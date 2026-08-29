import type { MetadataRoute } from "next";
import { getPrisma } from "@/server/db";
import { getRuntime } from "@/server/runtime";
import * as catalog from "@/server/services/catalog";
import type { ProductPublic } from "@/lib/data/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Regenerate at most once per hour so new products show up without a rebuild.
export const revalidate = 3600;

/**
 * All active products from the public catalogue, walked page by page.
 *
 * This is anonymous, un-guarded data, so it calls the catalogue service
 * directly rather than going through the router — there is no cookie to
 * forward and no guard to satisfy. Returns [] if the database is unreachable,
 * so the static routes still make it into the sitemap.
 */
async function allPublicProducts(): Promise<ProductPublic[]> {
  try {
    const { env } = getRuntime();
    const prisma = getPrisma(env.HYPERDRIVE.connectionString);

    const items: ProductPublic[] = [];
    let page = 1;
    let pageCount = 1;
    do {
      const data = await catalog.products(prisma, { page });
      items.push(...(data.items as unknown as ProductPublic[]));
      pageCount = data.pageCount;
      page++;
    } while (page <= pageCount);
    return items;
  } catch {
    return [];
  }
}

/** Served at /sitemap.xml — landing, catalogue, contact and product details. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await allPublicProducts();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/catalogue`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/produit/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...productRoutes];
}
