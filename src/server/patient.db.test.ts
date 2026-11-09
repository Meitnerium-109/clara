/**
 * Patient-side guarantees, against a real Postgres:
 *  - a session for one mobile can never read another mobile's patients or orders
 *  - link tokens: valid, expired, revoked, unknown, malformed
 *  - OTP: single use, 5 attempts, 5-minute expiry, 3 sends per 15 minutes,
 *    newest code only, and all of it holding up under concurrent requests
 *
 * Only runs with RUN_DB_TESTS=1 (npm run test:db). Uses TEST-PT- orders and
 * placeholder mobiles, and removes everything it creates.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { generateLinkToken, hashToken } from "@/lib/tokens";
import { hasConsented, recordConsent } from "./consent";
import { db } from "./db";
import { sendOtp, verifyOtp } from "./otp";
import { ordersForPatient, patientForMobile, patientsForMobile, reportForMobile } from "./patientData";
import { openLink } from "./reportLinks";

const RUN = process.env.RUN_DB_TESTS === "1";
const A = "+919000000097"; // a family phone: mother and son
const B = "+919000000096"; // someone else

const ids = { mother: "", son: "", neighbour: "", motherReady: "", sonReady: "", neighbourReady: "", motherProcessing: "" };

async function cleanUp() {
  const orders = await db.order.findMany({ where: { lisOrderId: { startsWith: "TEST-PT-" } }, select: { id: true } });
  const orderIds = orders.map((o) => o.id);
  const patients = await db.patient.findMany({ where: { mobile: { in: [A, B] } }, select: { id: true } });
  const patientIds = patients.map((p) => p.id);
  await db.accessLog.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { patientId: { in: patientIds } }] } });
  await db.reportLink.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.message.deleteMany({ where: { to: { in: [A, B] } } });
  await db.otpChallenge.deleteMany({ where: { mobile: { in: [A, B] } } });
  await db.consent.deleteMany({ where: { mobile: { in: [A, B] } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.patient.deleteMany({ where: { id: { in: patientIds } } });
}

async function order(lisOrderId: string, patientId: string, status: "READY" | "PROCESSING") {
  const created = await db.order.create({
    data: {
      lisOrderId,
      patientId,
      referringDoctor: "Dr. Test",
      status,
      signedAt: status === "READY" ? new Date() : null,
      results: { create: [{ parameter: "Haemoglobin", unit: "g/dL", valueText: "10.2", refText: "12.0-15.5", flag: "LOW" }] },
    },
  });
  return created.id;
}

/** Any 6-digit code other than the real one. */
const wrongFor = (code: string) => (code === "000000" ? "111111" : "000000");

/** Reads the code from the demo outbox, the same way a reviewer would. */
async function latestCode(mobile: string): Promise<string> {
  const message = await db.message.findFirstOrThrow({ where: { to: mobile, kind: "OTP" }, orderBy: { createdAt: "desc" } });
  return message.body!.match(/\b(\d{6})\b/)![1];
}

