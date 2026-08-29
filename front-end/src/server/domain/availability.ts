export type Availability = "disponible" | "stock_limite" | "indisponible";

/**
 * Availability is DERIVED, never stored (CLAUDE.md rule 4):
 *   stock <= 0 → indisponible, stock <= 5 → stock_limite, else disponible.
 * The storefront prints them as "Rupture" / "Stock limité" / "En stock".
 */
export function availabilityOf(stock: number): Availability {
  if (stock <= 0) return "indisponible";
  if (stock <= 5) return "stock_limite";
  return "disponible";
}

// ── Structured JSON columns ───────────────────────────────────────────────────
// Stored as Json in Postgres so the admin can add/remove entries freely, but
// always normalised to these shapes on the way out so the front-end never has
// to defend against a half-written row.

/** Filterable attributes, keyed by TagGroup.field (cpu, cores, ram, …). */
export type ProductAttributes = Record<string, string | string[]>;

/** One "Configuration choisie" button on the fiche. */
export interface ConfigOption {
  label: string;
  labelAr?: string | null;
  sub: string;
  subAr?: string | null;
  price?: number | null;
}

export type PromiseIcon = "check" | "shield" | "plug";

/** One of the 3 reassurance cards under the order button. */
export interface ProductPromise {
  icon: PromiseIcon;
  title: string;
  titleAr?: string | null;
  text: string;
  textAr?: string | null;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const optStr = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

const PROMISE_ICONS: PromiseIcon[] = ["check", "shield", "plug"];

export function toAttributes(v: unknown): ProductAttributes {
  const out: ProductAttributes = {};
  for (const [key, value] of Object.entries(asRecord(v))) {
    if (typeof value === "string" && value.trim() !== "") {
      out[key] = value.trim();
    } else if (Array.isArray(value)) {
      const arr = value
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((x) => x.trim());
      if (arr.length === 1) out[key] = arr[0];
      else if (arr.length > 1) out[key] = arr;
    }
  }
  return out;
}

export function toConfigurations(v: unknown): ConfigOption[] {
  return asArray(v).map((row) => {
    const r = asRecord(row);
    const numPrice =
      typeof r.price === "number" && !isNaN(r.price) ? r.price : null;
    const labelAr = optStr(r.labelAr);
    const subAr = optStr(r.subAr);
    return {
      label: str(r.label),
      ...(labelAr !== null && { labelAr }),
      sub: str(r.sub),
      ...(subAr !== null && { subAr }),
      ...(numPrice !== null && { price: numPrice }),
    };
  });
}

export function toPromises(v: unknown): ProductPromise[] {
  return asArray(v).map((row) => {
    const r = asRecord(row);
    const icon = str(r.icon) as PromiseIcon;
    const titleAr = optStr(r.titleAr);
    const textAr = optStr(r.textAr);
    return {
      icon: PROMISE_ICONS.includes(icon) ? icon : "check",
      title: str(r.title),
      ...(titleAr !== null && { titleAr }),
      text: str(r.text),
      ...(textAr !== null && { textAr }),
    };
  });
}

// ── Product shapes ────────────────────────────────────────────────────────────

/** A single product gallery image, as exposed publicly. */
export interface ProductImagePublic {
  id: number;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

/** Prisma ProductImage row shape (subset) accepted by the transformer. */
export interface ProductImageRow {
  id: number;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

/** Product row as stored by Prisma (Json columns still unknown-typed). */
export interface ProductScalar {
  id: number;
  reference: string;
  name: string;
  nameAr?: string | null;
  categoryId: string;
  price: number | null;
  promoPrice: number | null;
  stock: number;
  active: boolean;
  sold: number;

  specs: string;
  specsAr?: string | null;
  attributes: unknown;
  tone: string;

  imageUrl: string | null;

  condition: string;
  conditionAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  configurations: unknown;
  deliveryNote: string;
  deliveryNoteAr?: string | null;
  promises: unknown;

  createdAt: Date;
  updatedAt: Date;
}

/** Product as sent to clients: normalised JSON + derived availability. */
export interface ProductPublic extends Omit<
  ProductScalar,
  "attributes" | "configurations" | "promises"
> {
  attributes: ProductAttributes;
  configurations: ConfigOption[];
  promises: ProductPromise[];
  availability: Availability;
  /** Ordered gallery (by sortOrder). Empty when the product has no images. */
  images: ProductImagePublic[];
}

/** Public category shape embedded in a product detail response. */
export interface CategoryScalar {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
}

/** Optional related collections a detail endpoint may attach. */
export interface ProductRelations {
  category?: CategoryScalar;
  similar?: (ProductScalar & { images?: ProductImageRow[] })[];
}

export interface ProductPublicWithRelations extends ProductPublic {
  category?: CategoryScalar;
  similar?: ProductPublic[];
}

/**
 * Map a Prisma product to its public shape: explicit scalar fields, normalised
 * JSON columns and derived `availability`. Relations are attached ONLY when
 * explicitly passed, so nothing unrequested leaks into the response.
 */
export function toProductPublic(
  p: ProductScalar & { images?: ProductImageRow[] },
  relations?: ProductRelations,
): ProductPublicWithRelations {
  const base: ProductPublic = {
    id: p.id,
    reference: p.reference,
    name: p.name,
    nameAr: p.nameAr,
    categoryId: p.categoryId,
    price: p.price,
    promoPrice: p.promoPrice,
    stock: p.stock,
    active: p.active,
    sold: p.sold,

    specs: p.specs,
    specsAr: p.specsAr,
    attributes: toAttributes(p.attributes),
    tone: p.tone,

    imageUrl: p.imageUrl,

    condition: p.condition,
    conditionAr: p.conditionAr,
    description: p.description,
    descriptionAr: p.descriptionAr,
    configurations: toConfigurations(p.configurations),
    deliveryNote: p.deliveryNote,
    deliveryNoteAr: p.deliveryNoteAr,
    promises: toPromises(p.promises),

    createdAt: p.createdAt,
    updatedAt: p.updatedAt,

    availability: availabilityOf(p.stock),
    images: (p.images ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((img) => ({
        id: img.id,
        url: img.url,
        isCover: img.isCover,
        sortOrder: img.sortOrder,
      })),
  };

  if (!relations) return base;

  const result: ProductPublicWithRelations = { ...base };
  if (relations.category) {
    result.category = {
      id: relations.category.id,
      slug: relations.category.slug,
      name: relations.category.name,
      nameAr: relations.category.nameAr,
      description: relations.category.description,
      descriptionAr: relations.category.descriptionAr,
    };
  }
  if (relations.similar) {
    result.similar = relations.similar.map((t) => toProductPublic(t));
  }
  return result;
}

/**
 * Admin product shape. Identical to the public one today — admins simply see
 * inactive products too — but kept as its own name so admin-only fields can be
 * added without touching the public contract.
 */
export type ProductAdmin = ProductPublic;

export function toProductAdmin(
  p: ProductScalar & { images?: ProductImageRow[] },
): ProductAdmin {
  return toProductPublic(p) as ProductPublic;
}
