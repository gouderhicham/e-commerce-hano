import type { Metadata } from "next";
import { PanierClient } from "./panier-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mon panier — pc store 39",
};

export default function PanierPage() {
  return <PanierClient />;
}
