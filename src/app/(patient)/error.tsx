"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { parseLang, patientStrings } from "@/lib/i18n/patient";

export default function PatientError({ reset }: { error: Error; reset: () => void }) {
  // The language cookie is readable in the browser for exactly this screen.
  const lang = parseLang(typeof document !== "undefined" ? document.cookie.match(/(?:^|; )clara_lang=(\w+)/)?.[1] : undefined);
  const t = patientStrings(lang);
  return (
    <Card>
      <ErrorState title={t.errorTitle} message={t.errorBody} action={<Button size="lg" onClick={reset}>{t.tryAgain}</Button>} />
    </Card>
  );
}
