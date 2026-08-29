import { NextResponse, type NextRequest } from "next/server";
import { PATHNAME_HEADER } from "@/lib/i18n/shared";
import { getRuntime } from "@/server/runtime";
import { verifySession } from "@/server/infra/jwt";

/**
 * Route guard + locale plumbing. (Next 16.3 renamed `middleware.ts` to
 * `proxy.ts`; this is the same hook under its current name.)
 *
 * The storefront is entirely guest — browsing, favourites, cart and checkout
 * never ask for an account — so the only protected area is the back office: a
 * non-admin on /admin* is bounced to /login, which maps `?guard=admin` to
 * "Accès réservé à l'administrateur.".
 *
 * Every other request simply gets its pathname forwarded as a header, because
 * `app/layout.tsx` needs it to decide whether to render `<html>` in the
 * visitor's locale (storefront) or in French LTR (back office).
 */

/**
 * Verify the session cookie's signature and read its role claim.
 *
 * This used to be an HTTP call to the backend's /api/auth/me on *every* request
 * matched below. It is now a local HMAC verification: no network, no database.
 * That is safe because this guard only decides a redirect — the page behind it
 * still calls `requireAdmin()`, which re-reads the user from the database, so a
 * revoked admin cannot act on a stale claim.
 */
async function sessionRole(req: NextRequest): Promise<string | null> {
  try {
    const { COOKIE_NAME, JWT_SECRET } = getRuntime().env;

    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) return null;

    return (await verifySession(token, JWT_SECRET))?.role ?? null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  // Ensure global context is hydrated
  getRuntime();
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if ((await sessionRole(req)) !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?guard=admin";
      return NextResponse.redirect(url);
    }
  }

  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);
  // Strip accept-encoding for NextServer: Cloudflare CDN handles brotli/gzip
  // at the edge. Preventing Next.js from spawning node:zlib streams avoids
  // worker hanging on un-flushed chunk buffers.
  headers.delete("accept-encoding");
  headers.set("accept-encoding", "identity");
  return NextResponse.next({ request: { headers } });
}

export const middleware = proxy;
export default proxy;

export const config = {
  // Everything except Next internals and static assets: the storefront needs the
  // pathname header on every page; the /admin guard runs inside the handler.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/|media/).*)"],
};
