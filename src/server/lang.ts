import { cookies } from "next/headers";
import { parseLang, type Lang } from "@/lib/i18n/patient";

export const LANG_COOKIE = "clara_lang";

/** The patient's chosen language, remembered in a cookie (not personal data). */
export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}
