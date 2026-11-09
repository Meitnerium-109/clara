"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { parseLang, patientStrings, type Lang } from "@/lib/i18n/patient";
import { CodeForm } from "../../CodeForm";
import { flowMessage } from "../../flow";
import { sendLinkCode, verifyLinkCode } from "./actions";

export function LinkCodeFlow({ token, masked, lang }: { token: string; masked: string; lang: Lang }) {
  const t = patientStrings(parseLang(lang));
  const [step, setStep] = useState<"start" | "code">("start");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();

  if (step === "code") {
    return (
      <CodeForm
        t={t}
        intro={t.codeSentTo(masked)}
        submitLabel={t.openReport}
        verify={(code) => verifyLinkCode(token, code)}
        resend={() => sendLinkCode(token)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <p>{t.linkSendCodeTo(masked)}</p>
      <p aria-live="polite" className="min-h-7 font-medium text-danger-ink">
        {error}
      </p>
      <Button
        size="lg"
        loading={sending}
        onClick={() =>
          startSend(async () => {
            try {
              const result = await sendLinkCode(token);
              if (result.ok) setStep("code");
              else setError(flowMessage(t, result));
            } catch {
              setError(t.errorBody);
            }
          })
        }
      >
        {t.sendCode}
      </Button>
    </div>
  );
}
