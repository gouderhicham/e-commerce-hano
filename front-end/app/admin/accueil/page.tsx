import { getRepos } from "@/lib/data/repos";
import { AccueilClient } from "./accueil-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Sélection « Nos favoris » — Administration" };

export default async function AdminAccueilPage() {
  const repos = getRepos();
  const [favorites, products] = await Promise.all([
    repos.content.homeFavorites(),
    repos.products.listAll(),
  ]);

  return (
    <AccueilClient
      initialFavorites={favorites}
      products={products}
    />
  );
}
