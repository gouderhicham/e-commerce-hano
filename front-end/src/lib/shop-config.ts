/**
 * Static shop configuration.
 *
 * These values used to be edited from Admin → Paramètres and served by
 * `GET /api/settings/public`. They are hard-coded now: Paramètres only keeps
 * the Telegram relay, which the contact form still reads at runtime.
 *
 * The numbers mirror `src/server/domain/shop-config.ts` — the API is
 * still the authority (it recomputes every amount at checkout), so keep both
 * files in sync when a price changes.
 *
 * Customer-facing wording does NOT belong here: it lives in
 * `src/lib/i18n/dictionaries/` so it exists in both French and Arabic.
 */

/** Shop identity — footer, contact page, Telegram message header. */
export const SHOP = {
  name: "pc store .39",
  email: "contact@pcstore39.dz",
  phone: "+213 (0)5 50 00 00 00",
  address: "Alger, Algérie",
} as const;

/**
 * Number of delivery zones served: Algeria's 58 wilayas plus the 11 delegated
 * circumscriptions that carry their own tariff (`Wilaya.code` runs 1 → 69).
 * Referenced by the seed and the admin copy; storefront wording lives in the
 * dictionaries.
 */
export const WILAYA_COUNT = 69;

/**
 * Delivery. The real prices are per wilaya and per commune, stored in the
 * database and edited in Admin → Livraison; only the free-shipping threshold
 * and a last-resort fallback live here.
 */
export const SHIPPING = {
  /**
   * Last-resort fee, used only if a commune AND its wilaya carry no price.
   * Unreachable in practice — `Wilaya.fee` is never null.
   */
  fee: 500,
  /** Free delivery STRICTLY above this subtotal; 0 disables it. */
  freeThreshold: 0,
} as const;

/** Warranty advertised in the back office summary. */
export const WARRANTY = "1 mois de garantie";

/**
 * Default note under the order button, prefilled on each new product fiche.
 * The French and Arabic defaults must state the SAME facts — they are two
 * renderings of one sentence, not two different promises.
 */
export const DELIVERY_NOTE =
  "Livraison en 1 à 3 jours dans les 69 wilayas · Paiement à la livraison";

export const DELIVERY_NOTE_AR =
  "توصيل خلال 1 إلى 3 أيام إلى 69 ولاية · الدفع نقداً عند الاستلام";
