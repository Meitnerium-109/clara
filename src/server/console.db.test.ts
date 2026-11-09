/**
 * Summaries and the front-desk console, against a real Postgres.
 * Only runs with RUN_DB_TESTS=1 (npm run test:db). Uses TEST-CN- orders and
 * placeholder mobiles, and removes everything it creates.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_TEXT, type AiSummarizer } from "@/lib/summaries/resolve";
import { generateLinkToken, linkExpiresAt } from "@/lib/tokens";
import { db } from "./db";
import { openLink } from "./reportLinks";
import { markCallbackDone, resendLink, revealCallbackNumber } from "./staffActions";
import { orderDetail, searchOrders } from "./staffData";
import { flagSummary, summariesForReport } from "./summaries";

const RUN = process.env.RUN_DB_TESTS === "1";
const MOBILE = "+919000000095";
const OTHER = "+919000000094";

let staffId = "";
const ids = { patient: "", other: "", order: "", critical: "", processing: "" };

async function cleanUp() {
  const orders = await db.order.findMany({ where: { lisOrderId: { startsWith: "TEST-CN-" } }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  await db.accessLog.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.callbackTask.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.reportLink.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.message.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { to: { in: [MOBILE, OTHER] } }] } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } }); // results and summaries cascade
  await db.patient.deleteMany({ where: { mobile: { in: [MOBILE, OTHER] } } });
}

async function reportFor(orderId: string) {
  return db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { critical: true, results: { select: { id: true, parameter: true, valueText: true, unit: true, refText: true, flag: true } } },
  });
}

const goodAi = (): AiSummarizer & ReturnType<typeof vi.fn> =>
  vi.fn(async (p) => JSON.stringify({ summary: `Your ${p.parameter} is ${p.valueText} ${p.unit}, which is outside the normal range. Your doctor will explain.` }));

describe.skipIf(!RUN)("summaries and console against the database", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.DEMO_MODE = "true";
    staffId = (await db.staffUser.findFirstOrThrow({ select: { id: true } })).id;
    await cleanUp();
    ids.patient = (await db.patient.create({ data: { mobile: MOBILE, name: "Test Console Patient" } })).id;
    ids.other = (await db.patient.create({ data: { mobile: OTHER, name: "Test Other Patient" } })).id;
    const result = (parameter: string, valueText: string, unit: string, refText: string, flag: "LOW" | "HIGH" | "NORMAL" | "CRITICAL_HIGH") => ({
      parameter, valueText, unit, refText, flag,
    });
    ids.order = (
      await db.order.create({
        data: {
          lisOrderId: "TEST-CN-1", patientId: ids.patient, referringDoctor: "Dr. Test", status: "READY", signedAt: new Date(),
          results: {
            create: [
              result("Haemoglobin", "10.2", "g/dL", "12.0-15.5", "LOW"), // template
              result("HDL cholesterol", "38", "mg/dL", ">40", "LOW"), // AI
              result("TSH", "2.2", "µIU/mL", "0.4-4.0", "NORMAL"), // nothing
            ],
          },
        },
      })
    ).id;
    ids.critical = (
      await db.order.create({
        data: {
          lisOrderId: "TEST-CN-2", patientId: ids.patient, referringDoctor: "Dr. Test", status: "READY", critical: true, signedAt: new Date(),
          results: { create: [result("Potassium", "6.8", "mmol/L", "3.5-5.1", "CRITICAL_HIGH"), result("Haemoglobin", "10.2", "g/dL", "12.0-15.5", "LOW")] },
          callbackTask: { create: { reason: "Potassium 6.8 mmol/L (critically high)" } },
        },
      })
    ).id;
    ids.processing = (
      await db.order.create({ data: { lisOrderId: "TEST-CN-3", patientId: ids.other, referringDoctor: "Dr. Test", status: "PROCESSING" } })
    ).id;
  });
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  describe("summaries", () => {
    beforeEach(async () => {
      await db.summary.deleteMany({ where: { result: { order: { lisOrderId: { startsWith: "TEST-CN-" } } } } });
    });

    it("uses the template for haemoglobin, AI for HDL, nothing for a normal TSH", async () => {
      const ai = goodAi();
      const shown = await summariesForReport(await reportFor(ids.order), "en", ai);
      const bySource = Object.values(shown).map((s) => s.source).sort();
      expect(bySource).toEqual(["AI", "TEMPLATE"]);
      expect(ai).toHaveBeenCalledTimes(1);
      expect(ai.mock.calls[0][0]).toMatchObject({ parameter: "HDL cholesterol", lang: "en" });
    });

    it("caches: a second view makes no AI call and adds no rows", async () => {
      const report = await reportFor(ids.order);
      await summariesForReport(report, "en", goodAi());
      const ai = goodAi();
      await summariesForReport(report, "en", ai);
      expect(ai).not.toHaveBeenCalled();
      expect(await db.summary.count({ where: { result: { orderId: ids.order } } })).toBe(2);
    });

    it("caches each language separately, generated on first request", async () => {
      const report = await reportFor(ids.order);
      await summariesForReport(report, "en", goodAi());
      const te = await summariesForReport(report, "te", goodAi());
      expect(Object.values(te).some((s) => /[ఀ-౿]/.test(s.text))).toBe(true); // the Telugu template
      expect(await db.summary.groupBy({ by: ["language"], where: { result: { orderId: ids.order } } })).toHaveLength(2);
    });

    it("gives no summary at all on a critical order", async () => {
      const ai = goodAi();
      expect(await summariesForReport(await reportFor(ids.critical), "en", ai)).toEqual({});
      expect(ai).not.toHaveBeenCalled();
      expect(await db.summary.count({ where: { result: { orderId: ids.critical } } })).toBe(0);
    });

    it("saves the fallback when the AI breaks the rules", async () => {
      const bad: AiSummarizer = async () => JSON.stringify({ summary: "Your HDL cholesterol is low because you have heart disease." });
      const shown = await summariesForReport(await reportFor(ids.order), "en", bad);
      const hdl = Object.values(shown).find((s) => s.source !== "TEMPLATE")!;
      expect(hdl).toMatchObject({ source: "FALLBACK", text: FALLBACK_TEXT.en });
      expect(hdl.id).not.toBeNull();
    });

    it("doesn't save the fallback after a timeout, so the next view tries again", async () => {
      const timeout: AiSummarizer = async () => {
        throw new Error("timeout");
      };
      const report = await reportFor(ids.order);
      const shown = await summariesForReport(report, "en", timeout);
      expect(Object.values(shown).find((s) => s.source === "FALLBACK")).toMatchObject({ id: null });
      const ai = goodAi();
      const retried = await summariesForReport(report, "en", ai);
      expect(ai).toHaveBeenCalledTimes(1);
      expect(Object.values(retried).map((s) => s.source).sort()).toEqual(["AI", "TEMPLATE"]);
    });

    it("two people opening the report at once still store one row per result", async () => {
      const report = await reportFor(ids.order);
      await Promise.all([summariesForReport(report, "hi", goodAi()), summariesForReport(report, "hi", goodAi())]);
      expect(await db.summary.count({ where: { result: { orderId: ids.order }, language: "HI" } })).toBe(2);
    });

    it("lets the owner flag an explanation with a note, logged; anyone else is refused", async () => {
      const shown = await summariesForReport(await reportFor(ids.order), "en", goodAi());
      const summaryId = Object.values(shown)[0].id!;
      expect(await flagSummary(OTHER, summaryId, "trying someone else's")).toBe(false);
      expect((await db.summary.findUniqueOrThrow({ where: { id: summaryId } })).flaggedAt).toBeNull();

      expect(await flagSummary(MOBILE, summaryId, "My doctor said this is fine")).toBe(true);
      const flagged = await db.summary.findUniqueOrThrow({ where: { id: summaryId } });
      expect(flagged.flaggedAt).not.toBeNull();
      expect(flagged.flagNote).toBe("My doctor said this is fine");
      expect(await db.accessLog.count({ where: { orderId: ids.order, action: "SUMMARY_FLAGGED" } })).toBe(1);
    });
  });

  describe("resend", () => {
    it("revokes the old link, sends a new one, and records who did it", async () => {
      const old = generateLinkToken();
      await db.reportLink.create({ data: { orderId: ids.order, tokenHash: old.tokenHash, reason: "SIGNOFF", expiresAt: linkExpiresAt(new Date()) } });
      expect((await openLink(old.token)).state).toBe("VALID");

      expect(await resendLink(ids.order, staffId)).toEqual({ ok: true, masked: "••••••0095" });

      expect((await openLink(old.token)).state).toBe("REVOKED");
      const links = await db.reportLink.findMany({ where: { orderId: ids.order }, orderBy: { createdAt: "desc" } });
      expect(links[0]).toMatchObject({ reason: "RESEND", createdById: staffId, revokedAt: null });
      const newToken = (await db.message.findFirstOrThrow({ where: { orderId: ids.order, kind: "REPORT_LINK" }, orderBy: { createdAt: "desc" } }))
        .body!.match(/\/r\/([A-Za-z0-9_-]{43})/)![1];
      expect((await openLink(newToken)).state).toBe("VALID");
      expect(await db.accessLog.count({ where: { orderId: ids.order, action: "LINK_RESENT", staffUserId: staffId } })).toBe(1);
    });

    it("refuses to resend an unsigned order", async () => {
      expect(await resendLink(ids.processing, staffId)).toEqual({ ok: false, reason: "NOT_SIGNED" });
      expect(await db.reportLink.count({ where: { orderId: ids.processing } })).toBe(0);
    });
  });

  describe("callbacks", () => {
    it("marks a callback done once, with who, when and the note, and logs it", async () => {
      const task = await db.callbackTask.findUniqueOrThrow({ where: { orderId: ids.critical } });
      expect(await markCallbackDone(task.id, staffId, "Spoke to patient")).toBe(true);
      expect(await markCallbackDone(task.id, staffId, "second click")).toBe(false);
      const done = await db.callbackTask.findUniqueOrThrow({ where: { id: task.id } });
      expect(done).toMatchObject({ status: "DONE", doneById: staffId, note: "Spoke to patient" });
      expect(await db.accessLog.count({ where: { orderId: ids.critical, action: "CALLBACK_DONE" } })).toBe(1);
    });

    it("logs every time a staff member reveals a full number", async () => {
      const task = await db.callbackTask.findUniqueOrThrow({ where: { orderId: ids.critical } });
      expect(await revealCallbackNumber(task.id, staffId)).toBe(MOBILE);
      expect(await db.accessLog.count({ where: { orderId: ids.critical, action: "STAFF_VIEWED_ORDER", staffUserId: staffId } })).toBe(1);
    });
  });

  describe("search and delivery status", () => {
    it.each([
      ["name, any case", "test console"],
      ["order ID", "test-cn-1"],
      ["last 4 digits of the mobile", "0095"],
      ["full mobile with spaces", "+91 90000 00095"],
      ["mobile with leading 0", "09000000095"],
    ])("finds an order by %s", async (_label, query) => {
      expect((await searchOrders(query)).map((o) => o.lisOrderId)).toContain("TEST-CN-1");
    });

    it("never returns full mobiles", async () => {
      for (const o of await searchOrders("0095")) expect(o.mobile).toMatch(/^••••••\d{4}$/);
    });

    it("doesn't match on fewer than 4 digits", async () => {
      expect((await searchOrders("95")).map((o) => o.lisOrderId)).not.toContain("TEST-CN-1");
    });

    it("shows Opened once the patient views the report after the latest link", async () => {
      await db.message.create({ data: { to: MOBILE, channel: "WHATSAPP", kind: "REPORT_LINK", status: "DELIVERED", orderId: ids.critical } });
      expect((await orderDetail(ids.critical))!.delivery).toBe("DELIVERED");
      await db.accessLog.create({ data: { actorType: "PATIENT", action: "REPORT_VIEWED", orderId: ids.critical } });
      expect((await orderDetail(ids.critical))!.delivery).toBe("OPENED");
    });

    it("shows Not signed for a processing order", async () => {
      expect((await orderDetail(ids.processing))!.delivery).toBe("NOT_SIGNED");
    });
  });
});
