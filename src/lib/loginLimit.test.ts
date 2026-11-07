import { describe, expect, it } from "vitest";
import { countRecentFailures, isLoginLocked, type LoginAttempt } from "./loginLimit";

const now = new Date("2026-11-07T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60 * 1000);
const fail = (m: number): LoginAttempt => ({ succeeded: false, at: minutesAgo(m) });
const success = (m: number): LoginAttempt => ({ succeeded: true, at: minutesAgo(m) });

describe("login limit", () => {
  it("allows sign-in with no history", () => {
    expect(isLoginLocked([], now)).toBe(false);
  });

  it("allows 4 failures", () => {
    expect(isLoginLocked([fail(1), fail(2), fail(3), fail(4)], now)).toBe(false);
  });

  it("locks after 5 failures within 15 minutes", () => {
    expect(isLoginLocked([fail(1), fail(2), fail(3), fail(4), fail(5)], now)).toBe(true);
  });

  it("ignores failures older than 15 minutes", () => {
    expect(countRecentFailures([fail(1), fail(2), fail(16), fail(20), fail(30)], now)).toBe(2);
    expect(isLoginLocked([fail(1), fail(2), fail(16), fail(20), fail(30)], now)).toBe(false);
  });

  it("unlocks once the oldest failure leaves the window", () => {
    const attempts = [fail(11), fail(12), fail(13), fail(14), fail(14.5)];
    expect(isLoginLocked(attempts, now)).toBe(true);
    const oneMinuteLater = new Date(now.getTime() + 60 * 1000);
    expect(isLoginLocked(attempts, oneMinuteLater)).toBe(false);
  });

  it("resets the count after a successful sign-in", () => {
    const attempts = [fail(1), fail(2), success(3), fail(4), fail(5), fail(6), fail(7)];
    expect(countRecentFailures(attempts, now)).toBe(2);
    expect(isLoginLocked(attempts, now)).toBe(false);
  });
});
