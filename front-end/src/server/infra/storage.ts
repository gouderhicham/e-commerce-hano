import type { PrismaClient } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../http/errors";
import {
  ALLOWED_TYPES,
  MAX_STORED_BYTES,
  formatBytes,
} from "../domain/image-policy";

/**
 * Uploaded images, stored in Postgres (the `MediaObject` table).
 *
 * A Worker has no disk and no long-lived TCP, so there is nowhere to put a file
 * except the database it already talks to. Objects are addressed by key and
 * served at `/media/<key>`, which is what every `imageUrl` column stores.
 *
 * Size is governed by `domain/image-policy.ts`: the browser compresses to WebP
 * before uploading, and the ceiling enforced here is what keeps the database's
 * capacity predictable rather than hostage to whatever a phone camera produced.
 *
 * Reads are answered from the edge cache rather than Postgres on all but the
 * first hit: `serveObject` sets a one-year `immutable` Cache-Control, and keys
 * are content-addressed by a random token, so a replaced image is a new URL and
 * never a stale cache entry.
 */

const UNSUPPORTED_FR =
  "Format non supporté. Formats acceptés : JPEG, PNG, WebP.";

/** Sniff the leading bytes against the declared image type. */
function magicMatches(bytes: Uint8Array, mimetype: string): boolean {
  if (bytes.length < 12) return false;
  const ascii = (from: number, to: number) =>
    String.fromCharCode(...bytes.slice(from, to));

  switch (mimetype) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
    default:
      return false;
  }
}

/** Short collision-resistant, url-safe object id. */
function token(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate an uploaded image (French errors, magic-byte check) and return the
 * extension to store it under.
 */
export function validateImage(
  file: File | null,
  bytes: Uint8Array,
): { ext: string } {
  if (!file) throw new BadRequestError("Aucun fichier fourni.");

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new BadRequestError(UNSUPPORTED_FR);

  if (bytes.byteLength > MAX_STORED_BYTES) {
    throw new BadRequestError(
      `Fichier trop volumineux (${formatBytes(bytes.byteLength)}). ` +
        `Taille maximale : ${formatBytes(MAX_STORED_BYTES)}.`,
    );
  }

  // Defence in depth: the magic bytes must match the declared mimetype, so a
  // renamed executable can't slip through on Content-Type alone.
  if (!magicMatches(bytes, file.type)) {
    throw new BadRequestError("Fichier corrompu ou format non conforme.");
  }

  return { ext };
}

/**
 * Store a validated image under `<prefix>/<token>.<ext>` and return its public
 * media URL, `${PUBLIC_BASE_URL}/media/<key>`.
 */
export async function uploadImage(
  prisma: PrismaClient,
  publicBaseUrl: string,
  prefix: "products" | "categories" | "showcase",
  file: File | null,
): Promise<{ imageUrl: string }> {
  const bytes = new Uint8Array(
    await (file?.arrayBuffer() ?? Promise.resolve(new ArrayBuffer(0))),
  );
  const { ext } = validateImage(file, bytes);

  const key = `${prefix}/${token()}.${ext}`;
  await prisma.mediaObject.create({
    data: {
      key,
      contentType: file!.type,
      size: bytes.byteLength,
      data: bytes,
    },
  });

  return { imageUrl: `${publicBaseUrl}/media/${key}` };
}

/** Extract the media key from a public URL we host, else null. */
export function keyFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const marker = "/media/";
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const key = url.slice(at + marker.length);
  return key.startsWith("products/") ||
    key.startsWith("categories/") ||
    key.startsWith("showcase/")
    ? key
    : null;
}

/**
 * Best-effort deletion of an image by its public URL. Only removes objects we
 * host; seeded `/images/...` paths and external URLs are left untouched. Errors
 * are swallowed — an orphaned row must never fail the surrounding request.
 */
export async function deleteByUrl(
  prisma: PrismaClient,
  url?: string | null,
): Promise<void> {
  const key = keyFromUrl(url);
  if (!key) return;
  await prisma.mediaObject.deleteMany({ where: { key } }).catch(() => undefined);
}

/** Serve an object's bytes, or 404 with the canonical French message. */
export async function serveObject(
  prisma: PrismaClient,
  key: string,
): Promise<Response> {
  const object = await prisma.mediaObject.findUnique({ where: { key } });
  if (!object) throw new NotFoundError("Fichier introuvable.");

  const bytes = new Uint8Array(object.data);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );

  return new Response(buffer, {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.size),
      // Keys are random per upload, so a stored object is genuinely immutable:
      // the edge answers every repeat hit and Postgres sees only the first.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${key}"`,
    },
  });
}
