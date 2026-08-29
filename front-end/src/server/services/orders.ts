import type { Order, OrderLine, Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { AuthUser } from "../env";
import type { AdminEvent } from "../infra/notify";
import { FREE_SHIPPING_THRESHOLD, SHIP_FEE } from "../domain/shop-config";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../http/errors";

export type OrderWithLines = Order & { lines: OrderLine[] };

const ORDER_NOT_FOUND_FR = "Commande introuvable.";
const FORBIDDEN_FR = "Accès refusé.";
const PHONE_REGEX = /^0[567]\d{8}$/;

export const orderLineSchema = z.object({
  productId: z.coerce.number().int("Produit invalide."),
  qty: z.coerce.number().int("Quantité invalide.").min(1, "Quantité invalide."),
  configLabel: z.string().optional(),
});

export const createOrderSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  phone: z.string().regex(PHONE_REGEX, "Numéro de téléphone invalide."),
  email: z.email("Email invalide.").optional(),
  wilayaCode: z.coerce.number().int("La wilaya est requise."),
  communeId: z.coerce.number().int("La commune est requise."),
  // No street address and no delivery note: the shop delivers on wilaya +
  // commune and calls the customer to arrange the drop-off.

  /** Cash on delivery is the only method the shop accepts. */
  method: z.literal("COD", { error: "Mode de paiement invalide." }).optional(),
  lines: z.array(orderLineSchema).min(1, "Votre panier est vide."),
});

export type CreateOrderInput = z.output<typeof createOrderSchema>;

/**
 * Checkout. Everything (validation, money recompute, stock decrement, order +
 * lines + notification) happens in ONE transaction so an out-of-stock line
 * rolls the whole thing back (CLAUDE.md rule 5). Admin events are collected
 * inside the transaction and returned so the caller only fans them out after
 * it commits.
 */
export async function createOrder(
  prisma: PrismaClient,
  dto: CreateOrderInput,
  userId: string | null,
): Promise<{ order: OrderWithLines; adminEvents: AdminEvent[] }> {
  return prisma.$transaction(async (tx) => {
    // Wilaya must be one of the 58 canonical rows, and the commune must belong
    // to it (the commune carries the COD delivery fee).
    const wilaya = await tx.wilaya.findUnique({
      where: { code: dto.wilayaCode },
    });
    if (!wilaya) throw new ValidationError({ wilayaCode: "Wilaya invalide." });

    const commune = await tx.commune.findUnique({ where: { id: dto.communeId } });
    if (!commune || commune.wilayaCode !== dto.wilayaCode) {
      throw new ValidationError({ communeId: "Commune invalide." });
    }

    // Load referenced products once.
    const ids = [...new Set(dto.lines.map((l) => l.productId))];
    const products = await tx.product.findMany({ where: { id: { in: ids } } });
    const byId = new Map(products.map((p) => [p.id, p]));

    let subtotal = 0;
    const lineData: Prisma.OrderLineCreateWithoutOrderInput[] = [];
    for (const line of dto.lines) {
      const p = byId.get(line.productId);
      if (!p || !p.active) throw new BadRequestError("Produit indisponible.");
      if (p.price === null) {
        throw new BadRequestError(
          `« ${p.name} » est sur commande et ne peut pas être ajouté au panier.`,
        );
      }
      if (p.stock < line.qty) {
        throw new BadRequestError(`Stock insuffisant pour « ${p.name} ».`);
      }

      // Charge the promotion price when it's a valid discount off the base.
      const unitPrice =
        p.promoPrice != null && p.promoPrice < p.price ? p.promoPrice : p.price;
      subtotal += unitPrice * line.qty;

      // Snapshot the spec line and cover too, so the cart recap and the admin
      // order sheet still render correctly after the product is edited or
      // deleted (productId is SetNull).
      const meta = line.configLabel?.trim()
        ? p.specs
          ? `${p.specs} · ${line.configLabel.trim()}`
          : line.configLabel.trim()
        : p.specs;

      lineData.push({
        product: { connect: { id: p.id } },
        name: p.name,
        meta,
        imageUrl: p.imageUrl,
        unitPrice,
        qty: line.qty,
      });
    }

    // Shipping: free only when threshold > 0 and subtotal strictly exceeds it.
    // The price is per COMMUNE: commune override → wilaya fee → base fee.
    const free = FREE_SHIPPING_THRESHOLD > 0 && subtotal > FREE_SHIPPING_THRESHOLD;
    const shippingFee = free ? 0 : (commune.fee ?? wilaya.fee ?? SHIP_FEE);
    const total = subtotal + shippingFee;

    // Decrement stock + bump sold counters, flagging threshold crossings
    // (→ "stock faible" / "rupture" notifications for the admin).
    const adminEvents: AdminEvent[] = [];
    for (const line of dto.lines) {
      const p = byId.get(line.productId)!;
      const after = p.stock - line.qty;
      await tx.product.update({
        where: { id: line.productId },
        data: { stock: { decrement: line.qty }, sold: { increment: line.qty } },
      });
      if (p.stock > 0 && after <= 0) {
        adminEvents.push({
          type: "stock",
          message: `Rupture de stock : « ${p.name} »`,
          productId: p.id,
        });
      } else if (p.stock > 5 && after <= 5) {
        adminEvents.push({
          type: "stock",
          message: `Stock faible : « ${p.name} » — ${after} restants`,
          productId: p.id,
        });
      }
    }

    const orderId = await nextOrderNumber(tx);

    const order = await tx.order.create({
      data: {
        id: orderId,
        userId,
        customerName: dto.name,
        email: dto.email ?? null,
        phone: dto.phone,
        wilayaCode: dto.wilayaCode,
        communeId: dto.communeId,
        status: "NOUVELLE",
        method: "COD",
        subtotal,
        shippingFee,
        total,
        lines: { create: lineData },
      },
      include: { lines: true },
    });

    // A logged-in checkout consumes the server-side cart: drop the ordered
    // products (only those — a direct "buy now" must not clear other lines).
    if (userId) {
      await tx.cartItem.deleteMany({
        where: { userId, productId: { in: dto.lines.map((l) => l.productId) } },
      });
    }

    // Every order rings the bell — this is not optional any more.
    const orderMessage = `Nouvelle commande ${orderId} — ${dto.name}`;
    await tx.notification.create({
      data: { type: "ORDER", orderId, message: orderMessage, read: false },
    });
    adminEvents.unshift({ type: "order", message: orderMessage, orderId });

    // Stock alerts also land in the bell, pointing at the PRODUCT that ran low
    // — not at the order that emptied it.
    for (const ev of adminEvents) {
      if (ev.type === "stock") {
        await tx.notification.create({
          data: {
            type: "STOCK",
            productId: ev.productId ?? null,
            message: ev.message,
            read: false,
          },
        });
      }
    }

    return { order, adminEvents };
  });
}

/** Owner or admin only; 404 if missing, 403 otherwise. */
export async function orderById(
  prisma: PrismaClient,
  orderId: string,
  user: AuthUser | null,
): Promise<OrderWithLines> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { lines: true },
  });
  if (!order) throw new NotFoundError(ORDER_NOT_FOUND_FR);

  const isAdmin = user?.role === "ADMIN";
  const isOwner = user != null && order.userId === user.id;
  if (!isAdmin && !isOwner) throw new ForbiddenError(FORBIDDEN_FR);

  return order;
}

/** Next `CMD-<year>-<4 digits>` (sequential within the year). */
async function nextOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `CMD-${year}-`;
  const count = await tx.order.count({ where: { id: { startsWith: prefix } } });
  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
