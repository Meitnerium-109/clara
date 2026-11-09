import { describe, expect, it, vi } from "vitest";
import { buildPrompt, type PromptInput } from "./prompt";
import { FALLBACK_TEXT, planSummary, resolveAiSummary } from "./resolve";

const result = (overrides = {}) => ({ parameter: "HDL cholesterol", valueText: "38", unit: "mg/dL", refText: ">40", flag: "LOW" as const, ...overrides });

describe("planSummary: where an explanation comes from", () => {
  it("gives no explanation for any result on a critical order", () => {
    expect(planSummary(result({ parameter: "Haemoglobin" }), "en", true)).toEqual({ kind: "NONE" });
  });

  it.each(["CRITICAL_LOW", "CRITICAL_HIGH"] as const)("gives no explanation for a %s value", (flag) => {
    expect(planSummary(result({ flag }), "en", false)).toEqual({ kind: "NONE" });
  });

  it.each(["NORMAL", "UNKNOWN"] as const)("gives no explanation for a %s result (only out-of-range values get one)", (flag) => {
    expect(planSummary(result({ flag }), "en", false)).toEqual({ kind: "NONE" });
  });

  it("uses the locked template when one exists, in the chosen language", () => {
    const plan = planSummary(result({ parameter: "Haemoglobin", valueText: "10.2", unit: "g/dL", refText: "12.0-15.5" }), "te", false);
    expect(plan.kind).toBe("TEMPLATE");
    expect(plan.kind === "TEMPLATE" && plan.text).toMatch(/^మీ Haemoglobin ఫలితం 10.2 g\/dL/);
  });

  it("asks the AI only for out-of-range tests without a template", () => {
    expect(planSummary(result(), "hi", false)).toEqual({
      kind: "AI",
      prompt: { parameter: "HDL cholesterol", valueText: "38", unit: "mg/dL", refText: ">40", flag: "LOW", lang: "hi" },
    });
  });

  it("passes only the allowed fields to the AI, even if given a whole row", () => {
    const row = { ...result(), patientName: "Lakshmi Prasanna K", mobile: "+919000000001", lisOrderId: "ORD-71204", id: "cm123" };
    const plan = planSummary(row, "en", false);
    expect(plan.kind === "AI" && Object.keys(plan.prompt).sort()).toEqual(["flag", "lang", "parameter", "refText", "unit", "valueText"]);
  });
});

describe("buildPrompt", () => {
  const prompt: PromptInput = { parameter: "HDL cholesterol", valueText: "38", unit: "mg/dL", refText: ">40", flag: "LOW", lang: "te" };

  it("contains the test, value, range, direction and language", () => {
    const text = buildPrompt(prompt);
    expect(text).toContain("HDL cholesterol");
    expect(text).toContain("38 mg/dL");
    expect(text).toContain(">40 mg/dL");
    expect(text).toContain("below the normal range");
    expect(text).toContain("Telugu");
  });

  it("never contains personal data, even when the input object carries it", () => {
    const withPersonalData = { ...prompt, patientName: "Lakshmi Prasanna K", mobile: "+919000000001", lisOrderId: "ORD-71204" };
    const text = buildPrompt(withPersonalData as PromptInput);
    for (const secret of ["Lakshmi", "9000000001", "ORD-71204"]) expect(text).not.toContain(secret);
  });
});

describe("resolveAiSummary: validation and fallback", () => {
  const prompt: PromptInput = { parameter: "HDL cholesterol", valueText: "38", unit: "mg/dL", refText: ">40", flag: "LOW", lang: "en" };
  const good = JSON.stringify({ summary: "Your HDL cholesterol is 38 mg/dL, lower than the normal range. Your doctor will explain what it means." });

  it("uses valid AI output and caches it", async () => {
    expect(await resolveAiSummary(prompt, async () => good)).toMatchObject({ source: "AI", cache: true });
  });

  it("falls back, and caches the fallback, when the output breaks the rules", async () => {
    const bad = JSON.stringify({ summary: "Your HDL cholesterol is low, you have heart disease. Take a statin." });
    expect(await resolveAiSummary(prompt, async () => bad)).toEqual({ text: FALLBACK_TEXT.en, source: "FALLBACK", cache: true });
  });

  it("falls back without caching on a timeout or outage, so the next view tries again", async () => {
    const timeout = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await resolveAiSummary(prompt, timeout)).toEqual({ text: FALLBACK_TEXT.en, source: "FALLBACK", cache: false });
  });

  it("gives the fallback in the patient's language", async () => {
    const result = await resolveAiSummary({ ...prompt, lang: "hi" }, async () => "garbage");
    expect(result.text).toBe(FALLBACK_TEXT.hi);
  });
});
