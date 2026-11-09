import type { PatientStrings } from "@/lib/i18n/patient";

/** What a send-code or check-code action can answer. Shared by the link and sign-in flows. */
export type FlowError =
  | { reason: "FORMAT" | "NO_CODE" | "EXPIRED" | "LOCKED" | "INVALID_MOBILE" | "LINK_INVALID" | "ERROR" }
  | { reason: "WRONG"; attemptsLeft: number }
  | { reason: "RATE_LIMITED"; minutes: number };

export type FlowResult = { ok: true; masked?: string } | ({ ok: false } & FlowError);

export function flowMessage(t: PatientStrings, error: FlowError): string {
  switch (error.reason) {
    case "FORMAT":
      return t.otpFormat;
    case "WRONG":
      return t.otpWrong(error.attemptsLeft);
    case "LOCKED":
      return t.otpLocked;
    case "EXPIRED":
      return t.otpExpired;
    case "NO_CODE":
      return t.otpNoCode;
    case "RATE_LIMITED":
      return t.otpRateLimited(error.minutes);
    case "INVALID_MOBILE":
      return t.invalidMobile;
    case "LINK_INVALID":
      return t.linkExpiredBody;
    case "ERROR":
      return t.errorBody;
  }
}
