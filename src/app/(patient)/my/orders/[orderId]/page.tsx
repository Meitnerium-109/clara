import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/StatusPill";
import { AlertIcon } from "@/components/ui/icons";
import { flagLabel, formatDate, patientStrings } from "@/lib/i18n/patient";
import { logAccess } from "@/server/accessLog";
import { requireConsent } from "@/server/consent";
import { getLang } from "@/server/lang";
import { reportForMobile } from "@/server/patientData";
import { requirePatientMobile } from "@/server/patientSession";

export const metadata: Metadata = { title: "Report · Clara" };

export default async function ReportPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const mobile = await requirePatientMobile();
  await requireConsent(mobile, `/my/orders/${orderId}`);
  const lang = await getLang();
  const t = patientStrings(lang);

  const report = await reportForMobile(mobile, orderId);
  if (!report) notFound();
  await logAccess({ actorType: "PATIENT", action: "REPORT_VIEWED", orderId: report.id, patientId: report.patient.id });

  const back = (
    <Link href={`/my/p/${report.patient.id}`} className="inline-flex min-h-12 items-center text-accent underline underline-offset-4">
      <span aria-hidden="true">←&nbsp;</span>
      {t.allReports}
    </Link>
  );

  if (!report.ready) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Card>
          <h1 className="text-3xl leading-tight font-semibold">{t.notReadyTitle}</h1>
          <p className="mt-3">{t.notReadyBody}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {back}

      {report.critical && (
        <section role="alert" className="flex gap-4 rounded-card border-2 border-danger-ink bg-danger-bg p-5 text-danger-ink">
          <AlertIcon className="mt-1 h-8 w-8 shrink-0" />
          <div>
            <h2 className="text-2xl leading-tight font-bold">{t.criticalTitle}</h2>
            <p className="mt-2 font-medium">{t.criticalBody}</p>
          </div>
        </section>
      )}

      <Card>
        <h1 className="text-3xl leading-tight font-semibold">{report.patient.name}</h1>
        <p className="mt-2 text-ink-muted">
          {t.orderLabel(report.lisOrderId)}
          {report.signedAt && <> · {t.signedOn(formatDate(report.signedAt, lang))}</>}
        </p>
        <p className="text-ink-muted">{t.doctor(report.referringDoctor)}</p>
      </Card>

      <section aria-labelledby="results-heading" className="flex flex-col gap-3">
        <h2 id="results-heading" className="text-2xl font-semibold">
          {t.resultsHeading}
        </h2>
        <ul className="flex flex-col gap-3">
          {report.results.map((r) => {
            const range = `${r.refText} ${r.unit}`.trim();
            return (
              <li key={r.id} className="rounded-card border border-line bg-paper p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-xl font-semibold">{r.parameter}</h3>
                  <StatusPill flag={r.flag} label={flagLabel(t, r.flag)} />
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {r.valueText} <span className="text-xl font-normal text-ink-muted">{r.unit}</span>
                </p>
                <p className="mt-1 text-ink-muted">{r.refText ? t.normalRange(range) : t.noRange}</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Critical reports get no explanation: the lab calls instead. */}
      {!report.critical && (
        <section aria-labelledby="summary-heading" className="rounded-card border-2 border-dashed border-line p-5">
          <h2 id="summary-heading" className="text-xl font-semibold">
            {t.summaryTitle}
          </h2>
          <p className="mt-2 text-ink-muted">{t.summaryPending}</p>
          <p className="mt-3 text-base text-ink-muted">{t.disclaimer}</p>
        </section>
      )}

      {/* A plain link, not next/link: a file download shouldn't be prefetched. */}
      <a href={`/my/orders/${report.id}/pdf`} className={buttonClasses({ size: "lg" })}>
        {t.downloadPdf}
      </a>
    </div>
  );
}
