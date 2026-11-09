import { describe, expect, it } from "vitest";
import { SUMMARY_MAX_CHARS, validateSummary } from "./validate";

const ok = (summary: string) => JSON.stringify({ summary });
const GOOD = "Your HDL cholesterol is 38 mg/dL, a little lower than the normal range. HDL cholesterol is a kind of fat in the blood. Your doctor will explain what it means for you.";

describe("validateSummary", () => {
  it("accepts a good explanation and tidies spaces", () => {
    expect(validateSummary(ok(`  ${GOOD.replace(". ", ".   ")}  `), "HDL cholesterol")).toEqual({ ok: true, text: GOOD });
  });

  it("accepts Telugu and Hindi text that names the test", () => {
    expect(validateSummary(ok("మీ HDL cholesterol ఫలితం 38 mg/dL. ఇది సాధారణ పరిధి కంటే తక్కువగా ఉంది. మీ డాక్టర్ వివరిస్తారు."), "HDL cholesterol").ok).toBe(true);
    expect(validateSummary(ok("आपका HDL cholesterol 38 mg/dL है, जो सामान्य सीमा से कम है। आपके डॉक्टर बताएँगे।"), "HDL cholesterol").ok).toBe(true);
  });

  it("accepts JSON wrapped in code fences", () => {
    expect(validateSummary("```json\n" + ok(GOOD) + "\n```", "HDL cholesterol").ok).toBe(true);
  });

  it("ignores extra fields", () => {
    expect(validateSummary(JSON.stringify({ summary: GOOD, confidence: 0.9 }), "HDL cholesterol").ok).toBe(true);
  });

  it.each([
    ["plain text", GOOD, "not JSON"],
    ["empty", "", "not JSON"],
    ["truncated JSON", '{"summary": "Your HDL', "not JSON"],
    ["missing field", JSON.stringify({ text: GOOD }), "wrong shape or length"],
    ["wrong type", JSON.stringify({ summary: 42 }), "wrong shape or length"],
    ["an array", JSON.stringify([GOOD]), "wrong shape or length"],
    ["too short", ok("HDL cholesterol lo"), "wrong shape or length"],
    ["too long", ok(`HDL cholesterol ${"is fine ".repeat(60)}`), "wrong shape or length"],
  ])("rejects %s", (_label, raw, reason) => {
    expect(validateSummary(raw, "HDL cholesterol")).toEqual({ ok: false, reason });
  });

  it("allows exactly the maximum length", () => {
    const text = `HDL cholesterol ${"a".repeat(SUMMARY_MAX_CHARS - 16)}`;
    expect(text).toHaveLength(SUMMARY_MAX_CHARS);
    expect(validateSummary(ok(text), "HDL cholesterol").ok).toBe(true);
  });

  it("rejects text that doesn't name the test", () => {
    expect(validateSummary(ok("Your result is a little lower than the normal range. Your doctor will explain."), "HDL cholesterol")).toEqual({
      ok: false,
      reason: "does not name the test",
    });
  });

  it.each([
    "This suggests you have diabetes.",
    "This may be a sign of anaemia.",
    "You should take an iron tablet daily.",
    "Your doctor may prescribe medicine.",
    "Consider a vitamin supplement.",
    "This is a heart disease risk.",
    "There is nothing to worry about.",
    "This is not a diagnosis.",
    "ఇది షుగర్ వ్యాధి కావచ్చు.",
    "మీరు మందు తీసుకోవాలి.",
    "यह मधुमेह हो सकता है।",
    "आपको दवा लेनी चाहिए।",
  ])("rejects diagnosis or medicine advice: %s", (sentence) => {
    const result = validateSummary(ok(`Your HDL cholesterol is 38 mg/dL. ${sentence}`), "HDL cholesterol");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toMatch(/^contains "/);
  });

  it.each(["Visit https://example.com for more.", "Call 9876543210 for help.", "See www.example.com"])("rejects links and phone numbers: %s", (s) => {
    expect(validateSummary(ok(`Your HDL cholesterol is 38 mg/dL. ${s}`), "HDL cholesterol")).toEqual({
      ok: false,
      reason: "contains a link or phone number",
    });
  });
});
