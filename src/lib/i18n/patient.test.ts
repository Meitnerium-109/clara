import { describe, expect, it } from "vitest";
import { flagLabel, formatDate, LANGUAGES, parseLang, patientStrings } from "./patient";

const TELUGU = /[ఀ-౿]/;
const DEVANAGARI = /[ऀ-ॿ]/;

describe("patient strings", () => {
  // The types already force every key to exist; this catches empty or untranslated text.
  it.each(LANGUAGES)("%s has no empty strings", (lang) => {
    const strings = patientStrings(lang);
    for (const [key, value] of Object.entries(strings)) {
      const sample = typeof value === "function" ? (value as (arg: string) => string)("1") : value;
      expect(JSON.stringify(sample).length, key).toBeGreaterThan(2);
    }
  });

  it("Telugu and Hindi text is actually in their scripts", () => {
    expect(patientStrings("te").linkReadyTitle).toMatch(TELUGU);
    expect(patientStrings("hi").linkReadyTitle).toMatch(DEVANAGARI);
    expect(patientStrings("te").criticalTitle).toMatch(TELUGU);
    expect(patientStrings("hi").criticalTitle).toMatch(DEVANAGARI);
  });

  it("templates put the masked number in", () => {
    for (const lang of LANGUAGES) expect(patientStrings(lang).codeSentTo("••••••0010")).toContain("••••••0010");
  });

  it("consent has the same number of points in each language", () => {
    const counts = LANGUAGES.map((lang) => patientStrings(lang).consentPoints.length);
    expect(new Set(counts).size).toBe(1);
  });
});

describe("flagLabel", () => {
  it("uses one word for both critical directions", () => {
    const en = patientStrings("en");
    expect(flagLabel(en, "CRITICAL_LOW")).toBe("Critical");
    expect(flagLabel(en, "CRITICAL_HIGH")).toBe("Critical");
    expect(flagLabel(en, "UNKNOWN")).toBe("Ask doctor");
  });
});

describe("parseLang", () => {
  it.each([
    ["te", "te"],
    ["hi", "hi"],
    ["en", "en"],
    ["fr", "en"],
    [undefined, "en"],
    ["TE", "en"],
  ])("%j → %s", (input, expected) => expect(parseLang(input)).toBe(expected));
});

describe("formatDate", () => {
  it("formats in India time, so a late-evening sign-off isn't shown as the next or previous day", () => {
    // 20:00 UTC on 8 Nov is 01:30 IST on 9 Nov.
    expect(formatDate(new Date("2026-11-08T20:00:00Z"), "en")).toBe("9 Nov 2026");
  });
});
