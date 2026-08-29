import { createApp } from "@/server/app";
import { getRuntime } from "@/server/runtime";
import type { ExecutionContext } from "hono";

/**
 * The whole API, served by the same Worker as the site.
 *
 * Next's catch-all route handler hands every `/api/*` request to the Hono app.
 * Cloudflare bindings (Hyperdrive, R2, secrets) are not on `process.env` in a
 * Worker — they come from the request context, so they are injected per call.
 */
export const dynamic = "force-dynamic";

const app = createApp();

async function handler(request: Request): Promise<Response> {
  const { env, ctx } = getRuntime();
  return app.fetch(request, env, ctx as ExecutionContext | undefined);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;
