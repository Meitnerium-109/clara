/**
 * Basic protection against password guessing: after 5 failed sign-ins for one
 * email within 15 minutes, further attempts are refused until the window passes.
 * A successful sign-in resets the count.
 */

export const MAX_FAILED_LOGINS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export type LoginAttempt = { succeeded: boolean; at: Date };

/** Failures inside the window that happened after the most recent success. */
export function countRecentFailures(attempts: LoginAttempt[], now: Date): number {
  const windowStart = now.getTime() - LOGIN_WINDOW_MS;
  const lastSuccess = Math.max(
    windowStart,
    ...attempts.filter((a) => a.succeeded).map((a) => a.at.getTime()),
  );
  return attempts.filter((a) => !a.succeeded && a.at.getTime() > lastSuccess).length;
}

export function isLoginLocked(attempts: LoginAttempt[], now: Date): boolean {
  return countRecentFailures(attempts, now) >= MAX_FAILED_LOGINS;
}
