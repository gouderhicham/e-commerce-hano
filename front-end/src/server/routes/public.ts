import { Hono } from "hono";
import { z } from "zod";
import type { AppBindings } from "../env";
import { body, params } from "../http/validate";
import { afterResponse, notifyAdmin } from "../infra/notify";
import { byIp } from "../http/rate-limit";
import { createOrder, createOrderSchema, orderById } from "../services/orders";

/** The four canonical contact subjects (must match the front-end verbatim). */
export const CONTACT_SUBJECTS = [
  "Question produit",
  "Commande & livraison",
  "Garantie & SAV",
  "Autre",
] as const;

const createContactSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis."),
  email: z.email("Email invalide."),
  phone: z.string().optional(),
  subject: z.enum(CONTACT_SUBJECTS, { error: "Sujet invalide." }),
  message: z
    .string()
    .min(10, "Le message doit contenir au moins 10 caractères."),
});

const orderIdParam = z.object({ id: z.string().min(1) });

/** Mirror a contact message to Telegram, if the shop configured a bot. */
async function relayTelegram(
  prisma: AppBindings["Variables"]["prisma"],
  m: {
    name: string;
    email: string;
    phone: string | null;
    subject: string;
    message: string;
  },
): Promise<void> {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  if (!settings?.telegramBotToken || !settings?.telegramChatId) return;

  const text =
    `📬 *NOUVEAU MESSAGE - PC STORE .39*\n\n` +
    `👤 *Nom & Prénom:* ${m.name}\n` +
    `📧 *Email:* ${m.email}\n` +
    `📞 *Téléphone:* ${m.phone || "Non renseigné"}\n` +
    `🏷️ *Sujet:* ${m.subject}\n\n` +
    `💬 *Message:*\n${m.message}`;

  await fetch(
    `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: settings.telegramChatId,
        text,
        parse_mode: "Markdown",
      }),
    },
  );
}

/** Checkout and contact — anonymous-capable, so they are throttled by IP. */
export const publicRoutes = new Hono<AppBindings>()
  /** Guest or member checkout. */
  .post("/orders", byIp, async (c) => {
    const dto = await body(c, createOrderSchema);
    const { order, adminEvents } = await createOrder(
      c.var.prisma,
      dto,
      c.var.user?.id ?? null,
    );
    // Only after the transaction commits.
    for (const event of adminEvents) notifyAdmin(c, event);
    return c.json({ order }, 201);
  })

  /** Owner or admin only; 404 if missing, 403 otherwise. */
  .get("/orders/:id", async (c) => {
    const { id } = params(c, orderIdParam);
    return c.json({ order: await orderById(c.var.prisma, id, c.var.user) });
  })

  /** Persist an unread contact message (answered via mailto in admin). */
  .post("/contact", byIp, async (c) => {
    const dto = await body(c, createContactSchema);
    const notifMessage = `Nouveau message — ${dto.name} : ${dto.subject}`;

    // Interactive transaction: the bell row carries the message id so the back
    // office can open that exact message.
    const message = await c.var.prisma.$transaction(async (tx) => {
      const created = await tx.contactMessage.create({
        data: {
          name: dto.name,
          email: dto.email,
          phone: dto.phone ?? null,
          subject: dto.subject,
          message: dto.message,
          read: false,
        },
      });
      await tx.notification.create({
        data: {
          type: "MESSAGE",
          contactMessageId: created.id,
          message: notifMessage,
          read: false,
        },
      });
      return created;
    });

    notifyAdmin(c, {
      type: "message",
      message: notifMessage,
      contactMessageId: message.id,
    });
    // Best-effort relay: a failure must not fail the contact creation.
    afterResponse(c, relayTelegram(c.var.prisma, message));

    return c.json({ message }, 201);
  });
