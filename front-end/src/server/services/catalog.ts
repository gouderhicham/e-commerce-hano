import type { Prisma, PrismaClient } from "@prisma/client";
import {
  toAttributes,
  toProductPublic,
  type ProductPublicWithRelations,
} from "../domain/availability";
import { PAGE_SIZE_CATALOGUE, type Paginated } from "../domain/pagination";
import { PRODUCT_SEARCH_FIELDS } from "../domain/product-search";
import type { Locale } from "../domain/locale";
import { NotFoundError } from "../http/errors";
import type { ProductQuery, ProductSort } from "./catalog.schema";

const NOT_FOUND_FR = "Produit introuvable.";

export interface CategoryPublic {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  imageUrl: string | null;
  /** Offered in the catalogue sidebar ("Type de produit"). */
  filterable: boolean;
  sortOrder: number;
  productCount: number;
}

export interface SuggestItem {
  id: number;
  name: string;
  reference: string;
  imageUrl: string | null;
  price: number | null;
}

export interface TagGroupPublic {
  id: string;
  name: string;
  nameAr?: string | null;
  field: string;
  targets: string[];
  sortOrder: number;
  tags: { value: string; label: string; labelAr?: string | null }[];
}

export type ProductListResult = Paginated<ProductPublicWithRelations>;

let cachedWilayas: Array<{
  code: number;
  name: string;
  nameAr: string | null;
  fee: number;
  communes: Array<{
    id: number;
    wilayaCode: number;
    name: string;
    nameAr: string | null;
    fee: number | null;
  }>;
}> | null = null;

let cachedTagGroups: TagGroupPublic[] | null = null;
let cachedCategories: CategoryPublic[] | null = null;

export function invalidateCatalogCache() {
  cachedWilayas = null;
  cachedTagGroups = null;
  cachedCategories = null;
}

/** Active categories with active product count. */
export async function categories(
  prisma: PrismaClient,
): Promise<CategoryPublic[]> {
  if (cachedCategories) return cachedCategories;
  const rows = await prisma.category.findMany({
    where: { filterable: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { products: { where: { active: true } } } } },
  });
  cachedCategories = rows.map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    slug: c.slug,
    description: c.description,
    descriptionAr: c.descriptionAr,
    imageUrl: c.imageUrl,
    filterable: c.filterable,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
  }));
  return cachedCategories;
}

/** Sidebar filter blocks ("Affiner la selection"). */
export async function tagGroups(
  prisma: PrismaClient,
): Promise<TagGroupPublic[]> {
  if (cachedTagGroups) return cachedTagGroups;
  const groups = await prisma.tagGroup.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const allTags = await prisma.filterTag.findMany({
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  const tagsByGroup = new Map<string, typeof allTags>();
  for (const t of allTags) {
    let arr = tagsByGroup.get(t.groupId);
    if (!arr) {
      arr = [];
      tagsByGroup.set(t.groupId, arr);
    }
    arr.push(t);
  }
  cachedTagGroups = groups.map((g) => ({
    id: g.id,
    name: g.name,
    nameAr: g.nameAr,
    field: g.field,
    targets: g.targets,
    sortOrder: g.sortOrder,
    tags: (tagsByGroup.get(g.id) ?? []).map((t) => ({
      value: t.value,
      label: t.label,
      labelAr: t.labelAr,
    })),
  }));
  return cachedTagGroups;
}

/**
 * Public product listing with filters, sort and pagination.
 *
 * Everything except the attribute facets is filtered in SQL. The facets are
 * applied in JS because the catalogue's rule is deliberately permissive: a
 * product that carries NO value for a facet stays visible even when that facet
 * is active (a laptop with no "Architecture CPU" value still shows under
 * "Ryzen"). Expressing "key absent OR key in (...)" over a jsonb column is far
 * less readable than this, and a refurb shop's catalogue is small enough that
 * loading the category's rows costs nothing.
 */
export async function products(
  prisma: PrismaClient,
  query: ProductQuery,
): Promise<ProductListResult> {
  const page = query.page ?? 1;
  const facets = parseFacets(query.attrs);

  const rows = await prisma.product.findMany({
    where: buildWhere(query),
    orderBy: orderBy(query.sort, query.locale),
  });
  const productIds = rows.map((p) => p.id);
  const images =
    productIds.length > 0
      ? await prisma.productImage.findMany({
          where: { productId: { in: productIds } },
          orderBy: { sortOrder: "asc" },
        })
      : [];

  const imagesByProduct = new Map<number, typeof images>();
  for (const img of images) {
    let arr = imagesByProduct.get(img.productId);
    if (!arr) {
      arr = [];
      imagesByProduct.set(img.productId, arr);
    }
    arr.push(img);
  }
  const fullRows = rows.map((p) => ({
    ...p,
    images: imagesByProduct.get(p.id) ?? [],
  }));

  const matching = fullRows.filter((p) => matchesFacets(p.attributes, facets));
  const total = matching.length;
  const start = (page - 1) * PAGE_SIZE_CATALOGUE;

  return {
    items: matching
      .slice(start, start + PAGE_SIZE_CATALOGUE)
      .map((p) => toProductPublic(p)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE_CATALOGUE)),
  };
}

/** Top-5 autocomplete matches. */
export async function suggest(
  prisma: PrismaClient,
  q?: string,
): Promise<SuggestItem[]> {
  const term = q?.trim();
  if (!term) return [];
  return prisma.product.findMany({
    where: {
      active: true,
      OR: PRODUCT_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: term, mode: "insensitive" as const },
      })),
    },
    orderBy: [{ sold: "desc" }, { id: "desc" }],
    take: 5,
    select: {
      id: true,
      name: true,
      nameAr: true,
      reference: true,
      imageUrl: true,
      price: true,
    },
  });
}

