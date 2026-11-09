/**
 * Signed session tokens (JWT, HS256) kept in httpOnly cookies.
 *
 * Staff and patient sessions use different cookie names AND different
 * audiences, so a patient token can never be accepted as a staff session even
 * if someone copies it into the other cookie.
 *
 * Only uses jose (Web Crypto), so it runs in middleware on the Edge runtime.
 */

import { jwtVerify, SignJWT } from "jose";

export type SessionAudience = "staff" | "patient";

const ISSUER = "clara";

export const STAFF_COOKIE = "clara_staff";
export const STAFF_SESSION_SECONDS = 8 * 60 * 60; // one working shift

export const PATIENT_COOKIE = "clara_patient";
// Idle timeout: middleware re-issues the cookie on every page view, so it
// only expires after 30 minutes with no activity.
export const PATIENT_IDLE_SECONDS = 30 * 60;

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true, // page scripts can't read it, so a script-injection bug can't steal it
    secure: process.env.NODE_ENV === "production", // HTTPS only once deployed
    sameSite: "lax" as const, // not sent on cross-site form posts
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

const MIN_SECRET_LENGTH = 32;

export function sessionKey(secret: string | undefined): Uint8Array {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  subject: string,
  audience: SessionAudience,
  ttlSeconds: number,
  key: Uint8Array,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(key);
}

/** Returns the subject (user id) if the token is genuine, unexpired and for this audience. */
export async function verifySessionToken(
  token: string | undefined,
  audience: SessionAudience,
  key: Uint8Array,
): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience,
      algorithms: ["HS256"],
    });
    return payload.sub ?? null;
  } catch {
    // Bad signature, expired, wrong audience or malformed: all mean "not signed in".
    return null;
  }
}
