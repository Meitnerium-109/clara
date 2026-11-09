import type { Lang, PatientStrings } from "@/lib/i18n/patient";
import { FALLBACK_TEXT } from "@/lib/summaries/resolve";
import type { ShownSummary } from "@/server/summaries";
import { FlagExplanation } from "./FlagExplanation";

type Props = { summaries: Promise<Record<string, ShownSummary>>; resultId: string; t: PatientStrings; lang: Lang };

/** Rendered inside <Suspense>: waits for the explanations without holding up the rest of the page. */
export async function ResultSummary({ summaries, resultId, t, lang }: Props) {
  let summary: ShownSummary | undefined;
  try {
    summary = (await summaries)[resultId];
  } catch {
    summary = undefined; // never a broken page: show the fallback instead
  }
  const text = summary?.text ?? FALLBACK_TEXT[lang];
  const canFlag = summary?.id && summary.source !== "FALLBACK";

  return (
    <SummaryBox t={t}>
      <p>{text}</p>
      <p className="mt-2 text-base text-ink-muted">{t.disclaimer}</p>
      {canFlag && <FlagExplanation summaryId={summary!.id!} alreadyFlagged={summary!.flagged} lang={lang} />}
    </SummaryBox>
  );
}

export function SummaryLoading({ t }: { t: PatientStrings }) {
  return (
    <SummaryBox t={t}>
      <p className="animate-pulse text-ink-muted motion-reduce:animate-none">{t.summaryLoading}</p>
    </SummaryBox>
  );
}

function SummaryBox({ t, children }: { t: PatientStrings; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl bg-accent-soft p-4">
      <h4 className="mb-1 text-base font-semibold text-accent">{t.summaryTitle}</h4>
      {children}
    </div>
  );
}
