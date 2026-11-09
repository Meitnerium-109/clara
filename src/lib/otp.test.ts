import { describe, expect, it } from "vitest";
import {
  attemptsLeft,
  canSendOtp,
  challengeState,
  generateOtp,
  hashOtp,
  isWellFormedOtp,
  OTP_MAX_ATTEMPTS,
  otpKey,
  otpMatches,
} from "./otp";

const key = otpKey(new TextEncoder().encode("test-secret-that-is-at-least-32-characters-long"));
const otherKey = otpKey(new TextEncoder().encode("another-secret-that-is-at-least-32-characters"));

describe("generateOtp", () => {
  it("is always exactly 6 digits, including leading zeros", () => {
    for (let i = 0; i < 2000; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("varies", () => {
    expect(new Set(Array.from({ length: 200 }, generateOtp)).size).toBeGreaterThan(190);
  });
});

describe("isWellFormedOtp", () => {
  it.each(["123456", "000000"])("accepts %s", (c) => expect(isWellFormedOtp(c)).toBe(true));
  it.each(["", "12345", "1234567", "12345a", " 123456", "12 3456", "１２３４５６"])("rejects %j", (c) =>
    expect(isWellFormedOtp(c)).toBe(false),
  );
});

describe("hashing and matching", () => {
  it("never stores the code itself", () => {
    const hash = hashOtp("123456", "challenge-1", key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("123456");
  });

  it("matches the right code for the right challenge", () => {
    const hash = hashOtp("123456", "challenge-1", key);
    expect(otpMatches("123456", "challenge-1", hash, key)).toBe(true);
  });

  it("rejects a wrong code", () => {
    expect(otpMatches("123457", "challenge-1", hashOtp("123456", "challenge-1", key), key)).toBe(false);
  });

  it("ties the hash to its challenge: the same code on another challenge fails", () => {
    expect(otpMatches("123456", "challenge-2", hashOtp("123456", "challenge-1", key), key)).toBe(false);
  });

  it("needs the server key: a hash made with another key never matches", () => {
    expect(otpMatches("123456", "challenge-1", hashOtp("123456", "challenge-1", otherKey), key)).toBe(false);
  });

  it("rejects malformed input and a corrupted stored hash without throwing", () => {
    const hash = hashOtp("123456", "c", key);
    expect(otpMatches("12345", "c", hash, key)).toBe(false);
    expect(otpMatches("123456", "c", "not-hex", key)).toBe(false);
    expect(otpMatches("123456", "c", hash.slice(0, 10), key)).toBe(false);
  });
});

describe("challengeState", () => {
  const now = new Date("2026-11-09T10:00:00Z");
  const fresh = { expiresAt: new Date("2026-11-09T10:04:00Z"), attempts: 0, usedAt: null };

  it("is ACTIVE when fresh", () => expect(challengeState(fresh, now)).toBe("ACTIVE"));
  it("is ACTIVE with 4 attempts used", () => expect(challengeState({ ...fresh, attempts: 4 }, now)).toBe("ACTIVE"));
  it("is LOCKED after 5 attempts", () =>
    expect(challengeState({ ...fresh, attempts: OTP_MAX_ATTEMPTS }, now)).toBe("LOCKED"));
  it("is EXPIRED at the expiry instant", () => expect(challengeState(fresh, fresh.expiresAt)).toBe("EXPIRED"));
  it("is USED once used, whatever else is true", () =>
    expect(challengeState({ ...fresh, usedAt: now, attempts: 9 }, new Date("2030-01-01"))).toBe("USED"));
  it("reports LOCKED over EXPIRED", () =>
    expect(challengeState({ ...fresh, attempts: 5 }, new Date("2030-01-01"))).toBe("LOCKED"));
});

describe("attemptsLeft", () => {
  it.each([
    [0, 5],
    [4, 1],
    [5, 0],
    [7, 0],
  ])("%d used → %d left", (used, left) => expect(attemptsLeft(used)).toBe(left));
});

describe("canSendOtp (3 per mobile per 15 minutes)", () => {
  const now = new Date("2026-11-09T10:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("allows the first three", () => {
    expect(canSendOtp([], now)).toEqual({ allowed: true });
    expect(canSendOtp([minutesAgo(1), minutesAgo(2)], now)).toEqual({ allowed: true });
  });

  it("blocks the fourth and says when to retry", () => {
    expect(canSendOtp([minutesAgo(1), minutesAgo(5), minutesAgo(10)], now)).toEqual({
      allowed: false,
      retryAt: new Date(minutesAgo(10).getTime() + 15 * 60_000), // 5 minutes from now
    });
  });

  it("ignores sends older than 15 minutes", () => {
    expect(canSendOtp([minutesAgo(1), minutesAgo(16), minutesAgo(20), minutesAgo(30)], now)).toEqual({ allowed: true });
  });

  it("frees a slot exactly when the oldest send leaves the window", () => {
    const sends = [minutesAgo(1), minutesAgo(2), minutesAgo(14)];
    expect(canSendOtp(sends, now).allowed).toBe(false);
    expect(canSendOtp(sends, new Date(now.getTime() + 60_000)).allowed).toBe(true);
  });
});
