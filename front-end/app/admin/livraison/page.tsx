import { LivraisonClient } from "./livraison-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Livraison — Administration" };

export default function AdminLivraisonPage() {
  return <LivraisonClient />;
}
