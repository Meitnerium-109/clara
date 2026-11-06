/**
 * Normalises an Indian mobile number to E.164 (+91 followed by 10 digits).
 *
 * Every mobile is passed through this function before it is stored or compared,
 * so "98765 43210", "09876543210" and "+91 98765 43210" all become the same
 * patient key. Landlines and other countries are rejected: report links and
 * OTPs go by WhatsApp/SMS, which need an Indian mobile.
 */

export type MobileResult =
  | { ok: true; e164: string }
  | { ok: false; reason: string };

// Indian mobile numbers are 10 digits and start with 6, 7, 8 or 9.
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

// Characters people commonly type between digits.
const SEPARATORS = /[\s\-.()]/g;

export function normaliseMobile(input: string): MobileResult {
  const compact = input.trim().replace(SEPARATORS, "");

  if (compact === "") {
    return { ok: false, reason: "Mobile number is missing" };
  }
  if (!/^\+?\d+$/.test(compact)) {
    return { ok: false, reason: "Mobile number can only contain digits" };
  }

  const national = toNationalNumber(compact);
  if (national === null || !INDIAN_MOBILE.test(national)) {
    return { ok: false, reason: "Not a valid 10-digit Indian mobile number" };
  }

  return { ok: true, e164: `+91${national}` };
}

/** Strips a +91, 0091, 91 or trunk 0 prefix, returning the 10-digit part. */
function toNationalNumber(compact: string): string | null {
  if (compact.startsWith("+")) {
    return compact.startsWith("+91") ? compact.slice(3) : null;
  }
  if (compact.length === 14 && compact.startsWith("0091")) return compact.slice(4);
  if (compact.length === 12 && compact.startsWith("91")) return compact.slice(2);
  if (compact.length === 11 && compact.startsWith("0")) return compact.slice(1);
  if (compact.length === 10) return compact;
  return null;
}

/** Shows only the last 4 digits, e.g. "••••••3210", for screens and staff views. */
export function maskMobile(e164: string): string {
  return "••••••" + e164.slice(-4);
}
