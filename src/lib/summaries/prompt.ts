/**
 * The prompt sent to the AI. Built from an explicit list of fields, so no
 * name, mobile, order ID or doctor can reach it, even if the caller passes
 * a whole database row.
 */

import type { Lang } from "../i18n/patient";
import { withUnit } from "./templates";

export type PromptInput = {
  parameter: string;
  valueText: string;
  unit: string;
  refText: string;
  flag: "LOW" | "HIGH";
  lang: Lang;
};

const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", te: "Telugu (తెలుగు script)", hi: "Hindi (Devanagari script)" };

export const SYSTEM_PROMPT = [
  "You explain one lab test result to a patient in India in plain, calm, simple words, for someone with little schooling.",
  "Write 2 or 3 short sentences, at most 60 words.",
  "Say what the test measures in everyday words, and whether the result is lower or higher than the normal range.",
  "Do not name any disease or condition. Do not diagnose. Do not suggest medicines, supplements, doses, diets or treatment.",
  "Do not say whether it is serious or not. End by saying their doctor will explain what it means for them.",
  'Reply only with JSON: {"summary": "..."}.',
].join(" ");

export function buildPrompt(input: PromptInput): string {
  // Pick each field by name: nothing else from the input object is used.
  const { parameter, valueText, unit, refText, flag, lang } = input;
  return [
    `Language: ${LANGUAGE_NAMES[lang]}.`,
    `Test name (write it exactly like this, in English letters, at least once): ${parameter}`,
    `Result: ${withUnit(valueText, unit)}`,
    `Normal range: ${withUnit(refText, unit)}`,
    // Plain lowercase words: in capitals, the model tends to copy them into Telugu/Hindi text.
    `Direction: ${flag === "LOW" ? "below" : "above"} the normal range.`,
  ].join("\n");
}
