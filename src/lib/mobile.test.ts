import { describe, expect, it } from "vitest";
import { maskMobile, normaliseMobile } from "./mobile";

describe("normaliseMobile", () => {
  it.each([
    ["9876543210", "plain 10 digits"],
    ["98765 43210", "spaces"],
    ["98765-43210", "dashes"],
    ["(98765) 43210", "brackets"],
    ["  9876543210  ", "surrounding whitespace"],
    ["09876543210", "trunk 0 prefix"],
    ["919876543210", "91 without plus"],
    ["+919876543210", "already E.164"],
    ["+91 98765 43210", "E.164 with spaces"],
    ["+91-98765-43210", "E.164 with dashes"],
    ["00919876543210", "international 0091 prefix"],
  ])("accepts %s (%s)", (input) => {
    expect(normaliseMobile(input)).toEqual({ ok: true, e164: "+919876543210" });
  });

  it("gives the same key for every way of writing one number", () => {
    const forms = ["9876543210", "+91 98765 43210", "09876543210", "919876543210"];
    const results = forms.map(normaliseMobile);
    for (const result of results) expect(result).toEqual(results[0]);
  });

  it.each(["6000000000", "7123456789", "8999999999"])(
    "accepts numbers starting 6, 7 or 8: %s",
    (input) => {
      expect(normaliseMobile(input)).toEqual({ ok: true, e164: `+91${input}` });
    },
  );

  it.each([
    ["", "Mobile number is missing"],
    ["   ", "Mobile number is missing"],
    ["98765abcde", "Mobile number can only contain digits"],
    ["9.87654321E+09", "Mobile number can only contain digits"], // spreadsheet scientific notation
    ["+91+9876543210", "Mobile number can only contain digits"],
    ["987654321", "Not a valid 10-digit Indian mobile number"], // 9 digits
    ["98765432101", "Not a valid 10-digit Indian mobile number"], // 11 digits, no 0 prefix
    ["5876543210", "Not a valid 10-digit Indian mobile number"], // starts with 5
    ["0866247123", "Not a valid 10-digit Indian mobile number"], // Vijayawada landline
    ["+4479460000", "Not a valid 10-digit Indian mobile number"], // other country
    ["+9198765", "Not a valid 10-digit Indian mobile number"], // +91 but too short
  ])("rejects %j", (input, reason) => {
    expect(normaliseMobile(input)).toEqual({ ok: false, reason });
  });
});

describe("maskMobile", () => {
  it("shows only the last 4 digits", () => {
    expect(maskMobile("+919876543210")).toBe("••••••3210");
  });
});
