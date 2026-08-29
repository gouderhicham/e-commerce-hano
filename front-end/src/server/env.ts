import type { PrismaClient } from "@prisma/client";

/**
 * Cloudflare bindings and secrets, as declared in `wrangler.jsonc`.
 *
 * There is no ambient process environment on Workers: the runtime hands the
 * bindings to each request, so every piece of configuration arrives here.
 */
export interface CloudflareEnv {
  /**
   * Neon Postgres, pooled at the edge by Hyperdrive.
   *
   * Hyperdrive is not a database — it is a connection pool in front of the
   * shop's own Neon instance, so a Worker skips the TCP + TLS handshake that
   * would otherwise be paid on every single query. The data, the schema and
   * every migration stay in Neon.
   */
  HYPERDRIVE: { connectionString: string };

  /** Login throttling, counted at the edge. */
  LOGIN_RATE_LIMIT?: { limit: (opts: { key: string }) => Promise<{ success: boolean }> };

  // ── vars ──────────────────────────────────────────────────────────────────
  PUBLIC_BASE_URL: string;
  COOKIE_NAME: string;
  JWT_EXPIRES_IN: string;
  MAIL_FROM: string;

  // ── secrets (wrangler secret put) ─────────────────────────────────────────
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  MAIL_TO?: string;
}

/** Per-request state the Hono app carries. */
export interface AppBindings {
  Bindings: CloudflareEnv;
  Variables: {
    prisma: PrismaClient;
    /** Resolved by the auth middleware; null for guests. */
    user: AuthUser | null;
  };
}

export interface AuthUser {
  id: string;
  email: string;
  role: "ADMIN" | "CLIENT";
  name: string;
  phone: string | null;
  wilayaCode: number | null;
  communeId: number | null;
  adresse: string | null;
  createdAt: Date;
  updatedAt: Date;
}
