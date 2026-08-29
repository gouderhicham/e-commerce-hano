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
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { env } = getRuntime();
  const { key } = await params;

  try {
    return await serveObject(
      getPrisma(env.HYPERDRIVE.connectionString),
      key.join("/"),
    );
  } catch {
    return Response.json({ error: "Fichier introuvable." }, { status: 404 });
  }
}

export const HEAD = GET;
