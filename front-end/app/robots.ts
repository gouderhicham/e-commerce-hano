import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** Served at /robots.txt. Landing, catalogue and product pages are crawlable. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/login", "/panier", "/commande", "/favoris"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
