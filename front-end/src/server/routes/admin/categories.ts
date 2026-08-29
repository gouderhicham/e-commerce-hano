import { Hono } from "hono";
import type { Context } from "hono";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { slugify } from "../../domain/slug";
import { ConflictError, NotFoundError, ValidationError } from "../../http/errors";
import { body, params, parseOrThrow } from "../../http/validate";
import { deleteByUrl, uploadImage } from "../../infra/storage";
import { afterResponse } from "../../infra/notify";

const NOT_FOUND_FR = "Catégorie introuvable.";

const idParam = z.object({ id: z.string().min(1) });

/** `"true"`/`"1"` → true, `"false"`/`"0"` → false (multipart sends strings). */
const boolish = z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, z.boolean());

const categoryFields = {
  name: z.string().trim().min(1, "Le nom est requis."),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  /**
   * Offered in the catalogue sidebar ("Type de produit"). false → the category
   * is only reachable by search.
   */
  filterable: boolish.optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
};

const createCategorySchema = z.object(categoryFields);
const updateCategorySchema = z.object(categoryFields).partial();

/**
 * The category form arrives as `multipart/form-data` so the tile image can ride
 * along; a JSON body is still accepted for callers that send no file.
 */
async function readCategoryBody<T extends z.ZodType>(
  c: Context<AppBindings>,
  schema: T,
): Promise<{ dto: z.output<T>; image: File | null }> {
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return { dto: await body(c, schema), image: null };
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new ValidationError({ body: "Formulaire multipart invalide." });
  }

  const raw: Record<string, unknown> = {};
  for (const [key, value] of form.entries()) {
    if (key !== "image" && typeof value === "string") raw[key] = value;
  }
  const candidate = form.get("image");

  return {
    dto: parseOrThrow(schema, raw),
    image: candidate instanceof File && candidate.size > 0 ? candidate : null,
  };
}

/** First free slug of the form `base`, `base-2`, `base-3`, … */
async function uniqueSlug(
  prisma: PrismaClient,
  base: string,
  excludeId?: string,
): Promise<string> {
  let slug = base;
  let n = 1;
  for (;;) {
    const clash = await prisma.category.findFirst({
      where: { slug, NOT: excludeId ? { id: excludeId } : undefined },
      select: { id: true },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}

export const adminCategoryRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const rows = await c.var.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { products: true } } },
    });
    return c.json(
      rows.map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        name: cat.name,
        nameAr: cat.nameAr,
        description: cat.description,
        descriptionAr: cat.descriptionAr,
        imageUrl: cat.imageUrl,
        filterable: cat.filterable,
        sortOrder: cat.sortOrder,
        productCount: cat._count.products,
      })),
    );
  })

  .post("/", async (c) => {
    const { dto, image } = await readCategoryBody(c, createCategorySchema);

    const slug = await uniqueSlug(c.var.prisma, slugify(dto.name));
    const imageUrl = image
      ? (await uploadImage(c.var.prisma, c.env.PUBLIC_BASE_URL, "categories", image))
          .imageUrl
      : null;

    // New categories go to the end of the sidebar unless told otherwise.
    const last = await c.var.prisma.category.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const created = await c.var.prisma.category.create({
      data: {
        id: slug,
        slug,
        name: dto.name,
        nameAr: dto.nameAr ?? null,
        description: dto.description ?? null,
        descriptionAr: dto.descriptionAr ?? null,
        imageUrl,
        filterable: dto.filterable ?? true,
        sortOrder: dto.sortOrder ?? (last ? last.sortOrder + 1 : 0),
      },
    });

    return c.json({ ...created, productCount: 0 }, 201);
  })

  .patch("/:id", async (c) => {
    const { id } = params(c, idParam);
    const { dto, image } = await readCategoryBody(c, updateCategorySchema);

    const existing = await c.var.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(NOT_FOUND_FR);

    const slug =
      dto.name && dto.name !== existing.name
        ? await uniqueSlug(c.var.prisma, slugify(dto.name), id)
        : existing.slug;

    // A new file replaces the current image; the old object is cleaned up after
    // the row is updated (best-effort).
    const newImageUrl = image
      ? (await uploadImage(c.var.prisma, c.env.PUBLIC_BASE_URL, "categories", image))
          .imageUrl
      : undefined;

    const updated = await c.var.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.descriptionAr !== undefined && {
          descriptionAr: dto.descriptionAr,
        }),
        ...(dto.filterable !== undefined && { filterable: dto.filterable }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(newImageUrl !== undefined && { imageUrl: newImageUrl }),
        slug,
      },
      include: { _count: { select: { products: true } } },
    });

    if (newImageUrl !== undefined && existing.imageUrl) {
      afterResponse(c, deleteByUrl(c.var.prisma, existing.imageUrl));
    }

    return c.json({
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      nameAr: updated.nameAr,
      description: updated.description,
      descriptionAr: updated.descriptionAr,
      imageUrl: updated.imageUrl,
      filterable: updated.filterable,
      sortOrder: updated.sortOrder,
      productCount: updated._count.products,
    });
  })

  .delete("/:id", async (c) => {
    const { id } = params(c, idParam);
    const category = await c.var.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundError(NOT_FOUND_FR);

    const count = category._count.products;
    if (count > 0) {
      throw new ConflictError(
        `Cette catégorie contient ${count} produit${count > 1 ? "s" : ""}`,
      );
    }

    await c.var.prisma.category.delete({ where: { id } });
    if (category.imageUrl) {
      afterResponse(c, deleteByUrl(c.var.prisma, category.imageUrl));
    }

    return c.json({ success: true });
  });
