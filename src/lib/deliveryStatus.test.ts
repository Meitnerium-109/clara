import { describe, expect, it } from "vitest";
import { deliveryStage, needsAttention } from "./deliveryStatus";

const sentAt = new Date("2026-11-09T10:00:00Z");
const msg = (status: "QUEUED" | "SENT" | "DELIVERED" | "FAILED") => ({ status, createdAt: sentAt });

describe("deliveryStage", () => {
  it("is NOT_SIGNED while the order is processing", () => {
    expect(deliveryStage({ orderStatus: "PROCESSING", latestMessage: null, latestViewAt: null })).toBe("NOT_SIGNED");
  });

  it("is NO_MESSAGE for a signed order without a link message", () => {
    expect(deliveryStage({ orderStatus: "READY", latestMessage: null, latestViewAt: null })).toBe("NO_MESSAGE");
  });

  it.each(["QUEUED", "SENT", "DELIVERED", "FAILED"] as const)("follows the message status: %s", (status) => {
    expect(deliveryStage({ orderStatus: "READY", latestMessage: msg(status), latestViewAt: null })).toBe(status);
  });

  it("is OPENED once the patient viewed the report after the latest link", () => {
    expect(deliveryStage({ orderStatus: "READY", latestMessage: msg("DELIVERED"), latestViewAt: new Date("2026-11-09T11:00:00Z") })).toBe("OPENED");
  });

  it("ignores views from before a resend: the new link isn't opened yet", () => {
    expect(deliveryStage({ orderStatus: "READY", latestMessage: msg("SENT"), latestViewAt: new Date("2026-11-09T09:00:00Z") })).toBe("SENT");
  });

  it("flags only the stages staff should act on", () => {
    expect(needsAttention("NO_MESSAGE")).toBe(true);
    expect(needsAttention("FAILED")).toBe(true);
    expect(needsAttention("OPENED")).toBe(false);
    expect(needsAttention("SENT")).toBe(false);
  });
});
