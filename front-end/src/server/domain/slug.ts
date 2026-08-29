/**
 * Unicode combining diacritical marks for Latin accents (U+0300–U+036F)
 * and Arabic tashkeel / diacritics (U+064B–U+065F, U+0670).
 */
const LATIN_DIACRITICS = /[\u0300-\u036f]/g;
const ARABIC_TASHKEEL = /[\u064b-\u065f\u0670]/g;

/**
 * Unicode-aware slug generator supporting French (accents normalized) and Arabic:
 * - "Métrologie Spéciale" → "metrologie-speciale"
 * - "ذاكرة الوصول العشوائي" → "ذاكرة-الوصول-العشوائي"
 * - "حواسيب محمولة" → "حواسيب-محمولة"
 * - "Écran 4K شاشة" → "ecran-4k-شاشة"
 */
export function slugify(name: string, fallback = "categorie"): string {
  return (
    name
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

/**
 * Generates an ASCII attribute field key suitable for JSON attributes (e.g. `product.attributes[field]`).
 * - "Capacité RAM" → "capacite_ram"
 * - "Écran / Résolution" → "ecran_resolution"
 * - "Format SSD" → "format_ssd"
 */
export function generateFieldKey(name: string, fallback = "attr"): string {
  return (
    name
      .normalize("NFD")
      .replace(LATIN_DIACRITICS, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || fallback
  );
}
