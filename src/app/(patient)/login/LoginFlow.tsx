"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { parseLang, patientStrings, type Lang } from "@/lib/i18n/patient";
import { CodeForm } from "../CodeForm";
import { flowMessage } from "../flow";
import { sendLoginCode, verifyLoginCode } from "./actions";

export function LoginFlow({ lang }: { lang: Lang }) {
  const t = patientStrings(parseLang(lang));
  const [mobile, setMobile] = useState("");
  const [masked, setMasked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  if (masked) {
    return (
      <div className="flex flex-col gap-2">
        <CodeForm
          t={t}
          intro={t.codeSentGeneric(masked)}
          submitLabel={t.continueButton}
          verify={(code) => verifyLoginCode(mobile, code)}
          resend={() => sendLoginCode(mobile)}
        />
        <Button variant="ghost" size="lg" onClick={() => setMasked(null)}>
          {t.changeNumber}
        </Button>
      </div>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    startSend(async () => {
      try {
        const result = await sendLoginCode(mobile);
        if (result.ok) {
          setError(null);
          setMasked(result.masked ?? "");
        } else setError(flowMessage(t, result));
      } catch {
        setError(t.errorBody);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{t.mobileLabel}</span>
        <span className="flex min-h-16 items-center rounded-2xl border border-line bg-paper focus-within:outline-3 focus-within:outline-accent">
          <span className="pl-4 text-2xl text-ink-muted" aria-hidden="true">
            +91
          </span>
          <input
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="98765 43210"
            autoFocus
            aria-invalid={error ? true : undefined}
            aria-describedby="mobile-message"
            className="min-w-0 flex-1 rounded-2xl bg-transparent px-3 text-2xl tabular-nums outline-none"
          />
        </span>
      </label>
      <p id="mobile-message" aria-live="polite" className="min-h-7 font-medium text-danger-ink">
        {error}
      </p>
      <Button type="submit" size="lg" loading={sending}>
        {t.sendCode}
      </Button>
    </form>
  );
}