const cachedProductsById = new Map<
  number,
  { data: ProductPublicWithRelations; timestamp: number }
>();

/** Product detail with gallery, category and similar products. 404 if hidden. */
export async function productById(
  prisma: PrismaClient,
  id: number,
): Promise<ProductPublicWithRelations> {
  const cached = cachedProductsById.get(id);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return cached.data;
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!product || !product.active) throw new NotFoundError(NOT_FOUND_FR);

  const categoryList = await categories(prisma);
  const cat = categoryList.find((c) => c.id === product.categoryId) ?? {
    id: product.categoryId,
    slug: "",
    name: "Général",
    nameAr: "عام",
    description: "",
    descriptionAr: "",
    imageUrl: null,
    filterable: false,
    sortOrder: 0,
    productCount: 0,
  };

  const similarProducts = await prisma.product.findMany({
    where: { active: true, categoryId: product.categoryId, id: { not: id } },
    orderBy: [{ sold: "desc" }, { id: "desc" }],
    take: 4,
  });

  const similar = similarProducts.map((p) => ({
    ...p,
    images: [],
  }));

  const res = toProductPublic(
    product,
    { category: cat, similar },
  );
  cachedProductsById.set(id, { data: res, timestamp: Date.now() });
  return res;
}

export async function wilayas(prisma: PrismaClient) {
  if (cachedWilayas) return cachedWilayas;

  const wilayasList = await prisma.wilaya.findMany({
    orderBy: { code: "asc" },
    select: {
      code: true,
      name: true,
      nameAr: true,
      fee: true,
    },
  });
  const communesList = await prisma.commune.findMany({
    orderBy: [{ wilayaCode: "asc" }, { name: "asc" }],
    select: {
      id: true,
      wilayaCode: true,
      name: true,
      nameAr: true,
      fee: true,
    },
  });

  const byWilaya = new Map<number, typeof communesList>();
  for (const c of communesList) {
    let arr = byWilaya.get(c.wilayaCode);
    if (!arr) {
      arr = [];
      byWilaya.set(c.wilayaCode, arr);
    }
    arr.push(c);
  }
  cachedWilayas = wilayasList.map((w) => ({
    ...w,
    communes: byWilaya.get(w.code) ?? [],
  }));
  return cachedWilayas;
}

export async function wilayasLight(prisma: PrismaClient) {
  const list = await wilayas(prisma);
  return list.map((w) => ({
    code: w.code,
    name: w.name,
    nameAr: w.nameAr,
    fee: w.fee,
    communes: [],
  }));
}

/**
 * The only shop settings still read at runtime: the Telegram relay, because the
 * contact form posts to Telegram from the browser (mock-up parity). Everything
 * else -- identity, shipping numbers, storefront copy -- is static in
 * `front-end/src/lib/shop-config.ts`.
 */
export async function publicSettings(prisma: PrismaClient) {
  const s = await prisma.settings.findUniqueOrThrow({ where: { id: 1 } });
  return {
    telegramBotToken: s.telegramBotToken,
    telegramChatId: s.telegramChatId,
  };
}

