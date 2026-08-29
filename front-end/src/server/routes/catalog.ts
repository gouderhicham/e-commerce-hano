import { Hono } from "hono";
import type { AppBindings } from "../env";
import { params, query } from "../http/validate";
import * as catalog from "../services/catalog";
import {
  numericIdParam,
  productQuerySchema,
  suggestQuerySchema,
} from "../services/catalog.schema";

/**
 * The public storefront API — the routes that must be fast.
 *
 * Every one of these is anonymous and cacheable, so they carry an edge
 * `Cache-Control`: Cloudflare answers a repeat request from the colo without
 * ever waking the origin or touching Postgres, which is what removes the cold
 * start the old Vercel + Neon pair had on each first visit.
 */

/** Cache at the edge, revalidate in the background. */
function cacheable(seconds: number, staleSeconds = 300) {
  return `public, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`;
}

export const catalogRoutes = new Hono<AppBindings>()
  .get("/categories", async (c) => {
    c.header("Cache-Control", cacheable(300));
    return c.json(await catalog.categories(c.var.prisma));
  })

  .get("/tag-groups", async (c) => {
    c.header("Cache-Control", cacheable(300));
    return c.json(await catalog.tagGroups(c.var.prisma));
  })

  .get("/home", async (c) => {
    c.header("Cache-Control", cacheable(60));
    return c.json(await catalog.home(c.var.prisma));
  })

  // Declared before "/products/:id" so "suggest" is never read as an id.
  .get("/products/suggest", async (c) => {
    const { q } = query(c, suggestQuerySchema);
    return c.json(await catalog.suggest(c.var.prisma, q));
  })

  .get("/products/:id", async (c) => {
    const { id } = params(c, numericIdParam);
    c.header("Cache-Control", cacheable(60));
    return c.json(await catalog.productById(c.var.prisma, id));
  })

  .get("/products", async (c) => {
    const q = query(c, productQuerySchema);
    c.header("Cache-Control", cacheable(60));
    return c.json(await catalog.products(c.var.prisma, q));
  })

  .get("/shipping/wilayas", async (c) => {
    // The 58 wilayas and their communes change about once a decade.
    c.header("Cache-Control", cacheable(3600));
    return c.json(await catalog.wilayas(c.var.prisma));
  })

  .get("/settings/public", async (c) => c.json(await catalog.publicSettings(c.var.prisma)));
