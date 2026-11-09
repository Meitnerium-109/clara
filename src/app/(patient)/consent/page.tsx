import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckIcon } from "@/components/ui/icons";
import { patientStrings } from "@/lib/i18n/patient";
import { safePatientNext } from "@/lib/safePath";
import { hasConsented } from "@/server/consent";
import { getLang } from "@/server/lang";
import { requirePatientMobile } from "@/server/patientSession";
import { agreeToConsent } from "./actions";

export const metadata: Metadata = { title: "Consent · Clara" };

type Props = { searchParams: Promise<{ next?: string; error?: string }> };

export default async function ConsentPage({ searchParams }: Props) {
  const mobile = await requirePatientMobile();
  const { next: rawNext, error } = await searchParams;
  const next = safePatientNext(rawNext);
  if (await hasConsented(mobile)) redirect(next);

  const t = patientStrings(await getLang());
  return (
    <Card>
      <h1 className="text-3xl leading-tight font-semibold">{t.consentTitle}</h1>
      <ul className="mt-6 flex flex-col gap-4">
        {t.consentPoints.map((point) => (
          <li key={point} className="flex gap-3">
            <CheckIcon className="mt-1 h-6 w-6 shrink-0 text-accent" />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      <form action={agreeToConsent} className="mt-8 flex flex-col gap-5">
        <input type="hidden" name="next" value={next} />
        <label className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-paper p-4">
          <input type="checkbox" name="agree" value="yes" required className="mt-1 h-7 w-7 shrink-0 accent-[var(--color-accent)]" />
          <span className="font-medium">{t.consentAgree}</span>
        </label>
        {error && (
          <p role="alert" className="font-medium text-danger-ink">
            {t.consentRequired}
          </p>
        )}
        <Button type="submit" size="lg">
          {t.consentContinue}
        </Button>
      </form>
    </Card>
  );
}