/** Everything the home page renders, in one round trip. */
export async function home(prisma: PrismaClient) {
  const content = await prisma.siteContent.findUnique({ where: { id: 1 } });
  const cats = await prisma.category.findMany({
    where: { filterable: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  const favEntries = await prisma.homeFavorite.findMany({
    orderBy: { sortOrder: "asc" },
  });

  const productIds = favEntries.map((f) => f.productId);
  const products = productIds.length > 0
    ? await prisma.product.findMany({
        where: { id: { in: productIds }, active: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const favorites = favEntries
    .map((f) => {
      const p = productMap.get(f.productId);
      return p ? { ...f, product: p } : null;
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);

  return {
    showcase: content?.showcase ?? null,
    // Only the tiles: the heading and CTA around this strip are interface
    // chrome and live in the front-end's i18n dictionaries, so they exist in
    // both languages. Shipping French copy here made the API the third,
    // untranslated source of truth for text nobody rendered.
    favorites: {
      items: favorites.map((f) => ({
        id: String(f.id),
        productId: f.product.id,
        name: f.product.name,
        nameAr: f.product.nameAr,
        spec: f.product.specs || "",
        specAr: f.product.specsAr || "",
        price: f.product.promoPrice ?? f.product.price ?? 0,
        image: f.product.imageUrl || "",
      })),
    },
    categoryCards: cats.map((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      detail: c.description || "",
      detailAr: c.descriptionAr || "",
      img: c.imageUrl || "",
      slug: c.slug,
      categoryId: c.id,
      sortOrder: c.sortOrder,
    })),
  };
}

// -- internals ---------------------------------------------------------------

function csv(value?: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function buildWhere(query: ProductQuery): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [{ active: true }];

  const term = query.q?.trim();
  if (term) {
    and.push({
      OR: PRODUCT_SEARCH_FIELDS.map((field) => ({
        [field]: { contains: term, mode: "insensitive" as const },
      })),
    });
  }

  const cats = csv(query.category);
  if (cats.length) {
    and.push({
      OR: [{ categoryId: { in: cats } }, { category: { slug: { in: cats } } }],
    });
  }

  if (query.priceMin != null || query.priceMax != null) {
    const price: Prisma.IntNullableFilter = {};
    if (query.priceMin != null) price.gte = query.priceMin;
    if (query.priceMax != null) price.lte = query.priceMax;
    and.push({ price });
  }

  const availabilityOr = availabilityFilter(csv(query.availability));
  if (availabilityOr.length) and.push({ OR: availabilityOr });

  return { AND: and };
}

/**
 * `attrs` is `field:value1|value2;field2:value3` -- the selected sidebar tags.
 * Returns an empty map when nothing is selected.
 */
function parseFacets(attrs?: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  if (!attrs) return map;
  for (const chunk of attrs.split(";")) {
    const [field, values] = chunk.split(":");
    if (!field?.trim() || !values) continue;
    const list = values
      .split("|")
      .map((v) => v.trim())
      .filter(Boolean);
    if (list.length) map.set(field.trim(), list);
  }
  return map;
}

/** A product matches facets when all selected facet groups are satisfied. */
function matchesFacets(
  rawAttributes: unknown,
  facets: Map<string, string[]>,
): boolean {
  if (!facets.size) return true;
  const attributes = toAttributes(rawAttributes);
  for (const [field, allowed] of facets) {
    const rawVal = attributes[field];
    if (rawVal == null || (Array.isArray(rawVal) && rawVal.length === 0)) {
      return false;
    }
    const productValues = Array.isArray(rawVal) ? rawVal : [rawVal];
    const matchesGroup = productValues.some((pv) =>
      allowed.some((al) => matchAttributeValue(String(pv), al)),
    );
    if (!matchesGroup) return false;
  }
  return true;
}

function matchAttributeValue(productVal: string, filterVal: string): boolean {
  const p = productVal.trim().toLowerCase();
  const f = filterVal.trim().toLowerCase();
  if (p === f) return true;

  // Unit and number normalization: e.g. "6" matches "6 coeurs" or its Arabic
  // equivalent, so a facet chosen in one language still matches the other.
  const pNum = p.match(/^\d+/)?.[0];
  const fNum = f.match(/^\d+/)?.[0];
  if (pNum && fNum && pNum === fNum) {
    const pUnit = p.replace(/^\d+/, "").trim();
    const fUnit = f.replace(/^\d+/, "").trim();
    if (!pUnit || !fUnit || pUnit === fUnit) return true;
  }
  return false;
}

/** Map availability values to stock-range conditions (derived, not stored). */
function availabilityFilter(values: string[]): Prisma.ProductWhereInput[] {
  const or: Prisma.ProductWhereInput[] = [];
  for (const v of values) {
    if (v === "disponible") or.push({ stock: { gt: 5 } });
    else if (v === "stock_limite") or.push({ stock: { gte: 1, lte: 5 } });
    else if (v === "indisponible") or.push({ stock: { lte: 0 } });
  }
  return or;
}

function orderBy(
  sort?: ProductSort,
  locale?: Locale,
): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "prix_asc":
      return [{ price: { sort: "asc", nulls: "last" } }];
    case "prix_desc":
      return [{ price: { sort: "desc", nulls: "last" } }];
    case "nom":
      // In Arabic, sort by the Arabic title when the product has one and fall
      // back to the French name -- sorting Arabic listings by a French column
      // produces an order the reader cannot follow.
      return locale === "ar"
        ? [{ nameAr: { sort: "asc", nulls: "last" } }, { name: "asc" }]
        : [{ name: "asc" }];
    case "nouveautes":
    default:
      return [{ createdAt: "desc" }, { id: "desc" }];
  }
}
