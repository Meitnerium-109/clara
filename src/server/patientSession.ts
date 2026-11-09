import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import {
  createSessionToken,
  PATIENT_COOKIE,
  PATIENT_IDLE_SECONDS,
  sessionCookieOptions,
  sessionKey,
  verifySessionToken,
} from "@/lib/session";

/**
 * A patient session proves "this browser verified a code sent to this mobile".
 * It holds only the mobile (E.164), in a signed httpOnly cookie that the
 * user's own browser keeps; every data query is then filtered by that mobile.
 */
export async function startPatientSession(mobile: string): Promise<void> {
  const token = await createSessionToken(mobile, "patient", PATIENT_IDLE_SECONDS, sessionKey(process.env.SESSION_SECRET));
  (await cookies()).set(PATIENT_COOKIE, token, sessionCookieOptions(PATIENT_IDLE_SECONDS));
}

export async function endPatientSession(): Promise<void> {
  (await cookies()).delete(PATIENT_COOKIE);
}

/** The signed-in mobile, or null. */
export const getPatientMobile = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(PATIENT_COOKIE)?.value;
  return verifySessionToken(token, "patient", sessionKey(process.env.SESSION_SECRET));
});

export async function requirePatientMobile(): Promise<string> {
  const mobile = await getPatientMobile();
  if (!mobile) redirect("/login");
  return mobile;
}
