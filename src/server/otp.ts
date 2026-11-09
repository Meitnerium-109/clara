/**
 * Sending and checking one-time codes. The rules live in src/lib/otp.ts; this
 * file applies them against the database in a way that holds up when requests
 * arrive at the same time.
 */

import { randomUUID } from "node:crypto";
import { otpMessage } from "@/lib/messages";
import {
  canSendOtp,
  challengeState,
  generateOtp,
  hashOtp,
  isWellFormedOtp,
  OTP_MAX_ATTEMPTS,
  OTP_SEND_WINDOW_MS,
  OTP_TTL_MS,
  otpKey,
  otpMatches,
} from "@/lib/otp";
import { sessionKey } from "@/lib/session";
import { logAccess } from "./accessLog";
import { isDemoMode } from "./config";
import { db } from "./db";

const key = () => otpKey(sessionKey(process.env.SESSION_SECRET));

type Context = { orderId?: string; patientId?: string };

export type SendResult = { ok: true } | { ok: false; reason: "RATE_LIMITED"; retryInMinutes: number };

export async function sendOtp(mobile: string, context: Context = {}): Promise<SendResult> {
  const now = new Date();
  const recent = await db.otpChallenge.findMany({
    where: { mobile, createdAt: { gt: new Date(now.getTime() - OTP_SEND_WINDOW_MS) } },
    select: { createdAt: true },
  });
  const decision = canSendOtp(
    recent.map((c) => c.createdAt),
    now,
  );
  if (!decision.allowed) {
    return { ok: false, reason: "RATE_LIMITED", retryInMinutes: Math.ceil((decision.retryAt.getTime() - now.getTime()) / 60_000) };
  }

  const code = generateOtp();
  const id = randomUUID(); // chosen here so the hash can include it
  await db.$transaction([
    db.otpChallenge.create({
      data: { id, mobile, codeHash: hashOtp(code, id, key()), expiresAt: new Date(now.getTime() + OTP_TTL_MS), createdAt: now },
    }),
    db.message.create({
      data: { to: mobile, channel: "SMS", kind: "OTP", body: isDemoMode() ? otpMessage(code) : null, orderId: context.orderId },
    }),
  ]);
  await logAccess({ actorType: "PATIENT", action: "OTP_SENT", ...context });
  return { ok: true };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "FORMAT" | "NO_CODE" | "EXPIRED" | "LOCKED" }
  | { ok: false; reason: "WRONG"; attemptsLeft: number };

/**
 * Checks a code against the newest challenge for this mobile (sending a new
 * code makes older ones useless).
 *
 * Safe under concurrent requests:
 *  1. An attempt is "claimed" with one conditional UPDATE (attempts + 1 only
 *     while unused, unexpired and under 5). Parallel guesses can't exceed 5.
 *  2. A correct code is "spent" with another conditional UPDATE (only while
 *     unused). Two tabs submitting the same code: exactly one wins.
 */
export async function verifyOtp(mobile: string, code: string, context: Context = {}): Promise<VerifyResult> {
  if (!isWellFormedOtp(code)) return { ok: false, reason: "FORMAT" };
  const now = new Date();

  const challenge = await db.otpChallenge.findFirst({ where: { mobile }, orderBy: { createdAt: "desc" } });
  if (!challenge) return fail("NO_CODE");

  const state = challengeState(challenge, now);
  if (state !== "ACTIVE") return fail(state === "USED" ? "NO_CODE" : state);

  const claimed = await db.otpChallenge.updateMany({
    where: { id: challenge.id, usedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS }, expiresAt: { gt: now } },
    data: { attempts: { increment: 1 } },
  });
  if (claimed.count === 0) {
    // Lost a race with another request: say why, based on the row as it is now.
    const latest = await db.otpChallenge.findUnique({ where: { id: challenge.id } });
    const current = latest ? challengeState(latest, now) : "USED";
    return fail(current === "EXPIRED" || current === "LOCKED" ? current : "NO_CODE");
  }

  if (!otpMatches(code, challenge.id, challenge.codeHash, key())) {
    const left = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
    await logAccess({ actorType: "PATIENT", action: "OTP_FAILED", ...context });
    return left <= 0 ? { ok: false, reason: "LOCKED" } : { ok: false, reason: "WRONG", attemptsLeft: left };
  }

  const spent = await db.otpChallenge.updateMany({ where: { id: challenge.id, usedAt: null }, data: { usedAt: now } });
  if (spent.count === 0) return fail("NO_CODE");

  await logAccess({ actorType: "PATIENT", action: "OTP_VERIFIED", ...context });
  return { ok: true };

  async function fail(reason: "NO_CODE" | "EXPIRED" | "LOCKED"): Promise<VerifyResult> {
    await logAccess({ actorType: "PATIENT", action: "OTP_FAILED", ...context });
    return { ok: false, reason };
  }
}
