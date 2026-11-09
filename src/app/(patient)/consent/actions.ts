"use server";

import { redirect } from "next/navigation";
import { safePatientNext } from "@/lib/safePath";
import { recordConsent } from "@/server/consent";
import { requirePatientMobile } from "@/server/patientSession";

export async function agreeToConsent(formData: FormData) {
  const mobile = await requirePatientMobile();
  const next = safePatientNext(formData.get("next"));
  if (formData.get("agree") !== "yes") redirect(`/consent?error=1&next=${encodeURIComponent(next)}`);
  await recordConsent(mobile);
  redirect(next);
}
