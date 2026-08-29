"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { useProductsById } from "@/lib/use-products-by-id";
import { useCart } from "@/components/storefront/cart-context";
import { Arrow, Bag, TrashIcon } from "@/components/storefront/icons";
import { SHIPPING } from "@/lib/shop-config";
import { useI18n } from "@/lib/i18n/context";
import { interpolate, pick } from "@/lib/i18n/localize";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

export function PanierClient() {
  const { lines, setQty, remove } = useCart();
  const { products, missing, loading } = useProductsById(lines.map((l) => l.id));
  const { locale, t, isRTL } = useI18n();

  useEffect(() => {
    for (const id of missing) remove(id);
  }, [missing, remove]);

  const rows = useMemo(() => {
    return lines
      .map((line) => ({
        line,
        product: products.get(line.id),
      }))
      .filter(
        (row): row is { line: typeof row.line; product: NonNullable<typeof row.product> } =>
          Boolean(row.product),
      );
  }, [lines, products]);

  const totalItems = rows.reduce((sum, r) => sum + r.line.qty, 0);
  const subtotal = rows.reduce(
    (sum, r) => sum + (r.product.promoPrice ?? r.product.price ?? 0) * r.line.qty,
    0,
  );
  const freeShipping =
    SHIPPING.freeThreshold > 0 && subtotal > SHIPPING.freeThreshold;
  const total = subtotal;

  // Plural form is a property of the language, so each dictionary carries both
  // shapes rather than the component appending an "s".
  const itemCountLabel = interpolate(
    totalItems === 1 ? t.cart.itemCountOne : t.cart.itemCount,
    { n: totalItems },
  );

  return (
    <div className="mx-auto max-w-[1360px] px-5 pb-16 pt-6 sm:px-8">
      <div className="mb-8 flex items-center justify-between border-b border-[#17251f]/10 pb-5">
        <div>
          <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
            {t.cart.eyebrow}
          </span>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-.06em] text-[#17251f] sm:text-4xl">
            {t.cart.title}{" "}
            <span className="text-xl font-normal text-[#627269]">
              ({itemCountLabel})
            </span>
          </h1>
        </div>
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#1d4538] transition hover:text-[#14352b]"
        >
          <Arrow left /> {t.cart.continueShopping}
        </Link>
      </div>

      {loading && lines.length > 0 ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4 rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 sm:p-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 w-full" />
            ))}
          </div>
          <div className="skeleton h-64 w-full rounded-2xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mx-auto my-16 max-w-md rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-10 text-center shadow-sm">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#edf3ee] text-2xl text-[#1d4538]">
            <Bag />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-[#17251f]">
            {t.cart.emptyTitle}
          </h2>
          <p className="mt-2 text-sm text-[#627269]">
            {t.cart.emptySubtitle}
          </p>
          <Link
            href="/catalogue"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#1d4538] px-7 py-3.5 text-[11px] font-bold uppercase tracking-[.1em] text-white shadow-sm transition hover:bg-[#14352b]"
          >
            {t.cart.browseCatalog}
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="divide-y divide-[#17251f]/10 rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm sm:p-8">
            {rows.map(({ line, product }) => {
              const unit = product.promoPrice ?? product.price ?? 0;
              return (
                <div
                  key={line.id}
                  className="group flex flex-col justify-between gap-5 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <Link
                      href={`/produit/${product.id}`}
                      className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[#17251f]/10"
                      style={{ backgroundColor: product.tone }}
                    >
                      {product.imageUrl && (
                        <img
                          src={mediaSrc(product.imageUrl) ?? ""}
                          alt={pick(locale, product.name, product.nameAr)}
                          className="h-full w-full object-cover mix-blend-multiply transition duration-300 group-hover:scale-105"
                        />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/produit/${product.id}`}
                        className="text-base font-bold text-[#17251f] transition group-hover:text-[#1d4538]"
                      >
                        {pick(locale, product.name, product.nameAr)}
                      </Link>
                      <p className="mt-1 text-xs text-[#627269]">
                        {pick(locale, product.specs, product.specsAr)}
                      </p>
                      <p className="mt-1 whitespace-nowrap font-mono text-xs font-semibold text-[#1d4538] sm:hidden">
                        {fmtDA(unit, locale)} / {t.cart.perUnit}
                      </p>
                      {line.qty > product.stock && (
                        <p className="mt-1 text-[11px] font-semibold text-[#a06b1f]">
                          {interpolate(t.cart.onlyLeftInStock, { n: product.stock })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-6 border-t border-[#17251f]/5 pt-2 sm:justify-end sm:border-t-0 sm:pt-0">
                    <div className="inline-flex items-center rounded-lg border border-[#17251f]/15 bg-white text-xs font-semibold shadow-2xs">
                      <button
                        type="button"
                        onClick={() =>
                          line.qty <= 1
                            ? remove(line.id)
                            : setQty(line.id, line.qty - 1)
                        }
                        aria-label={t.cart.decreaseQty}
                        className="cursor-pointer rounded-s-lg px-3 py-1.5 text-[#718078] transition hover:bg-[#e7eee5] hover:text-[#17251f]"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-bold text-[#17251f]">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(line.id, line.qty + 1)}
                        disabled={line.qty >= product.stock}
                        aria-label={t.cart.increaseQty}
                        className="cursor-pointer rounded-e-lg px-3 py-1.5 text-[#718078] transition hover:bg-[#e7eee5] hover:text-[#17251f] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <b className="whitespace-nowrap font-mono text-base font-bold text-[#17251f]">
                      {fmtDA(unit * line.qty, locale)}
                    </b>

                    <button
                      type="button"
                      onClick={() => remove(line.id)}
                      aria-label={interpolate(t.cart.removeItemNamed, {
                        name: pick(locale, product.name, product.nameAr),
                      })}
                      title={t.cart.removeItem}
                      className="cursor-pointer p-1 text-[#9ca59e] transition hover:text-red-600"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="self-start lg:sticky lg:top-[90px]">
            <div className="rounded-2xl border border-[#17251f]/10 bg-[#fdfcf8] p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-4">
                <div>
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
                    {t.cart.recapEyebrow}
                  </span>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-.05em] text-[#17251f]">
                    {t.cart.recapTitle}
                  </h2>
                </div>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3ee] text-[#1d4538] shadow-sm">
                  <Bag />
                </span>
              </div>

              <div className="space-y-3.5 py-5 text-sm">
                <p className="flex justify-between text-[12px] font-medium uppercase tracking-[.06em] text-[#627269]">
                  <span>
                    {t.cart.subtotal} ({itemCountLabel})
                  </span>
                  <span className="whitespace-nowrap font-mono text-[13px] font-semibold text-[#17251f]">
                    {fmtDA(subtotal, locale)}
                  </span>
                </p>
                <p className="flex items-baseline justify-between gap-3 text-[12px] font-medium uppercase tracking-[.06em] text-[#627269]">
                  <span>{t.cart.shipping}</span>
                  <span className="text-end font-mono text-[11px] font-semibold normal-case tracking-normal text-[#627269]">
                    {freeShipping
                      ? t.cart.freeShipping
                      : t.cart.shippingCalculated}
                  </span>
                </p>

                <div className="flex items-baseline justify-between border-t border-[#17251f]/10 pt-4">
                  <span className="text-base font-bold tracking-tight text-[#17251f]">
                    {t.cart.total}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xl font-extrabold text-[#1d4538]">
                    {fmtDA(total, locale)}
                  </span>
                </div>
                <p className="text-[10.5px] leading-4 text-[#78827b]">
                  {freeShipping
                    ? t.cart.freeShippingNotice
                    : t.cart.shippingNotice}
                </p>
              </div>

              <Link
                href="/commande"
                className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#1d4538] py-4 text-center text-[12px] font-bold uppercase tracking-[.12em] text-white shadow-md transition-all duration-200 hover:bg-[#14352b] hover:shadow-lg active:scale-[0.99]"
              >
                <span>{t.cart.checkoutBtn}</span>
                <span className={`text-base ${isRTL ? "rotate-180" : ""}`}>→</span>
              </Link>

              <div className="mt-5 border-t border-[#17251f]/10 pt-4 text-center">
                <p className="text-[11px] leading-relaxed text-[#627269]">
                  {t.cart.directCheckoutNotice}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
