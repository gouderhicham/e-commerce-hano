import { getPrisma } from "@/server/db";
import { getRuntime } from "@/server/runtime";
import { serveObject } from "@/server/infra/storage";

/**
 * Public object streaming, mounted OUTSIDE `/api` so every `imageUrl` already
 * stored in the database — `${PUBLIC_BASE_URL}/media/<key>` — keeps
 * resolving wherever the app is deployed.
 *
 * The response is immutable and cached at the edge, so a product photo is
 * served from the colo rather than from Postgres on all but the first hit.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { env } = getRuntime();
  const { key } = await params;
  const joinedKey = key.join("/");

  // 1. HTTP 304 conditional request check (If-None-Match)
  const ifNoneMatch = request.headers.get("if-none-match");
  if (
    ifNoneMatch &&
    (ifNoneMatch === `"${joinedKey}"` || ifNoneMatch === `W/"${joinedKey}"`)
  ) {
    return new Response(null, {
      status: 304,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${joinedKey}"`,
      },
    });
  }

  // 2. Cloudflare edge cache lookup
  const cache =
    typeof caches !== "undefined" && "default" in caches
      ? (caches as unknown as { default: Cache }).default
      : null;

  if (cache) {
    try {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
    } catch {
      // Non-fatal if edge cache match throws
    }
  }

  try {
    const response = await serveObject(
      getPrisma(env.HYPERDRIVE.connectionString),
      joinedKey,
    );

    // 3. Asynchronously store in Cloudflare edge cache on cache miss
    if (cache && response.status === 200) {
      try {
        await cache.put(request, response.clone());
      } catch {
        // Non-fatal if edge cache put throws
      }
    }

    return response;
  } catch {
    return Response.json({ error: "Fichier introuvable." }, { status: 404 });
  }
}

export const HEAD = GET;
