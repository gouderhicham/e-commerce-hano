"use client";

// Favorites external store, two persistence modes (mirrors the cart):
//   - guest: localStorage ("pcstore39_favorites") — the storefront's normal mode;
//   - logged in: server-side favorites (/api/account/favorites/[id]) mirrored
//     in memory, every toggle synced (fire-and-forget); localStorage untouched.
// <FavoritesProvider> (public layout) picks the mode and seeds the account's
// favorites; login/logout wipe localStorage via favoritesReset().
// useSyncExternalStore keeps SSR (no favorites) and the hydrated client copy
// consistent without setState-in-effect cascades.

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n/context";

interface FavoritesSnapshot {
  ids: number[];
  loggedIn: boolean;
}

const STORAGE_KEY = "pcstore39_favorites";
const EMPTY: number[] = [];
const SERVER_SNAPSHOT: FavoritesSnapshot = { ids: EMPTY, loggedIn: false };

function readStored(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter((x): x is number => typeof x === "number");
  } catch {
    return EMPTY;
  }
}

let mode: "local" | "server" = "local";
let ids: number[] = typeof window === "undefined" ? EMPTY : readStored();
let snapshot: FavoritesSnapshot = { ids, loggedIn: false };

const listeners = new Set<() => void>();

function wipeStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — nothing to wipe.
  }
}

function commit(next: number[]): void {
  ids = next;
  snapshot = { ids, loggedIn: mode === "server" };
  if (mode === "local") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Storage full/unavailable — the in-memory list still works.
    }
  }
  listeners.forEach((l) => l());
}

// Server sync — fire-and-forget: the in-memory list is the immediate truth,
// the next full load re-reads /api/account/favorites.
function syncToggle(id: number, added: boolean): void {
  if (mode !== "server") return;
  void apiFetch(`/api/account/favorites/${id}`, {
    method: added ? "PUT" : "DELETE",
  }).catch(() => {});
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => SERVER_SNAPSHOT;

/** Toggle a favorite. Returns true when it was ADDED, false when removed. */
export function favoritesToggle(id: number): boolean {
  const added = !ids.includes(id);
  commit(added ? [...ids, id] : ids.filter((x) => x !== id));
  syncToggle(id, added);
  return added;
}

/**
 * Auth transition (login/register/logout): wipe the localStorage favorites and
 * the in-memory copy so nothing leaks between the guest and the account
 * session. The account's server favorites are untouched — <FavoritesProvider>
 * reseeds them.
 */
export function favoritesReset(): void {
  wipeStorage();
  mode = "local";
  commit([]);
}

/**
 * Mounted by the public layout. Logged in → server mode seeded with the
 * account's favorites (localStorage wiped); guest → localStorage mode.
 */
export function FavoritesProvider({
  loggedIn,
  initialIds,
  children,
}: {
  loggedIn: boolean;
  initialIds: number[];
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (loggedIn) {
      mode = "server";
      wipeStorage();
      commit(initialIds);
    } else {
      if (mode === "server") {
        // Logged out mid-session: the guest starts with an empty list.
        mode = "local";
        favoritesReset();
      }
      mode = "local";
    }
    // initialIds identity only changes when the server layout re-renders
    // (login/logout/refresh) — exactly when reseeding is wanted.
  }, [loggedIn, initialIds]);

  return children;
}

export interface FavoritesApi extends FavoritesSnapshot {
  has: (id: number) => boolean;
  /** Always applies now — favorites work with or without login. Returns true. */
  toggle: (id: number) => boolean;
}

export function useFavorites(): FavoritesApi {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { pushToast } = useToast();
  const { t } = useI18n();
  const toggle = useCallback(
    (id: number): boolean => {
      const added = favoritesToggle(id);
      pushToast(
        added ? t.favorites.added : t.favorites.removed,
        added ? "success" : "info",
      );
      return true;
    },
    [pushToast, t],
  );
  const has = useCallback((id: number) => snap.ids.includes(id), [snap.ids]);
  return { ids: snap.ids, loggedIn: snap.loggedIn, has, toggle };
}
