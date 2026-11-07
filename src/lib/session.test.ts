import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createSessionToken, sessionKey, verifySessionToken } from "./session";

const key = sessionKey("test-secret-that-is-at-least-32-characters-long");
const otherKey = sessionKey("a-different-secret-also-32-characters-or-more");

describe("sessionKey", () => {
  it.each([undefined, "", "too-short"])("rejects a missing or short secret: %j", (secret) => {
    expect(() => sessionKey(secret)).toThrow(/SESSION_SECRET/);
  });
});

describe("session tokens", () => {
  it("round-trips the subject", async () => {
    const token = await createSessionToken("staff_123", "staff", 60, key);
    expect(await verifySessionToken(token, "staff", key)).toBe("staff_123");
  });

  it("returns null when there is no token", async () => {
    expect(await verifySessionToken(undefined, "staff", key)).toBeNull();
  });

  it("rejects a patient token used as a staff session", async () => {
    const token = await createSessionToken("patient_1", "patient", 60, key);
    expect(await verifySessionToken(token, "staff", key)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await createSessionToken("staff_123", "staff", 60, otherKey);
    expect(await verifySessionToken(token, "staff", key)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken("staff_123", "staff", 60, key);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "staff_admin", aud: "staff", iss: "clara" })).toString(
      "base64url",
    );
    expect(await verifySessionToken(`${header}.${forgedPayload}.${signature}`, "staff", key)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const issuedTwoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("staff_123")
      .setIssuer("clara")
      .setAudience("staff")
      .setIssuedAt(issuedTwoHoursAgo)
      .setExpirationTime(issuedTwoHoursAgo + 3600)
      .sign(key);
    expect(await verifySessionToken(token, "staff", key)).toBeNull();
  });

  it("rejects an unsigned token (alg: none)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "staff_123", aud: "staff", iss: "clara" })).toString(
      "base64url",
    );
    expect(await verifySessionToken(`${header}.${payload}.`, "staff", key)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySessionToken("not-a-jwt", "staff", key)).toBeNull();
  });
});
