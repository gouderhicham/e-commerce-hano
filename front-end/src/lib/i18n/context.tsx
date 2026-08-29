"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { Dictionary, Direction, Locale } from "./types";
import { LOCALE_COOKIE, dirOf } from "./shared";
import { fr } from "./dictionaries/fr";
import { ar } from "./dictionaries/ar";

interface I18nContextValue {
  locale: Locale;
  dir: Direction;
  isRTL: boolean;
  t: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const DICTIONARIES: Record<Locale, Dictionary> = { fr, ar };

const I18nContext = createContext<I18nContextValue>({
  locale: "fr",
  dir: "ltr",
  isRTL: false,
  t: fr,
  setLocale: () => {},
  toggleLocale: () => {},
});

function persistLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  try {
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;
    document.documentElement.dir = dirOf(locale);
    document.documentElement.lang = locale;
  } catch {
    // Cookies disabled — the in-memory locale still works for this page view.
  }
}

export function I18nProvider({
  initialLocale = "fr",
  children,
}: {
  initialLocale?: Locale;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const applyLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistLocale(next);
  }, []);

  const toggleLocale = useCallback(() => {
    applyLocale(locale === "fr" ? "ar" : "fr");
  }, [locale, applyLocale]);

  const dir = dirOf(locale);

  return (
    <I18nContext.Provider
      value={{
        locale,
        dir,
        isRTL: locale === "ar",
        t: DICTIONARIES[locale] ?? fr,
        setLocale: applyLocale,
        toggleLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
