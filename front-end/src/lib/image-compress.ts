import {
  IMAGE_QUALITY,
  MAX_IMAGE_DIMENSION,
  MAX_STORED_BYTES,
  PREFERRED_MIME,
  formatBytes,
} from "@/server/domain/image-policy";

/**
 * Shrink and re-encode an image in the browser, before it is uploaded.
 *
 * Compression has to happen HERE, not on the server: a Worker cannot run a
 * native image library, and doing it in pure JS would burn billed CPU on every
 * upload. The browser already has a hardware-accelerated encoder — it costs the
 * shop nothing to use it, and the bytes that cross the wire (and land in
 * Postgres) drop by roughly an order of magnitude.
 *
 * Always returns a File. If anything fails — an exotic format, a browser
 * without `createImageBitmap`, a canvas the GPU refuses — the original is
 * returned untouched and the server decides whether it is small enough.
 */
export async function compressImage(file: File): Promise<File> {
  // Already small and in the right format: re-encoding would only lose quality.
  if (file.type === PREFERRED_MIME && file.size <= MAX_STORED_BYTES / 2) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, PREFERRED_MIME, IMAGE_QUALITY),
    );
    // A browser that cannot encode WebP hands back null (or silently gives PNG,
    // which the type check below catches) — keep the original in that case.
    if (!blob || blob.type !== PREFERRED_MIME) return file;

    // Re-encoding an already-optimised file can come out larger. Keep whichever
    // is smaller; the point is bytes stored, not the format.
    if (blob.size >= file.size) return file;

    return new File([blob], replaceExtension(file.name, "webp"), {
      type: PREFERRED_MIME,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Compress several files, preserving order. */
export function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f)));
}

/**
 * The message to show when a file is still too large after compression — which
 * only happens if the browser could not re-encode it at all.
 */
export function tooLargeMessage(file: File): string | null {
  if (file.size <= MAX_STORED_BYTES) return null;
  return (
    `« ${file.name} » fait ${formatBytes(file.size)} après compression ; ` +
    `la taille maximale est ${formatBytes(MAX_STORED_BYTES)}. ` +
    "Réduisez ses dimensions avant de le téléverser."
  );
}

function replaceExtension(name: string, ext: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot === -1 ? name : name.slice(0, dot)}.${ext}`;
}
