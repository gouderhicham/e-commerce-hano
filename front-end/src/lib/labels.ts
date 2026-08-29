// Back-office labels + pill colour maps, in the pc store .39 palette.
//
// The admin is French-only by design, so these strings are NOT translated.
// Anything the STOREFRONT renders must come from `src/lib/i18n/dictionaries/`
// instead — never import a label from here into a `(public)` route.

import type {
  Availability,
  OrderStatus,
  PaymentMethod,
} from "@/lib/data/types";

export interface PillColors {
  color: string;
  bg: string;
  border: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NOUVELLE: "Nouvelle",
  PRETE_A_LIVRER: "Prête à livrer",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

/** Short forms for the status filter row. */
export const ORDER_STATUS_SHORT: Record<OrderStatus, string> = {
  NOUVELLE: "Nouvelle",
  PRETE_A_LIVRER: "Prête à livrer",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export const ORDER_STATUSES: OrderStatus[] = [
  "NOUVELLE",
  "PRETE_A_LIVRER",
  "EN_LIVRAISON",
  "LIVREE",
  "ANNULEE",
];

export const ORDER_STATUS_PILLS: Record<OrderStatus, PillColors> = {
  NOUVELLE: { color: "#4e5d56", bg: "#eef1ec", border: "#c9d2cb" },
  PRETE_A_LIVRER: { color: "#8a6a25", bg: "#f8f0dd", border: "#e3c88a" },
  EN_LIVRAISON: { color: "#1f6b70", bg: "#e2eeef", border: "#96c2c6" },
  LIVREE: { color: "#2a624b", bg: "#dcebdd", border: "#8fbf9d" },
  ANNULEE: { color: "#8b3a3a", bg: "#f6e5e5", border: "#dba7a7" },
};

/** Back-office wording for stock. The storefront uses `t.product.*`. */
export const AVAILABILITY_LABELS: Record<Availability, string> = {
  disponible: "En stock",
  stock_limite: "Stock limité",
  indisponible: "Rupture",
};

export const AVAILABILITY_PILLS: Record<Availability, PillColors> = {
  disponible: { color: "#315d49", bg: "#dce8dd", border: "#9dbfab" },
  stock_limite: { color: "#8a6a25", bg: "#f6ecd8", border: "#e3c88a" },
  indisponible: { color: "#8b3a3a", bg: "#f0dcdc", border: "#dba7a7" },
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: "Espèces à la livraison",
};

/**
 * Canonical contact subjects. These are VALUES, not labels: they are what the
 * browser posts and what the database stores, and they must stay byte-identical
 * to `CONTACT_SUBJECTS` in `src/server/routes/public.ts`.
 * The customer-facing translation of each one lives in `t.contact.subjects`.
 */
export const CONTACT_SUBJECTS = [
  "Question produit",
  "Commande & livraison",
  "Garantie & SAV",
  "Autre",
] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

/**
 * Client-facing order timeline. The shop is cash on delivery only, so payment
 * happens on delivery and the flow always reads the same way.
 */
const ORDER_STEPS_COD = [
  "Nouvelle",
  "Prête à livrer",
  "En livraison",
  "Livrée",
] as const;

const ORDER_STEP_INDEX_COD: Partial<Record<OrderStatus, number>> = {
  NOUVELLE: 0,
  PRETE_A_LIVRER: 1,
  EN_LIVRAISON: 2,
  LIVREE: 3,
};

/** Timeline step labels for an order. */
export function orderSteps(): readonly string[] {
  return ORDER_STEPS_COD;
}

/** Index of the current step within {@link orderSteps} for a given status. */
export function orderStepIndex(status: OrderStatus): number | undefined {
  return ORDER_STEP_INDEX_COD[status];
}
