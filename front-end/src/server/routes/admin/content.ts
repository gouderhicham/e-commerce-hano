import { Hono } from "hono";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { generateFieldKey, slugify } from "../../domain/slug";
import { NotFoundError, ValidationError } from "../../http/errors";
import { body, params } from "../../http/validate";

const GROUP_NOT_FOUND_FR = "Groupe de filtres introuvable.";

const idParam = z.object({ id: z.string().min(1) });

const json = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

/** Slugify a group name into a stable id: "Capacité RAM" → "capacite-ram". */
const slugifyId = (name: string): string => slugify(name, "groupe");

/** One cell of the showcase's four-column spec grid. */
const showcaseSpecSchema = z.object({
  label: z.string(),
  labelAr: z.string().optional(),
  val: z.string(),
  valAr: z.string().optional(),
});

/** The full-width block under the hero (Admin → Produit vedette). */
const showcaseSchema = z.object({
  eyebrow: z.string().optional(),
  eyebrowAr: z.string().optional(),
  title: z.string().optional(),
  titleAr: z.string().optional(),
  subtitle: z.string().optional(),
  subtitleAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  imageAltAr: z.string().optional(),
  specs: z.array(showcaseSpecSchema).optional(),
});

const updateSiteContentSchema = z.object({
  showcase: showcaseSchema.optional(),
});

/** Full replacement of the "Nos favoris" tiles, in display order. */
const replaceHomeFavoritesSchema = z.object({
  items: z.array(
    z.object({
      productId: z.coerce.number().int("Produit rattaché invalide."),
    }),
  ),
});

/** One block of the catalogue sidebar. Tags are replaced wholesale. */
const tagGroupSchema = z.object({
  name: z.string().trim().min(1, "Le nom du groupe est requis."),
  nameAr: z.string().optional(),
  /** Key read from `Product.attributes`; generated from the name when omitted. */
  field: z.string().optional(),
  targets: z.array(z.string()),
  sortOrder: z.coerce.number().int().min(0).optional(),
  tags: z.array(
    z.object({
      /** Value stored in `Product.attributes`; defaults to the label. */
      value: z.string().optional(),
      label: z.string().trim().min(1, "Le libellé est requis."),
      labelAr: z.string().optional(),
    }),
  ),
});

type TagGroupInput = z.output<typeof tagGroupSchema>;

