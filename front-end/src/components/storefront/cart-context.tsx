"use client";

// Cart external store, two persistence modes:
//   - guest: localStorage ("pcstore39_cart") — the storefront's normal mode;
//   - logged in: server-side cart (/api/account/cart) — the store mirrors it
//     in memory and syncs every mutation (fire-and-forget), localStorage is
//     never touched. <CartProvider> (public layout) picks the mode and seeds
//     the server lines; login/logout wipe localStorage via cartReset().
// Lines hold product ids + quantities only; prices are always recomputed
// server-side at checkout.
// useSyncExternalStore keeps SSR (empty cart) and the hydrated client copy
// consistent without setState-in-effect cascades.

import { useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api-client";
import type { CartLine } from "@/lib/data/types";

export type { CartLine };

interface CartSnapshot {
  lines: CartLine[];
  count: number;
  /** Increments on every add — drives the nav bubble pop animation. */
  bump: number;
}

const STORAGE_KEY = "pcstore39_cart";
const EMPTY: CartLine[] = [];
const SERVER_SNAPSHOT: CartSnapshot = { lines: EMPTY, count: 0, bump: 0 };

function readStored(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as CartLine).id === "number" &&
        typeof (l as CartLine).qty === "number" &&
        (l as CartLine).qty > 0,
    );
  } catch {
    return EMPTY;
  }
}

let mode: "local" | "server" = "local";
let lines: CartLine[] =
  typeof window === "undefined" ? EMPTY : readStored();
let bump = 0;
let snapshot: CartSnapshot = {
  lines,
  count: lines.reduce((n, l) => n + l.qty, 0),
  bump,
};

const listeners = new Set<() => void>();

function wipeStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to wipe.
  }
}

function commit(next: CartLine[], bumped: boolean): void {
  lines = next;
  if (bumped) bump++;
  snapshot = { lines, count: lines.reduce((n, l) => n + l.qty, 0), bump };
  if (mode === "local") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage full/unavailable — the in-memory cart still works.
    }
  }
  listeners.forEach((l) => l());
}

// Server sync — fire-and-forget: the in-memory cart is the immediate truth,
// the next full load re-reads /api/account/cart.
function syncSet(id: number, qty: number): void {
  if (mode !== "server") return;
  void apiFetch(`/api/account/cart/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ qty }),
  }).catch(() => {});
}

function syncRemove(id: number): void {
  if (mode !== "server") return;
  void apiFetch(`/api/account/cart/${id}`, { method: "DELETE" }).catch(
    () => {},
  );
}

function syncClear(): void {
  if (mode !== "server") return;
  void apiFetch("/api/account/cart", { method: "DELETE" }).catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

export function cartAdd(id: number, qty = 1): void {
  const existing = lines.find((l) => l.id === id);
  const nextQty = (existing?.qty ?? 0) + qty;
  commit(
    existing
      ? lines.map((l) => (l.id === id ? { ...l, qty: nextQty } : l))
      : [...lines, { id, qty }],
    true,
  );
  syncSet(id, nextQty);
}

export function cartSetQty(id: number, qty: number): void {
  const clamped = Math.max(1, qty);
  commit(
    lines.map((l) => (l.id === id ? { ...l, qty: clamped } : l)),
    false,
  );
  syncSet(id, clamped);
}

export function cartRemove(id: number): void {
  commit(
    lines.filter((l) => l.id !== id),
    false,
  );
  syncRemove(id);
}

export function cartClear(): void {
  commit([], false);
  syncClear();
}

/**
 * Auth transition (login/register/logout): wipe the localStorage cart and the
 * in-memory copy so nothing leaks between the guest and the account session.
 * The server cart of the account is untouched — <CartProvider> reseeds it.
 */
export function cartReset(): void {
  wipeStorage();
  mode = "local";
  commit([], false);
}

/**
 * Mounted by the public layout. Logged in → server mode seeded with the
 * account's cart (localStorage wiped); guest → localStorage mode.
 */
export function CartProvider({
  loggedIn,
  initialLines,
  children,
}: {
  loggedIn: boolean;
  initialLines: CartLine[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (loggedIn) {
      mode = "server";
      wipeStorage();
      commit(initialLines, false);
    } else {
      if (mode === "server") {
        // Logged out mid-session: the guest starts with an empty cart.
        mode = "local";
        cartReset();
      }
      mode = "local";
    }
    // initialLines identity only changes when the server layout re-renders
    // (login/logout/refresh) — exactly when reseeding is wanted.
  }, [loggedIn, initialLines]);

  return children;
}

export interface CartApi extends CartSnapshot {
  add: (id: number, qty?: number) => void;
  setQty: (id: number, qty: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

export function useCart(): CartApi {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...snap,
    add: cartAdd,
    setQty: cartSetQty,
    remove: cartRemove,
    clear: cartClear,
  };
}
