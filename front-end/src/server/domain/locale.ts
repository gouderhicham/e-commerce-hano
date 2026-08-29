/**
 * The two languages the storefront renders. The back office is French-only, so
 * this only ever affects public endpoints and customer-facing error messages.
 */
export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: unknown): value is Locale {
  return value === "fr" || value === "ar";
}

/**
 * Resolve the locale of a request from the `x-locale` header the front-end
 * sends, falling back to `Accept-Language` and finally to French.
 */
export function localeFromHeaders(
  headers:
    | {
        "x-locale"?: string | string[];
        "accept-language"?: string | string[];
      }
    | undefined
    | null,
): Locale {
  // Non-HTTP contexts (and test doubles) can reach the exception filter without
  // a headers bag at all — default rather than throwing inside error handling.
  if (!headers) return DEFAULT_LOCALE;

  const explicit = first(headers["x-locale"]);
  if (isLocale(explicit)) return explicit;

  const accept = first(headers["accept-language"])?.toLowerCase() ?? "";
  // Good enough for two languages: Arabic wins only if it is listed first.
  const primary = accept.split(",")[0]?.trim().slice(0, 2);
  return isLocale(primary) ? primary : DEFAULT_LOCALE;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
