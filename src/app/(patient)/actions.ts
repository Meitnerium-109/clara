"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseLang } from "@/lib/i18n/patient";
import { safeLocalPath } from "@/lib/safePath";
import { LANG_COOKIE } from "@/server/lang";
import { endPatientSession } from "@/server/patientSession";

export async function setLanguage(formData: FormData) {
  (await cookies()).set(LANG_COOKIE, parseLang(formData.get("lang")), {
    path: "/",
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60,
    httpOnly: false, // only a language choice; the error screen reads it in the browser
  });
  redirect(safeLocalPath(formData.get("path")));
}

export async function signOutPatient() {
  await endPatientSession();
  redirect("/");
}
