import { getRepos } from "@/lib/data/repos";
import {
  CategoriesSection,
  FavoritesSection,
  HeroSection,
  HeroShowcase,
  PromiseSection,
} from "@/components/storefront/home-sections";

export const dynamic = "force-dynamic";

/**
 * Landing page.
 *
 * The hero, the promise block and the "Nos favoris" tiles come from
 * Admin → Page d'accueil; the full-width showcase from Admin → Produit vedette;
 * the category tiles from Admin → Catégories. Any block the back office has
 * left blank falls back to the i18n dictionaries (`t.home.*`), so a fresh
 * install renders the same copy in French and in Arabic.
 */
export default async function HomePage() {
  const content = await getRepos().content.home().catch(() => ({
    showcase: null,
    categoryCards: [],
    favorites: { items: [] },
  }));

  const showcase = content?.showcase ?? null;
  const categoryCards = content?.categoryCards ?? [];
  const favorites = content?.favorites ?? { items: [] };

  return (
    <>
      <HeroSection />
      {showcase && <HeroShowcase showcase={showcase} />}
      <CategoriesSection cards={categoryCards} />
      <FavoritesSection favorites={favorites} />
      <PromiseSection />
    </>
  );
}
