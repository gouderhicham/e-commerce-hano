import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, PATHNAME_HEADER, isLocale } from "./shared";
import type { Locale } from "./types";

/** Routes rendered in the visitor's language. Everything else is French LTR. */
function isStorefrontPath(pathname: string): boolean {
  return !(
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/login" ||
    pathname.startsWith("/api/")
  );
}

/**
 * The locale to render this request in.
 *
 * The back office is French-only by design, so an admin page always resolves to
 * "fr" even when the visitor's cookie says Arabic — otherwise the whole
 * dashboard would flip to RTL with French labels inside it.
 */
export async function resolveLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const pathname = headerList.get(PATHNAME_HEADER) ?? "/";
  if (!isStorefrontPath(pathname)) return "fr";

  const raw = cookieStore.get(LOCALE_COOKIE)?.value;
  return isLocale(raw) ? raw : "fr";
}
