import { getCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { AppBindings, AuthUser } from "../env";
import { verifySession } from "../infra/jwt";
import { ForbiddenError, UnauthorizedError } from "./errors";

const NOT_LOGGED_IN_FR = "Veuillez vous connecter pour continuer.";
const ADMIN_ONLY_FR = "Accès réservé à l'administrateur.";

/** The exact `select` guaranteeing `passwordHash` never leaves the DB layer. */
export const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  role: true,
  name: true,
  phone: true,
  wilayaCode: true,
  communeId: true,
  adresse: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Resolve the caller from the session cookie, or null. Never throws — the
 * equivalent of `resolveOptionalUser`, for endpoints that behave differently
 * for guests (owner-or-admin order access, guest checkout).
 */
export async function resolveUser(
  c: Context<AppBindings>,
): Promise<AuthUser | null> {
  const token = getCookie(c, c.env.COOKIE_NAME);
  if (!token) return null;

  const payload = await verifySession(token, c.env.JWT_SECRET);
  if (!payload) return null;

  // Load fresh: a role change or a deleted account must invalidate the session
  // immediately, so the cookie's own claims are never trusted as user state.
  return c.var.prisma.user.findUnique({
    where: { id: payload.sub },
    select: USER_PUBLIC_SELECT,
  });
}

/**
 * Populate `c.var.user` for every request without rejecting anyone. Runs once,
 * ahead of the routes, so `requireUser`/`requireAdmin` only assert — they never
 * hit the database a second time.
 */
export const withUser: MiddlewareHandler<AppBindings> = async (c, next) => {
  c.set("user", await resolveUser(c));
  await next();
};

/** Requires any logged-in user; 401 otherwise. */
export const requireUser: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.var.user) throw new UnauthorizedError(NOT_LOGGED_IN_FR);
  await next();
};

/** Requires a logged-in ADMIN; 401 if not logged in, 403 if not admin. */
export const requireAdmin: MiddlewareHandler<AppBindings> = async (c, next) => {
  const user = c.var.user;
  if (!user) throw new UnauthorizedError(NOT_LOGGED_IN_FR);
  if (user.role !== "ADMIN") throw new ForbiddenError(ADMIN_ONLY_FR);
  await next();
};

/** The current user, asserted non-null — for handlers behind `requireUser`. */
export function currentUser(c: Context<AppBindings>): AuthUser {
  const user = c.var.user;
  if (!user) throw new UnauthorizedError(NOT_LOGGED_IN_FR);
  return user;
}
