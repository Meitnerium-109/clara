import { checkLink, hashToken, isWellFormedToken, type LinkCheck } from "@/lib/tokens";
import { db } from "./db";

export type OpenedLink =
  | { state: Exclude<LinkCheck, "VALID"> }
  | { state: "VALID"; orderId: string; patientId: string; mobile: string };

/** Looks a link up by the hash of its token; the raw token is never stored or logged. */
export async function openLink(token: string, now = new Date()): Promise<OpenedLink> {
  if (!isWellFormedToken(token)) return { state: "NOT_FOUND" };
  const link = await db.reportLink.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      order: { select: { id: true, patient: { select: { id: true, mobile: true } } } },
    },
  });
  const state = checkLink(link, now);
  if (state !== "VALID" || !link) return { state: state === "VALID" ? "NOT_FOUND" : state };
  return { state, orderId: link.order.id, patientId: link.order.patient.id, mobile: link.order.patient.mobile };
}
