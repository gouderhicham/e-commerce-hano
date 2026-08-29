import { ar } from "./i18n/dictionaries/ar";
import { fr } from "./i18n/dictionaries/fr";
import type { Locale } from "./i18n/types";

const DICTIONARIES = { fr, ar } as const;

/**
 * `12500` → `"12500 DA"` (fr) or `"دج 12500"` (ar) · `null` → the locale's
 * "sur commande" wording. Unit and null wording both come from the
 * dictionaries, so there is exactly one place to change either.
 */
export function fmtDA(
  n: number | null | undefined,
  locale: Locale = "fr",
): string {
  const { currency, surCommande } = (DICTIONARIES[locale] ?? fr).common;
  if (n == null) return surCommande;
  const num = Math.round(n);
  return locale === "ar" ? `\u200E${num} ${currency}` : `${num} ${currency}`;
}

/** Plain number formatting (no unit). */
export function fmtN(n: number): string {
  return String(Math.round(n));
}

/**
 * `"48900 DA"` → `48900`. The admin price inputs display digits, so
 * every keystroke round-trips through here; anything non-numeric is dropped.
 */
export function parseDA(value: string): number {
  return Number(value.replace(/\D/g, "")) || 0;
}

/**
 * Resolve a product's pricing for display / charging. `onPromo` is true only
 * when `promoPrice` is a valid discount (both prices set, promo strictly less).
 * `effective` is the price actually paid; `original` is the struck-through one
 * (null when there's no promotion).
 */
export function priceInfo(p: {
  price: number | null;
  promoPrice: number | null;
}): { effective: number | null; original: number | null; onPromo: boolean } {
  const onPromo =
    p.price != null && p.promoPrice != null && p.promoPrice < p.price;
  return {
    effective: onPromo ? p.promoPrice : p.price,
    original: onPromo ? p.price : null,
    onPromo,
  };
}

const FR_MONTHS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
] as const;

/** `"2026-06-28"` → `"28 juin 2026"` (French short months). */
export function frDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${FR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** `"2026-07-18T13:05:00Z"` → `"18 juil. 2026, 14:05"` (local time). */
export function frDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${frDate(iso)}, ${hh}:${mm}`;
}

const LATIN_DIACRITICS = /[\u0300-\u036f]/g;
const ARABIC_TASHKEEL = /[\u064b-\u065f\u0670]/g;

/**
 * Unicode-aware slug generator supporting French (accents normalized) and Arabic:
 * - "Métrologie Spéciale" → "metrologie-speciale"
 * - "ذاكرة الوصول العشوائي" → "ذاكرة-الوصول-العشوائي"
 * - "حواسيب محمولة" → "حواسيب-محمولة"
 * - "Écran 4K شاشة" → "ecran-4k-شاشة"
 */
export function slugify(str: string, fallback = "item"): string {
  return (
    str
      .normalize("NFD")
      .replace(LATIN_DIACRITICS, "")
      .normalize("NFC")
      .replace(ARABIC_TASHKEEL, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || fallback
  );
}

