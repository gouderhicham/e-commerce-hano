import { Hono } from "hono";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { AppBindings } from "../../env";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../http/errors";
import { body, params, query } from "../../http/validate";
import { PAGE_SIZE_ADMIN, paginationArgs } from "../../domain/pagination";

const NOT_FOUND_FR = "Commande introuvable.";
const LOCKED_FR = "Impossible de modifier une commande annulée.";

const ORDER_STATUSES = [
  "NOUVELLE",
  "PRETE_A_LIVRER",
  "EN_LIVRAISON",
  "LIVREE",
  "ANNULEE",
] as const;

const idParam = z.object({ id: z.string().min(1) });

const listQuery = z.object({
  status: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.enum(ORDER_STATUSES).optional(),
    )
    .optional(),
  q: z
    .preprocess(
      (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
      z.string().optional(),
    )
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
});

const setStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES, { error: "Statut invalide." }),
});

export const adminOrderRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const { status, q, page } = query(c, listQuery);

    const and: Prisma.OrderWhereInput[] = [];
    if (status) and.push({ status });
    const term = q?.trim();
    if (term) {
      and.push({
        OR: [
          { id: { contains: term, mode: "insensitive" } },
          { customerName: { contains: term, mode: "insensitive" } },
          { phone: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      });
    }
    const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};
    const { skip, take } = paginationArgs(page, PAGE_SIZE_ADMIN);

    const [items, total, grouped] = await Promise.all([
      c.var.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { lines: true },
      }),
      c.var.prisma.order.count({ where }),
      c.var.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    const counts: Record<string, number> = { toutes: 0 };
    for (const s of ORDER_STATUSES) counts[s] = 0;
    for (const g of grouped) {
      counts[g.status] = g._count._all;
      counts.toutes += g._count._all;
    }

    return c.json({
      items,
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE_ADMIN)),
      counts,
    });
  })

  .patch("/:id/status", async (c) => {
    const { id } = params(c, idParam);
    const { status } = await body(c, setStatusSchema);

    if (status === "ANNULEE") {
      throw new BadRequestError(
        "L'annulation d'une commande doit passer par l'action d'annulation dédiée afin de réapprovisionner le stock.",
      );
    }

    const order = await c.var.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundError(NOT_FOUND_FR);
    if (order.status === "ANNULEE") throw new ConflictError(LOCKED_FR);

    return c.json({
      order: await c.var.prisma.order.update({
        where: { id },
        data: { status },
        include: { lines: true },
      }),
    });
  })

  /** Cancel + restock. Idempotent: an already-cancelled order is returned as-is. */
  .post("/:id/cancel", async (c) => {
    const { id } = params(c, idParam);

    const order = await c.var.prisma.$transaction(async (tx) => {
      const existing = await tx.order.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!existing) throw new NotFoundError(NOT_FOUND_FR);
      if (existing.status === "ANNULEE") return existing;

      for (const line of existing.lines) {
        // Match by productId, fall back to product name (SetNull history).
        const product =
          line.productId != null
            ? await tx.product.findUnique({ where: { id: line.productId } })
            : await tx.product.findFirst({ where: { name: line.name } });
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: { increment: line.qty },
              sold: { decrement: line.qty },
            },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: { status: "ANNULEE" },
        include: { lines: true },
      });
    });

    return c.json({ order });
  });
