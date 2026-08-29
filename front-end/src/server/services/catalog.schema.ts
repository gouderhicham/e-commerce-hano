import { z } from "zod";
import { LOCALES } from "../domain/locale";

export const PRODUCT_SORTS = [
  "nouveautes",
  "prix_asc",
  "prix_desc",
  "nom",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Public catalogue query (`GET /api/products`). All params optional.
 *
 * Everything arrives as a string from the query string, so the numeric fields
 * coerce. Unknown values for the enums are rejected rather than ignored, so a
 * typo in a hand-written URL fails loudly instead of silently listing
 * everything.
 */
export const productQuerySchema = z.object({
  q: z.string().optional(),
  /** CSV of category ids, e.g. "pt,ram". */
  category: z.string().optional(),
  /** CSV of availability values: disponible,stock_limite,indisponible. */
  availability: z.string().optional(),
  /**
   * Selected sidebar facets as `field:value1|value2;field2:value3`,
   * e.g. `cpu:Ryzen|Intel;ram:16 Go`. Fields match `TagGroup.field`.
   */
  attrs: z.string().optional(),
  priceMin: z.coerce.number().int().min(0).optional(),
  priceMax: z.coerce.number().int().min(0).optional(),
  sort: z.enum(PRODUCT_SORTS).optional(),
  /**
   * Reading language. Only affects ordering today ("Nom A-Z" sorts on `nameAr`
   * in Arabic); the payload always carries both languages.
   */
  locale: z.enum(LOCALES).optional(),
  page: z.coerce.number().int().min(1).optional(),
});

export type ProductQuery = z.output<typeof productQuerySchema>;

/** Suggest query (`GET /api/products/suggest`). */
export const suggestQuerySchema = z.object({
  q: z.string().optional(),
});

/** Numeric route param shared by every `/:id` product endpoint. */
export const numericIdParam = z.object({
  id: z.coerce.number().int().positive("Identifiant invalide."),
});
