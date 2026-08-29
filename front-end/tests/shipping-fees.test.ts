import { describe, expect, it } from "vitest";
import {
  INVALID_FEE,
  diffCommuneFees,
  diffWilayaFees,
  effectiveFee,
  importSummary,
  parseFeeDraft,
} from "@/lib/admin/shipping-fees";
import type { Wilaya } from "@/lib/data/types";

const wilayas: Wilaya[] = [
  {
    code: 16,
    name: "Alger",
    fee: 400,
    communes: [
      { id: 1601, name: "Alger Centre", wilayaCode: 16, fee: null },
      { id: 1602, name: "Bab El Oued", wilayaCode: 16, fee: 550 },
    ],
  },
  {
    code: 31,
    name: "Oran",
    fee: 700,
    communes: [{ id: 3101, name: "Oran", wilayaCode: 31, fee: null }],
  },
];

describe("parseFeeDraft", () => {
  it("treats an empty input as 'no value'", () => {
    expect(parseFeeDraft("")).toBeNull();
    expect(parseFeeDraft("   ")).toBeNull();
  });

  it("accepts non-negative integers, spaces included", () => {
    expect(parseFeeDraft("0")).toBe(0);
    expect(parseFeeDraft("450")).toBe(450);
    expect(parseFeeDraft("1 200")).toBe(1200);
  });

  it("rejects anything that is not a whole DA amount", () => {
    expect(parseFeeDraft("abc")).toBe(INVALID_FEE);
    expect(parseFeeDraft("12.5")).toBe(INVALID_FEE);
    expect(parseFeeDraft("-100")).toBe(INVALID_FEE);
  });
});

describe("effectiveFee", () => {
  it("prefers the commune fee and falls back to the wilaya", () => {
    expect(effectiveFee(550, 400)).toBe(550);
    expect(effectiveFee(null, 400)).toBe(400);
    expect(effectiveFee(0, 400)).toBe(0); // free delivery is a real value
  });
});

describe("diffWilayaFees", () => {
  it("keeps only drafts that differ from the stored fee", () => {
    const { changes, invalid } = diffWilayaFees(wilayas, {
      16: "450",
      31: "700", // unchanged
    });
    expect(changes).toEqual([{ code: 16, fee: 450 }]);
    expect(invalid).toEqual([]);
  });

  it("flags an empty wilaya fee — it is the fallback, it cannot be blank", () => {
    const { changes, invalid } = diffWilayaFees(wilayas, { 16: "" });
    expect(changes).toEqual([]);
    expect(invalid).toEqual([16]);
  });
});

describe("diffCommuneFees", () => {
  it("sends null when the input is cleared (inherit the wilaya)", () => {
    const { changes } = diffCommuneFees(wilayas, { 1602: "" });
    expect(changes).toEqual([{ id: 1602, fee: null }]);
  });

  it("ignores an untouched commune and one re-typed to the same value", () => {
    const { changes } = diffCommuneFees(wilayas, { 1602: "550" });
    expect(changes).toEqual([]);
  });

  it("sets an override on a commune that was inheriting", () => {
    const { changes } = diffCommuneFees(wilayas, { 1601: "300" });
    expect(changes).toEqual([{ id: 1601, fee: 300 }]);
  });

  it("flags an unreadable fee instead of sending it", () => {
    const { changes, invalid } = diffCommuneFees(wilayas, { 1601: "abc" });
    expect(changes).toEqual([]);
    expect(invalid).toEqual([1601]);
  });
});

describe("importSummary", () => {
  it("says nothing changed when the file matches the database", () => {
    expect(
      importSummary({ updatedWilayas: 0, updatedCommunes: 0, skipped: 0 }),
    ).toContain("Aucun tarif modifié");
  });

  it("pluralises both counts", () => {
    expect(
      importSummary({ updatedWilayas: 1, updatedCommunes: 12, skipped: 0 }),
    ).toBe("1 wilaya et 12 communes mis à jour.");
  });
});
