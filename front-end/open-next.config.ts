import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext turns the Next.js build into a Cloudflare Worker.
 *
 * No incremental cache is configured yet: the storefront pages that carry
 * `revalidate` are re-rendered per isolate. Wire an R2 or KV incremental cache
 * here to share the ISR payload across the edge — that is the single biggest
 * remaining win for cold-cache page loads.
 */
const config = defineCloudflareConfig();
config.edgeExternals = [...(config.edgeExternals ?? []), "pg-cloudflare"];

export default config;
