import { z } from "zod";

/** Page sizes fixed by the front-end contract (API.md §Conventions). */
export const PAGE_SIZE_ADMIN = 8;
export const PAGE_SIZE_CATALOGUE = 16;

/** Paginated envelope returned by every list endpoint. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

/**
 * Shared `?page=` query schema (1-based, defaults to 1).
 *
 * Zod needs no decorator metadata (which Workers cannot provide), and it is
 * the same validator the front-end forms already use, so a rule is written
 * once instead of once per dialect.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

/** Clamp an incoming page to a sane 1-based integer. */
export function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) return 1;
  return Math.floor(page);
}

/** Prisma `skip`/`take` for a given page + size. */
export function paginationArgs(
  page: number,
  pageSize: number,
): { skip: number; take: number } {
  const p = normalizePage(page);
  return { skip: (p - 1) * pageSize, take: pageSize };
}

/** Wrap a fetched page of items + total count into the response envelope. */
export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  const p = normalizePage(page);
  return {
    items,
    total,
    page: p,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}
