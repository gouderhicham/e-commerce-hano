import type { CookieOptions } from "hono/utils/cookie";

/**
 * Parse a JWT-style duration ("7d", "12h", "30m", "3600s", or a plain number of
 * seconds) into seconds — the unit Hono's cookie helper wants for `maxAge`.
 */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60; // safe default: 7 days
  const amount = Number.parseInt(match[1], 10);
  const factor: Record<string, number> = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 24 * 60 * 60,
  };
  return amount * factor[match[2] ?? "s"];
}

/**
 * Session cookie flags.
 *
 * The API is now same-origin with the site (one Worker serves both), so the
 * cross-site `SameSite=None` the split deployment needed is gone: `Lax` is
 * both sufficient and a free CSRF mitigation. `Secure` follows the scheme so
 * the cookie still works over plain http on localhost.
 */
export function sessionCookieOptions(
  isSecure: boolean,
  maxAgeSeconds: number,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "Lax",
    secure: isSecure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** True when the request arrived over HTTPS (so cookies may be `Secure`). */
export function isSecureRequest(url: string): boolean {
  return new URL(url).protocol === "https:";
}
