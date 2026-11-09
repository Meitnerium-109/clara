/**
 * Calls Google Gemini for one explanation. Plain fetch, no SDK: one request
 * shape, easy to read and to test with a fake fetch.
 *
 * What is sent: only the prompt from buildPrompt (test, value, unit, range,
 * direction, language). No name, mobile, ID or doctor ever leaves our server.
 */

import { buildPrompt, SYSTEM_PROMPT, type PromptInput } from "@/lib/summaries/prompt";
import type { AiSummarizer } from "@/lib/summaries/resolve";

// Google retires model versions for new keys (gemini-2.5-flash already is), so
// the model is a setting: GEMINI_MODEL overrides this default. 3.5-flash was
// chosen by measurement: valid output in all 3 languages in ~1.4 s, while newer
// flash models didn't answer within the 8 s timeout (see docs/DECISIONS.md).
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const GEMINI_TIMEOUT_MS = 8000;

const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

type Options = {
  apiKey: string | undefined;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Turn off the model's thinking step (faster). Some model families reject this option. */
  disableThinking?: boolean;
};

export function geminiSummarizer({
  apiKey,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  fetchImpl = fetch,
  timeoutMs = GEMINI_TIMEOUT_MS,
  disableThinking = true,
}: Options): AiSummarizer {
  return async (prompt: PromptInput) => {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

    const response = await fetchImpl(endpoint(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, // key in a header, never in the URL
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildPrompt(prompt) }] }],
        generationConfig: {
          temperature: 0.2, // steady, plain wording
          maxOutputTokens: 400,
          responseMimeType: "application/json",
          responseSchema: { type: "OBJECT", properties: { summary: { type: "STRING" } }, required: ["summary"] },
          // A short explanation needs no reasoning step; much faster.
          ...(disableThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini returned ${response.status}`);

    const data = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no text");
    return text;
  };
}
