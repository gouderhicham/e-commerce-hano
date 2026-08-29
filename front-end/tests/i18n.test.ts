import { describe, expect, it } from "vitest";
import { ar } from "@/lib/i18n/dictionaries/ar";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { interpolate, pick } from "@/lib/i18n/localize";

type Leaf = [path: string, value: string];

function leaves(obj: unknown, prefix = ""): Leaf[] {
  const out: Leaf[] = [];
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.push([path, value]);
    else if (value && typeof value === "object") out.push(...leaves(value, path));
  }
  return out;
}

const frLeaves = leaves(fr);
const arLeaves = leaves(ar);
const frMap = new Map(frLeaves);
const arMap = new Map(arLeaves);

/** `{name}`, `{n}`, … placeholders a template expects. */
function tokens(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("i18n dictionaries", () => {
  it("define exactly the same keys in both languages", () => {
    const missingInAr = [...frMap.keys()].filter((k) => !arMap.has(k));
    const missingInFr = [...arMap.keys()].filter((k) => !frMap.has(k));
    expect({ missingInAr, missingInFr }).toEqual({
      missingInAr: [],
      missingInFr: [],
    });
  });

  it("never ship an empty string", () => {
    const empty = [...frLeaves, ...arLeaves]
      .filter(([, value]) => !value.trim())
      .map(([path]) => path);
    expect(empty).toEqual([]);
  });

  it("use the same interpolation tokens in both languages", () => {
    const mismatched = [...frMap.entries()]
      .filter(([key, value]) => {
        const other = arMap.get(key);
        return other !== undefined && tokens(value).join() !== tokens(other).join();
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });

  it("keep the two languages distinct where it matters", () => {
    // A French string copied verbatim into ar.ts is an untranslated key. Purely
    // numeric/symbolic values (ratings, "1 - 3") legitimately match.
    const suspicious = [...frMap.entries()]
      .filter(([key, value]) => {
        if (arMap.get(key) !== value) return false;
        return /\p{Letter}/u.test(value);
      })
      .map(([key]) => key);
    expect(suspicious).toEqual([]);
  });
});

describe("pick", () => {
  it("returns French when reading French", () => {
    expect(pick("fr", "Ordinateur", "حاسوب")).toBe("Ordinateur");
  });

  it("returns Arabic when reading Arabic", () => {
    expect(pick("ar", "Ordinateur", "حاسوب")).toBe("حاسوب");
  });

  it("falls back to French when the translation is missing or blank", () => {
    expect(pick("ar", "Ordinateur", null)).toBe("Ordinateur");
    expect(pick("ar", "Ordinateur", "")).toBe("Ordinateur");
    expect(pick("ar", "Ordinateur", "   ")).toBe("Ordinateur");
  });

  it("never returns undefined", () => {
    expect(pick("ar", null, null)).toBe("");
    expect(pick("fr", undefined, undefined)).toBe("");
  });
});

describe("interpolate", () => {
  it("substitutes named tokens", () => {
    expect(interpolate("Seulement {n} en stock", { n: 3 })).toBe(
      "Seulement 3 en stock",
    );
  });

  it("leaves unknown tokens untouched rather than blanking them", () => {
    expect(interpolate("{a} et {b}", { a: "x" })).toBe("x et {b}");
  });
});
