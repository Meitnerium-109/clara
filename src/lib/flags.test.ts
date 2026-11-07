import { describe, expect, it } from "vitest";
import {
  assessResult,
  compareToRange,
  criticalFlag,
  isOrderCritical,
  parseRange,
  parseValue,
  type ResultFlag,
} from "./flags";

describe("parseValue", () => {
  it.each([
    ["10.2", 10.2],
    ["142", 142],
    ["  6.8 ", 6.8],
    ["0", 0],
    ["-2.5", -2.5],
    ["1,50,000", 150000], // Indian grouping
    ["98,000", 98000],
    ["150,000", 150000], // Western grouping
    ["2,10,000.5", 210000.5],
  ])("parses %j as %d", (text, expected) => {
    expect(parseValue(text)).toBe(expected);
  });

  it.each([
    "",
    "Negative",
    "Positive",
    "Nil",
    "<0.01", // below detection limit: not a single number
    ">1000",
    "10,2", // European decimal comma: rejected, never read as 102
    "1,5,0",
    "12.5.1",
    "12 mg",
    "NaN",
    "Infinity",
  ])("returns null for %j", (text) => {
    expect(parseValue(text)).toBeNull();
  });
});

describe("parseRange", () => {
  it("parses a between range with both ends included", () => {
    expect(parseRange("12.0-15.5")).toEqual({ low: 12, high: 15.5, lowInclusive: true, highInclusive: true });
  });

  it.each([
    ["0-100", 0, 100],
    ["3.5 - 5.1", 3.5, 5.1],
    ["3.5–5.1", 3.5, 5.1], // en dash
    ["70—100", 70, 100], // em dash
    ["1,50,000-4,10,000", 150000, 410000],
    ["5-5", 5, 5],
  ])("parses %j", (text, low, high) => {
    expect(parseRange(text)).toMatchObject({ low, high });
  });

  it("parses '<200' as an upper bound that excludes 200", () => {
    expect(parseRange("<200")).toEqual({ low: null, high: 200, lowInclusive: false, highInclusive: false });
  });

  it("parses '>40' as a lower bound that excludes 40", () => {
    expect(parseRange(">40")).toEqual({ low: 40, high: null, lowInclusive: false, highInclusive: false });
  });

  it.each([
    ["<=5.6", { high: 5.6, highInclusive: true }],
    ["≤5.6", { high: 5.6, highInclusive: true }],
    [">= 30", { low: 30, lowInclusive: true }],
    ["≥30", { low: 30, lowInclusive: true }],
    ["< 200", { high: 200, highInclusive: false }],
  ])("parses %j", (text, expected) => {
    expect(parseRange(text)).toMatchObject(expected);
  });

  it.each([
    "",
    "Negative",
    "See report",
    "15.5-12.0", // low above high
    "12.0-",
    "-15.5",
    "12-15-18",
    "up to 200",
    "10,2-15,5",
  ])("returns null for %j", (text) => {
    expect(parseRange(text)).toBeNull();
  });
});

describe("compareToRange", () => {
  const between = parseRange("12.0-15.5")!;
  const below200 = parseRange("<200")!;
  const above40 = parseRange(">40")!;
  const atMost = parseRange("<=200")!;

  it.each([
    [between, 11.9, "LOW"],
    [between, 12.0, "NORMAL"], // edge included
    [between, 13.4, "NORMAL"],
    [between, 15.5, "NORMAL"], // edge included
    [between, 15.6, "HIGH"],
    [below200, 199, "NORMAL"],
    [below200, 200, "HIGH"], // "<200" excludes 200
    [atMost, 200, "NORMAL"],
    [above40, 41, "NORMAL"],
    [above40, 40, "LOW"], // ">40" excludes 40
    [above40, 500, "NORMAL"], // no upper bound
  ] as const)("range %o, value %d → %s", (range, value, expected) => {
    expect(compareToRange(value, range)).toBe(expected);
  });
});

describe("criticalFlag", () => {
  it.each([
    ["Potassium", "mmol/L", 6.8, "CRITICAL_HIGH"],
    ["Potassium", "mmol/L", 6.0, null], // limit is "> 6.0", so 6.0 itself is not critical
    ["Potassium", "mmol/L", 6.01, "CRITICAL_HIGH"],
    ["Potassium", "mmol/L", 2.7, "CRITICAL_LOW"],
    ["Potassium", "mmol/L", 2.8, null],
    ["Serum Potassium", "mmol/l", 7, "CRITICAL_HIGH"], // alias and unit case
    ["K", "mmol/L", 7, "CRITICAL_HIGH"],
    ["Haemoglobin", "g/dL", 6.9, "CRITICAL_LOW"],
    ["Hemoglobin", "g/dL", 6.9, "CRITICAL_LOW"], // US spelling
    ["Haemoglobin", "g/dL", 7, null],
    ["Haemoglobin", "g/dL", 25, null], // no upper critical limit for Hb
    ["Fasting Blood Sugar", "mg/dL", 45, "CRITICAL_LOW"],
    ["Random glucose", "mg/dL", 452, "CRITICAL_HIGH"],
    ["Glucose", "mg/dL", 400, null],
    ["Sodium", "mmol/L", 118, "CRITICAL_LOW"],
    ["Calcium", "mg/dL", 13.5, "CRITICAL_HIGH"],
  ] as const)("%s %s %d → %s", (parameter, unit, value, expected) => {
    expect(criticalFlag(parameter, unit, value)).toBe(expected);
  });

  it("does not apply a limit when the unit differs", () => {
    // 450 mmol/L is nonsense for glucose; the mg/dL limit must not fire on it.
    expect(criticalFlag("Glucose", "mmol/L", 450)).toBeNull();
  });

  it("returns null for tests with no critical limit", () => {
    expect(criticalFlag("LDL cholesterol", "mg/dL", 900)).toBeNull();
  });
});

