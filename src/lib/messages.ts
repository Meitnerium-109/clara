/**
 * Text and keys for outgoing messages and staff tasks.
 *
 * The report-ready message deliberately contains no name and no test details:
 * if the LIS holds a wrong number, the stranger who receives it learns nothing,
 * and the link still needs an OTP sent to that same phone.
 */

import type { ResultFlag } from "./flags";
import { isCriticalFlag } from "./flags";

/** The unique key that stops one order's sign-off message from ever being queued twice. */
export function signoffDedupeKey(lisOrderId: string): string {
  return `signoff:${lisOrderId}`;
}

export function reportLinkUrl(appUrl: string, token: string): string {
  return new URL(`/r/${token}`, appUrl).toString();
}

// Telugu line was AI-translated; see docs/ASSUMPTIONS.md.
export function reportReadyMessage(url: string): string {
  return [
    "Company A Labs: your test report is ready.",
    "మీ పరీక్ష రిపోర్ట్ సిద్ధంగా ఉంది.",
    `Open: ${url}`,
    "The link works for 72 hours. We will send a code to this number to open it.",
  ].join("\n");
}

type ResultSummary = { parameter: string; valueText: string; unit: string; flag: ResultFlag };

/** What staff read on the callback task: which values are critical and which way. */
export function callbackReason(results: ResultSummary[]): string {
  const critical = results.filter((r) => isCriticalFlag(r.flag));
  if (critical.length === 0) return "Marked critical by the LIS";
  return critical
    .map((r) => {
      const direction = r.flag === "CRITICAL_LOW" ? "critically low" : "critically high";
      return `${r.parameter} ${r.valueText}${r.unit ? ` ${r.unit}` : ""} (${direction})`;
    })
    .join("; ");
}
