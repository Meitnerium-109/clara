import { describe, expect, it } from "vitest";
import { checkLink, generateLinkToken, hashToken, isWellFormedToken, LINK_TTL_MS, linkExpiresAt, linkStatus } from "./tokens";

describe("generateLinkToken", () => {
  it("makes a 43-character URL-safe token (32 random bytes)", () => {
    const { token } = generateLinkToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("stores a SHA-256 hash, not the token", () => {
    const { token, tokenHash } = generateLinkToken();
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
  });

  it("never repeats", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateLinkToken().token));
    expect(tokens.size).toBe(1000);
  });
});

describe("link expiry", () => {
  const created = new Date("2026-11-07T10:00:00Z");
  const expiresAt = linkExpiresAt(created);

  it("expires exactly 72 hours after creation", () => {
    expect(expiresAt.getTime() - created.getTime()).toBe(LINK_TTL_MS);
    expect(expiresAt.toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });

  it("is valid one second before expiry", () => {
    expect(linkStatus({ expiresAt, revokedAt: null }, new Date(expiresAt.getTime() - 1000))).toBe("VALID");
  });

  it("is expired at the expiry instant and after", () => {
    expect(linkStatus({ expiresAt, revokedAt: null }, expiresAt)).toBe("EXPIRED");
    expect(linkStatus({ expiresAt, revokedAt: null }, new Date(expiresAt.getTime() + 1))).toBe("EXPIRED");
  });

  it("is revoked once revokedAt has passed, even if not expired", () => {
    const revokedAt = new Date("2026-11-08T10:00:00Z");
    expect(linkStatus({ expiresAt, revokedAt }, new Date("2026-11-08T11:00:00Z"))).toBe("REVOKED");
  });

  it("reports revoked rather than expired when both apply", () => {
    const revokedAt = new Date("2026-11-08T10:00:00Z");
    expect(linkStatus({ expiresAt, revokedAt }, new Date("2026-11-20T00:00:00Z"))).toBe("REVOKED");
  });
});

describe("isWellFormedToken", () => {
  it("accepts a generated token", () => {
    expect(isWellFormedToken(generateLinkToken().token)).toBe(true);
  });

  it.each(["", "short", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`, `${"a".repeat(42)}.`])(
    "rejects %j",
    (token) => expect(isWellFormedToken(token)).toBe(false),
  );
});

describe("checkLink", () => {
  const now = new Date("2026-11-09T10:00:00Z");
  const expiresAt = new Date("2026-11-10T10:00:00Z");

  it("NOT_FOUND when no link has this hash", () => expect(checkLink(null, now)).toBe("NOT_FOUND"));
  it("VALID when not expired or revoked", () => expect(checkLink({ expiresAt, revokedAt: null }, now)).toBe("VALID"));
  it("EXPIRED after 72 hours", () => expect(checkLink({ expiresAt, revokedAt: null }, expiresAt)).toBe("EXPIRED"));
  it("REVOKED after a resend", () =>
    expect(checkLink({ expiresAt, revokedAt: new Date("2026-11-09T09:00:00Z") }, now)).toBe("REVOKED"));
});
