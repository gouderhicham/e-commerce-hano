import { cookies } from "next/headers";
import type { PublicUser } from "@/lib/data/types";
import { getPrisma } from "@/server/db";
import { getRuntime } from "@/server/runtime";
import { USER_PUBLIC_SELECT } from "@/server/http/auth";
import { verifySession } from "@/server/infra/jwt";

/**
 * Auth now lives in this same Worker, so resolving the current user is a cookie
 * read, a signature check and one indexed query — no HTTP call to a separate
 * service, which is what this used to cost on every guarded page render.
 */

/** HTTP-mappable auth failure: 401 not logged in, 403 wrong role. */
export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Current user or null. Never throws — a broken session reads as "guest". */
export async function getSessionUser(): Promise<PublicUser | null> {
  try {
    const { env } = getRuntime();
    const { COOKIE_NAME, JWT_SECRET, HYPERDRIVE } = env;

    const token = (await cookies()).get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySession(token, JWT_SECRET);
    if (!payload) return null;

    // Load fresh rather than trusting the cookie's claims: a role change or a
    // deleted account has to invalidate the session immediately. The `select`
    // is what guarantees `passwordHash` never leaves the data layer.
    const user = await getPrisma(HYPERDRIVE.connectionString).user.findUnique({
      where: { id: payload.sub },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) return null;

    // Dates were ISO strings when this crossed an HTTP boundary; keep that
    // shape so every consumer (and `PublicUser`) stays unchanged.
    return {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Veuillez vous connecter pour continuer.");
  return user;
}

export async function requireAdmin(): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Veuillez vous connecter pour continuer.");
  if (user.role !== "ADMIN")
    throw new AuthError(403, "Accès réservé à l'administrateur.");
  return user;
}
