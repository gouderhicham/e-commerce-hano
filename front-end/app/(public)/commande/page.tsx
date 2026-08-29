import type { Metadata } from "next";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commande — pc store 39",
};

export default function CommandePage() {
  return <CheckoutClient />;
}
