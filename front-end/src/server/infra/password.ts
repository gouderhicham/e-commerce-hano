import bcrypt from "bcryptjs";

/**
 * Password hashing on Workers.
 *
 * bcrypt is a deliberately slow *pure-JS* loop, and Workers bills CPU time: a
 * cost-10 hash burns ~60-100ms, which blows the free plan's 10ms budget on
 * every single login. PBKDF2 through Web Crypto is the way out — the work
 * happens in the runtime's native crypto, not in the JS isolate, so the same
 * security margin costs a fraction of the billed CPU.
 *
 * Older `$2a$/$2b$/$2y$` bcrypt digests are still accepted, then transparently
 * re-hashed on the next successful login (see `needsRehash`), so an account
 * created under that scheme keeps working and no bcrypt verification ever runs
 * twice for the same user.
 */

/** OWASP's 2023 floor for PBKDF2-HMAC-SHA256. */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;
const PREFIX = "pbkdf2-sha256";

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Constant-time compare: a length-independent early return leaks the digest. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Hash a plaintext password into `pbkdf2-sha256$<iters>$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(password, salt, PBKDF2_ITERATIONS);
  return `${PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/** True when `digest` is a bcrypt hash rather than the current scheme. */
export function isLegacyHash(digest: string): boolean {
  return /^\$2[aby]?\$/.test(digest);
}

/** Verify a password against either hash format. Never throws. */
export async function verifyPassword(
  password: string,
  digest: string,
): Promise<boolean> {
  try {
    if (isLegacyHash(digest)) return await bcrypt.compare(password, digest);

    const [prefix, iterations, salt, hash] = digest.split("$");
    if (prefix !== PREFIX || !iterations || !salt || !hash) return false;

    const derived = await derive(
      password,
      fromBase64(salt),
      Number.parseInt(iterations, 10),
    );
    return timingSafeEqual(derived, fromBase64(hash));
  } catch {
    return false;
  }
}

/**
 * True when a *verified* password should be re-hashed and stored — either it is
 * a legacy bcrypt digest, or the iteration count has since been raised.
 */
export function needsRehash(digest: string): boolean {
  if (isLegacyHash(digest)) return true;
  const [prefix, iterations] = digest.split("$");
  if (prefix !== PREFIX) return true;
  return Number.parseInt(iterations, 10) < PBKDF2_ITERATIONS;
}
