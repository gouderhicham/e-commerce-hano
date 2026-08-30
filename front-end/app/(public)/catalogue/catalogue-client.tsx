"use client";

import { useEffect, useState, useTransition } from "react";
import {
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { useCart } from "@/components/storefront/cart-context";
import { useFavorites } from "@/components/storefront/favorites-context";
import { useToast } from "@/components/ui/toast";
import {
  Cart,
  CheckIcon,
  FilterIcon,
  HeartIcon,
  ShieldIcon,
  ZapIcon,
} from "@/components/storefront/icons";
import { useI18n } from "@/lib/i18n/context";
import { interpolate, pick } from "@/lib/i18n/localize";
import { parseCatalogueParams, productQuery } from "@/lib/catalogue-query";
import type {
  CategoryWithCount,
  Paginated,
  ProductPublic,
  TagGroup,
} from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

/**
 * Read the selected sidebar facets out of the URL: one comma-separated param
 * per tag group, keyed by the group's `field`.
 */
function tagsFromParams(
  params: URLSearchParams | ReadonlyURLSearchParams,
  tagGroups: TagGroup[],
): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const group of tagGroups) {
    const val = params.get(group.field);
    if (val) map[group.field] = val.split(",").filter(Boolean);
  }
  return map;
}

const DEFAULT_PAGINATION: Paginated<ProductPublic> = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
};

