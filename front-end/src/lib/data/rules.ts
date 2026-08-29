// Canonical business rules (CLAUDE.md §Business rules).
// Pure functions shared by the mock (phase 1) and Prisma (phase 2) repositories
// so the two implementations can never drift.

import { SHIPPING } from "../shop-config";
import type {
  Availability,
  Order,
  Product,
  ProductPublic,
} from "./types";

/** Rule 1 — availability is derived, never stored. */
export function availabilityOf(stock: number): Availability {
  if (stock <= 0) return "indisponible";
  if (stock <= 5) return "stock_limite";
  return "disponible";
}

export function withAvailability<P extends Product>(
  p: P,
): P & { availability: Availability } {
  return { ...p, availability: availabilityOf(p.stock) };
}

/** Algerian mobile phone: 05/06/07 + 8 digits (spaces tolerated by callers). */
export const PHONE_REGEX = /^0[567]\d{8}$/;

/**
 * Rule 3 — shipping. Free (0) when subtotal is STRICTLY above the threshold
 * (threshold 0 disables free shipping). Otherwise the selected commune's fee,
 * falling back to the wilaya's default fee, then to the base fee.
 *
 * The fee and threshold are static (`src/lib/shop-config.ts`); `settings` lets
 * a caller — or a test — override them.
 */
export function computeShipping(args: {
  subtotal: number;
  settings?: { shipFee: number; freeThreshold: number };
  /** Default delivery fee of the selected wilaya (null when unknown). */
  wilayaFee: number | null;
  /** Fee override of the selected commune; null → inherit the wilaya fee. */
  communeFee?: number | null;
}): number {
  const { subtotal, wilayaFee, communeFee } = args;
  const shipFee = args.settings?.shipFee ?? SHIPPING.fee;
  const freeThreshold = args.settings?.freeThreshold ?? SHIPPING.freeThreshold;
  if (freeThreshold > 0 && subtotal > freeThreshold) return 0;
  return communeFee ?? wilayaFee ?? shipFee;
}

/** Order number: CMD-<year>-<4 digits>. */
export function makeOrderNumber(
  year: number,
  exists: (id: string) => boolean,
  random: () => number = Math.random,
): string {
  for (let i = 0; i < 50; i++) {
    const id = `CMD-${year}-${1000 + Math.floor(random() * 9000)}`;
    if (!exists(id)) return id;
  }
  // Practically unreachable; sequential fallback keeps the format valid.
  let n = 1000;
  while (exists(`CMD-${year}-${n}`)) n++;
  return `CMD-${year}-${n}`;
}

/**
 * Sort values accepted by the catalogue. "defaut" is the "Sélection par
 * défaut" option of the storefront dropdown: catalogue order, oldest first.
 */
export const CATALOGUE_SORTS = [
  "defaut",
  "nouveautes",
  "prix_asc",
  "prix_desc",
  "nom",
] as const;
export type CatalogueSort = (typeof CATALOGUE_SORTS)[number];

/**
 * Catalogue sorting — null price ("sur commande") sorts last, matching SQL
 * `nulls: "last"`. `locale` drives both which name is compared (the Arabic one
 * when it exists) and the collation used, so "Nom A-Z" is alphabetical in the
 * language the customer is actually reading.
 */
export function sortProducts<P extends Product>(
  items: P[],
  sort: CatalogueSort,
  locale: "fr" | "ar" = "fr",
): P[] {
  const nameOf = (p: P): string =>
    (locale === "ar" && p.nameAr?.trim() ? p.nameAr : p.name) ?? "";
  const sorters: Record<CatalogueSort, (a: P, b: P) => number> = {
    defaut: (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.id - a.id,
    prix_asc: (a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return a.price - b.price;
    },
    prix_desc: (a, b) => {
      if (a.price === null && b.price === null) return 0;
      if (a.price === null) return 1;
      if (b.price === null) return -1;
      return b.price - a.price;
    },
    nom: (a, b) => nameOf(a).localeCompare(nameOf(b), locale),
    nouveautes: (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
      b.id - a.id,
  };
  return [...items].sort(sorters[sort] ?? sorters.defaut);
}

export function paginate<T>(
  rows: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; page: number; pageCount: number } {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const start = (cur - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total, page: cur, pageCount };
}

/** Public product mapper used everywhere a product leaves the data layer. */
export function toPublic(p: Product): ProductPublic {
  return withAvailability(p);
}

export function orderTotals(o: Order): { itemCount: number } {
  return { itemCount: o.lines.reduce((n, l) => n + l.qty, 0) };
}

export const PAGE_SIZE_ADMIN = 8;
export const PAGE_SIZE_CATALOGUE = 16;
