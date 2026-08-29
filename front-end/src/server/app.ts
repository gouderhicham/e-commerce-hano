import { Hono } from "hono";
import type { AppBindings } from "./env";
import { getPrisma } from "./db";
import { handleError } from "./http/errors";
import { withUser } from "./http/auth";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { accountRoutes } from "./routes/account";
import { catalogRoutes } from "./routes/catalog";
import { publicRoutes } from "./routes/public";

/**
 * The API, mounted inside the Next.js app at `app/api/[[...route]]/route.ts`.
 *
 * One Worker serves both the site and its API, so a server component reaches
 * the data layer in-process — no network hop between page and data, which is
 * where most of the old architecture's latency lived.
 */
export function createApp() {
  const app = new Hono<AppBindings>().basePath("/api");

  app.onError(handleError);

  // One Prisma client per request context, backed by the isolate-level cache.
  app.use("*", async (c, next) => {
    c.set("prisma", getPrisma(c.env.HYPERDRIVE.connectionString));
    await next();
  });

  // Resolve the session once, ahead of the routes: the guards then only assert.
  app.use("*", withUser);

  app.get("/health", async (c) => {
    try {
      const products = await c.var.prisma.product.count();
      return c.json({ status: "ok", products });
    } catch (err: unknown) {
      return c.json({ status: "degraded", error: (err as Error)?.message || "db error" }, 200);
    }
  });

  app.route("/auth", authRoutes);
  app.route("/account", accountRoutes);
  app.route("/admin", adminRoutes);
  app.route("/", catalogRoutes);
  app.route("/", publicRoutes);

  // Every route the API serves is registered above, so an unmatched path is
  // a genuine 404 rather than something to forward elsewhere.
  app.notFound((c) => c.json({ error: "Route introuvable." }, 404));

  return app;
}

export type AppType = ReturnType<typeof createApp>;
