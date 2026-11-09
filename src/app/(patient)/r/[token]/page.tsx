import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AlertIcon } from "@/components/ui/icons";
import { patientStrings, type PatientStrings } from "@/lib/i18n/patient";
import { maskMobile } from "@/lib/mobile";
import { logAccess } from "@/server/accessLog";
import { getLang } from "@/server/lang";
import { getPatientMobile } from "@/server/patientSession";
import { openLink, type OpenedLink } from "@/server/reportLinks";
import { LinkCodeFlow } from "./LinkCodeFlow";

export default async function ReportLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lang = await getLang();
  const t = patientStrings(lang);

  const link = await openLink(token);
  if (link.state !== "VALID") return <LinkProblem state={link.state} t={t} />;

  await logAccess({ actorType: "PATIENT", action: "LINK_OPENED", orderId: link.orderId, patientId: link.patientId });

  // Already verified this phone in this browser: no need for another code.
  if ((await getPatientMobile()) === link.mobile) redirect(`/my/orders/${link.orderId}`);

  return (
    <Card>
      <h1 className="mb-4 text-3xl leading-tight font-semibold">{t.linkReadyTitle}</h1>
      <LinkCodeFlow token={token} masked={maskMobile(link.mobile)} lang={lang} />
    </Card>
  );
}

function LinkProblem({ state, t }: { state: Exclude<OpenedLink["state"], "VALID">; t: PatientStrings }) {
  const copy = {
    NOT_FOUND: [t.linkInvalidTitle, t.linkInvalidBody],
    EXPIRED: [t.linkExpiredTitle, t.linkExpiredBody],
    REVOKED: [t.linkRevokedTitle, t.linkRevokedBody],
  }[state];
  return (
    <Card className="flex flex-col gap-5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <AlertIcon className="h-7 w-7" />
      </span>
      <h1 className="text-3xl leading-tight font-semibold">{copy[0]}</h1>
      <p>{copy[1]}</p>
      <ButtonLink href="/login" size="lg">
        {t.signInWithMobile}
      </ButtonLink>
    </Card>
  );
}
