"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { maskMobile, normaliseMobile } from "@/lib/mobile";
import { sendOtp, verifyOtp } from "@/server/otp";
import { mobileHasPatients } from "@/server/patientData";
import { startPatientSession } from "@/server/patientSession";
import type { FlowResult } from "../flow";

const Text = z.string().max(30);

/**
 * Same answer whether or not the number has reports, so this form can't be
 * used to find out who is a patient of the lab. A code is only actually sent
 * when there is something to see.
 */
export async function sendLoginCode(mobileInput: string): Promise<FlowResult> {
  const text = Text.safeParse(mobileInput);
  const mobile = normaliseMobile(text.success ? text.data : "");
  if (!mobile.ok) return { ok: false, reason: "INVALID_MOBILE" };

  if (await mobileHasPatients(mobile.e164)) {
    const sent = await sendOtp(mobile.e164);
    if (!sent.ok) return { ok: false, reason: "RATE_LIMITED", minutes: sent.retryInMinutes };
  }
  return { ok: true, masked: maskMobile(mobile.e164) };
}

export async function verifyLoginCode(mobileInput: string, code: string): Promise<FlowResult> {
  const text = Text.safeParse(mobileInput);
  const mobile = normaliseMobile(text.success ? text.data : "");
  if (!mobile.ok) return { ok: false, reason: "INVALID_MOBILE" };

  const result = await verifyOtp(mobile.e164, Text.safeParse(code).success ? code : "");
  if (!result.ok) return result;

  await startPatientSession(mobile.e164);
  redirect("/my");
}
