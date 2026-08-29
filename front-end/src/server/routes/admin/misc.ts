import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { NotFoundError } from "../../http/errors";
import { body, params, query } from "../../http/validate";
import {
  PAGE_SIZE_ADMIN,
  normalizePage,
  paginationArgs,
} from "../../domain/pagination";
import { toProductPublic } from "../../domain/availability";

const idParam = z.object({ id: z.string().min(1) });
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  focus: z.string().optional(),
});

const SERIES_DAYS = 14;
const LATEST_NOTIFICATIONS = 8;

/** Orders the admin has not started handling yet. */
const PENDING_STATUSES = ["NOUVELLE"] as const;

/** Per-day revenue of delivered orders across the last 14 calendar days. */
function buildSeries(
  orders: { total: number; createdAt: Date }[],
): { date: string; revenue: number }[] {
  const byDay = new Map<string, number>();
  for (const o of orders) {
    const key = o.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + o.total);
  }

  const series: { date: string; revenue: number }[] = [];
  const today = new Date();
  for (let i = SERIES_DAYS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, revenue: byDay.get(key) ?? 0 });
  }
  return series;
}

/** Sidebar and bell counters. */
export const badgeRoutes = new Hono<AppBindings>().get("/", async (c) => {
  const [newOrders, unreadMessages, unreadNotifications] = await Promise.all([
    c.var.prisma.order.count({ where: { status: { in: [...PENDING_STATUSES] } } }),
    c.var.prisma.contactMessage.count({ where: { read: false } }),
    c.var.prisma.notification.count({ where: { read: false } }),
  ]);
  return c.json({ newOrders, unreadQuotes: 0, unreadMessages, unreadNotifications });
});

export const dashboardRoutes = new Hono<AppBindings>().get("/", async (c) => {
  const prisma = c.var.prisma;
  const [
    caAgg,
    ordersTotal,
    newOrders,
    activeProducts,
    clients,
    deliveredOrders,
    latestOrders,
    topProductsRaw,
    stockAlertsRaw,
  ] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true }, where: { status: "LIVREE" } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "NOUVELLE" } }),
    prisma.product.count({ where: { active: true } }),
    prisma.user.count({ where: { role: "CLIENT" } }),
    prisma.order.findMany({
      where: { status: "LIVREE" },
      select: { total: true, createdAt: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { lines: true },
    }),
    prisma.product.findMany({ orderBy: { sold: "desc" }, take: 5 }),
    prisma.product.findMany({
      where: { stock: { lte: 5 } },
      orderBy: { stock: "asc" },
    }),
  ]);

  return c.json({
    kpis: {
      caTotal: caAgg._sum.total ?? 0,
      ordersTotal,
      newOrders,
      activeProducts,
      clients,
    },
    salesSeries: buildSeries(deliveredOrders),
    latestOrders,
    topProducts: topProductsRaw.map((p) => toProductPublic(p)),
    stockAlerts: stockAlertsRaw.map((p) => toProductPublic(p)),
  });
});

export const clientRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const { page } = query(c, pageQuery);
    const { skip, take } = paginationArgs(page, PAGE_SIZE_ADMIN);

    const [users, total] = await Promise.all([
      c.var.prisma.user.findMany({
        where: { role: "CLIENT" },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true,
          email: true,
          role: true,
          name: true,
          phone: true,
          wilayaCode: true,
          communeId: true,
          adresse: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      c.var.prisma.user.count({ where: { role: "CLIENT" } }),
    ]);

    // One grouped query instead of 2N per-user round trips: over Hyperdrive
    // every extra query is a real network hop. An N+1 that a local socket
    // would hide is the difference between a fast page and a slow one here.
    const ids = users.map((u) => u.id);
    const [orderCounts, spendSums] = await Promise.all([
      c.var.prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { in: ids } },
        _count: { _all: true },
      }),
      c.var.prisma.order.groupBy({
        by: ["userId"],
        where: { userId: { in: ids }, status: "LIVREE" },
        _sum: { total: true },
      }),
    ]);
    const countBy = new Map(orderCounts.map((g) => [g.userId, g._count._all]));
    const spentBy = new Map(spendSums.map((g) => [g.userId, g._sum.total ?? 0]));

    return c.json({
      items: users.map((user) => ({
        user,
        orders: countBy.get(user.id) ?? 0,
        totalSpent: spentBy.get(user.id) ?? 0,
        since: user.createdAt,
      })),
      total,
      page,
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE_ADMIN)),
    });
  })

  .get("/:id", async (c) => {
    const { id } = params(c, idParam);
    const user = await c.var.prisma.user.findFirst({
      where: { id, role: "CLIENT" },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        phone: true,
        wilayaCode: true,
        communeId: true,
        adresse: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundError("Client introuvable.");

    const orders = await c.var.prisma.order.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      include: { lines: true },
    });
    return c.json({ user, orders });
  });

