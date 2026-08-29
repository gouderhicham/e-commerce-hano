import type { NextConfig } from "next";

/**
 * Local development does NOT boot Miniflare.
 *
 * `initOpenNextCloudflareForDev()` starts workerd, a native binary that fails
 * to launch on some machines (a Windows host with an outdated Visual C++
 * runtime, for one) — and when it fails it takes every Cloudflare binding with
 * it, so the whole app 500s for a reason unrelated to the app. `src/server/
 * runtime.ts` reads `.env.local` instead, which exercises the same code path
 * against the same Postgres.
 *
 * Set `CLOUDFLARE_DEV=1` to opt in when you specifically want to test against
 * real bindings locally. `npm run cf:preview` runs the built Worker for real,
 * which is the more faithful check anyway.
 */
if (process.env.NODE_ENV === "development" && process.env.CLOUDFLARE_DEV === "1") {
  void import("@opennextjs/cloudflare")
    .then(({ initOpenNextCloudflareForDev }) => initOpenNextCloudflareForDev())
    .catch((err) => {
      console.warn(
        "[next.config] Could not start Miniflare; falling back to process.env.",
        err instanceof Error ? err.message : err,
      );
    });
}

/**
 * No rewrites, no proxies.
 *
 * The API is part of this app (`app/api/[[...route]]/route.ts`, a Hono
 * router), so a server component reaches the handlers in-process. Uploaded
 * images are served by `app/media/[...key]/route.ts` out of Postgres. Nothing
 * is forwarded to another origin any more — which is the point: every hop the
 * old split deployment paid on a page render is gone.
 */
const nextConfig: NextConfig = {
  compress: false,
  serverExternalPackages: ["pg-cloudflare"],
};

export default nextConfig;
