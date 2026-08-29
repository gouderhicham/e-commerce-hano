import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppBindings } from "../env";

const TOO_MANY_FR = "Trop de tentatives. Veuillez réessayer dans un instant.";

/**
 * Throttling via Cloudflare's rate-limiting binding.
 *
 * An in-memory counter would mean one independent counter per isolate - no
 * limit at all in practice. The binding counts at the edge instead, shared
 * across every isolate in a colo, and costs nothing on the free plan.
 *
 * Absent binding (e.g. `next dev` without Miniflare) → the middleware is inert
 * rather than fatal, so local development never depends on it.
 */
export function rateLimit(
  keyOf: (c: Parameters<MiddlewareHandler<AppBindings>>[0]) => string,
): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const limiter = c.env.LOGIN_RATE_LIMIT;
    if (limiter) {
      const { success } = await limiter.limit({ key: keyOf(c) });
      if (!success) throw new HTTPException(429, { message: TOO_MANY_FR });
    }
    await next();
  };
}

/** Throttle by client IP, as reported by Cloudflare. */
export const byIp = rateLimit(
  (c) => c.req.header("cf-connecting-ip") ?? "unknown",
);