export const settingsRoutes = new Hono<AppBindings>()
  .get("/", async (c) =>
    c.json(await c.var.prisma.settings.findUniqueOrThrow({ where: { id: 1 } })),
  )
  .patch("/", async (c) => {
    // Partial patch of the singleton row — the shop identity, shipping numbers
    // and storefront copy are static now; only the Telegram relay is editable.
    const dto = await body(
      c,
      z.object({
        telegramBotToken: z.string().optional(),
        telegramChatId: z.string().optional(),
      }),
    );
    return c.json(
      await c.var.prisma.settings.update({ where: { id: 1 }, data: dto }),
    );
  });

export const messageRoutes = new Hono<AppBindings>()
  /**
   * `focus` is how a bell notification deep-links to a message: instead of the
   * requested page, return the page that actually contains it (messages are
   * ordered newest first, so "how many are newer" gives the offset).
   */
  .get("/", async (c) => {
    const { page, focus } = query(c, pageQuery);

    let resolvedPage = page;
    if (focus) {
      const target = await c.var.prisma.contactMessage.findUnique({
        where: { id: focus },
        select: { createdAt: true },
      });
      if (target) {
        const newer = await c.var.prisma.contactMessage.count({
          where: { createdAt: { gt: target.createdAt } },
        });
        resolvedPage = Math.floor(newer / PAGE_SIZE_ADMIN) + 1;
      }
    }

    const { skip, take } = paginationArgs(resolvedPage, PAGE_SIZE_ADMIN);
    const [items, total, unreadCount] = await Promise.all([
      c.var.prisma.contactMessage.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      c.var.prisma.contactMessage.count(),
      c.var.prisma.contactMessage.count({ where: { read: false } }),
    ]);

    return c.json({
      items,
      total,
      page: normalizePage(resolvedPage),
      pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE_ADMIN)),
      unreadCount,
    });
  })

  .patch("/:id/read", async (c) => {
    const { id } = params(c, idParam);
    await assertMessageExists(c.var.prisma, id);
    return c.json({
      message: await c.var.prisma.contactMessage.update({
        where: { id },
        data: { read: true },
      }),
    });
  })

  .delete("/:id", async (c) => {
    const { id } = params(c, idParam);
    await assertMessageExists(c.var.prisma, id);
    await c.var.prisma.contactMessage.delete({ where: { id } });
    return c.json({ ok: true });
  });

async function assertMessageExists(
  prisma: AppBindings["Variables"]["prisma"],
  id: string,
): Promise<void> {
  const found = await prisma.contactMessage.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new NotFoundError("Message introuvable.");
}

async function assertNotificationExists(
  prisma: AppBindings["Variables"]["prisma"],
  id: string,
): Promise<void> {
  const found = await prisma.notification.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) throw new NotFoundError("Notification introuvable.");
}

/**
 * The bell.
 *
 * The SSE `/stream` endpoint is deliberately gone: a Worker isolate is
 * per-request and short-lived, so nothing can hold an in-process subscription
 * open across requests, and billing a long-lived idle socket is the opposite of
 * what this migration is for. The back office polls this list instead — see
 * `admin-shell.tsx`, which refreshes while the tab is visible.
 */
export const notificationRoutes = new Hono<AppBindings>()
  .get("/", async (c) => {
    const [items, unreadCount] = await Promise.all([
      c.var.prisma.notification.findMany({
        orderBy: { createdAt: "desc" },
        take: LATEST_NOTIFICATIONS,
      }),
      c.var.prisma.notification.count({ where: { read: false } }),
    ]);
    return c.json({ items, unreadCount });
  })

  .post("/read-all", async (c) => {
    await c.var.prisma.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    return c.json({ ok: true });
  })

  .patch("/:id/read", async (c) => {
    const { id } = params(c, idParam);
    await assertNotificationExists(c.var.prisma, id);
    return c.json({
      notification: await c.var.prisma.notification.update({
        where: { id },
        data: { read: true },
      }),
    });
  })

  .delete("/:id", async (c) => {
    const { id } = params(c, idParam);
    await assertNotificationExists(c.var.prisma, id);
    await c.var.prisma.notification.delete({ where: { id } });
    return c.json({ ok: true });
  })

  .delete("/", async (c) => {
    await c.var.prisma.notification.deleteMany({});
    return c.json({ ok: true });
  });
