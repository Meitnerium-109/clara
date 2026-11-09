"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import type { PatientStrings } from "@/lib/i18n/patient";
import { flowMessage, type FlowResult } from "./flow";

type Props = {
  t: PatientStrings;
  intro: string;
  submitLabel: string;
  verify: (code: string) => Promise<FlowResult>;
  resend: () => Promise<FlowResult>;
};

/** One large code box and one primary button. On success the server redirects. */
export function CodeForm({ t, intro, submitLabel, verify, resend }: Props) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [resending, startResend] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return setMessage(t.otpFormat);
    startCheck(async () => {
      try {
        const result = await verify(code);
        if (!result.ok) {
          setMessage(flowMessage(t, result));
          if (result.reason !== "WRONG") setCode("");
        }
      } catch {
        setMessage(t.errorBody);
      }
    });
  }

  function sendAgain() {
    startResend(async () => {
      try {
        const result = await resend();
        setCode("");
        setMessage(result.ok ? null : flowMessage(t, result));
      } catch {
        setMessage(t.errorBody);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p>{intro}</p>
      <label className="flex flex-col gap-2">
        <span className="font-semibold">{t.codeLabel}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          autoFocus
          aria-invalid={message ? true : undefined}
          aria-describedby="code-message"
          className="min-h-16 rounded-2xl border border-line bg-paper px-4 text-center text-3xl font-semibold tracking-[0.4em] tabular-nums"
        />
      </label>
      <p id="code-message" aria-live="polite" className="min-h-7 font-medium text-danger-ink">
        {message}
      </p>
      <Button type="submit" size="lg" loading={checking} disabled={resending}>
        {submitLabel}
      </Button>
      <Button type="button" variant="ghost" size="lg" onClick={sendAgain} loading={resending} disabled={checking}>
        {t.resendCode}
      </Button>
    </form>
  );
}
