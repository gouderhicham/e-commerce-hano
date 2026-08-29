/**
 * Static shop configuration.
 *
 * These values used to live in the `Settings` singleton and were editable from
 * Admin → Paramètres. They are now hard-coded: the back office only keeps the
 * Telegram relay editable. The storefront mirrors the copy in
 * `front-end/src/lib/shop-config.ts` — keep the two files in sync.
 */

/** Shop identity (footer, contact page, outgoing mail). */
export const SHOP = {
  name: "pc store .39",
  email: "contact@pcstore39.dz",
  phone: "+213 (0)5 50 00 00 00",
  address: "Alger, Algérie",
} as const;

/**
 * Last-resort delivery fee in DA. Real prices are per wilaya and per commune
 * (`Wilaya.fee` / `Commune.fee`, edited in Admin → Livraison); this only
 * applies if both are missing, and doubles as the seed's starting fee.
 */
export const SHIP_FEE = 500;

/**
 * Free delivery when the subtotal is STRICTLY above this amount, in DA.
 * 0 disables free delivery entirely.
 */
export const FREE_SHIPPING_THRESHOLD = 0;

/**
 * Default note under the order button, copied onto each new product fiche.
 * Mirrors `DELIVERY_NOTE` / `DELIVERY_NOTE_AR` in the front-end's shop-config —
 * the two languages must state the SAME facts.
 */
export const DEFAULT_DELIVERY_NOTE =
  "Livraison en 1 à 3 jours dans les 69 wilayas · Paiement à la livraison";

export const DEFAULT_DELIVERY_NOTE_AR =
  "توصيل خلال 1 إلى 3 أيام إلى 69 ولاية · الدفع نقداً عند الاستلام";

/**
 * Number of delivery zones served: Algeria's 58 wilayas plus the 11 delegated
 * circumscriptions that carry their own tariff (`Wilaya.code` runs 1 -> 69).
 */
export const WILAYA_COUNT = 69;
