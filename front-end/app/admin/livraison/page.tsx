import { getRepos } from "@/lib/data/repos";
import { LivraisonClient } from "./livraison-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Livraison — Administration" };

export default async function AdminLivraisonPage() {
  // ~94 KB for the 69 wilayas and their 1 559 communes: one round trip buys
  // instant wilaya switching and search across every commune.
  const wilayas = await getRepos().wilayaFees.adminList();
  return <LivraisonClient initialWilayas={wilayas} />;
}
