/**
 * Report link tokens. The raw token only ever exists in the message sent to
 * the patient; the database keeps its SHA-256 hash. A database leak therefore
 * reveals no working links.
 */

import { createHash, randomBytes } from "node:crypto";

export const LINK_TTL_MS = 72 * 60 * 60 * 1000;

/** 32 random bytes from the OS's secure generator, as URL-safe text (43 characters). */
export function generateLinkToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function linkExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + LINK_TTL_MS);
}

export type LinkStatus = "VALID" | "EXPIRED" | "REVOKED";

/** Revoked wins over expired, so staff see the more specific reason. */
export function linkStatus(link: { expiresAt: Date; revokedAt: Date | null }, now: Date): LinkStatus {
  if (link.revokedAt && link.revokedAt <= now) return "REVOKED";
  if (now >= link.expiresAt) return "EXPIRED";
  return "VALID";
}

/** Shape check before any database lookup: junk in the URL never reaches a query. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type LinkCheck = "VALID" | "EXPIRED" | "REVOKED" | "NOT_FOUND";

/** The full check for an opened link: it exists, is not revoked, is not expired. */
export function checkLink(link: { expiresAt: Date; revokedAt: Date | null } | null, now: Date): LinkCheck {
  return link ? linkStatus(link, now) : "NOT_FOUND";
}
