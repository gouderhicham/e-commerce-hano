import { cookies } from "next/headers";
import { createApp } from "@/server/app";
import { getRuntime } from "@/server/runtime";
import type { ExecutionContext } from "hono";

/**
 * Server-side fetch of an admin list page for the first render. The browser
 * fetches later pages itself against /api on the same origin; this dispatches
 * into the same router in-process, forwarding the session cookie so the admin
 * guard is satisfied exactly as it would be for a browser request.
 */

let cachedApp: ReturnType<typeof createApp> | null = null;

function api() {
  if (!cachedApp) cachedApp = createApp();
  return cachedApp;
}

/** Fetch one admin list page, forwarding the request cookie. */
export async function fetchAdminList<E>(path: string): Promise<E> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const { env, ctx } = getRuntime();
  // The host is irrelevant — nothing dials it — but `Request` needs an absolute
  // URL, and the router matches on the path.
  const res = await api().fetch(
    new Request(`https://internal${path}`, { headers: { cookie } }),
    env,
    ctx as ExecutionContext | undefined,
  );

  if (!res.ok) throw new Error(`Admin list ${path} → ${res.status}`);
  return (await res.json()) as E;
}
