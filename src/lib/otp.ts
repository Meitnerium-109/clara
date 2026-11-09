/**
 * One-time codes: the link proves which report, the code proves the person
 * holds the phone right now.
 *
 * Rules: 6 digits from the OS's secure generator; stored only as a keyed
 * hash; valid for 5 minutes; 5 attempts, then locked; usable once; at most 3
 * codes per mobile per 15 minutes.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_SENDS = 3;
export const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function isWellFormedOtp(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/**
 * HMAC with a server secret, not a plain hash: there are only a million
 * 6-digit codes, so a plain SHA-256 could be reversed instantly by anyone who
 * saw the database. The challenge id is mixed in so equal codes hash differently.
 */
export function hashOtp(code: string, challengeId: string, key: Uint8Array): string {
  return createHmac("sha256", key).update(`${challengeId}:${code}`).digest("hex");
}

/** Compares in constant time, so response timing reveals nothing about the code. */
export function otpMatches(code: string, challengeId: string, storedHash: string, key: Uint8Array): boolean {
  if (!isWellFormedOtp(code)) return false;
  const actual = Buffer.from(hashOtp(code, challengeId, key), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A separate key derived from the session secret, so one secret never does two jobs directly. */
export function otpKey(secret: Uint8Array): Uint8Array {
  return createHmac("sha256", secret).update("clara-otp-v1").digest();
}

export type ChallengeState = "ACTIVE" | "USED" | "LOCKED" | "EXPIRED";

export function challengeState(
  challenge: { expiresAt: Date; attempts: number; usedAt: Date | null },
  now: Date,
): ChallengeState {
  if (challenge.usedAt) return "USED";
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return "LOCKED";
  if (now >= challenge.expiresAt) return "EXPIRED";
  return "ACTIVE";
}

export function attemptsLeft(attemptsUsed: number): number {
  return Math.max(0, OTP_MAX_ATTEMPTS - attemptsUsed);
}

export type SendDecision = { allowed: true } | { allowed: false; retryAt: Date };

/** Given when recent codes were sent to this mobile, may we send another now? */
export function canSendOtp(sentAt: Date[], now: Date): SendDecision {
  const windowStart = now.getTime() - OTP_SEND_WINDOW_MS;
  const recent = sentAt.map((d) => d.getTime()).filter((t) => t > windowStart).sort((a, b) => a - b);
  if (recent.length < OTP_MAX_SENDS) return { allowed: true };
  // The oldest of the recent sends leaving the window frees one slot.
  return { allowed: false, retryAt: new Date(recent[recent.length - OTP_MAX_SENDS] + OTP_SEND_WINDOW_MS) };
}
