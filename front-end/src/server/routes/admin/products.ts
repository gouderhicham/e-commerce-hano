import { Hono } from "hono";
import type { Context } from "hono";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { toProductAdmin } from "../../domain/availability";
import { PAGE_SIZE_ADMIN, paginationArgs } from "../../domain/pagination";
import { PRODUCT_SEARCH_FIELDS } from "../../domain/product-search";
import { BadRequestError, NotFoundError, ValidationError } from "../../http/errors";
import { body, params, parseOrThrow, query } from "../../http/validate";
import { deleteByUrl, uploadImage } from "../../infra/storage";
import { afterResponse } from "../../infra/notify";
import {
  createProductSchema,
  productAdminQuerySchema,
  setActiveSchema,
  setStockSchema,
  updateProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from "./products.schema";

const NOT_FOUND_FR = "Produit introuvable.";
const IMAGES_ORDER_INVALID_FR = "Ordre des images invalide.";

const idParam = z.object({
  id: z.coerce.number().int().positive("Identifiant invalide."),
});

const PRODUCT_INCLUDE = {
  images: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.ProductInclude;

/** One entry of the client-supplied gallery order (multipart `imageOrder`). */
interface ImageOrderItem {
  /** Existing ProductImage id to keep (edit mode). */
  id?: number;
  /** Index into the newly uploaded `images` files array. */
  newIndex?: number;
  /** An already-hosted URL (seeded /images/… asset, or one pasted by the admin). */
  url?: string;
}

/** Resolved gallery: rows to persist, the cover URL, and orphaned object URLs. */
interface ResolvedGallery {
  rows: { url: string; isCover: boolean; sortOrder: number }[];
  coverUrl: string | null;
  removedUrls: string[];
}

/**
 * A promotion price only makes sense as a discount off a real price. Throws a
 * 400 when a promoPrice is set on a "Sur commande" product (no base price) or
 * is not strictly below it. `undefined` promoPrice = "leave unchanged".
 */
function assertPromoPrice(
  price: number | null | undefined,
  promoPrice: number | null | undefined,
): void {
  if (promoPrice == null) return; // null clears it / undefined leaves it
  if (price == null) {
    throw new BadRequestError(
      "Impossible d'appliquer une promotion à un produit « Sur commande ».",
    );
  }
  if (promoPrice >= price) {
    throw new BadRequestError("Le prix promotionnel doit être inférieur au prix.");
  }
}

/**
 * The storefront-copy fields, mapped straight through when present. Kept in one
 * place so create and update can never disagree about which fields exist.
 * `reference`, `name`, `categoryId`, prices, stock, active and the gallery are
 * handled by the callers (they differ between create and update).
 */
function scalarData(dto: CreateProductInput | UpdateProductInput) {
  return {
    ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
    ...(dto.specs !== undefined && { specs: dto.specs }),
    ...(dto.specsAr !== undefined && { specsAr: dto.specsAr }),
    ...(dto.attributes !== undefined && { attributes: dto.attributes }),
    ...(dto.tone !== undefined && { tone: dto.tone }),
    ...(dto.condition !== undefined && { condition: dto.condition }),
    ...(dto.conditionAr !== undefined && { conditionAr: dto.conditionAr }),
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
    ...(dto.configurations !== undefined && { configurations: dto.configurations }),
    ...(dto.deliveryNote !== undefined && { deliveryNote: dto.deliveryNote }),
    ...(dto.deliveryNoteAr !== undefined && { deliveryNoteAr: dto.deliveryNoteAr }),
    ...(dto.promises !== undefined && { promises: dto.promises }),
  };
}

/**
 * Parse the multipart `imageOrder` field (a JSON string). Returns `undefined`
 * when the field is absent (→ gallery left untouched on update), `[]` for an
 * explicit empty gallery, else the sanitized order. Malformed JSON → 400.
 */
function parseImageOrder(raw?: string): ImageOrderItem[] | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new ValidationError({ images: IMAGES_ORDER_INVALID_FR });
  }
  if (!Array.isArray(parsed)) {
    throw new ValidationError({ images: IMAGES_ORDER_INVALID_FR });
  }

  return parsed.map((entry) => {
    const o = (entry ?? {}) as Record<string, unknown>;
    const item: ImageOrderItem = {};
    if (typeof o.id === "number") item.id = o.id;
    if (typeof o.newIndex === "number") item.newIndex = o.newIndex;
    if (typeof o.url === "string" && o.url.trim()) item.url = o.url.trim();
    return item;
  });
}

