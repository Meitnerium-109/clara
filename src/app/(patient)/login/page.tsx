import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { patientStrings } from "@/lib/i18n/patient";
import { getLang } from "@/server/lang";
import { LoginFlow } from "./LoginFlow";

export const metadata: Metadata = { title: "Sign in · Clara" };

export default async function PatientLoginPage() {
  const lang = await getLang();
  const t = patientStrings(lang);
  return (
    <Card>
      <h1 className="text-3xl leading-tight font-semibold">{t.loginTitle}</h1>
      <p className="mt-2 mb-6 text-ink-muted">{t.loginIntro}</p>
      <LoginFlow lang={lang} />
    </Card>
  );
}