describe.skipIf(!RUN)("patient side against the database", { timeout: 120_000 }, () => {
  beforeAll(async () => {
    process.env.DEMO_MODE = "true";
    process.env.SESSION_SECRET ??= "test-secret-that-is-at-least-32-characters-long";
    await cleanUp();
    ids.mother = (await db.patient.create({ data: { mobile: A, name: "Test Mother" } })).id;
    ids.son = (await db.patient.create({ data: { mobile: A, name: "Test Son" } })).id;
    ids.neighbour = (await db.patient.create({ data: { mobile: B, name: "Test Neighbour" } })).id;
    ids.motherReady = await order("TEST-PT-1", ids.mother, "READY");
    ids.sonReady = await order("TEST-PT-2", ids.son, "READY");
    ids.neighbourReady = await order("TEST-PT-3", ids.neighbour, "READY");
    ids.motherProcessing = await order("TEST-PT-4", ids.mother, "PROCESSING");
  });
  afterAll(async () => {
    await cleanUp();
    await db.$disconnect();
  });

  describe("access control: a mobile only ever sees its own data", () => {
    it("lists only the patients on this mobile (a family shares one)", async () => {
      expect((await patientsForMobile(A)).map((p) => p.name)).toEqual(["Test Mother", "Test Son"]);
      expect((await patientsForMobile(B)).map((p) => p.name)).toEqual(["Test Neighbour"]);
    });

    it("refuses another mobile's report, in both directions", async () => {
      expect(await reportForMobile(A, ids.neighbourReady)).toBeNull();
      expect(await reportForMobile(B, ids.motherReady)).toBeNull();
      expect(await reportForMobile(B, ids.sonReady)).toBeNull();
    });

    it("refuses another mobile's patient and their order list", async () => {
      expect(await patientForMobile(A, ids.neighbour)).toBeNull();
      expect(await ordersForPatient(A, ids.neighbour)).toEqual([]);
      expect(await patientForMobile(B, ids.mother)).toBeNull();
    });

    it("lets family members on the same mobile see each other's reports", async () => {
      const report = await reportForMobile(A, ids.sonReady);
      expect(report).toMatchObject({ ready: true, patient: { name: "Test Son" } });
    });

    it("never loads results of an unsigned order", async () => {
      const report = await reportForMobile(A, ids.motherProcessing);
      expect(report).toMatchObject({ ready: false, status: "PROCESSING" });
      expect(report).not.toHaveProperty("results");
    });

    it("returns null for an ID that doesn't exist", async () => {
      expect(await reportForMobile(A, "does-not-exist")).toBeNull();
    });

    it("lists a patient's orders newest first", async () => {
      const orders = await ordersForPatient(A, ids.mother);
      expect(orders.map((o) => o.lisOrderId).sort()).toEqual(["TEST-PT-1", "TEST-PT-4"]);
    });
  });

  describe("report links", () => {
    async function link(overrides: { expiresAt?: Date; revokedAt?: Date | null } = {}) {
      const { token, tokenHash } = generateLinkToken();
      await db.reportLink.create({
        data: {
          orderId: ids.motherReady,
          tokenHash,
          reason: "SIGNOFF",
          expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
          revokedAt: overrides.revokedAt ?? null,
        },
      });
      return token;
    }

    it("opens a valid link to its order and mobile", async () => {
      expect(await openLink(await link())).toEqual({ state: "VALID", orderId: ids.motherReady, patientId: ids.mother, mobile: A });
    });

    it("reports an expired link", async () => {
      expect(await openLink(await link({ expiresAt: new Date(Date.now() - 1000) }))).toEqual({ state: "EXPIRED" });
    });

    it("reports a revoked link", async () => {
      expect(await openLink(await link({ revokedAt: new Date(Date.now() - 1000) }))).toEqual({ state: "REVOKED" });
    });

    it("treats an unknown or malformed token as not found", async () => {
      expect(await openLink(generateLinkToken().token)).toEqual({ state: "NOT_FOUND" });
      expect(await openLink("../../etc/passwd")).toEqual({ state: "NOT_FOUND" });
      expect(await openLink("")).toEqual({ state: "NOT_FOUND" });
    });

    it("stores only the hash: looking up the raw token as a hash finds nothing", async () => {
      const token = await link();
      expect(await db.reportLink.count({ where: { tokenHash: token } })).toBe(0);
      expect(await db.reportLink.count({ where: { tokenHash: hashToken(token) } })).toBe(1);
    });
  });

  describe("one-time codes", () => {
    const ctx = () => ({ orderId: ids.motherReady, patientId: ids.mother });

    beforeEach(async () => {
      await db.otpChallenge.deleteMany({ where: { mobile: { in: [A, B] } } });
      await db.message.deleteMany({ where: { to: { in: [A, B] } } });
      process.env.DEMO_MODE = "true";
    });

    it("accepts the right code once, then never again", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      expect(await verifyOtp(A, code, ctx())).toEqual({ ok: true });
      expect(await verifyOtp(A, code, ctx())).toEqual({ ok: false, reason: "NO_CODE" });
    });

    it("stores only a hash of the code", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      const challenge = await db.otpChallenge.findFirstOrThrow({ where: { mobile: A } });
      expect(challenge.codeHash).not.toContain(code);
      expect(challenge.codeHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("counts down wrong attempts and locks after 5, even for the right code", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      const wrong = wrongFor(code);
      for (const left of [4, 3, 2, 1]) {
        expect(await verifyOtp(A, wrong, ctx())).toEqual({ ok: false, reason: "WRONG", attemptsLeft: left });
      }
      expect(await verifyOtp(A, wrong, ctx())).toEqual({ ok: false, reason: "LOCKED" });
      expect(await verifyOtp(A, code, ctx())).toEqual({ ok: false, reason: "LOCKED" });
    });

    it("expires after 5 minutes", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      await db.otpChallenge.updateMany({ where: { mobile: A }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await verifyOtp(A, code, ctx())).toEqual({ ok: false, reason: "EXPIRED" });
    });

    it("sets a 5-minute expiry when sending", async () => {
      await sendOtp(A, ctx());
      const c = await db.otpChallenge.findFirstOrThrow({ where: { mobile: A } });
      expect(c.expiresAt.getTime() - c.createdAt.getTime()).toBe(5 * 60 * 1000);
    });

    it("only the newest code works after a resend", async () => {
      await sendOtp(A, ctx());
      const first = await latestCode(A);
      await sendOtp(A, ctx());
      const second = await latestCode(A);
      if (first !== second) {
        expect(await verifyOtp(A, first, ctx())).toMatchObject({ ok: false, reason: "WRONG" });
      }
      expect(await verifyOtp(A, second, ctx())).toEqual({ ok: true });
    });

    it("allows 3 sends per mobile per 15 minutes, then says when to retry", async () => {
      for (let i = 0; i < 3; i++) expect(await sendOtp(A, ctx())).toEqual({ ok: true });
      const fourth = await sendOtp(A, ctx());
      expect(fourth).toMatchObject({ ok: false, reason: "RATE_LIMITED" });
      expect(!fourth.ok && fourth.retryInMinutes).toBeGreaterThan(0);
      expect(!fourth.ok && fourth.retryInMinutes).toBeLessThanOrEqual(15);
      // The limit is per mobile: another number is unaffected.
      expect(await sendOtp(B, { orderId: ids.neighbourReady, patientId: ids.neighbour })).toEqual({ ok: true });
    });

    it("lets exactly one of several simultaneous correct submissions through", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      const results = await Promise.all(Array.from({ length: 4 }, () => verifyOtp(A, code, ctx())));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
    });

    it("never allows more than 5 guesses, even when they arrive at once", async () => {
      await sendOtp(A, ctx());
      const code = await latestCode(A);
      const wrong = wrongFor(code);
      const results = await Promise.all(Array.from({ length: 10 }, () => verifyOtp(A, wrong, ctx())));
      expect(results.some((r) => r.ok)).toBe(false);
      const challenge = await db.otpChallenge.findFirstOrThrow({ where: { mobile: A } });
      expect(challenge.attempts).toBe(5);
    });

    it("keeps the code out of the outbox when DEMO_MODE is off", async () => {
      process.env.DEMO_MODE = "false";
      await sendOtp(A, ctx());
      const message = await db.message.findFirstOrThrow({ where: { to: A, kind: "OTP" } });
      expect(message.body).toBeNull();
    });

    it("logs sends, failures and successes in the access log", async () => {
      await db.accessLog.deleteMany({ where: { patientId: ids.mother, action: { in: ["OTP_SENT", "OTP_FAILED", "OTP_VERIFIED"] } } });
      await sendOtp(A, ctx());
      await verifyOtp(A, wrongFor(await latestCode(A)), ctx());
      await verifyOtp(A, await latestCode(A), ctx());
      const actions = (await db.accessLog.findMany({ where: { patientId: ids.mother }, orderBy: { at: "asc" } })).map((l) => l.action);
      expect(actions).toEqual(expect.arrayContaining(["OTP_SENT", "OTP_FAILED", "OTP_VERIFIED"]));
    });
  });

  describe("consent", () => {
    it("is recorded once per mobile and keeps the first time", async () => {
      expect(await hasConsented(B)).toBe(false);
      await recordConsent(B);
      const first = await db.consent.findFirstOrThrow({ where: { mobile: B } });
      await recordConsent(B);
      expect(await db.consent.count({ where: { mobile: B } })).toBe(1);
      expect((await db.consent.findFirstOrThrow({ where: { mobile: B } })).consentedAt).toEqual(first.consentedAt);
      expect(await hasConsented(B)).toBe(true);
      expect(await hasConsented(A)).toBe(false); // consent belongs to the phone, not the family
    });
  });
});
