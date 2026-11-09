/**
 * What front-desk staff see for an order's report link:
 *   Not signed → Queued → Sent → Delivered → Opened (or Failed).
 * "Opened" means the patient viewed the report after the latest link was
 * sent; it comes from the access log, not from the message provider.
 */

export type DeliveryStage = "NOT_SIGNED" | "NO_MESSAGE" | "QUEUED" | "SENT" | "DELIVERED" | "FAILED" | "OPENED";

type Input = {
  orderStatus: "PROCESSING" | "READY";
  latestMessage: { status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED"; createdAt: Date } | null;
  latestViewAt: Date | null;
};

export function deliveryStage({ orderStatus, latestMessage, latestViewAt }: Input): DeliveryStage {
  if (orderStatus === "PROCESSING") return "NOT_SIGNED";
  if (!latestMessage) return "NO_MESSAGE";
  if (latestViewAt && latestViewAt >= latestMessage.createdAt) return "OPENED";
  return latestMessage.status;
}

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  NOT_SIGNED: "Not signed yet",
  NO_MESSAGE: "No link sent",
  QUEUED: "Queued",
  SENT: "Sent",
  DELIVERED: "Delivered",
  FAILED: "Failed",
  OPENED: "Opened",
};

/** Stages where staff may need to act (resend, or check the number). */
export function needsAttention(stage: DeliveryStage): boolean {
  return stage === "NO_MESSAGE" || stage === "FAILED";
}
