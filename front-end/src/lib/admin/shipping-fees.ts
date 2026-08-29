// Draft → payload logic for Admin → Livraison, kept pure so the save path is
// testable without a DOM.

import type { CommuneFee, Wilaya, WilayaFee } from "@/lib/data/types";

/** A fee input the admin has touched but not saved. Keyed by wilaya code / commune id. */
export type FeeDrafts = Record<number, string>;

/** Returned when a draft holds something that is not a usable fee. */
export const INVALID_FEE = Symbol("invalid-fee");

/**
 * Read a fee input. Empty means "no value": `null` for a commune (inherit the
 * wilaya fee), which is why the caller decides whether null is acceptable.
 */
export function parseFeeDraft(
  raw: string,
): number | null | typeof INVALID_FEE {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(/\s/g, ""));
  if (!Number.isInteger(n) || n < 0) return INVALID_FEE;
  return n;
}

/** The fee actually charged for a commune: its own, else its wilaya's. */
export function effectiveFee(fee: number | null, wilayaFee: number): number {
  return fee ?? wilayaFee;
}

/**
 * Wilaya rows to save: drafts that parse to a number AND differ from the
 * stored fee. A wilaya fee is the fallback for its communes, so an empty
 * input is rejected rather than treated as "no fee".
 */
export function diffWilayaFees(
  wilayas: Wilaya[],
  drafts: FeeDrafts,
): { changes: WilayaFee[]; invalid: number[] } {
  const changes: WilayaFee[] = [];
  const invalid: number[] = [];
  for (const w of wilayas) {
    const raw = drafts[w.code];
    if (raw === undefined) continue;
    const parsed = parseFeeDraft(raw);
    if (parsed === INVALID_FEE || parsed === null) {
      invalid.push(w.code);
      continue;
    }
    if (parsed !== w.fee) changes.push({ code: w.code, fee: parsed });
  }
  return { changes, invalid };
}

/**
 * Commune rows to save. An empty input clears the override (`fee: null`), so
 * only a non-numeric value is invalid here.
 */
export function diffCommuneFees(
  wilayas: Wilaya[],
  drafts: FeeDrafts,
): { changes: CommuneFee[]; invalid: number[] } {
  const changes: CommuneFee[] = [];
  const invalid: number[] = [];
  for (const w of wilayas) {
    for (const c of w.communes) {
      const raw = drafts[c.id];
      if (raw === undefined) continue;
      const parsed = parseFeeDraft(raw);
      if (parsed === INVALID_FEE) {
        invalid.push(c.id);
        continue;
      }
      if (parsed !== c.fee) changes.push({ id: c.id, fee: parsed });
    }
  }
  return { changes, invalid };
}

/** French summary of an Excel import, ready for a toast. */
export function importSummary(result: {
  updatedWilayas: number;
  updatedCommunes: number;
  skipped: number;
}): string {
  const parts: string[] = [];
  if (result.updatedWilayas > 0) {
    parts.push(
      `${result.updatedWilayas} wilaya${result.updatedWilayas > 1 ? "s" : ""}`,
    );
  }
  if (result.updatedCommunes > 0) {
    parts.push(
      `${result.updatedCommunes} commune${result.updatedCommunes > 1 ? "s" : ""}`,
    );
  }
  if (parts.length === 0) return "Aucun tarif modifié — le fichier est identique.";
  return `${parts.join(" et ")} mis à jour.`;
}
