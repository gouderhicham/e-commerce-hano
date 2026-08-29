import { VedetteClient } from "./vedette-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produit vedette — Administration" };

export default function AdminVedettePage() {
  return <VedetteClient />;
}
