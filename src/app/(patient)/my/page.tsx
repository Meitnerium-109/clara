import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { patientStrings } from "@/lib/i18n/patient";
import { requireConsent } from "@/server/consent";
import { getLang } from "@/server/lang";
import { patientsForMobile } from "@/server/patientData";
import { requirePatientMobile } from "@/server/patientSession";

export const metadata: Metadata = { title: "My reports · Clara" };

export default async function MyReportsPage() {
  const mobile = await requirePatientMobile();
  await requireConsent(mobile, "/my");
  const t = patientStrings(await getLang());
  const patients = await patientsForMobile(mobile);

  if (patients.length === 1) redirect(`/my/p/${patients[0].id}`);

  if (patients.length === 0) {
    return (
      <Card>
        <EmptyState title={t.noPatientsTitle} message={t.noPatientsBody} />
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-3xl leading-tight font-semibold">{t.pickerTitle}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t.pickerIntro}</p>
      <ul className="flex flex-col gap-3">
        {patients.map((p) => (
          <li key={p.id}>
            <ButtonLink href={`/my/p/${p.id}`} variant="secondary" size="lg" className="min-h-16 justify-start text-2xl">
              {p.name}
            </ButtonLink>
          </li>
        ))}
      </ul>
    </Card>
  );
}
