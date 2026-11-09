/**
 * Decides where a result's explanation comes from, in this order:
 *  1. Critical order or critical value → no explanation (the lab phones instead).
 *  2. Normal, unknown or no range → no explanation needed (only out-of-range values get one).
 *  3. A locked template exists for this test → the template.
 *  4. Otherwise ask the AI, validate the answer, and fall back on any problem.
 */

import { isCriticalFlag, type ResultFlag } from "../flags";
import type { Lang } from "../i18n/patient";
import type { PromptInput } from "./prompt";
import { findTemplate, renderTemplate } from "./templates";
import { validateSummary } from "./validate";

export type SummarySource = "TEMPLATE" | "AI" | "FALLBACK" | "NONE";

export const FALLBACK_TEXT: Record<Lang, string> = {
  en: "A simple explanation is not available. Please see your full report or ask your doctor.",
  te: "సులభమైన వివరణ అందుబాటులో లేదు. దయచేసి మీ పూర్తి రిపోర్ట్ చూడండి లేదా మీ డాక్టర్‌ను అడగండి.",
  hi: "आसान व्याख्या उपलब्ध नहीं है। कृपया अपनी पूरी रिपोर्ट देखें या अपने डॉक्टर से पूछें।",
};

export type SummaryInput = {
  parameter: string;
  valueText: string;
  unit: string;
  refText: string;
  flag: ResultFlag;
};

export type SummaryPlan = { kind: "NONE" } | { kind: "TEMPLATE"; text: string } | { kind: "AI"; prompt: PromptInput };

export function planSummary(result: SummaryInput, lang: Lang, orderCritical: boolean): SummaryPlan {
  if (orderCritical || isCriticalFlag(result.flag)) return { kind: "NONE" };
  if (result.flag !== "LOW" && result.flag !== "HIGH") return { kind: "NONE" };

  const input = { ...result, flag: result.flag };
  const template = findTemplate(result.parameter);
  if (template) return { kind: "TEMPLATE", text: renderTemplate(template, input, lang) };

  return {
    kind: "AI",
    prompt: { parameter: result.parameter, valueText: result.valueText, unit: result.unit, refText: result.refText, flag: result.flag, lang },
  };
}

/** Returns the raw model text, or throws on network error, timeout, missing key or bad response. */
export type AiSummarizer = (prompt: PromptInput) => Promise<string>;

export type ResolvedSummary = {
  text: string;
  source: Exclude<SummarySource, "NONE">;
  /**
   * Whether to save it. A fallback after bad AI output is saved (asking again
   * would cost money and likely fail again). A fallback after a timeout or
   * outage is not, so the next view tries again.
   */
  cache: boolean;
};

export async function resolveAiSummary(prompt: PromptInput, ai: AiSummarizer): Promise<ResolvedSummary> {
  let raw: string;
  try {
    raw = await ai(prompt);
  } catch {
    return { text: FALLBACK_TEXT[prompt.lang], source: "FALLBACK", cache: false };
  }
  const checked = validateSummary(raw, prompt.parameter);
  return checked.ok
    ? { text: checked.text, source: "AI", cache: true }
    : { text: FALLBACK_TEXT[prompt.lang], source: "FALLBACK", cache: true };
}
