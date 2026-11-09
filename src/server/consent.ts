import { redirect } from "next/navigation";
import { CONSENT_VERSION } from "@/lib/consent";
import { db } from "./db";

export async function hasConsented(mobile: string): Promise<boolean> {
  const consent = await db.consent.findUnique({
    where: { mobile_wordingVersion: { mobile, wordingVersion: CONSENT_VERSION } },
    select: { id: true },
  });
  return consent !== null;
}

export async function recordConsent(mobile: string): Promise<void> {
  await db.consent.upsert({
    where: { mobile_wordingVersion: { mobile, wordingVersion: CONSENT_VERSION } },
    create: { mobile, wordingVersion: CONSENT_VERSION },
    update: {}, // keep the original time of agreement
  });
}

/** For patient pages: no health data is shown until this mobile has agreed to the current wording. */
export async function requireConsent(mobile: string, returnTo: string): Promise<void> {
  if (!(await hasConsented(mobile))) redirect(`/consent?next=${encodeURIComponent(returnTo)}`);
}