describe("assessResult", () => {
  describe("the three sample rows from the brief", () => {
    it("ORD-71204: haemoglobin 10.2 (12.0-15.5) is LOW", () => {
      expect(
        assessResult({ parameter: "Haemoglobin", unit: "g/dL", valueText: "10.2", refText: "12.0-15.5" }),
      ).toEqual({ valueNum: 10.2, refLow: 12, refHigh: 15.5, flag: "LOW" });
    });

    it("ORD-71219: LDL 142 (0-100) is HIGH", () => {
      expect(
        assessResult({ parameter: "LDL cholesterol", unit: "mg/dL", valueText: "142", refText: "0-100" }),
      ).toEqual({ valueNum: 142, refLow: 0, refHigh: 100, flag: "HIGH" });
    });

    it("ORD-71233: potassium 6.8 (3.5-5.1) is CRITICAL_HIGH", () => {
      expect(
        assessResult({ parameter: "Potassium", unit: "mmol/L", valueText: "6.8", refText: "3.5-5.1" }),
      ).toEqual({ valueNum: 6.8, refLow: 3.5, refHigh: 5.1, flag: "CRITICAL_HIGH" });
    });
  });

  it("uses one-sided ranges", () => {
    expect(
      assessResult({ parameter: "Total cholesterol", unit: "mg/dL", valueText: "212", refText: "<200" }).flag,
    ).toBe("HIGH");
    expect(assessResult({ parameter: "HDL cholesterol", unit: "mg/dL", valueText: "38", refText: ">40" })).toEqual({
      valueNum: 38,
      refLow: 40,
      refHigh: null,
      flag: "LOW",
    });
  });

  it("returns UNKNOWN for a non-numeric value, but keeps the parsed range", () => {
    expect(
      assessResult({ parameter: "Dengue NS1 antigen", unit: "", valueText: "Negative", refText: "Negative" }),
    ).toEqual({ valueNum: null, refLow: null, refHigh: null, flag: "UNKNOWN" });
    expect(
      assessResult({ parameter: "TSH", unit: "µIU/mL", valueText: "<0.01", refText: "0.4-4.0" }),
    ).toEqual({ valueNum: null, refLow: 0.4, refHigh: 4, flag: "UNKNOWN" });
  });

  it("returns UNKNOWN when the range can't be parsed and no critical limit applies", () => {
    expect(
      assessResult({ parameter: "Vitamin B12", unit: "pg/mL", valueText: "320", refText: "See report" }),
    ).toEqual({ valueNum: 320, refLow: null, refHigh: null, flag: "UNKNOWN" });
  });

  it("still catches a critical value when the range is garbled", () => {
    expect(
      assessResult({ parameter: "Potassium", unit: "mmol/L", valueText: "7.2", refText: "???" }).flag,
    ).toBe("CRITICAL_HIGH");
  });

  it("prefers critical over plain low", () => {
    expect(
      assessResult({ parameter: "Haemoglobin", unit: "g/dL", valueText: "6.4", refText: "12.0-15.5" }).flag,
    ).toBe("CRITICAL_LOW");
  });

  it("handles Indian-format platelet counts", () => {
    expect(
      assessResult({ parameter: "Platelets", unit: "/cumm", valueText: "98,000", refText: "1,50,000-4,10,000" }),
    ).toEqual({ valueNum: 98000, refLow: 150000, refHigh: 410000, flag: "LOW" });
  });
});

describe("isOrderCritical", () => {
  const normal: ResultFlag[] = ["NORMAL", "LOW", "HIGH", "UNKNOWN"];

  it("is critical when the LIS says so, even if our rules find nothing", () => {
    expect(isOrderCritical(true, normal)).toBe(true);
  });

  it.each(["CRITICAL_LOW", "CRITICAL_HIGH"] as const)(
    "is critical when any result is %s, even if the LIS does not say so",
    (flag) => {
      expect(isOrderCritical(false, [...normal, flag])).toBe(true);
    },
  );

  it("is not critical when neither source says so", () => {
    expect(isOrderCritical(false, normal)).toBe(false);
  });

  it("is not critical for an order with no results", () => {
    expect(isOrderCritical(false, [])).toBe(false);
  });
});
