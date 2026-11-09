import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../i18n/patient";
import { findTemplate, renderTemplate, TEMPLATED_TESTS } from "./templates";
import { validateSummary } from "./validate";

const EXAMPLES: Record<string, [string, string, string, string]> = {
  haemoglobin: ["Haemoglobin", "10.2", "g/dL", "12.0-15.5"],
  ldl: ["LDL cholesterol", "142", "mg/dL", "0-100"],
  "fasting-glucose": ["Fasting glucose", "168", "mg/dL", "70-100"],
  hba1c: ["HbA1c", "7.8", "%", "4.0-5.6"],
  tsh: ["TSH", "5.6", "µIU/mL", "0.4-4.0"],
  creatinine: ["Creatinine", "1.5", "mg/dL", "0.7-1.3"],
  platelets: ["Platelets", "98,000", "/cumm", "1,50,000-4,10,000"],
  "vitamin-d": ["Vitamin D", "14", "ng/mL", "30-100"],
};

describe("locked templates", () => {
  it("cover the 8 common tests from the brief", () => {
    expect(TEMPLATED_TESTS.map((t) => t.key).sort()).toEqual(Object.keys(EXAMPLES).sort());
  });

  // The templates must obey the same rules as AI output: name the test, stay
  // short, no diagnosis or medicine words. 8 tests × 2 directions × 3 languages.
  for (const test of TEMPLATED_TESTS) {
    for (const flag of ["LOW", "HIGH"] as const) {
      for (const lang of LANGUAGES) {
        it(`${test.key} ${flag} in ${lang} passes the summary validator`, () => {
          const [parameter, valueText, unit, refText] = EXAMPLES[test.key];
          const text = renderTemplate(test, { parameter, valueText, unit, refText, flag }, lang);
          expect(validateSummary(JSON.stringify({ summary: text }), parameter)).toEqual({ ok: true, text });
        });
      }
    }
  }

  it("fills in the value, unit and range", () => {
    const text = renderTemplate(findTemplate("Haemoglobin")!, { parameter: "Haemoglobin", valueText: "10.2", unit: "g/dL", refText: "12.0-15.5", flag: "LOW" }, "en");
    expect(text).toBe(
      "Your Haemoglobin result is 10.2 g/dL. This is lower than the normal range (12.0-15.5 g/dL). " +
        "Haemoglobin carries oxygen around your body in the blood. Your doctor will explain what this means for you.",
    );
  });

  it("says lower for LOW and higher for HIGH", () => {
    const base = { parameter: "TSH", valueText: "5.6", unit: "µIU/mL", refText: "0.4-4.0" };
    expect(renderTemplate(findTemplate("TSH")!, { ...base, flag: "HIGH" }, "en")).toContain("higher than");
    expect(renderTemplate(findTemplate("TSH")!, { ...base, flag: "LOW" }, "en")).toContain("lower than");
  });

  it("uses the lab's own test name, in every language", () => {
    for (const lang of LANGUAGES) {
      const text = renderTemplate(findTemplate("Hemoglobin")!, { parameter: "Hemoglobin", valueText: "10", unit: "g/dL", refText: "12-15", flag: "LOW" }, lang);
      expect(text).toContain("Hemoglobin");
      expect(text).not.toContain("{");
    }
  });

  it.each(["Hemoglobin", "HB", "Fasting Blood Sugar", "FBS", "Glycated Haemoglobin", "Serum Creatinine", "Platelet count", "Vitamin D 25-OH", "LDL-C"])(
    "recognises %s",
    (name) => expect(findTemplate(name)).toBeDefined(),
  );

  it.each(["Total cholesterol", "HDL cholesterol", "Random glucose", "Sodium", "Vitamin B12"])("has no template for %s", (name) =>
    expect(findTemplate(name)).toBeUndefined(),
  );
});
