"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { parseLang, patientStrings, type Lang } from "@/lib/i18n/patient";
import { flagExplanation } from "./actions";

export function FlagExplanation({ summaryId, alreadyFlagged, lang }: { summaryId: string; alreadyFlagged: boolean; lang: Lang }) {
  const t = patientStrings(parseLang(lang));
  const [state, setState] = useState<"idle" | "open" | "sent">(alreadyFlagged ? "sent" : "idle");
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [sending, startSend] = useTransition();

  if (state === "sent") {
    return (
      <p role="status" className="mt-3 flex items-center gap-2 text-base font-medium text-accent">
        <CheckIcon className="h-5 w-5 shrink-0" />
        {t.flagThanks}
      </p>
    );
  }

  if (state === "idle") {
    return (
      <button type="button" onClick={() => setState("open")} className="mt-2 min-h-12 text-base text-accent underline underline-offset-4">
        {t.flagButton}
      </button>
    );
  }

  return (
    <form
      className="mt-3 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        startSend(async () => {
          try {
            const result = await flagExplanation(summaryId, note);
            if (result.ok) setState("sent");
            else setFailed(true);
          } catch {
            setFailed(true);
          }
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-medium">{t.flagNoteLabel}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          rows={3}
          maxLength={500}
          className="rounded-xl border border-line bg-paper p-3 text-base"
        />
      </label>
      {failed && (
        <p role="alert" className="text-base font-medium text-danger-ink">
          {t.errorBody}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={sending}>
          {t.flagSend}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setState("idle")} disabled={sending}>
          {t.flagCancel}
        </Button>
      </div>
    </form>
  );
}
