import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "pc store 39 — Ordinateurs portables reconditionnés à El Oued",
  description:
    "Boutique spécialisée dans la vente d'ordinateurs portables reconditionnés, testés et garantis avec livraison 58 wilayas.",
};

export default function HomePage() {
  return <HomeClient />;
}
