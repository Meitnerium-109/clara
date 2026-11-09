import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CheckIcon, ClockIcon } from "@/components/ui/icons";
import { formatDate, patientStrings } from "@/lib/i18n/patient";
import { requireConsent } from "@/server/consent";
import { getLang } from "@/server/lang";
import { ordersForPatient, patientForMobile, patientsForMobile } from "@/server/patientData";
import { requirePatientMobile } from "@/server/patientSession";

export const metadata: Metadata = { title: "Reports · Clara" };

export default async function PatientOrdersPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const mobile = await requirePatientMobile();
  await requireConsent(mobile, `/my/p/${patientId}`);
  const lang = await getLang();
  const t = patientStrings(lang);

  const patient = await patientForMobile(mobile, patientId);
  if (!patient) notFound();
  const [orders, family] = await Promise.all([ordersForPatient(mobile, patientId), patientsForMobile(mobile)]);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h1 className="text-3xl leading-tight font-semibold">{t.ordersTitle(patient.name)}</h1>
        {family.length > 1 && (
          <Link href="/my" className="mt-3 inline-block text-accent underline underline-offset-4">
            {t.choosePerson}
          </Link>
        )}
      </Card>

      {orders.length === 0 ? (
        <Card surface="solid">
          <EmptyState title={t.ordersEmpty} message={t.processingHint} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const date = formatDate(order.signedAt ?? order.createdAt, lang);
            return (
              <li key={order.id}>
                {order.status === "READY" ? (
                  <Link
                    href={`/my/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 rounded-card border border-line bg-paper p-5 hover:border-accent"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="font-semibold">{date}</span>
                      <span className="text-ink-muted">{t.orderLabel(order.lisOrderId)}</span>
                      <span className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent">
                        <CheckIcon className="h-5 w-5" />
                        {t.statusReady}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-accent">
                      {t.viewReport} <span aria-hidden="true">→</span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 rounded-card border border-line bg-paper/70 p-5">
                    <span className="font-semibold">{date}</span>
                    <span className="text-ink-muted">{t.orderLabel(order.lisOrderId)}</span>
                    <span className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-neutral-bg px-3 py-1 font-semibold text-ink-muted">
                      <ClockIcon className="h-5 w-5" />
                      {t.statusProcessing}
                    </span>
                    <span className="text-ink-muted">{t.processingHint}</span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
