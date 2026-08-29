import type { Showcase } from "../data/types";
import type { Locale } from "./types";

/**
 * i18n helpers.
 *
 * Editorial content (products, categories, home blocks) carries its Arabic
 * translation in sibling `*Ar` columns written by the back office — there are
 * no hard-coded translations of shop data anywhere in this folder. Interface
 * chrome lives in `dictionaries/`.
 */

/**
 * Pick the Arabic variant when the locale is Arabic AND the translation is a
 * non-empty string; fall back to the French original otherwise.
 *
 * This is THE way to render a translatable database field — never inline
 * `locale === "ar" ? x.nameAr : x.name`, which silently prints an empty string
 * when the admin has not filled the Arabic column yet.
 */
export function pick(
  locale: Locale,
  base: string | null | undefined,
  arabic: string | null | undefined,
): string {
  if (locale === "ar" && typeof arabic === "string" && arabic.trim()) {
    return arabic;
  }
  return base ?? "";
}

/** Replace `{token}` placeholders in a dictionary string. */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}

export function localizeShowcase(
  showcase: Showcase | undefined,
  locale: Locale,
): Showcase | undefined {
  if (!showcase) return undefined;
  if (locale === "fr") return showcase;

  return {
    ...showcase,
    eyebrow: pick(locale, showcase.eyebrow, showcase.eyebrowAr),
    title: pick(locale, showcase.title, showcase.titleAr),
    subtitle: pick(locale, showcase.subtitle, showcase.subtitleAr),
    description: pick(locale, showcase.description, showcase.descriptionAr),
    imageAlt: pick(locale, showcase.imageAlt, showcase.imageAltAr),
    specs: (showcase.specs || []).map((s) => ({
      label: pick(locale, s.label, s.labelAr),
      val: pick(locale, s.val, s.valAr),
    })),
  };
}
