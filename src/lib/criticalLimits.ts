/**
 * Critical limits: values so far out of range that the lab must phone the patient.
 *
 * ASSUMPTION: these numbers are common textbook values, not clinical guidance
 * from Company A. A pathologist must confirm them (see docs/ASSUMPTIONS.md).
 *
 * A limit only applies when the unit matches. Glucose of 450 is critical in
 * mg/dL but impossible in mmol/L, so a unit we don't know never triggers a
 * false alarm; the normal range flags still apply.
 */

export type CriticalLimit = {
  test: string;
  aliases: string[]; // parameter names the LIS may use
  unit: string;
  below?: number; // critical if value < below
  above?: number; // critical if value > above
};

export const CRITICAL_LIMITS: CriticalLimit[] = [
  {
    test: "Potassium",
    aliases: ["potassium", "serum potassium", "k"],
    unit: "mmol/L",
    below: 2.8,
    above: 6.0,
  },
  {
    test: "Sodium",
    aliases: ["sodium", "serum sodium", "na"],
    unit: "mmol/L",
    below: 120,
    above: 160,
  },
  {
    test: "Haemoglobin",
    aliases: ["haemoglobin", "hemoglobin", "hb", "hgb"],
    unit: "g/dL",
    below: 7,
  },
  {
    test: "Glucose",
    aliases: [
      "glucose",
      "blood glucose",
      "plasma glucose",
      "fasting glucose",
      "random glucose",
      "fasting blood sugar",
      "random blood sugar",
      "fbs",
      "rbs",
    ],
    unit: "mg/dL",
    below: 50,
    above: 400,
  },
  {
    test: "Calcium",
    aliases: ["calcium", "serum calcium", "ca"],
    unit: "mg/dL",
    below: 6.0,
    above: 13.0,
  },
];

// "Serum Potassium" and "serum-potassium" should match the same alias.
const simplify = (text: string) => text.toLowerCase().replace(/[^a-z0-9/]/g, "");

export function findCriticalLimit(parameter: string, unit: string): CriticalLimit | undefined {
  const name = simplify(parameter);
  const unitKey = simplify(unit);
  return CRITICAL_LIMITS.find(
    (limit) =>
      simplify(limit.unit) === unitKey && limit.aliases.some((alias) => simplify(alias) === name),
  );
}