/**
 * Resolve the final gallery from the requested order, storing any new files.
 * `order === undefined` means "no change" (returns null). Existing images
 * referenced by id are kept; those dropped are returned in `removedUrls` so the
 * caller can prune their rows after the DB write.
 */
async function resolveGallery(
  prisma: PrismaClient,
  publicBaseUrl: string,
  args: {
    files: File[];
    order: ImageOrderItem[] | undefined;
    coverIndex?: number;
    existing: { id: number; url: string }[];
  },
): Promise<ResolvedGallery | null> {
  const { files, order, existing } = args;
  if (order === undefined) return null;

  // Store new files first — index-aligned with the caller's `images` array.
  const newUrls: string[] = [];
  for (const file of files) {
    const { imageUrl } = await uploadImage(prisma, publicBaseUrl, "products", file);
    newUrls.push(imageUrl);
  }

  const existingById = new Map(existing.map((e) => [e.id, e.url]));
  const keptIds = new Set<number>();
  const rows: ResolvedGallery["rows"] = [];

  for (const item of order) {
    let url: string | undefined;
    if (item.id !== undefined && existingById.has(item.id)) {
      url = existingById.get(item.id);
      keptIds.add(item.id);
    } else if (
      item.newIndex !== undefined &&
      item.newIndex >= 0 &&
      item.newIndex < newUrls.length
    ) {
      url = newUrls[item.newIndex];
    } else if (item.url !== undefined) {
      url = item.url;
    }
    if (url === undefined) continue;
    rows.push({ url, isCover: false, sortOrder: rows.length });
  }

  let cover = args.coverIndex ?? 0;
  if (!Number.isInteger(cover) || cover < 0 || cover >= rows.length) cover = 0;
  if (rows.length) rows[cover].isCover = true;

  // An externally-hosted URL that the admin re-listed must not be deleted just
  // because its row id changed, so compare on URL too.
  const keptUrls = new Set(rows.map((r) => r.url));
  return {
    rows,
    coverUrl: rows.length ? rows[cover].url : null,
    removedUrls: existing
      .filter((e) => !keptIds.has(e.id) && !keptUrls.has(e.url))
      .map((e) => e.url),
  };
}

/**
 * The product form arrives as `multipart/form-data` so the gallery files ride
 * along; a JSON body is still accepted for callers that send no files.
 */
async function readProductBody<T extends z.ZodType>(
  c: Context<AppBindings>,
  schema: T,
): Promise<{ dto: z.output<T>; files: File[] }> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { dto: await body(c, schema), files: [] };
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ValidationError({ body: "Formulaire multipart invalide." });
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key !== "images" && typeof value === "string") raw[key] = value;
  }
  const files = form.getAll("images").filter((v): v is File => v instanceof File);

  return { dto: parseOrThrow(schema, raw), files };
}

async function assertReferenceFree(
  prisma: PrismaClient,
  reference: string,
): Promise<void> {
  const clash = await prisma.product.findUnique({
    where: { reference },
    select: { id: true },
  });
  if (clash) throw new ValidationError({ reference: "Cette référence existe déjà." });
}

async function assertExists(prisma: PrismaClient, id: number): Promise<void> {
  const exists = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) throw new NotFoundError(NOT_FOUND_FR);
}

