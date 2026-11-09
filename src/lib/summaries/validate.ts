/**
 * Checks AI output before any patient sees it. Anything that fails becomes
 * the fallback text: a missing explanation is safe, a wrong one isn't.
 */

import { z } from "zod";

export const SUMMARY_MIN_CHARS = 20;
export const SUMMARY_MAX_CHARS = 400;

const Output = z.object({ summary: z.string().trim().min(SUMMARY_MIN_CHARS).max(SUMMARY_MAX_CHARS) });

/**
 * Words that would turn an explanation into a diagnosis or medical advice, in
 * all three languages. Checked whatever the language, since models mix them.
 * Deliberately broad: a false alarm only costs a fallback message.
 */
export const BANNED_PHRASES = [
  // diagnosis and named conditions
  "diagnos", "disease", "disorder", "condition", "you have", "suffering", "cancer", "tumour", "tumor",
  "diabet", "anaemi", "anemi", "hypothyroid", "hyperthyroid", "kidney failure", "kidney disease",
  "infection", "dengue", "heart attack", "stroke", "deficien",
  // medicines and treatment
  "medicine", "medication", "tablet", "capsule", "pill", "dose", "dosage", "prescri", "supplement",
  "insulin", "statin", "metformin", "iron tablet", "treatment", "treat ", "cure", "stop taking",
  // reassurance or alarm the AI must not give
  "nothing to worry", "not serious", "dangerous", "emergency",
  // Telugu
  "వ్యాధి", "రోగం", "నిర్ధారణ", "మందు", "మాత్ర", "చికిత్స", "డయాబెటిస్", "షుగర్ వ్యాధి", "క్యాన్సర్",
  // Hindi
  "बीमारी", "रोग", "निदान", "दवा", "दवाई", "गोली", "इलाज", "मधुमेह", "डायबिटीज", "कैंसर",
];

export type ValidationResult = { ok: true; text: string } | { ok: false; reason: string };

export function validateSummary(raw: string, parameter: string): ValidationResult {
  // Some models wrap JSON in ```json fences even when asked not to.
  const unfenced = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

  let json: unknown;
  try {
    json = JSON.parse(unfenced);
  } catch {
    return { ok: false, reason: "not JSON" };
  }

  const parsed = Output.safeParse(json);
  if (!parsed.success) return { ok: false, reason: "wrong shape or length" };
  const text = parsed.data.summary.replace(/\s+/g, " ");

  if (!text.toLowerCase().includes(parameter.trim().toLowerCase())) {
    return { ok: false, reason: "does not name the test" };
  }
  const lower = text.toLowerCase();
  const banned = BANNED_PHRASES.find((phrase) => lower.includes(phrase));
  if (banned) return { ok: false, reason: `contains "${banned}"` };
  if (/https?:\/\/|www\.|\d{7,}/i.test(text)) return { ok: false, reason: "contains a link or phone number" };

  return { ok: true, text };
}
