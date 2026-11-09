/**
 * LIS import: preview (read-only) and commit. The browser never sends us a
 * "plan": on Confirm it sends the same file again and we rebuild the preview
 * from the database as it is now, so a tampered or stale preview can't be
 * committed.
 */

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { readLisCsv } from "@/lib/import/csv";
import { buildImportPreview, orderIdsIn, type ExistingOrder, type ImportPreview, type OrderPlan } from "@/lib/import/preview";
import { db } from "./db";
import { deliverSignoff } from "./delivery";
import { dispatchQueued } from "./outbox";

type PreviewResult = { ok: true; preview: ImportPreview; fingerprint: string } | { ok: false; error: string };

async function loadExistingOrders(orderIds: string[]): Promise<ExistingOrder[]> {
  if (orderIds.length === 0) return [];
  return db.order.findMany({
    where: { lisOrderId: { in: orderIds } },
    select: {
      lisOrderId: true,
      status: true,
      critical: true,
      referringDoctor: true,
      patient: { select: { name: true, mobile: true } },
      results: { select: { parameter: true, unit: true, valueText: true, refText: true, flag: true } },
    },
  });
}

/** A short hash of exactly what the commit would do. */
function fingerprintOf(plans: OrderPlan[]): string {
  return createHash("sha256").update(JSON.stringify(plans)).digest("hex");
}

export async function previewImport(csvText: string): Promise<PreviewResult> {
  const read = readLisCsv(csvText);
  if (!read.ok) return read;
  const existing = await loadExistingOrders(orderIdsIn(read.rows));
  const preview = buildImportPreview(read.rows, existing);
  return { ok: true, preview, fingerprint: fingerprintOf(preview.plans) };
}

export type CommitSummary = {
  ordersSaved: number;
  linksQueued: number;
  callbacksCreated: number;
  rejectedRows: number;
  /** Orders signed by someone else between preview and commit; left untouched. */
  skipped: number;
  /** Orders this import signed, for preparing their explanations afterwards. */
  signedOrderIds: string[];
};

type CommitResult = { ok: true; summary: CommitSummary } | { ok: false; error: string; stale?: boolean };

export async function commitImport(
  csvText: string,
  fileName: string,
  staffId: string,
  expectedFingerprint: string,
): Promise<CommitResult> {
  const result = await previewImport(csvText);
  if (!result.ok) return result;
  if (result.fingerprint !== expectedFingerprint) {
    return {
      ok: false,
      stale: true,
      error: "The data changed after you previewed this file. Please check the new preview before confirming.",
    };
  }

  const { preview } = result;
  const summary: CommitSummary = {
    ordersSaved: 0,
    linksQueued: 0,
    callbacksCreated: 0,
    rejectedRows: preview.counts.REJECTED,
    skipped: 0,
    signedOrderIds: [],
  };

  // One transaction per order: a failure in one order never half-saves it,
  // and never blocks the other orders in the file.
  for (const plan of preview.plans) {
    const outcome = await db.$transaction((tx) => commitOrder(tx, plan), { maxWait: 10_000, timeout: 20_000 });
    if (outcome === "skipped") {
      summary.skipped += 1;
      continue;
    }
    summary.ordersSaved += 1;
    if (outcome.sent) {
      summary.linksQueued += 1;
      summary.signedOrderIds.push(outcome.orderId);
    }
    if (outcome.callbackCreated) summary.callbacksCreated += 1;
  }

  await dispatchQueued();
  await db.importBatch.create({
    data: { fileName, rowCount: preview.rows.length, errorCount: preview.counts.REJECTED, createdById: staffId },
  });
  return { ok: true, summary };
}

async function commitOrder(tx: Prisma.TransactionClient, plan: OrderPlan) {
  const now = new Date();

  // Re-check inside the transaction: if the order was signed since the
  // preview, the "signed reports never change" rule still holds.
  const current = await tx.order.findUnique({ where: { lisOrderId: plan.lisOrderId }, select: { id: true, status: true } });

  if (plan.kind === "MARK_CRITICAL") {
    if (current?.status !== "READY") return "skipped" as const;
    await tx.order.update({ where: { id: current.id }, data: { critical: true } });
    const task = await tx.callbackTask.createMany({
      data: [{ orderId: current.id, reason: plan.callbackReason }],
      skipDuplicates: true,
    });
    return { sent: false, callbackCreated: task.count === 1, orderId: current.id };
  }

  if (current?.status === "READY") return "skipped" as const;

  const patient = await tx.patient.upsert({
    where: { mobile_name: { mobile: plan.mobile, name: plan.patientName } },
    create: { mobile: plan.mobile, name: plan.patientName },
    update: {},
  });

  const fields = {
    referringDoctor: plan.referringDoctor,
    status: plan.status,
    critical: plan.critical,
    ...(plan.signs ? { signedAt: now } : {}),
  };
  const order = await tx.order.upsert({
    where: { lisOrderId: plan.lisOrderId },
    create: { lisOrderId: plan.lisOrderId, patientId: patient.id, ...fields },
    update: fields,
  });

  for (const result of plan.results) {
    await tx.result.upsert({
      where: { orderId_parameter: { orderId: order.id, parameter: result.parameter } },
      create: { orderId: order.id, ...result },
      update: result,
    });
  }

  if (!plan.signs) return { sent: false, callbackCreated: false, orderId: order.id };
  const delivered = await deliverSignoff(
    tx,
    {
      id: order.id,
      lisOrderId: plan.lisOrderId,
      critical: plan.critical,
      mobile: plan.mobile,
      callbackReason: plan.callbackReason,
    },
    now,
  );
  return { ...delivered, orderId: order.id };
}
