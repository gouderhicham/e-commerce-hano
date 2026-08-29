import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CloudflareEnv } from "./env";

/**
 * The Cloudflare bindings and execution context for the current request.
 *
 * `ctx` is absent outside a real Worker; every caller treats `waitUntil` as
 * best-effort, so a missing context degrades to "run it, don't await it".
 */
export interface Runtime {
  env: CloudflareEnv;
  ctx?: { waitUntil(promise: Promise<unknown>): void };
}

let warned = false;

/**
 * Build the bindings from `process.env` for local development.
 *
 * Under `next dev`, bindings normally come from Miniflare — but Miniflare boots
 * workerd, a native binary that will not start on every machine (a Windows host
 * with an outdated Visual C++ runtime, for instance). Making local development
 * depend on that would mean the app is unrunnable there for a reason that has
 * nothing to do with the app, so this reads `.env.local` instead.
 *
 * Hyperdrive's only job is pooling, and it exposes a plain connection string,
 * so pointing Prisma straight at `DATABASE_URL` locally exercises exactly the
 * same query path — only without the pooler in front of it.
 */
function envFromProcess(): CloudflareEnv {
  const connectionString = process.env.DATABASE_URL ?? "";

  if (!warned) {
    warned = true;
    if (!connectionString) {
      console.warn(
        "[runtime] No Cloudflare bindings and no DATABASE_URL — set one in .env.local.",
      );
    } else {
      console.info(
        "[runtime] Cloudflare bindings unavailable; using process.env (local development).",
      );
    }
  }

  return {
    HYPERDRIVE: { connectionString },
    PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL ?? "http://localhost:3000",
    COOKIE_NAME: process.env.COOKIE_NAME ?? "pcstore39_session",
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "7d",
    MAIL_FROM:
      process.env.MAIL_FROM ?? "pc store .39 <no-reply@pcstore39.dz>",
    // Dev-only default: a deployed Worker always gets this from
    // `wrangler secret put JWT_SECRET`, never from here.
    JWT_SECRET: process.env.JWT_SECRET ?? "dev-only-insecure-secret",
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAIL_TO: process.env.MAIL_TO,
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __GLOBAL_CF_ENV__: CloudflareEnv | undefined;
  // eslint-disable-next-line no-var
  var __GLOBAL_CF_CTX__: Runtime["ctx"] | undefined;
}

/**
 * Resolve the runtime for this request: the real Cloudflare context when there
 * is one, else a process.env-backed stand-in. In a deployed Worker the first
 * branch always wins — there is no ambient process environment there at all.
 */
export function getRuntime(): Runtime {
  try {
    const { env, ctx } = getCloudflareContext();
    const bindings = env as unknown as CloudflareEnv | undefined;
    // A context can exist with bindings that never initialised (a Miniflare
    // that failed to boot), which would surface as an unreadable connection
    // string deep inside Prisma rather than here.
    if (bindings?.HYPERDRIVE?.connectionString) {
      globalThis.__GLOBAL_CF_ENV__ = bindings;
      globalThis.__GLOBAL_CF_CTX__ = ctx as Runtime["ctx"];
      return { env: bindings, ctx: ctx as Runtime["ctx"] };
    }
  } catch {
    // No Cloudflare context in current async scope (e.g. detached RSC stream)
  }

  if (globalThis.__GLOBAL_CF_ENV__?.HYPERDRIVE?.connectionString) {
    return {
      env: globalThis.__GLOBAL_CF_ENV__,
      ctx: globalThis.__GLOBAL_CF_CTX__,
    };
  }

  return { env: envFromProcess() };
}
