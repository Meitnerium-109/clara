import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { Card } from "@/components/ui/Card";
import { SignInForm } from "./SignInForm";

export const metadata: Metadata = { title: "Staff sign in · Clara" };

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <Card>
        <Wordmark suffix="Staff" className="text-lg" />
        <h1 className="mt-6 text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 mb-6 text-ink-muted">For front-desk staff at Company A labs.</p>
        <SignInForm />
      </Card>
      <p className="mt-6 text-center text-[0.9375rem]">
        <Link href="/" className="text-accent underline-offset-4 hover:underline">
          ← Back to Clara
        </Link>
      </p>
    </main>
  );
}
