/**
 * Sign-off delivery: when an order is signed, the patient gets exactly one
 * report link. "Exactly one" is enforced by the database, not by our code
 * being careful:
 *
 *   The message is inserted first with ON CONFLICT DO NOTHING on its unique
 *   dedupe key ("signoff:ORD-71204"). If another import, a double click or a
 *   re-run got there first, the insert affects 0 rows and we stop, before
 *   any link or task is created. Two transactions racing for the same key are
 *   queued by Postgres's unique index, so only one can ever insert it.
 *
 * Link, message and callback task are written in one transaction: all or nothing.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { callbackReason, reportLinkUrl, reportReadyMessage, signoffDedupeKey } from "@/lib/messages";
import { generateLinkToken, linkExpiresAt } from "@/lib/tokens";
import { appUrl, isDemoMode } from "./config";
import { dispatchQueued } from "./outbox";

export type SignedOrder = {
  id: string;
  lisOrderId: string;
  critical: boolean;
  mobile: string;
  callbackReason: string;
};

export type DeliveryResult = { sent: boolean; callbackCreated: boolean };

/** Call inside a transaction, right after the order is saved as READY. */
export async function deliverSignoff(
  tx: Prisma.TransactionClient,
  order: SignedOrder,
  now = new Date(),
): Promise<DeliveryResult> {
  const { token, tokenHash } = generateLinkToken();

  const { count } = await tx.message.createMany({
    data: [
      {
        to: order.mobile,
        channel: "WHATSAPP",
        kind: "REPORT_LINK",
        // The body holds the raw link. Outside demo mode we don't keep it,
        // so stored messages can't be replayed into working links.
        body: isDemoMode() ? reportReadyMessage(reportLinkUrl(appUrl(), token)) : null,
        orderId: order.id,
        dedupeKey: signoffDedupeKey(order.lisOrderId),
      },
    ],
    skipDuplicates: true, // ON CONFLICT DO NOTHING
  });
  if (count === 0) return { sent: false, callbackCreated: false };

  await tx.reportLink.create({
    data: { orderId: order.id, tokenHash, reason: "SIGNOFF", expiresAt: linkExpiresAt(now), createdAt: now },
  });

  let callbackCreated = false;
  if (order.critical) {
    const task = await tx.callbackTask.createMany({
      data: [{ orderId: order.id, reason: order.callbackReason }],
      skipDuplicates: true, // one task per order, also guarded by a unique index
    });
    callbackCreated = task.count === 1;
  }
  return { sent: true, callbackCreated };
}

/**
 * Delivers every signed order that has no report link message yet, e.g. the
 * seeded Ready orders. Safe to run any number of times.
 */
export async function deliverPendingSignoffs(client: PrismaClient) {
  const pending = await client.order.findMany({
    where: { status: "READY", messages: { none: { kind: "REPORT_LINK" } } },
    select: {
      id: true,
      lisOrderId: true,
      critical: true,
      patient: { select: { mobile: true } },
      results: { select: { parameter: true, valueText: true, unit: true, flag: true } },
    },
    orderBy: { lisOrderId: "asc" },
  });

  let sent = 0;
  let callbacks = 0;
  for (const order of pending) {
    const result = await client.$transaction((tx) =>
      deliverSignoff(tx, {
        id: order.id,
        lisOrderId: order.lisOrderId,
        critical: order.critical,
        mobile: order.patient.mobile,
        callbackReason: callbackReason(order.results),
      }),
    );
    if (result.sent) sent += 1;
    if (result.callbackCreated) callbacks += 1;
  }
  await dispatchQueued(client);
  return { sent, callbacks };
}
