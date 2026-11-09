"use client";

import { usePathname } from "next/navigation";
import { LANGUAGE_NAMES, LANGUAGES, type Lang } from "@/lib/i18n/patient";
import { cn } from "@/lib/cn";

type Props = { current: Lang; label: string; action: (formData: FormData) => Promise<void> };

/** Works without JavaScript too: it's a plain form posting to a server action. */
export function LanguageSwitch({ current, label, action }: Props) {
  const pathname = usePathname();
  return (
    <form action={action} className="glass flex rounded-full p-1" aria-label={label}>
      <input type="hidden" name="path" value={pathname} />
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="submit"
          name="lang"
          value={lang}
          lang={lang}
          aria-pressed={lang === current}
          // System font for the labels, so showing "తెలుగు" doesn't download the
          // whole Telugu web font on an English page.
          style={{ fontFamily: "system-ui, sans-serif" }}
          className={cn(
            "min-h-11 min-w-12 rounded-full px-3 text-base font-semibold",
            lang === current ? "bg-accent text-white" : "text-accent hover:bg-accent-soft",
          )}
        >
          {lang === "en" ? "EN" : LANGUAGE_NAMES[lang]}
        </button>
      ))}
    </form>
  );
}
