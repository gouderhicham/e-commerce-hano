import { Hono } from "hono";
import type { AppBindings } from "../../env";
import { requireAdmin } from "../../http/auth";
import { adminCategoryRoutes } from "./categories";
import { adminContentRoutes } from "./content";
import {
  badgeRoutes,
  clientRoutes,
  dashboardRoutes,
  messageRoutes,
  notificationRoutes,
  settingsRoutes,
} from "./misc";
import { adminOrderRoutes } from "./orders";
import { adminProductRoutes } from "./products";
import { adminWilayaFeeRoutes } from "./wilaya-fees";
import { uploadRoutes } from "../uploads";

/**
 * The back office. One `requireAdmin` here replaces the `@UseGuards(AdminGuard)`
 * that every admin controller carried, so a new route cannot be added without
 * the guard by forgetting a decorator.
 */
export const adminRoutes = new Hono<AppBindings>()
  .use("*", requireAdmin)
  .route("/badges", badgeRoutes)
  .route("/dashboard", dashboardRoutes)
  .route("/clients", clientRoutes)
  .route("/settings", settingsRoutes)
  .route("/messages", messageRoutes)
  .route("/notifications", notificationRoutes)
  .route("/orders", adminOrderRoutes)
  .route("/products", adminProductRoutes)
  .route("/categories", adminCategoryRoutes)
  .route("/content", adminContentRoutes)
  .route("/wilaya-fees", adminWilayaFeeRoutes)
  .route("/uploads", uploadRoutes);
