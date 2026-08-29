import type { Metadata } from "next";
import { getRepos } from "@/lib/data/repos";
import { CheckoutClient } from "./checkout-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Commande — pc store 39",
};

export default async function CommandePage() {
  const wilayas = await getRepos().misc.wilayas();
  return <CheckoutClient wilayas={wilayas} />;
}
