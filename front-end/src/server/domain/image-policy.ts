/**
 * One image policy, shared by everything that writes an image.
 *
 * Uploaded images are rows in Postgres, so every byte competes with the
 * database's size quota — on Neon's free tier that is 500 MB for the *whole*
 * database. The ceiling below is what makes the capacity predictable: at
 * `MAX_STORED_BYTES` per image, 500 MB holds ~850 images even in the worst
 * case, and at the size the compressor actually produces (~80–200 KB) it holds
 * several thousand.
 *
 * These constants are consumed by three places that must never disagree:
 *   - `src/lib/image-compress.ts`  — the browser, before uploading
 *   - `prisma/seed.ts`             — sharp, when seeding the catalogue
 *   - `src/server/infra/storage.ts`— the server, which enforces the ceiling
 */

/** Longest edge in pixels. Product photos are never rendered larger. */
export const MAX_IMAGE_DIMENSION = 1600;

/** WebP quality (0–1). 0.82 is visually lossless for photographs. */
export const IMAGE_QUALITY = 0.82;

/**
 * Hard ceiling on the bytes actually stored, AFTER compression.
 *
 * A compressed 1600px WebP lands far below this; the limit exists so a client
 * that skipped compression cannot quietly consume half the quota with one file.
 */
export const MAX_STORED_BYTES = 600 * 1024;

/** What the compressor targets, and what the store prefers to receive. */
export const PREFERRED_MIME = "image/webp";

/** Formats accepted on upload → the extension they are stored under. */
export const ALLOWED_TYPES: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Human-readable size, for error messages. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  return `${Math.round(bytes / 1024)} Ko`;
}
