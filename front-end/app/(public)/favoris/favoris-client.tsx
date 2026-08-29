"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { useProductsById } from "@/lib/use-products-by-id";
import { useCart } from "@/components/storefront/cart-context";
import { useFavorites } from "@/components/storefront/favorites-context";
import { useToast } from "@/components/ui/toast";
import { Arrow, Cart, HeartIcon } from "@/components/storefront/icons";
import { useI18n } from "@/lib/i18n/context";
import { interpolate, pick } from "@/lib/i18n/localize";
import type { ProductPublic } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

export function FavorisClient() {
  const router = useRouter();
  const { ids, has, toggle } = useFavorites();
  const { add } = useCart();
  const { pushToast } = useToast();
  const { products, loading } = useProductsById(ids);
  const { locale, t } = useI18n();
  const [animatingId, setAnimatingId] = useState<number | null>(null);

  const items = useMemo(
    () =>
      ids
        .map((id) => products.get(id))
        .filter((p): p is ProductPublic => Boolean(p)),
    [ids, products],
  );

  const onToggle = (id: number) => {
    toggle(id);
    setAnimatingId(id);
    window.setTimeout(() => setAnimatingId(null), 450);
  };

  const onAdd = (product: ProductPublic) => {
    if (product.availability === "indisponible") {
      pushToast(t.product.outOfStockNotice, "error");
      return;
    }
    if (product.price === null) {
      pushToast(t.product.onRequestNotice, "info");
      return;
    }
    add(product.id, 1);
    pushToast(
      `« ${pick(locale, product.name, product.nameAr)} » ${t.catalogue.addedToCart}`,
      "success",
    );
  };

  return (
    <div className="mx-auto max-w-[1360px] px-5 pb-16 pt-6 sm:px-8">
      <div className="mb-8 flex items-center justify-between border-b border-[#17251f]/10 pb-5">
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
            {t.favorites.eyebrow}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.06em] text-[#17251f] sm:text-4xl">
            {t.favorites.title}{" "}
            <span className="text-xl font-normal text-[#627269]">
              ({items.length})
            </span>
          </h1>
        </div>
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#1d4538] transition hover:text-[#14352b]"
        >
          <Arrow left /> {t.favorites.viewStore}
        </Link>
      </div>

      {loading && ids.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[#17251f]/12 bg-[#fdfcf8] p-2.5 sm:p-4"
            >
              <div className="skeleton h-36 xs:h-44 sm:h-56 w-full rounded-xl" />
              <div className="skeleton mt-3 sm:mt-4 h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mx-auto my-16 max-w-md rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-10 text-center shadow-sm">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#edf3ee] text-2xl text-[#1d4538]">
            <HeartIcon className="h-7 w-7" filled />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#17251f]">
            {t.favorites.emptyTitle}
          </h2>
          <p className="mt-2 text-sm text-[#627269]">
            {t.favorites.emptySubtitle}
          </p>
          <Link
            href="/catalogue"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1d4538] px-7 py-3.5 text-[11px] font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#14352b]"
          >
            {t.favorites.browseCatalog}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              onClick={() => router.push(`/produit/${item.id}`)}
              className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#17251f]/12 bg-[#fdfcf8] p-2.5 sm:p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#1d4538]/30 hover:shadow-xl"
            >
              <div
                className="relative h-36 xs:h-44 sm:h-56 overflow-hidden rounded-xl"
                style={{ backgroundColor: item.tone }}
              >
                {item.promoPrice != null && item.price != null && item.promoPrice < item.price && (
                  <span className="absolute start-2 top-2 sm:start-3 sm:top-3 z-10 rounded-full bg-red-600 px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold text-white shadow-sm">
                    -{Math.round(((item.price - item.promoPrice) / item.price) * 100)}%
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(item.id);
                  }}
                  aria-label={interpolate(
                    has(item.id) ? t.favorites.removeAria : t.favorites.addAria,
                    { name: pick(locale, item.name, item.nameAr) },
                  )}
                  className="absolute end-2 top-2 sm:end-3 sm:top-3 z-10 grid h-7 w-7 sm:h-8 sm:w-8 cursor-pointer place-items-center rounded-full bg-white/90 text-[#17251f] shadow-sm transition hover:text-[#e11d48]"
                >
                  <HeartIcon
                    className="h-3.5 w-3.5 sm:h-4 sm:w-4"
                    filled={has(item.id)}
                    animating={animatingId === item.id}
                  />
                </button>
                {item.imageUrl && (
                  <img
                    src={mediaSrc(item.imageUrl) ?? ""}
                    alt={pick(locale, item.name, item.nameAr)}
                    className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105"
                  />
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between px-0.5 pb-0.5 pt-3 sm:px-1 sm:pb-1 sm:pt-4">
                <div>
                  <h3 className="line-clamp-2 text-[13px] sm:text-[17px] font-semibold tracking-[-.04em] text-[#17251f] transition group-hover:text-[#1d4538]">
                    {pick(locale, item.name, item.nameAr)}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] leading-3.5 sm:leading-4 text-[#5f6e66]">
                    {pick(locale, item.specs, item.specsAr)}
                  </p>
                </div>

                <div className="mt-3 sm:mt-5 flex items-center justify-between gap-1.5 sm:gap-2 border-t border-[#17251f]/10 pt-2.5 sm:pt-3">
                  <div className="min-w-0">
                    <b className="block truncate font-mono text-[13px] sm:text-[15px] font-bold text-[#17251f]">
                      {fmtDA(item.promoPrice ?? item.price, locale)}
                    </b>
                    {item.promoPrice != null && item.price != null && item.promoPrice < item.price && (
                      <span className="block truncate font-mono text-[10px] sm:text-xs text-[#9aa39c] line-through">
                        {fmtDA(item.price, locale)}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(item);
                    }}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 sm:gap-1.5 rounded-lg bg-[#1d4538] px-2.5 sm:px-3.5 py-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-[.08em] text-white shadow-xs transition hover:bg-[#14352b]"
                  >
                    <Cart className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                    <span className="hidden xs:inline">{t.favorites.addToCart}</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
