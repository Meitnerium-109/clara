import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { isDemoMode } from "@/server/config";

export const dynamic = "force-dynamic"; // DEMO_MODE is read at request time

export default function HomePage() {
  return (
    <main className="patient-scale mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <Card>
        <Wordmark className="text-2xl" />

        <h1 className="mt-8 text-3xl leading-tight font-semibold">Your lab reports, clear and safe.</h1>
        {/* Telugu and Hindi taglines were AI-translated; see docs/ASSUMPTIONS.md. */}
        <p lang="te" className="mt-3 text-xl text-ink-muted">
          మీ ల్యాబ్ రిపోర్టులు, స్పష్టంగా మరియు సురక్షితంగా.
        </p>
        <p lang="hi" className="mt-1 text-xl text-ink-muted">
          आपकी लैब रिपोर्ट, साफ़ और सुरक्षित।
        </p>

        <div className="mt-8 rounded-2xl bg-accent-soft p-5">
          <h2 className="font-semibold">How to see your report</h2>
          <p className="mt-2">
            When your report is ready, the lab sends a link to your phone on WhatsApp or SMS. Open that link,
            enter the code we send you, and your report will open.
          </p>
        </div>

        <ButtonLink href="/login" size="lg" className="mt-8">
          See my reports
        </ButtonLink>
      </Card>

      <p className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-base">
        <Link href="/staff/login" className="text-accent underline underline-offset-4">
          Lab staff sign in
        </Link>
        {isDemoMode() && (
          <Link href="/demo/phone" className="text-accent underline underline-offset-4">
            Demo phone (for reviewers)
          </Link>
        )}
      </p>
    </main>
  );
}
