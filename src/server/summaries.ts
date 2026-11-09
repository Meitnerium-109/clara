/**
 * Explanations for a report, in one language: read from the cache (Summary
 * table), and only the missing ones are generated. Two people opening the same
 * report at once can't create duplicates: (resultId, language) is unique and
 * inserts skip conflicts.
 */

import type { Language } from "@prisma/client";
import type { ResultFlag } from "@/lib/flags";
import type { Lang } from "@/lib/i18n/patient";
import { planSummary, resolveAiSummary, type AiSummarizer, type SummarySource } from "@/lib/summaries/resolve";
import { logAccess } from "./accessLog";
import { db } from "./db";
import { geminiSummarizer } from "./gemini";

const toDbLanguage = (lang: Lang) => lang.toUpperCase() as Language;

export type ShownSummary = {
  /** Null for a fallback we chose not to save (AI timed out); it can't be flagged. */
  id: string | null;
  text: string;
  source: Exclude<SummarySource, "NONE">;
  flagged: boolean;
};

type ReportForSummaries = {
  critical: boolean;
  results: Array<{ id: string; parameter: string; valueText: string; unit: string; refText: string; flag: ResultFlag }>;
};

const defaultAi = () => geminiSummarizer({ apiKey: process.env.GEMINI_API_KEY });

/** Which results get an explanation slot at all (out-of-range, not critical). */
export function resultsNeedingSummary(report: ReportForSummaries, lang: Lang): string[] {
  return report.results.filter((r) => planSummary(r, lang, report.critical).kind !== "NONE").map((r) => r.id);
}

export async function summariesForReport(
  report: ReportForSummaries,
  lang: Lang,
  ai: AiSummarizer = defaultAi(),
): Promise<Record<string, ShownSummary>> {
  const planned = report.results
    .map((r) => ({ result: r, plan: planSummary(r, lang, report.critical) }))
    .filter((p) => p.plan.kind !== "NONE");
  if (planned.length === 0) return {};

  const language = toDbLanguage(lang);
  const readCached = () =>
    db.summary.findMany({
      where: { resultId: { in: planned.map((p) => p.result.id) }, language },
      select: { id: true, resultId: true, text: true, source: true, flaggedAt: true },
    });

  const shown: Record<string, ShownSummary> = {};
  const remember = (rows: Awaited<ReturnType<typeof readCached>>) => {
    for (const row of rows) {
      shown[row.resultId] = { id: row.id, text: row.text, source: row.source as ShownSummary["source"], flagged: row.flaggedAt !== null };
    }
  };
  remember(await readCached());

  const missing = planned.filter((p) => !shown[p.result.id]);
  if (missing.length === 0) return shown;

  // AI calls run in parallel, each with its own timeout.
  const generated = await Promise.all(
    missing.map(async ({ result, plan }) => {
      if (plan.kind === "TEMPLATE") return { resultId: result.id, text: plan.text, source: "TEMPLATE" as const, cache: true };
      if (plan.kind === "AI") return { resultId: result.id, ...(await resolveAiSummary(plan.prompt, ai)) };
      throw new Error("unreachable");
    }),
  );

  const toSave = generated.filter((g) => g.cache);
  if (toSave.length > 0) {
    await db.summary.createMany({
      data: toSave.map((g) => ({ resultId: g.resultId, language, text: g.text, source: g.source })),
      skipDuplicates: true,
    });
    remember(await readCached()); // includes rows another request may have saved first
  }
  for (const g of generated) {
    if (!shown[g.resultId]) shown[g.resultId] = { id: null, text: g.text, source: g.source, flagged: false };
  }
  return shown;
}

/** "Generate English at sign-off": warms the cache so the first view is instant. */
export async function prepareEnglishSummaries(orderIds: string[], ai?: AiSummarizer): Promise<void> {
  for (const orderId of orderIds) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        critical: true,
        results: { select: { id: true, parameter: true, valueText: true, unit: true, refText: true, flag: true } },
      },
    });
    if (order?.status === "READY") await summariesForReport(order, "en", ai);
  }
}

/**
 * A patient says an explanation seems wrong. Only works for explanations on
 * reports for the signed-in mobile; anything else is quietly refused.
 */
export async function flagSummary(mobile: string, summaryId: string, note: string | null): Promise<boolean> {
  const summary = await db.summary.findFirst({
    where: { id: summaryId, result: { order: { patient: { mobile } } } },
    select: { id: true, result: { select: { orderId: true, order: { select: { patientId: true } } } } },
  });
  if (!summary) return false;

  await db.summary.update({ where: { id: summary.id }, data: { flaggedAt: new Date(), flagNote: note || null } });
  await logAccess({
    actorType: "PATIENT",
    action: "SUMMARY_FLAGGED",
    orderId: summary.result.orderId,
    patientId: summary.result.order.patientId,
  });
  return true;
}
