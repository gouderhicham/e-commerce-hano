import { SHOP } from "../domain/shop-config";
import type { CloudflareEnv } from "../env";
import type { AdminEvent } from "./notify";

/** French subject line per notification type. */
const SUBJECTS: Record<Exclude<AdminEvent["type"], "ping">, string> = {
  order: "Nouvelle commande — pc store .39",
  message: "Nouveau message — pc store .39",
  stock: "Alerte de stock — pc store .39",
};

/**
 * Transactional email over Resend's HTTP API.
 *
 * Workers have no TCP sockets, so SMTP is impossible here - transactional mail
 * has to go over HTTP. Every send is best-effort and swallows its own errors,
 * so a flaky mail provider can never break a checkout or a contact request.
 *
 * With no `RESEND_API_KEY` configured the mailer logs and no-ops, which is the
 * old "disabled" mode — the app stays fully functional without email.
 */
export async function sendNotificationEmail(
  env: CloudflareEnv,
  event: AdminEvent,
): Promise<void> {
  if (event.type === "ping") return;

  const subject = SUBJECTS[event.type];
  const to = env.MAIL_TO || SHOP.email || null;

  if (!env.RESEND_API_KEY || !to) {
    console.log(`[email:off] → ${to ?? "?"} · ${subject} · ${event.message}`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.MAIL_FROM,
        to: [to],
        subject,
        text: event.message,
      }),
    });

    if (!response.ok) {
      console.error(
        `Resend rejected "${subject}" (${response.status}): ${await response.text()}`,
      );
    }
  } catch (err) {
    console.error(
      `Failed to send notification email: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
