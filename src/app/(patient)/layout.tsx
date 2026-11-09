import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { patientStrings } from "@/lib/i18n/patient";
import { getLang } from "@/server/lang";
import { getPatientMobile } from "@/server/patientSession";
import { setLanguage, signOutPatient } from "./actions";
import { LanguageSwitch } from "./LanguageSwitch";

// Health data pages must never appear in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = patientStrings(lang);
  const signedIn = (await getPatientMobile()) !== null;

  return (
    <div lang={lang} className="patient-scale min-h-dvh">
      <header className="mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <Link href={signedIn ? "/my" : "/"} className="rounded-lg">
          <Wordmark className="text-xl" />
        </Link>
        <LanguageSwitch current={lang} label={t.languageLabel} action={setLanguage} />
      </header>
      <main className="mx-auto max-w-xl px-4 pt-6 pb-10">{children}</main>
      {signedIn && (
        <footer className="mx-auto max-w-xl px-4 pb-10 text-center">
          <form action={signOutPatient}>
            <button type="submit" className="min-h-12 rounded-xl px-4 text-accent underline underline-offset-4">
              {t.signOut}
            </button>
          </form>
        </footer>
      )}
    </div>
  );
}