/** `[groupId, value]` is unique — keep the first occurrence of each value. */
function dedupeTags(tags: TagGroupInput["tags"]) {
  const seen = new Set<string>();
  return tags.filter((t) => {
    const key = (t.value?.trim() || t.label.trim()).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tagRows(tags: TagGroupInput["tags"]) {
  return dedupeTags(tags).map((t, i) => ({
    value: t.value?.trim() || t.label.trim(),
    label: t.label.trim(),
    labelAr: t.labelAr?.trim() || null,
    sortOrder: i,
  }));
}

async function freeGroupId(prisma: PrismaClient, base: string): Promise<string> {
  let id = base;
  let n = 2;
  while (
    await prisma.tagGroup.findUnique({ where: { id }, select: { id: true } })
  ) {
    id = `${base}-${n++}`;
  }
  return id;
}

async function assertCategoriesExist(
  prisma: PrismaClient,
  ids: string[],
): Promise<void> {
  if (!ids.length) return;
  const found = await prisma.category.count({ where: { id: { in: ids } } });
  if (found !== new Set(ids).size) {
    throw new ValidationError({ targets: "Une catégorie ciblée est introuvable." });
  }
}

async function assertGroupExists(prisma: PrismaClient, id: string) {
  const found = await prisma.tagGroup.findUnique({
    where: { id },
    select: { id: true, field: true },
  });
  if (!found) throw new NotFoundError(GROUP_NOT_FOUND_FR);
  return found;
}

/** The singleton row, created on first read so a fresh DB is never empty. */
async function getSiteContent(prisma: PrismaClient) {
  const existing = await prisma.siteContent.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.siteContent.create({ data: { id: 1, showcase: {} } });
}

async function homeFavorites(prisma: PrismaClient) {
  const rows = await prisma.homeFavorite.findMany({
    orderBy: { sortOrder: "asc" },
    include: { product: true },
  });
  return rows.map((r) => ({
    id: String(r.id),
    productId: r.product.id,
    name: r.product.name,
    nameAr: r.product.nameAr,
    spec: r.product.specs || "",
    specAr: r.product.specsAr || "",
    price: r.product.promoPrice ?? r.product.price ?? 0,
    image: r.product.imageUrl || "",
    sortOrder: r.sortOrder,
  }));
}

export const adminContentRoutes = new Hono<AppBindings>()
  .get("/home", async (c) =>
    c.json({ content: await getSiteContent(c.var.prisma) }),
  )

  .patch("/home", async (c) => {
    const dto = await body(c, updateSiteContentSchema);
    await getSiteContent(c.var.prisma); // ensure the row exists
    const content = await c.var.prisma.siteContent.update({
      where: { id: 1 },
      data: {
        ...(dto.showcase !== undefined && { showcase: json(dto.showcase) }),
      },
    });
    return c.json({ content });
  })

  .get("/home/favorites", async (c) =>
    c.json({ items: await homeFavorites(c.var.prisma) }),
  )

  /**
   * Lightweight product list for the "Nos favoris" picker in the admin. Returns
   * all products (active and inactive) with just the fields needed to
   * auto-populate a tile: name, specs line, price, cover image.
   */
  .get("/home/favorites/products", async (c) => {
    const items = await c.var.prisma.product.findMany({
      select: {
        id: true,
        name: true,
        nameAr: true,
        specs: true,
        specsAr: true,
        price: true,
        promoPrice: true,
        imageUrl: true,
        active: true,
      },
      orderBy: { name: "asc" },
    });
    return c.json({ items });
  })

  /**
   * The "Nos favoris" strip is edited as one list (reorder, add, remove), so it
   * is replaced wholesale in a transaction rather than diffed row by row.
   */
  .put("/home/favorites", async (c) => {
    const dto = await body(c, replaceHomeFavoritesSchema);

    const productIds = dto.items.map((i) => i.productId);
    if (productIds.length) {
      const found = await c.var.prisma.product.count({
        where: { id: { in: productIds } },
      });
      if (found !== new Set(productIds).size) {
        throw new ValidationError({
          items: "Un produit rattaché est introuvable.",
        });
      }
    }

    await c.var.prisma.$transaction([
      c.var.prisma.homeFavorite.deleteMany({}),
      c.var.prisma.homeFavorite.createMany({
        data: dto.items.map((item, index) => ({
          productId: item.productId,
          sortOrder: index,
        })),
      }),
    ]);

    return c.json({ items: await homeFavorites(c.var.prisma) });
  })

  .get("/category-cards", async (c) => {
    const categories = await c.var.prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return c.json({
      items: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        nameAr: cat.nameAr,
        detail: cat.description || "",
        detailAr: cat.descriptionAr || "",
        img: cat.imageUrl || "",
        slug: cat.slug,
        categoryId: cat.id,
        sortOrder: cat.sortOrder,
      })),
    });
  })

  .get("/tag-groups", async (c) => {
    const items = await c.var.prisma.tagGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: { tags: { orderBy: { sortOrder: "asc" } } },
    });
    return c.json({ items });
  })

  .post("/tag-groups", async (c) => {
    const dto = await body(c, tagGroupSchema);
    await assertCategoriesExist(c.var.prisma, dto.targets);

    const id = await freeGroupId(c.var.prisma, slugifyId(dto.name));
    const field = dto.field?.trim() || generateFieldKey(dto.name);
    const last = await c.var.prisma.tagGroup.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const group = await c.var.prisma.tagGroup.create({
      data: {
        id,
        name: dto.name,
        nameAr: dto.nameAr ?? null,
        field,
        targets: dto.targets,
        sortOrder: dto.sortOrder ?? (last ? last.sortOrder + 1 : 0),
        tags: { create: tagRows(dto.tags) },
      },
      include: { tags: { orderBy: { sortOrder: "asc" } } },
    });

    return c.json({ group }, 201);
  })

  /** Tags are replaced wholesale — the admin edits the whole block at once. */
  .put("/tag-groups/:id", async (c) => {
    const { id } = params(c, idParam);
    const dto = await body(c, tagGroupSchema);

    const existing = await assertGroupExists(c.var.prisma, id);
    await assertCategoriesExist(c.var.prisma, dto.targets);
    const field = dto.field?.trim() || existing.field || generateFieldKey(dto.name);

    const group = await c.var.prisma.tagGroup.update({
      where: { id },
      data: {
        name: dto.name,
        nameAr: dto.nameAr ?? null,
        field,
        targets: dto.targets,
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        tags: { deleteMany: {}, create: tagRows(dto.tags) },
      },
      include: { tags: { orderBy: { sortOrder: "asc" } } },
    });

    return c.json({ group });
  })

  .delete("/tag-groups/:id", async (c) => {
    const { id } = params(c, idParam);
    await assertGroupExists(c.var.prisma, id);
    await c.var.prisma.tagGroup.delete({ where: { id } });
    return c.json({ success: true });
  });
