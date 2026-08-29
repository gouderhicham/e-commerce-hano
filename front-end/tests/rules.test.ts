import { describe, expect, it } from "vitest";
import {
  availabilityOf,
  computeShipping,
  makeOrderNumber,
  paginate,
  sortProducts,
} from "@/lib/data/rules";
import { fmtDA, frDate, slugify } from "@/lib/format";
import { SHIPPING } from "@/lib/shop-config";
import type { Product } from "@/lib/data/types";


describe("availabilityOf (rule 1 — derived, never stored)", () => {
  it("maps stock to availability", () => {
    expect(availabilityOf(0)).toBe("indisponible");
    expect(availabilityOf(-2)).toBe("indisponible");
    expect(availabilityOf(1)).toBe("stock_limite");
    expect(availabilityOf(5)).toBe("stock_limite");
    expect(availabilityOf(6)).toBe("disponible");
  });
});

describe("computeShipping (rule 3)", () => {
  const settings = { shipFee: 800, freeThreshold: 50000 };

  it("is free strictly above the threshold", () => {
    expect(
      computeShipping({
        subtotal: 50001,
        settings,
        wilayaFee: 400,
        communeFee: 550,
      }),
    ).toBe(0);
    // exactly at threshold → NOT free (strict >)
    expect(
      computeShipping({ subtotal: 50000, settings, wilayaFee: 400 }),
    ).toBe(400);
  });

  it("threshold 0 disables free shipping", () => {
    expect(
      computeShipping({
        subtotal: 999999,
        settings: { shipFee: 800, freeThreshold: 0 },
        wilayaFee: 400,
      }),
    ).toBe(400);
  });

  it("uses the commune fee first, then wilaya fee, then base fee", () => {
    // commune override wins over its wilaya's default fee
    expect(
      computeShipping({
        subtotal: 1000,
        settings,
        wilayaFee: 1200,
        communeFee: 950,
      }),
    ).toBe(950);
    // no commune override → wilaya default fee
    expect(
      computeShipping({
        subtotal: 1000,
        settings,
        wilayaFee: 1200,
        communeFee: null,
      }),
    ).toBe(1200);
    // unknown destination → base fee
    expect(
      computeShipping({ subtotal: 1000, settings, wilayaFee: null }),
    ).toBe(800);
  });

  it("falls back to the static shop config when no override is given", () => {
    expect(computeShipping({ subtotal: 1000, wilayaFee: null })).toBe(
      SHIPPING.fee,
    );
  });
});

describe("makeOrderNumber", () => {
  it("produces CMD-<year>-<4 digits> and avoids collisions", () => {
    const taken = new Set(["CMD-2026-1500"]);
    let first = true;
    const id = makeOrderNumber(
      2026,
      (candidate) => taken.has(candidate),
      () => {
        // First draw collides (0.5 → 1000+4500=5500? deterministic below)
        if (first) {
          first = false;
          return (1500 - 1000) / 9000; // → CMD-2026-1500 (taken)
        }
        return (4821 - 1000) / 9000; // → CMD-2026-4821
      },
    );
    expect(id).toBe("CMD-2026-4821");
    expect(id).toMatch(/^CMD-2026-\d{4}$/);
  });
});

const P = (id: number, price: number | null, name: string): Product => ({
  id,
  reference: `R${id}`,
  name,
  categoryId: "pt",
  price,
  promoPrice: null,
  stock: 10,
  active: true,
  sold: 0,

  specs: "",
  attributes: {},
  tone: "#e3ece3",

  imageUrl: null,
  images: [],

  condition: "État excellent",
  description: "",
  configurations: [],
  deliveryNote: "",
  promises: [],

  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
});

describe("sortProducts (catalogue sorts — null price sorts last)", () => {
  const items = [P(1, 500, "b"), P(2, null, "a"), P(3, 100, "c")];

  it("nouveautes = createdAt desc then id desc", () => {
    const timedItems = [
      { ...P(1, 500, "b"), createdAt: "2026-01-01" },
      { ...P(2, null, "a"), createdAt: "2026-03-01" },
      { ...P(3, 100, "c"), createdAt: "2026-02-01" },
    ];
    expect(sortProducts(timedItems, "nouveautes").map((p) => p.id)).toEqual([2, 3, 1]);
  });
  it("prix_asc puts null last", () => {
    expect(sortProducts(items, "prix_asc").map((p) => p.id)).toEqual([3, 1, 2]);
  });
  it("prix_desc puts null last", () => {
    expect(sortProducts(items, "prix_desc").map((p) => p.id)).toEqual([1, 3, 2]);
  });
  it("nom = locale name asc", () => {
    expect(sortProducts(items, "nom").map((p) => p.name)).toEqual(["a", "b", "c"]);
  });
});

describe("paginate", () => {
  const rows = Array.from({ length: 26 }, (_, i) => i + 1);

  it("slices pages and clamps out-of-range pages", () => {
    const p1 = paginate(rows, 1, 8);
    expect(p1.items).toHaveLength(8);
    expect(p1.pageCount).toBe(4);
    const last = paginate(rows, 99, 8);
    expect(last.page).toBe(4);
    expect(last.items).toEqual([25, 26]);
    expect(paginate(rows, 0, 8).page).toBe(1);
  });

  it("empty list yields one empty page", () => {
    const empty = paginate([], 1, 8);
    expect(empty.pageCount).toBe(1);
    expect(empty.items).toEqual([]);
  });
});

describe("formatting helpers", () => {
  it("fmtDA formats integers without line-breaking spaces", () => {
    expect(fmtDA(12500)).toBe("12500\u00A0DA");
    expect(fmtDA(12500, "ar")).toBe("\u200E12500\u00A0دج");
    expect(fmtDA(800)).toBe("800\u00A0DA");
    expect(fmtDA(1234567)).toBe("1234567\u00A0DA");
    expect(fmtDA(null)).toBe("Sur commande");
    expect(fmtDA(null, "ar")).toBe("على الطلب");
  });

  it("frDate renders French short months", () => {
    expect(frDate("2026-06-28")).toBe("28 juin 2026");
    expect(frDate("2026-01-05")).toBe("5 janv. 2026");
    expect(frDate("2026-08-15")).toBe("15 août 2026");
  });
});

describe("slugify (Arabic & French compatibility)", () => {
  it("normalizes French accented names without stray dashes", () => {
    expect(slugify("Métrologie Spéciale")).toBe("metrologie-speciale");
    expect(slugify("Ordinateurs Portables & Écrans")).toBe(
      "ordinateurs-portables-ecrans",
    );
  });

  it("handles pure Arabic category and product names", () => {
    expect(slugify("حواسيب محمولة")).toBe("حواسيب-محمولة");
    expect(slugify("ذاكرة الوصول العشوائي")).toBe("ذاكرة-الوصول-العشوائي");
  });

  it("handles mixed French and Arabic names", () => {
    expect(slugify("PC Portable حاسوب محمول 2026")).toBe(
      "pc-portable-حاسوب-محمول-2026",
    );
  });
});

