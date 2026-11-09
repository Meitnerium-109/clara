/**
 * Things front-desk staff change. Each takes the staff member's ID, so every
 * change is recorded against a person in the access log.
 */

import { reportLinkUrl, reportReadyMessage } from "@/lib/messages";
import { maskMobile } from "@/lib/mobile";
import { generateLinkToken, linkExpiresAt } from "@/lib/tokens";
import { logAccess } from "./accessLog";
import { appUrl, isDemoMode } from "./config";
import { db } from "./db";
import { dispatchQueued } from "./outbox";

export type ResendResult = { ok: true; masked: string } | { ok: false; reason: "NOT_FOUND" | "NOT_SIGNED" };

/**
 * Revokes every live link for the order and sends a fresh one to the mobile on
 * file, all in one transaction. The number itself can't be changed here: a
 * wrong number is fixed in the LIS, and the masked number is shown so staff
 * can spot it.
 */
export async function resendLink(orderId: string, staffId: string): Promise<ResendResult> {
  const now = new Date();
  const { token, tokenHash } = generateLinkToken();

  const result = await db.$transaction(async (tx): Promise<ResendResult> => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, patient: { select: { id: true, mobile: true } } },
    });
    if (!order) return { ok: false, reason: "NOT_FOUND" };
    if (order.status !== "READY") return { ok: false, reason: "NOT_SIGNED" };

    await tx.reportLink.updateMany({ where: { orderId, revokedAt: null }, data: { revokedAt: now } });
    await tx.reportLink.create({
      data: { orderId, tokenHash, reason: "RESEND", expiresAt: linkExpiresAt(now), createdAt: now, createdById: staffId },
    });
    await tx.message.create({
      data: {
        to: order.patient.mobile,
        channel: "WHATSAPP",
        kind: "REPORT_LINK",
        body: isDemoMode() ? reportReadyMessage(reportLinkUrl(appUrl(), token)) : null,
        orderId,
        createdAt: now,
      },
    });
    await tx.accessLog.create({
      data: { actorType: "STAFF", action: "LINK_RESENT", staffUserId: staffId, orderId, patientId: order.patient.id },
    });
    return { ok: true, masked: maskMobile(order.patient.mobile) };
  });

  if (result.ok) await dispatchQueued();
  return result;
}

/** Marks a critical callback as done, once. A second click (or second person) changes nothing. */
export async function markCallbackDone(taskId: string, staffId: string, note: string | null): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const task = await tx.callbackTask.findUnique({ where: { id: taskId }, select: { orderId: true, order: { select: { patientId: true } } } });
    if (!task) return false;
    const { count } = await tx.callbackTask.updateMany({
      where: { id: taskId, status: "OPEN" },
      data: { status: "DONE", doneById: staffId, doneAt: new Date(), note },
    });
    if (count === 0) return false;
    await tx.accessLog.create({
      data: { actorType: "STAFF", action: "CALLBACK_DONE", staffUserId: staffId, orderId: task.orderId, patientId: task.order.patientId },
    });
    return true;
  });
}

/** The full number, only when a staff member asks for it to make a call, and logged. */
export async function revealCallbackNumber(taskId: string, staffId: string): Promise<string | null> {
  const task = await db.callbackTask.findUnique({
    where: { id: taskId },
    select: { orderId: true, order: { select: { patient: { select: { id: true, mobile: true } } } } },
  });
  if (!task) return null;
  await logAccess({ actorType: "STAFF", action: "STAFF_VIEWED_ORDER", staffUserId: staffId, orderId: task.orderId, patientId: task.order.patient.id });
  return task.order.patient.mobile;
}

export async function logStaffView(orderId: string, staffId: string): Promise<void> {
  await logAccess({ actorType: "STAFF", action: "STAFF_VIEWED_ORDER", staffUserId: staffId, orderId });
}
