import { getRepos } from "@/lib/data/repos";
import {
  CategoriesSection,
  FavoritesSection,
  HeroSection,
  HeroShowcase,
  PromiseSection,
} from "@/components/storefront/home-sections";

// Revalidate with ISR every 60 seconds on the Edge CDN for instant 15-30ms loads.
export const revalidate = 60;

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
  const { showcase, categoryCards, favorites } =
    await getRepos().content.home();

  return (
    <>
      <HeroSection />
      <HeroShowcase showcase={showcase} />
      <CategoriesSection cards={categoryCards} />
      <FavoritesSection favorites={favorites} />
      <PromiseSection />
    </>
  );
}
