"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import type { ProductPublic } from "@/lib/data/types";

const EMPTY_PRODUCTS: ReadonlyMap<number, ProductPublic> = new Map();
const EMPTY_MISSING: readonly number[] = [];

interface Resolved {
  /** The id list this result was fetched for — "" before the first fetch. */
  key: string;
  products: ReadonlyMap<number, ProductPublic>;
  missing: readonly number[];
}

const INITIAL: Resolved = {
  key: "",
  products: EMPTY_PRODUCTS,
  missing: EMPTY_MISSING,
};

/**
 * Resolve a set of product ids to their current catalogue data.
 *
 * The cart and the favourites list persist ids only (prices are always
 * recomputed server-side), so both pages hydrate them here. Ids that 404 —
 * a product deleted or deactivated since it was saved — come back in `missing`
 * so the caller can drop the corresponding line.
 *
 * State holds the id list its data belongs to, which lets `loading` and the
 * empty case be derived during render instead of written from the effect.
 */
export function useProductsById(ids: number[]): {
  products: ReadonlyMap<number, ProductPublic>;
  /** Ids that no longer resolve to a visible product. */
  missing: readonly number[];
  loading: boolean;
} {
  // Ids are a fresh array each render; key the effect on their stable identity.
  const key = ids.join(",");
  const [resolved, setResolved] = useState<Resolved>(INITIAL);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const wanted = key.split(",").map(Number);

    void Promise.all(
      wanted.map((id) =>
        apiFetch(`/api/products/${id}`)
          .then((res) =>
            res.ok ? (res.json() as Promise<ProductPublic>) : null,
          )
          .catch(() => null),
      ),
    ).then((rows) => {
      if (cancelled) return;
      const products = new Map<number, ProductPublic>();
      const missing: number[] = [];
      rows.forEach((row, index) => {
        if (row) products.set(row.id, row);
        else missing.push(wanted[index]);
      });
      setResolved({ key, products, missing });
    });

    return () => {
      cancelled = true;
    };
  }, [key]);

  if (!key) {
    return { products: EMPTY_PRODUCTS, missing: EMPTY_MISSING, loading: false };
  }
  const fresh = resolved.key === key;
  return {
    products: fresh ? resolved.products : EMPTY_PRODUCTS,
    missing: fresh ? resolved.missing : EMPTY_MISSING,
    loading: !fresh,
  };
}
