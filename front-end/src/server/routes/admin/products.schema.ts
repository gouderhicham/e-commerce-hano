import { z } from "zod";

/**
 * The product form is sent as `multipart/form-data` so the gallery files ride
 * in the same request. Every field therefore arrives as a string, and the
 * structured ones as JSON-encoded strings — hence the preprocessors below.
 *
 * Each is a no-op when the value already has the right runtime type, so the
 * same schema still validates a plain JSON body.
 */

/** `"true"`/`"1"` → true, `"false"`/`"0"` → false. */
const boolish = z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, z.boolean());

/** Empty string / `"null"` → null ("Sur commande"), numeric string → number. */
const nullableInt = (message: string) =>
  z.preprocess(
    (v) => {
      if (v === "" || v === null || v === "null") return null;
      if (typeof v === "string" && v.trim() !== "") {
        const n = Number(v);
        return Number.isNaN(n) ? v : n;
      }
      return v;
    },
    z.number().int(message).min(0, message).nullable(),
  );

/** Parse a JSON-encoded value; malformed input falls through to fail the schema. */
function jsonish(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return v;
  }
}

const configurationSchema = z.object({
  label: z.string(),
  labelAr: z.string().nullish(),
  sub: z.string(),
  subAr: z.string().nullish(),
  price: z.number().nullish(),
});

const promiseSchema = z.object({
  icon: z.string(),
  title: z.string(),
  titleAr: z.string().nullish(),
  text: z.string(),
  textAr: z.string().nullish(),
});

/**
 * The editable fields shared by create and update. Kept in one place so the two
 * can never disagree about which fields exist — the job `PartialType` did.
 */
const productFields = {
  // 01 · Identite & visibilite
  reference: z.string().trim().min(1, "La référence est requise."),
  name: z.string().trim().min(1, "Le nom est requis."),
  nameAr: z.string().optional(),
  categoryId: z.string().trim().min(1, "La catégorie est requise."),
  condition: z.string().optional(),
  conditionAr: z.string().optional(),
  /** Background colour of the catalogue thumbnail. */
  tone: z.string().optional(),
  stock: z.coerce
    .number()
    .int()
    .min(0, "Le stock ne peut pas être négatif.")
    .optional(),
  active: boolish.optional(),

  // 02 · Prix
  price: nullableInt("Prix invalide.").optional(),
  promoPrice: nullableInt("Prix promotionnel invalide.").optional(),

  // 03 · Carte catalogue & filtres
  specs: z.string().optional(),
  specsAr: z.string().optional(),
  attributes: z
    .preprocess(
      jsonish,
      z.record(z.string(), z.union([z.string(), z.array(z.string())]), {
        error: "Attributs invalides.",
      }),
    )
    .optional(),

  // 04 · Visuels
  /**
   * Final gallery order, JSON-encoded. Each entry references an existing image
   * (`{"id":12}`), a newly uploaded file by index (`{"newIndex":0}`), or an
   * already-hosted URL (`{"url":"/images/..."}`).
   */
  imageOrder: z.string().optional(),
  coverIndex: z.coerce
    .number()
    .int("Index de couverture invalide.")
    .min(0, "Index de couverture invalide.")
    .optional(),

  // 05 · Fiche produit
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  configurations: z
    .preprocess(jsonish, z.array(configurationSchema, {
      error: "Configurations invalides.",
    }))
    .optional(),
  deliveryNote: z.string().optional(),
  deliveryNoteAr: z.string().optional(),
  promises: z
    .preprocess(jsonish, z.array(promiseSchema, { error: "Promesses invalides." }))
    .optional(),
};

export const createProductSchema = z.object(productFields);

/** PATCH: every field optional; omitting `imageOrder` leaves the gallery alone. */
export const updateProductSchema = z.object(productFields).partial();

export type CreateProductInput = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.output<typeof updateProductSchema>;

export const productAdminQuerySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(["actif", "inactif"]).optional(),
  availability: z.enum(["disponible", "stock_limite", "indisponible"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const setActiveSchema = z.object({
  active: boolish.refine((v) => typeof v === "boolean", "Valeur invalide."),
});

export const setStockSchema = z.object({
  stock: z.coerce
    .number()
    .int("Stock invalide.")
    .min(0, "Le stock ne peut pas être négatif."),
});
