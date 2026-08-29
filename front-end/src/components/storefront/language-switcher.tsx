"use client";

import { useI18n } from "@/lib/i18n/context";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.nav.languageSwitcher}
      className={`inline-flex items-center rounded-full border border-[#17251f]/12 bg-[#f0f4ef] p-1 shadow-2xs transition-all ${className}`}
    >
      <button
        type="button"
        onClick={() => setLocale("fr")}
        aria-pressed={locale === "fr"}
        className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${
          locale === "fr"
            ? "bg-[#1d4538] text-white shadow-xs"
            : "text-[#58675f] hover:text-[#17251f]"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        aria-pressed={locale === "ar"}
        className={`cursor-pointer rounded-full px-2.5 py-1 text-[11px] font-bold transition-all duration-200 ${
          locale === "ar"
            ? "bg-[#1d4538] text-white shadow-xs"
            : "text-[#58675f] hover:text-[#17251f]"
        }`}
      >
        العربية
      </button>
    </div>
  );
}
