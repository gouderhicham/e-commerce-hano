// Single door for all browser → API calls.
//
// Every path is same-origin: the API is the Hono router mounted at /api in this
// same Worker. That is not just tidiness — the session cookie is httpOnly and
// SameSite=Lax, so pointing these calls at another origin would silently stop
// sending it. There is deliberately no base-URL setting to get that wrong.

import { LOCALE_COOKIE, isLocale } from "./i18n/shared";

/** The locale this browser is reading in, straight from the cookie. */
function currentLocale(): string {
  if (typeof document === "undefined") return "fr";
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`),
    );
    const value = match?.[1];
    return isLocale(value) ? value : "fr";
  } catch {
    return "fr";
  }
}

/**
 * Every browser → API call carries `x-locale`, because the backend renders its
 * error messages in the customer's language (see `AllExceptionsFilter`). The
 * storefront prints those messages verbatim, so without this header an Arabic
 * shopper reads French errors.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-locale")) headers.set("x-locale", currentLocale());

  return fetch(path, {
    // Needed for cross-origin session cookies once the API is external.
    credentials: "include",
    ...init,
    headers,
  });
}

/**
 * Normalize a product image URL for the browser. The backend stores absolute
 * media URLs (e.g. `http://localhost:4000/media/products/x.jpg`); rewriting them
 * to the relative `/media/...` path routes the request through the same-origin
 * Next.js proxy. Relative paths (seed `/images/...`) are returned untouched.
 */
export function mediaSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url)) {
    const at = url.indexOf("/media/");
    if (at !== -1) return url.slice(at);
  }
  return url;
}
