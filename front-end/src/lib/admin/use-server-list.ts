"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

/** Every admin list endpoint returns this envelope (plus optional extras). */
export interface ListEnvelope<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

type Params = Record<string, string | number | undefined | null>;

/**
 * Server-driven list state (id-beauty's UsersPage pattern): page + filters live
 * here, and every change fetches ONE page from the backend via the same-origin
 * proxy. Seeded with the server-rendered page 1 so the first paint needs no
 * client fetch; changing a filter should be paired with `setPage(1)` by the
 * caller so a narrowed list isn't stranded on a now-empty page.
 */
export function useServerList<E extends ListEnvelope<unknown>>(
  path: string,
  initial: E,
  params: Params,
): {
  data: E;
  loading: boolean;
  error: unknown;
  page: number;
  setPage: (page: number) => void;
  reload: () => Promise<void>;
} {
  // Seed from the envelope, not from 1: a deep link (e.g. a bell notification
  // pointing at a message on page 3) is served pre-paginated by the server.
  const [page, setPage] = useState(initial.page || 1);
  const [data, setData] = useState<E>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const paramsKey = JSON.stringify(params);
  // The server already provided page 1 with default params — skip the first run.
  const skipFirst = useRef(true);

  const load = useCallback(async () => {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${path}?${qs.toString()}`);
      if (!res.ok) throw new Error(`Erreur de chargement (${res.status}).`);
      setData((await res.json()) as E);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // params is captured via paramsKey to keep the identity stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, page, paramsKey]);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    void load();
  }, [load]);

  return { data, loading, error, page, setPage, reload: load };
}
