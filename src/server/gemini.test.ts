import { describe, expect, it, vi } from "vitest";
import type { PromptInput } from "@/lib/summaries/prompt";
import { geminiSummarizer } from "./gemini";

const prompt: PromptInput = { parameter: "HDL cholesterol", valueText: "38", unit: "mg/dL", refText: ">40", flag: "LOW", lang: "en" };
const reply = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const fakeFetch = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("geminiSummarizer", () => {
  it("returns the model's text", async () => {
    const fetchImpl = fakeFetch(reply('{"summary":"ok"}'));
    expect(await geminiSummarizer({ apiKey: "k", fetchImpl })(prompt)).toBe('{"summary":"ok"}');
  });

  it("sends the key in a header, not the URL, and asks for JSON", async () => {
    const fetchImpl = fakeFetch(reply("{}"));
    await geminiSummarizer({ apiKey: "secret-key", fetchImpl })(prompt);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).not.toContain("secret-key");
    expect(url).toContain("/models/");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("secret-key");
    expect(JSON.parse(init.body as string).generationConfig.responseMimeType).toBe("application/json");
  });

  it("sends only the prompt fields: no names, mobiles or IDs", async () => {
    const fetchImpl = fakeFetch(reply("{}"));
    const leaky = { ...prompt, patientName: "Lakshmi Prasanna K", mobile: "+919000000001", lisOrderId: "ORD-71204" };
    await geminiSummarizer({ apiKey: "k", fetchImpl })(leaky as PromptInput);
    const body = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string;
    for (const secret of ["Lakshmi", "9000000001", "ORD-71204"]) expect(body).not.toContain(secret);
  });

  it("uses the model it is given", async () => {
    const fetchImpl = fakeFetch(reply("{}"));
    await geminiSummarizer({ apiKey: "k", model: "some-model-1", fetchImpl })(prompt);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toContain("/models/some-model-1:generateContent");
  });

  it("can leave out the thinking setting for models that reject it", async () => {
    const fetchImpl = fakeFetch(reply("{}"));
    await geminiSummarizer({ apiKey: "k", fetchImpl, disableThinking: false })(prompt);
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.generationConfig.thinkingConfig).toBeUndefined();
  });

  it("fails without a key, without calling out", async () => {
    const fetchImpl = fakeFetch(reply("{}"));
    await expect(geminiSummarizer({ apiKey: undefined, fetchImpl })(prompt)).rejects.toThrow(/GEMINI_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails on an error status", async () => {
    await expect(geminiSummarizer({ apiKey: "k", fetchImpl: fakeFetch({ error: "quota" }, 429) })(prompt)).rejects.toThrow(/429/);
  });

  it("fails on an empty or odd response", async () => {
    await expect(geminiSummarizer({ apiKey: "k", fetchImpl: fakeFetch({ candidates: [] }) })(prompt)).rejects.toThrow(/no text/);
    await expect(geminiSummarizer({ apiKey: "k", fetchImpl: fakeFetch({}) })(prompt)).rejects.toThrow(/no text/);
  });

  it("gives up after the timeout", async () => {
    const hanging = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))),
    );
    const started = Date.now();
    await expect(geminiSummarizer({ apiKey: "k", fetchImpl: hanging as typeof fetch, timeoutMs: 50 })(prompt)).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