export function CatalogueClient({
  initial = DEFAULT_PAGINATION,
  categories: initialCategories = [],
  tagGroups: initialTagGroups = [],
}: {
  initial?: Paginated<ProductPublic>;
  categories?: CategoryWithCount[];
  tagGroups?: TagGroup[];
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const { pushToast } = useToast();
  const { locale, t } = useI18n();

  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>(initialTagGroups);
  const [result, setResult] = useState<Paginated<ProductPublic>>(initial);
  const [loading, setLoading] = useState(initial.items.length === 0);
  const [animatingId, setAnimatingId] = useState<number | null>(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (categories.length === 0) {
      apiFetch("/api/categories")
        .then((r) => r.json())
        .then((data: CategoryWithCount[]) => setCategories(data))
        .catch(() => {});
    }
    if (tagGroups.length === 0) {
      apiFetch("/api/tag-groups")
        .then((r) => r.json())
        .then((data: TagGroup[]) => setTagGroups(data))
        .catch(() => {});
    }
  }, [categories.length, tagGroups.length]);

  const searchCategory = searchParams.get("category") ?? "";
  const currentSort = searchParams.get("sort") ?? "";
  const currentSearch = searchParams.get("q") ?? "";

  // Local optimistic state for 0ms immediate UI responsiveness on tap, re-derived
  // whenever the URL changes from somewhere else (back button, a category link,
  // the search box). Adjusting it during render rather than in an effect means
  // the corrected value paints in the same commit, with no flash of stale
  // filters — the effect version rendered once with the old selection first.
  const paramsKey = searchParams.toString();
  const [syncedParams, setSyncedParams] = useState(paramsKey);
  const [localCategory, setLocalCategory] = useState(searchCategory);
  const [localTags, setLocalTags] = useState<Record<string, string[]>>(() =>
    tagsFromParams(searchParams, tagGroups),
  );

  if (syncedParams !== paramsKey) {
    setSyncedParams(paramsKey);
    setLocalCategory(searchCategory);
    setLocalTags(tagsFromParams(searchParams, tagGroups));
  }

  const activeCategory =
    categories.find((c) => c.slug === localCategory || c.id === localCategory) ?? null;

  const relevantGroups = tagGroups.filter(
    (g) =>
      !activeCategory ||
      g.targets.length === 0 ||
      g.targets.includes(activeCategory.id),
  );

  const selectedTags = localTags;
  const activeFilterCount = Object.values(selectedTags).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  // Same pattern for the server-rendered page: a fresh `initial` (a navigation
  // resolved on the server) replaces whatever the client last fetched.
  const [syncedInitial, setSyncedInitial] = useState(initial);
  if (syncedInitial !== initial) {
    setSyncedInitial(initial);
    setResult(initial);
    setLoading(initial.items.length === 0);
  }

  useEffect(() => {
    const filter = parseCatalogueParams(
      new URLSearchParams(searchParams.toString()),
      tagGroups,
      locale,
    );

    apiFetch(`/api/products${productQuery(filter)}`)
      .then((res) => {
        if (res.ok) return res.json() as Promise<Paginated<ProductPublic>>;
        return null;
      })
      .then((data) => {
        if (data) setResult(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [searchParams, tagGroups, locale]);

  const updateQuery = (updater: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(searchParams.toString());
    updater(p);
    p.delete("page");
    startTransition(() => {
      router.push(`/catalogue?${p.toString()}`, { scroll: false });
    });
  };

  const setCategory = (slug: string) => {
    setLocalCategory(slug);
    const cat = categories.find((c) => c.slug === slug || c.id === slug);
    const nextTags = { ...localTags };
    for (const g of tagGroups) {
      if (slug && cat && g.targets.length > 0 && !g.targets.includes(cat.id)) {
        delete nextTags[g.field];
      }
    }
    setLocalTags(nextTags);

    updateQuery((p) => {
      if (slug) p.set("category", slug);
      else p.delete("category");
      for (const g of tagGroups) {
        if (slug && cat && g.targets.length > 0 && !g.targets.includes(cat.id)) {
          p.delete(g.field);
        }
      }
    });
  };

  const toggleTag = (field: string, value: string) => {
    const current = localTags[field] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    const nextMap = { ...localTags };
    if (next.length) nextMap[field] = next;
    else delete nextMap[field];
    setLocalTags(nextMap);

    updateQuery((p) => {
      if (next.length) p.set(field, next.join(","));
      else p.delete(field);
    });
  };

  const clearAllFilters = () => {
    setLocalTags({});
    const p = new URLSearchParams();
    if (localCategory) p.set("category", localCategory);
    if (currentSort) p.set("sort", currentSort);
    startTransition(() => {
      router.push(`/catalogue?${p.toString()}`, { scroll: false });
    });
  };

  const handleAddToCart = (item: ProductPublic) => {
    if (item.availability === "indisponible") {
      pushToast(t.product.outOfStockNotice, "error");
      return;
    }
    if (item.price === null) {
      pushToast(t.product.onRequestNotice, "info");
      return;
    }
    add(item.id, 1);
    pushToast(`« ${pick(locale, item.name, item.nameAr)} » ${t.catalogue.addedToCart}`, "success");
  };

  const handleFavorite = (id: number) => {
    toggle(id);
    setAnimatingId(id);
    window.setTimeout(() => setAnimatingId(null), 450);
  };

  const totalProducts = categories.reduce((sum, c) => sum + c.productCount, 0);

  return (
    <div className="mx-auto max-w-[1360px] px-5 pb-20 pt-6 sm:px-8">
      <div className="mb-8 flex flex-col gap-4 border-b border-[#17251f]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
            {t.catalogue.eyebrow}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.06em] text-[#17251f] sm:text-4xl">
            {activeCategory
              ? pick(locale, activeCategory.name, activeCategory.nameAr)
              : t.catalogue.allProducts}
            <span className="text-lg font-normal text-[#627269]">
              {" "}
              ({result.total})
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileFiltersOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[#17251f]/15 bg-white px-3.5 py-2 text-xs font-semibold text-[#17251f] shadow-2xs transition hover:border-[#1d4538] lg:hidden"
          >
            <FilterIcon className="h-3.5 w-3.5" />
            <span>{t.catalogue.openFilters}</span>
            {activeFilterCount > 0 && (
              <span className="grid h-4 w-4 place-items-center rounded-full bg-[#1d4538] text-[9px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <label
              htmlFor="sort-select"
              className="text-xs font-medium text-[#627269]"
            >
              {t.catalogue.sortBy}
            </label>
            <select
              id="sort-select"
              value={currentSort}
              onChange={(e) =>
                updateQuery((p) => {
                  if (e.target.value) p.set("sort", e.target.value);
                  else p.delete("sort");
                })
              }
              className="cursor-pointer rounded-xl border border-[#17251f]/15 bg-white px-3 py-2 text-xs font-semibold text-[#17251f] shadow-2xs outline-none transition focus:border-[#1d4538]"
            >
              {/* Values MUST match PRODUCT_SORTS in the backend's
                  product-query.dto.ts — an unknown value is rejected with a 400
                  and the catalogue silently stops sorting. */}
              <option value="">{t.catalogue.sortDefaut}</option>
              <option value="prix_asc">{t.catalogue.sortPrixAsc}</option>
              <option value="prix_desc">{t.catalogue.sortPrixDesc}</option>
              <option value="nom">{t.catalogue.sortNom}</option>
              <option value="nouveautes">{t.catalogue.sortNouveautes}</option>
            </select>
          </div>
        </div>
      </div>

      <div className="cart-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
            !localCategory
              ? "bg-[#1d4538] text-white shadow-sm"
              : "border border-[#17251f]/12 bg-white text-[#17251f] hover:border-[#1d4538]/40"
          }`}
        >
          {t.catalogue.allProducts} ({totalProducts})
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.slug)}
            className={`cursor-pointer whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition ${
              localCategory === cat.slug || localCategory === cat.id
                ? "bg-[#1d4538] text-white shadow-sm"
                : "border border-[#17251f]/12 bg-white text-[#17251f] hover:border-[#1d4538]/40"
            }`}
          >
            {pick(locale, cat.name, cat.nameAr)} ({cat.productCount})
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[90px] space-y-6 rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-3">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[.15em] text-[#17251f]">
                  {t.catalogue.filterTitle}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#627269]">
                  {activeFilterCount > 0
                    ? `${activeFilterCount} ${t.catalogue.activeFilter}`
                    : t.catalogue.filterSubtitle}
                </p>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="cursor-pointer text-[11px] font-semibold text-[#1d4538] underline hover:text-[#14352b]"
                >
                  {t.catalogue.resetFilters}
                </button>
              )}
            </div>

            <div>
              <label
                htmlFor="search-sidebar"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[.08em] text-[#627269]"
              >
                {t.catalogue.searchLabel}
              </label>
              <input
                id="search-sidebar"
                type="text"
                placeholder={t.catalogue.searchPlaceholder}
                defaultValue={currentSearch}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    updateQuery((p) => {
                      if (val) p.set("q", val);
                      else p.delete("q");
                    });
                  }
                }}
                className="w-full rounded-xl border border-[#17251f]/15 bg-white px-3.5 py-2 text-xs text-[#17251f] outline-none transition placeholder:text-[#9ca59e] focus:border-[#1d4538]"
              />
            </div>

            {relevantGroups.map((group) => {
              const selected = selectedTags[group.field] ?? [];
              return (
                <div
                  key={group.id}
                  className="border-t border-[#17251f]/8 pt-4"
                >
                  <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-[.1em] text-[#17251f]">
                    {pick(locale, group.name, group.nameAr)}
                  </h3>
                  <div className="space-y-1.5">
                    {group.tags.map((tag) => {
                      const tagKey = tag.label || tag.value;
                      const isChecked = selected.includes(tagKey) || selected.includes(tag.value);
                      return (
                        <label
                          key={tag.label}
                          className="flex cursor-pointer items-center gap-2.5 text-xs text-[#4d5c54] transition hover:text-[#17251f]"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTag(group.field, tagKey)}
                            className="h-4 w-4 cursor-pointer rounded border-[#17251f]/20 text-[#1d4538] focus:ring-[#1d4538]"
                          />
                          <span
                            className={
                              isChecked
                                ? "font-bold text-[#1d4538]"
                                : "font-normal"
                            }
                          >
                            {pick(locale, tag.label, tag.labelAr)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            <div className="border-t border-[#17251f]/10 pt-4 text-[11px] text-[#627269]">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#17251f]">
                {t.catalogue.guaranteesTitle}
              </h3>
              <div className="flex items-center gap-2 py-1">
                <ShieldIcon className="h-4 w-4 text-[#1d4538]" />
                <span>{t.catalogue.guarantee1}</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <ZapIcon className="h-4 w-4 text-[#1d4538]" />
                <span>{t.catalogue.guarantee2}</span>
              </div>
              <div className="flex items-center gap-2 py-1">
                <CheckIcon className="h-4 w-4 text-[#1d4538]" />
                <span>{t.catalogue.guarantee3}</span>
              </div>
            </div>
          </div>
        </aside>

        {mobileFiltersOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.catalogue.filterTitle}
            className="fixed inset-0 z-50 flex bg-black/40 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileFiltersOpen(false)}
          >
            <div
              className="ms-auto flex h-full w-full max-w-xs flex-col bg-[#fdfcf8] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-4">
                <h2 className="text-sm font-bold uppercase tracking-[.15em] text-[#17251f]">
                  {t.catalogue.filterTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label={t.catalogue.closeFilters}
                  className="cursor-pointer text-xl text-[#627269] hover:text-[#17251f]"
                >
                  ×
                </button>
              </div>

              <div className="cart-scrollbar flex-1 overflow-y-auto py-4 space-y-6">
                {relevantGroups.map((group) => {
                  const selected = selectedTags[group.field] ?? [];
                  return (
                    <div key={group.id}>
                      <h3 className="mb-2 text-xs font-bold uppercase tracking-[.1em] text-[#17251f]">
                        {pick(locale, group.name, group.nameAr)}
                      </h3>
                      <div className="space-y-2">
                        {group.tags.map((tag) => {
                          const tagKey = tag.label || tag.value;
                          const isChecked = selected.includes(tagKey) || selected.includes(tag.value);
                          return (
                            <label
                              key={tag.label}
                              className="flex cursor-pointer items-center gap-2.5 text-xs text-[#4d5c54]"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() =>
                                  toggleTag(group.field, tagKey)
                                }
                                className="h-4 w-4 rounded border-[#17251f]/20 text-[#1d4538]"
                              />
                              <span
                                className={
                                  isChecked
                                    ? "font-bold text-[#1d4538]"
                                    : "font-normal"
                                }
                              >
                                {pick(locale, tag.label, tag.labelAr)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[#17251f]/10 pt-4 flex gap-3">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllFilters();
                      setMobileFiltersOpen(false);
                    }}
                    className="flex-1 cursor-pointer rounded-xl border border-[#17251f]/15 py-3 text-xs font-bold uppercase tracking-[.1em] text-[#17251f]"
                  >
                    {t.catalogue.resetFilters}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  className="flex-1 cursor-pointer rounded-xl bg-[#1d4538] py-3 text-xs font-bold uppercase tracking-[.1em] text-white shadow-sm"
                >
                  {t.catalogue.filterResults} ({result.total})
                </button>
              </div>
            </div>
          </div>
        )}

        <main
          aria-busy={isPending}
          className={isPending ? "opacity-60 transition-opacity" : ""}
        >
          {loading && result.items.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex flex-col justify-between rounded-2xl border border-[#17251f]/12 bg-[#fdfcf8] p-2.5 sm:p-4 shadow-sm"
                >
                  <div className="skeleton h-36 xs:h-44 sm:h-56 w-full rounded-xl" />
                  <div className="mt-3 sm:mt-4 space-y-2">
                    <div className="skeleton h-4 w-3/4 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#17251f]/10 pt-3">
                    <div className="skeleton h-5 w-20 rounded" />
                    <div className="skeleton h-7 w-20 rounded-lg" />
                  </div>
                </div>
              ))}
            </div>
          ) : result.items.length === 0 ? (
            <div className="my-12 rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-12 text-center shadow-sm">
              <p className="font-mono text-xs font-bold uppercase tracking-[.15em] text-[#8a6a25]">
                {t.catalogue.emptyTitle}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[#17251f]">
                {t.catalogue.emptySubtitle}
              </h2>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-6 cursor-pointer rounded-xl bg-[#1d4538] px-6 py-3 text-xs font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#14352b]"
              >
                {t.catalogue.resetFilters}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
              {result.items.map((item) => (
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
                        handleFavorite(item.id);
                      }}
                      aria-label={interpolate(
                        has(item.id)
                          ? t.favorites.removeAria
                          : t.favorites.addAria,
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
                        <b className="block truncate font-mono text-[13px] sm:text-[16px] font-bold text-[#17251f]">
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
                          handleAddToCart(item);
                        }}
                        aria-label={t.product.addToCart}
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

          {result.pageCount > 1 && (
            <div className="mt-10 flex items-center justify-center gap-2">
              {Array.from({ length: result.pageCount }).map((_, i) => {
                const p = i + 1;
                const isCurrent = p === result.page;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      updateQuery((params) => {
                        params.set("page", String(p));
                      })
                    }
                    className={`h-9 w-9 cursor-pointer rounded-xl font-mono text-xs font-bold transition ${
                      isCurrent
                        ? "bg-[#1d4538] text-white shadow-sm"
                        : "border border-[#17251f]/15 bg-white text-[#17251f] hover:border-[#1d4538]"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
