import { describe, expect, it } from "vitest";
import { keyFromUrl, validateImage } from "@/server/infra/storage";

/** Build a File whose declared type and leading bytes can disagree. */
function file(type: string, bytes: number[], size = bytes.length): File {
  const padded = new Uint8Array(Math.max(size, bytes.length));
  padded.set(bytes);
  return new File([padded], "upload", { type });
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
// "RIFF" .... "WEBP"
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

function bytesOf(list: number[], size = list.length): Uint8Array {
  const out = new Uint8Array(Math.max(size, list.length));
  out.set(list);
  return out;
}

describe("uploaded image validation", () => {
  it("accepts the three supported formats", () => {
    expect(validateImage(file("image/png", PNG), bytesOf(PNG)).ext).toBe("png");
    expect(validateImage(file("image/jpeg", JPEG), bytesOf(JPEG)).ext).toBe("jpg");
    expect(validateImage(file("image/webp", WEBP), bytesOf(WEBP)).ext).toBe("webp");
  });

  it("rejects a missing file", () => {
    expect(() => validateImage(null, new Uint8Array())).toThrow(
      /Aucun fichier fourni/,
    );
  });

  it("rejects an unsupported mime type", () => {
    expect(() => validateImage(file("image/gif", PNG), bytesOf(PNG))).toThrow(
      /Format non supporté/,
    );
  });

  it("rejects anything over 5 MB", () => {
    const big = bytesOf(PNG, 5 * 1024 * 1024 + 1);
    expect(() => validateImage(file("image/png", PNG), big)).toThrow(
      /trop volumineux/,
    );
  });

  it("rejects a file whose magic bytes contradict its declared type", () => {
    // An executable renamed to .png and sent with Content-Type: image/png —
    // the check that Content-Type alone would let through.
    const mz = [0x4d, 0x5a, 0x90, 0x00, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(() => validateImage(file("image/png", mz), bytesOf(mz))).toThrow(
      /Fichier corrompu/,
    );
  });

  it("rejects a file too short to carry a header", () => {
    const tiny = [0x89, 0x50];
    expect(() => validateImage(file("image/png", tiny), bytesOf(tiny))).toThrow(
      /Fichier corrompu/,
    );
  });
});

describe("keyFromUrl", () => {
  it("extracts the key from a URL we host", () => {
    expect(keyFromUrl("https://pcstore39.dz/media/products/abc.png")).toBe(
      "products/abc.png",
    );
    expect(keyFromUrl("/media/showcase/hero.webp")).toBe("showcase/hero.webp");
  });

  it("ignores seeded static assets and external URLs", () => {
    // Deleting a product must not try to remove /public/images files or
    // something hosted elsewhere.
    expect(keyFromUrl("/images/products/elitebook-845.jpg")).toBeNull();
    expect(keyFromUrl("https://cdn.example.com/photo.jpg")).toBeNull();
    expect(keyFromUrl(null)).toBeNull();
    expect(keyFromUrl(undefined)).toBeNull();
  });

  it("ignores a /media/ path outside the prefixes we own", () => {
    expect(keyFromUrl("/media/../../etc/passwd")).toBeNull();
    expect(keyFromUrl("/media/somewhere-else/x.png")).toBeNull();
  });
});
