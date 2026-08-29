import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { USER_PUBLIC_SELECT, currentUser, requireUser } from "../http/auth";
import { NotFoundError, ValidationError } from "../http/errors";
import { body, params } from "../http/validate";
import { hashPassword, verifyPassword } from "../infra/password";
import { toProductPublic } from "../domain/availability";

const PHONE_REGEX = /^0[567]\d{8}$/;
const PRODUCT_NOT_FOUND_FR = "Produit introuvable.";

const productIdParam = z.object({
  productId: z.coerce.number().int().positive("Produit invalide."),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  email: z.email("Email invalide."),
  phone: z.string().regex(PHONE_REGEX, "Numéro de téléphone invalide."),
  wilayaCode: z.coerce.number().int().optional(),
  communeId: z.coerce.number().int().optional(),
  adresse: z.string().optional(),
});

const changePasswordSchema = z.object({
  current: z.string().min(1, "Le mot de passe actuel est requis."),
  next: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères."),
  confirm: z.string().min(1, "La confirmation est requise."),
});

const cartItemSchema = z.object({
  qty: z.coerce
    .number()
    .int("Quantité invalide.")
    .min(1, "La quantité doit être au moins 1."),
});

/** Everything under `/account` requires a session. */
export const accountRoutes = new Hono<AppBindings>()
  .use("*", requireUser)

  .get("/", async (c) => {
    const user = await c.var.prisma.user.findUniqueOrThrow({
      where: { id: currentUser(c).id },
      select: USER_PUBLIC_SELECT,
    });
    return c.json({ user });
  })

  .patch("/", async (c) => {
    const userId = currentUser(c).id;
    const dto = await body(c, updateProfileSchema);

    const emailOwner = await c.var.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (emailOwner && emailOwner.id !== userId) {
      throw new ValidationError({ email: "Cet email est déjà utilisé." });
    }

    // Delivery address consistency: the commune must belong to the wilaya
    // (checkout prefills from here and prices COD by commune).
    if (dto.wilayaCode != null) {
      const wilaya = await c.var.prisma.wilaya.findUnique({
        where: { code: dto.wilayaCode },
        select: { code: true },
      });
      if (!wilaya) throw new ValidationError({ wilayaCode: "Wilaya invalide." });
    }
    if (dto.communeId != null) {
      const commune = await c.var.prisma.commune.findUnique({
        where: { id: dto.communeId },
        select: { wilayaCode: true },
      });
      if (!commune || commune.wilayaCode !== dto.wilayaCode) {
        throw new ValidationError({ communeId: "Commune invalide." });
      }
    }

    const user = await c.var.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        wilayaCode: dto.wilayaCode ?? null,
        communeId: dto.communeId ?? null,
        adresse: dto.adresse ?? null,
      },
      select: USER_PUBLIC_SELECT,
    });
    return c.json({ user });
  })

  .patch("/password", async (c) => {
    const userId = currentUser(c).id;
    const dto = await body(c, changePasswordSchema);

    if (dto.next !== dto.confirm) {
      throw new ValidationError({
        confirm: "Les mots de passe ne correspondent pas.",
      });
    }

    const user = await c.var.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(dto.current, user.passwordHash))) {
      throw new ValidationError({ current: "Mot de passe actuel incorrect." });
    }

    await c.var.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(dto.next) },
    });
    return c.json({ ok: true });
  })

  .get("/orders", async (c) => {
    const items = await c.var.prisma.order.findMany({
      where: { userId: currentUser(c).id },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
    return c.json({ items });
  })

  .get("/favorites", async (c) => {
    const favs = await c.var.prisma.favorite.findMany({
      where: { userId: currentUser(c).id },
      orderBy: { createdAt: "desc" },
      include: { product: true },
    });
    return c.json({ items: favs.map((f) => toProductPublic(f.product)) });
  })

  .put("/favorites/:productId", async (c) => {
    const userId = currentUser(c).id;
    const { productId } = params(c, productIdParam);

    const product = await c.var.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundError(PRODUCT_NOT_FOUND_FR);

    // Idempotent add.
    await c.var.prisma.favorite.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return c.json({ ok: true });
  })

  .delete("/favorites/:productId", async (c) => {
    const { productId } = params(c, productIdParam);
    // Idempotent remove — no error if it wasn't there.
    await c.var.prisma.favorite.deleteMany({
      where: { userId: currentUser(c).id, productId },
    });
    return c.json({ ok: true });
  })

  /** Cart lines `{ id, qty }` (id = product id); inactive products are hidden. */
  .get("/cart", async (c) => {
    const items = await c.var.prisma.cartItem.findMany({
      where: { userId: currentUser(c).id, product: { active: true } },
      orderBy: { createdAt: "asc" },
      select: { productId: true, qty: true },
    });
    return c.json({ items: items.map((i) => ({ id: i.productId, qty: i.qty })) });
  })

  /** Absolute-quantity upsert — the client sends the resulting qty, not a delta. */
  .put("/cart/:productId", async (c) => {
    const userId = currentUser(c).id;
    const { productId } = params(c, productIdParam);
    const { qty } = await body(c, cartItemSchema);

    const product = await c.var.prisma.product.findUnique({
      where: { id: productId },
      select: { active: true, price: true },
    });
    // Rule 6: "Sur commande" products (price null) can never sit in a cart.
    if (!product || !product.active || product.price === null) {
      throw new NotFoundError(PRODUCT_NOT_FOUND_FR);
    }

    await c.var.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, qty },
      update: { qty },
    });
    return c.json({ ok: true });
  })

  .delete("/cart/:productId", async (c) => {
    const { productId } = params(c, productIdParam);
    // Idempotent remove — no error if it wasn't there.
    await c.var.prisma.cartItem.deleteMany({
      where: { userId: currentUser(c).id, productId },
    });
    return c.json({ ok: true });
  })

  .delete("/cart", async (c) => {
    await c.var.prisma.cartItem.deleteMany({
      where: { userId: currentUser(c).id },
    });
    return c.json({ ok: true });
  });
