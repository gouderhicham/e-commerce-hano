import { SignJWT, jwtVerify } from "jose";

/** Session claims carried by the session cookie. */
export interface JwtPayload {
  sub: string;
  role: "ADMIN" | "CLIENT";
}

/**
 * HS256 via `jose`, which signs through Web Crypto - the only crypto a Worker
 * has. Verification costs a few microseconds of native work, so a guard can
 * afford to run it on every request.
 */
function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signSession(
  payload: JwtPayload,
  secret: string,
  expiresIn: string,
): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key(secret));
}

/** Verify and decode a session token, or null when invalid/expired. */
export async function verifySession(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), {
      algorithms: ["HS256"],
    });
    const sub = payload.sub;
    const role = payload.role;
    if (typeof sub !== "string") return null;
    if (role !== "ADMIN" && role !== "CLIENT") return null;
    return { sub, role };
  } catch {
    return null;
  }
}
