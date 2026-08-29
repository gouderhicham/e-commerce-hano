import type { Direction, Locale } from "./types";

/**
 * Locale plumbing shared between the middleware (edge runtime), server
 * components and client components. Kept free of React and `next/headers` so
 * importing it never drags either into the edge bundle.
 */

/**
 * Request header the middleware uses to forward the current pathname to server
 * components. Layouts have no access to the URL otherwise.
 */
export const PATHNAME_HEADER = "x-pathname";

/**
 * The chosen locale lives in ONE place: a plain (non-httpOnly) cookie, so the
 * server can read it in `app/layout.tsx` and render `<html lang dir>` correctly
 * on the very first byte. There is deliberately no localStorage copy — a second
 * store the server cannot see is exactly what produces a flash of the wrong
 * direction and hydration mismatches.
 */
export const LOCALE_COOKIE = "pcstore39_locale";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "ar";
}

export function dirOf(locale: Locale): Direction {
  return locale === "ar" ? "rtl" : "ltr";
}
