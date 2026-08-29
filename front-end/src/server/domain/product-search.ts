/**
 * Columns a free-text product search looks at, on the storefront and in the
 * back office alike.
 *
 * The Arabic columns are in the list on purpose: the shop is bilingual, so a
 * customer browsing in Arabic types Arabic. Leaving `nameAr` / `specsAr` out
 * means their search matches nothing at all, which is not a "degraded" result —
 * it is a broken one. Add every new translatable text column here.
 */
export const PRODUCT_SEARCH_FIELDS = [
  "name",
  "nameAr",
  "reference",
  "specs",
  "specsAr",
] as const;

export type ProductSearchField = (typeof PRODUCT_SEARCH_FIELDS)[number];
