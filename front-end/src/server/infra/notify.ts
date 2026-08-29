import type { Context } from "hono";
import type { AppBindings } from "../env";
import { sendNotificationEmail } from "./mail";

/**
 * An admin notification: what the bell shows, and what gets mirrored to email.
 * The `Notification` row is the record; this type describes the side effects
 * that follow once its transaction has committed.
 */
export interface AdminEvent {
  type: "order" | "message" | "stock" | "ping";
  message: string;
  orderId?: string | null;
  productId?: number | null;
  contactMessageId?: string | null;
}

/**
 * Fan out an admin notification after its DB row is committed.
 *
 * There is no in-process pub/sub and no push stream here: isolates are
 * per-request and short-lived, so nothing can subscribe across them, and a
 * long-lived connection would bill duration for an idle socket. The persisted
 * notification row is therefore the single source of truth - the back office
 * polls it - and this function only handles the out-of-band mirrors (email,
 * Telegram).
 *
 * `waitUntil` lets those run *after* the response is flushed, so the shopper
 * never waits on an email provider to finish a checkout.
 */
export function notifyAdmin(
  c: Context<AppBindings>,
  event: AdminEvent,
): void {
  afterResponse(c, sendNotificationEmail(c.env, event));
}

/** Run any best-effort side effect past the response, without blocking it. */
export function afterResponse(
  c: Context<AppBindings>,
  work: Promise<unknown>,
): void {
  const guarded = work.catch(() => undefined);
  // `executionCtx` throws rather than returning undefined when the adapter has
  // none (plain `next dev`), so the fallback has to be a catch, not a check.
  try {
    c.executionCtx.waitUntil(guarded);
  } catch {
    void guarded;
  }
}
