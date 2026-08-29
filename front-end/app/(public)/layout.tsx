import { getSessionUser } from "@/lib/auth/session";
import { getRepos } from "@/lib/data/repos";
import { CartProvider } from "@/components/storefront/cart-context";
import { FavoritesProvider } from "@/components/storefront/favorites-context";
import { I18nProvider } from "@/lib/i18n/context";
import { resolveLocale } from "@/lib/i18n/server";
import { SiteFooter } from "@/components/storefront/footer";
import { SiteHeader } from "@/components/storefront/navbar";

/**
 * Storefront shell. Browsing, favourites, cart and checkout are all guest —
 * the header never asks for an account. A signed-in admin browsing the shop
 * still gets their server-side cart/favourites seeded, so the two stay in sync.
 */
export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser().catch(() => null);
  const initialLocale = await resolveLocale().catch(() => "fr" as const);

  return (
    <I18nProvider initialLocale={initialLocale}>
      <FavoritesProvider initialIds={[]} loggedIn={!!user}>
        <CartProvider loggedIn={!!user} initialLines={[]}>
          <div className="flex min-h-screen flex-col bg-[#f8f7f2] text-[#17251f]">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </CartProvider>
      </FavoritesProvider>
    </I18nProvider>
  );
}
