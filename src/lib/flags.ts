/**
 * Result flags come from rules, never from AI: parse the lab's reference range,
 * compare the value, and check the critical-limits table.
 *
 * When something can't be parsed the flag is UNKNOWN. We never guess.
 */

import { findCriticalLimit } from "./criticalLimits";

// Same values as the ResultFlag enum in prisma/schema.prisma.
export type ResultFlag =
  | "NORMAL"
  | "LOW"
  | "HIGH"
  | "CRITICAL_LOW"
  | "CRITICAL_HIGH"
  | "UNKNOWN";

export type ReferenceRange = {
  low: number | null; // null = no lower bound, e.g. "<200"
  high: number | null; // null = no upper bound, e.g. ">40"
  lowInclusive: boolean;
  highInclusive: boolean;
};

// A number as an Indian lab writes it: "10.2", "150000", "1,50,000" (Indian
// grouping) or "150,000" (Western grouping). Anything else, like the
// European "10,2", is rejected rather than misread as 102.
const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d{1,3}(?:,\d{2})*,\d{3}|\d+)(?:\.\d+)?`;

const VALUE = new RegExp(`^-?${NUMBER}$`);
const BETWEEN = new RegExp(`^(${NUMBER})\\s*-\\s*(${NUMBER})$`);
const BELOW = new RegExp(`^(<=?)\\s*(${NUMBER})$`);
const ABOVE = new RegExp(`^(>=?)\\s*(${NUMBER})$`);

function toNumber(token: string): number {
  return Number(token.replace(/,/g, ""));
}

/** "10.2" → 10.2. Non-numeric results like "Negative" or "<0.01" → null. */
export function parseValue(text: string): number | null {
  const trimmed = text.trim();
  return VALUE.test(trimmed) ? toNumber(trimmed) : null;
}

/** "12.0-15.5", "0-100", "<200", ">40", "≤5.6". Anything else → null. */
export function parseRange(text: string): ReferenceRange | null {
  const trimmed = text
    .trim()
    .replace(/[–—]/g, "-") // en and em dashes from Word or Excel
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=");

  const between = trimmed.match(BETWEEN);
  if (between) {
    const low = toNumber(between[1]);
    const high = toNumber(between[2]);
    if (low > high) return null;
    return { low, high, lowInclusive: true, highInclusive: true };
  }

  const below = trimmed.match(BELOW);
  if (below) {
    return { low: null, high: toNumber(below[2]), lowInclusive: false, highInclusive: below[1] === "<=" };
  }

  const above = trimmed.match(ABOVE);
  if (above) {
    return { low: toNumber(above[2]), high: null, lowInclusive: above[1] === ">=", highInclusive: false };
  }

  return null;
}

/** Compares a value with a range. "12.0-15.5" includes both ends; "<200" excludes 200. */
export function compareToRange(value: number, range: ReferenceRange): "NORMAL" | "LOW" | "HIGH" {
  if (range.low !== null && (value < range.low || (!range.lowInclusive && value === range.low))) {
    return "LOW";
  }
  if (range.high !== null && (value > range.high || (!range.highInclusive && value === range.high))) {
    return "HIGH";
  }
  return "NORMAL";
}

/** CRITICAL_LOW / CRITICAL_HIGH if the value crosses a critical limit, otherwise null. */
export function criticalFlag(
  parameter: string,
  unit: string,
  value: number,
): "CRITICAL_LOW" | "CRITICAL_HIGH" | null {
  const limit = findCriticalLimit(parameter, unit);
  if (!limit) return null;
  if (limit.below !== undefined && value < limit.below) return "CRITICAL_LOW";
  if (limit.above !== undefined && value > limit.above) return "CRITICAL_HIGH";
  return null;
}

export type ResultInput = {
  parameter: string;
  unit: string;
  valueText: string;
  refText: string;
};

export type AssessedResult = {
  valueNum: number | null;
  refLow: number | null;
  refHigh: number | null;
  flag: ResultFlag;
};

/**
 * The one function import and seed call for each result row. Its output maps
 * straight onto the Result table's columns.
 *
 * Critical limits are checked before the range, so a dangerous potassium is
 * still caught even if the LIS sent a garbled range.
 */
export function assessResult(input: ResultInput): AssessedResult {
  const valueNum = parseValue(input.valueText);
  const range = parseRange(input.refText);
  const refLow = range?.low ?? null;
  const refHigh = range?.high ?? null;

  if (valueNum === null) return { valueNum, refLow, refHigh, flag: "UNKNOWN" };

  const critical = criticalFlag(input.parameter, input.unit, valueNum);
  if (critical) return { valueNum, refLow, refHigh, flag: critical };

  if (!range) return { valueNum, refLow, refHigh, flag: "UNKNOWN" };

  return { valueNum, refLow, refHigh, flag: compareToRange(valueNum, range) };
}

export function isCriticalFlag(flag: ResultFlag): boolean {
  return flag === "CRITICAL_LOW" || flag === "CRITICAL_HIGH";
}

/**
 * An order is critical if the LIS says so OR any result crosses our limits.
 * We trust either source: an unnecessary call costs minutes, a missed one could harm someone.
 */
export function isOrderCritical(lisSaysCritical: boolean, flags: ResultFlag[]): boolean {
  return lisSaysCritical || flags.some(isCriticalFlag);
}