/** Availability tallies across ALL products (for the stock page KPIs/tabs). */
async function stockCounts(prisma: PrismaClient) {
  const [total, indisponible, stock_limite] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { stock: { lte: 0 } } }),
    prisma.product.count({ where: { stock: { gte: 1, lte: 5 } } }),
  ]);
  return {
    total,
    indisponible,
    stock_limite,
    disponible: total - indisponible - stock_limite,
  };
}

export const adminProductRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const q = query(c, productAdminQuerySchema);
    const and: Prisma.ProductWhereInput[] = [];

    const term = q.q?.trim();
    if (term) {
      and.push({
        OR: PRODUCT_SEARCH_FIELDS.map((field) => ({
          [field]: { contains: term, mode: "insensitive" as const },
        })),
      });
    }
    if (q.category) {
      and.push({
        OR: [{ categoryId: q.category }, { category: { slug: q.category } }],
      });
    }
    if (q.status) and.push({ active: q.status === "actif" });
    // Availability is derived from stock (rule 4): indisponible ≤ 0,
    // stock_limite 1–5, disponible > 5.
    if (q.availability === "indisponible") and.push({ stock: { lte: 0 } });
    else if (q.availability === "stock_limite")
      and.push({ stock: { gte: 1, lte: 5 } });
    else if (q.availability === "disponible") and.push({ stock: { gt: 5 } });

    const where: Prisma.ProductWhereInput = and.length ? { AND: and } : {};
    const { skip, take } = paginationArgs(q.page, PAGE_SIZE_ADMIN);

    const [rows, total, counts] = await Promise.all([
      c.var.prisma.product.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        include: PRODUCT_INCLUDE,
      }),
      c.var.prisma.product.count({ where }),
      stockCounts(c.var.prisma),
    ]);

    return c.json({
      items: rows.map((p) => toProductAdmin(p)),
      total,
      page: q.page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE_ADMIN)),
      stockCounts: counts,
    });
  })

  /** Single product (admin), incl. inactive, with ordered gallery. */
  .get("/:id", async (c) => {
    const { id } = params(c, idParam);
    const product = await c.var.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundError(NOT_FOUND_FR);
    return c.json(toProductAdmin(product));
  })

  .post("/", async (c) => {
    const { dto, files } = await readProductBody(c, createProductSchema);

    await assertReferenceFree(c.var.prisma, dto.reference);
    assertPromoPrice(dto.price ?? null, dto.promoPrice);

    // Ensure the first configuration price matches the effective product price
    if (dto.configurations && dto.configurations.length > 0) {
      const effectivePrice = dto.promoPrice ?? dto.price ?? null;
      dto.configurations[0].price = effectivePrice;
    }

    // Reference is free (checked above), so stored files here won't be orphaned
    // by a later unique-constraint failure. An absent order with files defaults
    // to "all uploaded files, in the order received".
    const order =
      parseImageOrder(dto.imageOrder) ?? files.map((_, i) => ({ newIndex: i }));
    const gallery = await resolveGallery(c.var.prisma, c.env.PUBLIC_BASE_URL, {
      files,
      order,
      coverIndex: dto.coverIndex,
      existing: [],
    });

    const created = await c.var.prisma.product.create({
      data: {
        ...scalarData(dto),
        reference: dto.reference,
        name: dto.name,
        categoryId: dto.categoryId,
        stock: dto.stock ?? 0,
        active: dto.active ?? true,
        price: dto.price ?? null,
        promoPrice: dto.promoPrice ?? null,
        imageUrl: gallery?.coverUrl ?? null,
        ...(gallery && gallery.rows.length
          ? { images: { create: gallery.rows } }
          : {}),
      },
      include: PRODUCT_INCLUDE,
    });

    return c.json(toProductAdmin(created), 201);
  })

  .patch("/:id", async (c) => {
    const { id } = params(c, idParam);
    const { dto, files } = await readProductBody(c, updateProductSchema);

    const existing = await c.var.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!existing) throw new NotFoundError(NOT_FOUND_FR);

    if (dto.reference && dto.reference !== existing.reference) {
      await assertReferenceFree(c.var.prisma, dto.reference);
    }

    // Validate the promotion against the resulting state (patched price/promo,
    // else the current values) so a price change can't leave a stale promo.
    const resultingPrice = dto.price !== undefined ? dto.price : existing.price;
    const resultingPromoPrice = dto.promoPrice !== undefined ? dto.promoPrice : existing.promoPrice;
    assertPromoPrice(resultingPrice, resultingPromoPrice);

    // Sync first configuration price to effective price
    const effectivePrice = resultingPromoPrice ?? resultingPrice;
    if (dto.configurations && dto.configurations.length > 0) {
      dto.configurations[0].price = effectivePrice;
    }

    // Gallery is rebuilt only when `imageOrder` is provided; otherwise it is
    // left untouched. New files are stored here (before the DB write); orphaned
    // rows are removed afterwards, best-effort.
    const gallery = await resolveGallery(c.var.prisma, c.env.PUBLIC_BASE_URL, {
      files,
      order: parseImageOrder(dto.imageOrder),
      coverIndex: dto.coverIndex,
      existing: existing.images.map((img) => ({ id: img.id, url: img.url })),
    });

    const data: Prisma.ProductUpdateInput = {
      ...scalarData(dto),
      ...(dto.reference !== undefined && { reference: dto.reference }),
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.categoryId !== undefined && {
        category: { connect: { id: dto.categoryId } },
      }),
      ...(dto.price !== undefined && { price: dto.price }),
      ...(dto.promoPrice !== undefined && { promoPrice: dto.promoPrice }),
      ...(dto.stock !== undefined && { stock: dto.stock }),
      ...(dto.active !== undefined && { active: dto.active }),
      // A rebuilt gallery re-syncs the denormalized cover URL.
      ...(gallery ? { imageUrl: gallery.coverUrl } : {}),
    };

    // Replace the whole gallery atomically with the update when rebuilt: drop
    // the old rows and recreate the resolved order in one transaction.
    if (gallery) data.images = { deleteMany: {}, create: gallery.rows };

    const updated = await c.var.prisma.product.update({
      where: { id },
      data,
      include: PRODUCT_INCLUDE,
    });

    // Best-effort cleanup of objects no longer referenced by any image row —
    // past the response, so the admin never waits on it.
    if (gallery) {
      afterResponse(
        c,
        Promise.all(
          gallery.removedUrls.map((url) => deleteByUrl(c.var.prisma, url)),
        ),
      );
    }

    return c.json(toProductAdmin(updated));
  })

  .delete("/:id", async (c) => {
    const { id } = params(c, idParam);
    const existing = await c.var.prisma.product.findUnique({
      where: { id },
      include: { images: true },
    });
    if (!existing) throw new NotFoundError(NOT_FOUND_FR);

    // Hard delete; OrderLine.productId is SetNull so history keeps its
    // snapshots. ProductImage rows cascade; their stored bytes are pruned
    // best-effort.
    await c.var.prisma.product.delete({ where: { id } });
    afterResponse(
      c,
      Promise.all(
        existing.images.map((img) => deleteByUrl(c.var.prisma, img.url)),
      ),
    );

    return c.json({ success: true });
  })

  .patch("/:id/active", async (c) => {
    const { id } = params(c, idParam);
    const { active } = await body(c, setActiveSchema);
    await assertExists(c.var.prisma, id);

    const updated = await c.var.prisma.product.update({
      where: { id },
      data: { active },
      include: PRODUCT_INCLUDE,
    });
    return c.json(toProductAdmin(updated));
  })

  .patch("/:id/stock", async (c) => {
    const { id } = params(c, idParam);
    const { stock } = await body(c, setStockSchema);
    await assertExists(c.var.prisma, id);

    const updated = await c.var.prisma.product.update({
      where: { id },
      data: { stock },
      include: PRODUCT_INCLUDE,
    });
    return c.json(toProductAdmin(updated));
  });
