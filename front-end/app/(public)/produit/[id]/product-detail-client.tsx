"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { useCart } from "@/components/storefront/cart-context";
import { useFavorites } from "@/components/storefront/favorites-context";
import { useToast } from "@/components/ui/toast";
import {
  Arrow,
  Cart,
  HeartIcon,
  PROMISE_ICONS,
} from "@/components/storefront/icons";
import {
  ORDER_SECTION_ID,
  ProductOrderForm,
} from "@/components/storefront/product-order-form";
import { useI18n } from "@/lib/i18n/context";
import { interpolate, pick } from "@/lib/i18n/localize";
import type { ProductDetail, Wilaya } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

const subscribe = () => () => {};

const STOCK_TONE = {
  disponible: "bg-[#dce8dd] text-[#315d49]",
  stock_limite: "bg-[#f6ecd8] text-[#8a6a25]",
  indisponible: "bg-[#f0dcdc] text-[#8b3a3a]",
} as const;

/** Icon-bubble tints of the 3 reassurance cards, in order. */
const PROMISE_TONES = ["bg-[#dbe7dc]", "bg-[#e8eee4]", "bg-[#e3eae1]"];

const MIN_SWIPE = 40;

export function ProductDetailClient({
  product,
  wilayas,
}: {
  product: ProductDetail;
  wilayas: Wilaya[];
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const { pushToast } = useToast();
  const { locale, t, isRTL } = useI18n();

  const gallery = product.images.length
    ? product.images.map((i) => i.url)
    : product.imageUrl
      ? [product.imageUrl]
      : [];

  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [addedPulse, setAddedPulse] = useState(false);
  const [animatingFav, setAnimatingFav] = useState(false);
  const [configIndex, setConfigIndex] = useState(0);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const selectedConfig = product.configurations?.[configIndex];
  const price = selectedConfig?.price ?? product.promoPrice ?? product.price;
  const outOfStock = product.availability === "indisponible";
  const onRequest = product.price === null;

  const nextSlide = useCallback(
    () => setActive((prev) => (gallery.length ? (prev + 1) % gallery.length : 0)),
    [gallery.length],
  );
  const prevSlide = useCallback(
    () =>
      setActive((prev) =>
        gallery.length ? (prev - 1 + gallery.length) % gallery.length : 0,
      ),
    [gallery.length],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") nextSlide();
      if (event.key === "ArrowLeft") prevSlide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextSlide, prevSlide]);

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  const settleSwipe = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > MIN_SWIPE) nextSlide();
    else if (distance < -MIN_SWIPE) prevSlide();
  };

  const handleAddToCart = () => {
    if (outOfStock) {
      pushToast(t.product.outOfStockNotice, "error");
      return;
    }
    if (onRequest) {
      pushToast(t.product.onRequestNotice, "error");
      return;
    }
    add(product.id, 1);
    setAddedPulse(true);
    window.setTimeout(() => setAddedPulse(false), 2000);
    pushToast(
      `« ${pick(locale, product.name, product.nameAr)} » ${t.catalogue.addedToCart}`,
      "success",
    );
  };

  /** Jump to the order form further down the page — no cart involved. */
  const handleOrderNow = () => {
    if (onRequest || outOfStock) {
      handleAddToCart();
      return;
    }
    const section = document.getElementById(ORDER_SECTION_ID);
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    section?.querySelector("input")?.focus({ preventScroll: true });
  };

  const handleFavorite = () => {
    toggle(product.id);
    setAnimatingFav(true);
    window.setTimeout(() => setAnimatingFav(false), 450);
  };

  const STOCK_LABEL = {
    disponible: t.product.inStock,
    stock_limite: t.product.limitedStock,
    indisponible: t.product.outOfStock,
  } as const;

  const headline = pick(locale, product.name, product.nameAr);

  return (
    <>
      <div className="mx-auto max-w-[1360px] px-5 pt-6 sm:px-8">
        <Link
          href="/catalogue"
          className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[#537062] transition hover:text-[#1d4538]"
        >
          <Arrow left /> {t.product.backToCatalog}
        </Link>
      </div>

      <section className="mx-auto grid max-w-[1360px] w-full min-w-0 gap-8 px-4 pb-16 pt-6 sm:px-8 sm:gap-10 lg:grid-cols-[1.08fr_.92fr] lg:gap-14">
        <div className="w-full min-w-0 lg:sticky lg:top-[98px] lg:self-start">
          <div
            onTouchStart={(e) => {
              setTouchEnd(null);
              setTouchStart(e.targetTouches[0].clientX);
            }}
            onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
            onTouchEnd={settleSwipe}
            onMouseDown={(e) => {
              setIsDragging(true);
              setTouchStart(e.clientX);
              setTouchEnd(null);
            }}
            onMouseMove={(e) => {
              if (isDragging) setTouchEnd(e.clientX);
            }}
            onMouseUp={() => {
              if (!isDragging) return;
              setIsDragging(false);
              settleSwipe();
            }}
            onMouseLeave={() => setIsDragging(false)}
            className="group relative flex h-[280px] xs:h-[340px] sm:h-[420px] lg:h-[480px] w-full max-w-full cursor-grab select-none items-center justify-center overflow-hidden rounded-2xl border border-[#17251f]/10 bg-[#e2ebe1] p-3 sm:p-6 shadow-sm touch-pan-y active:cursor-grabbing"
          >
            {gallery.length > 0 && (
              <img
                key={active}
                src={mediaSrc(gallery[active]) ?? ""}
                alt={product.name}
                draggable={false}
                onClick={() => {
                  const dragged =
                    touchStart !== null &&
                    touchEnd !== null &&
                    Math.abs(touchStart - touchEnd) >= 10;
                  if (!dragged) setLightbox(true);
                }}
                className="max-h-full max-w-full w-auto h-auto animate-fade-in select-none object-contain mix-blend-multiply transition-all duration-500 group-hover:scale-105"
              />
            )}

            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isRTL) nextSlide();
                    else prevSlide();
                  }}
                  aria-label={t.product.prevImage}
                  className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/80 text-[#1d4538] shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white active:scale-95 md:grid"
                >
                  <Arrow left={!isRTL} flipRtl={false} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isRTL) prevSlide();
                    else nextSlide();
                  }}
                  aria-label={t.product.nextImage}
                  className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/80 text-[#1d4538] shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-white active:scale-95 md:grid"
                >
                  <Arrow left={isRTL} flipRtl={false} />
                </button>
              </>
            )}

            {gallery.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightbox(true);
                  }}
                  className="absolute end-5 top-5 z-10 cursor-pointer rounded-full border border-[#1d4538]/15 bg-[#f8f7f2]/90 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[.13em] text-[#39594d] shadow-sm backdrop-blur-sm transition hover:bg-white"
                >
                  {t.product.zoom} ⤢
                </button>

                <span className="absolute bottom-5 start-5 z-10 rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-white shadow-sm backdrop-blur-md">
                  {active + 1} / {gallery.length}
                </span>
              </>
            )}

            {gallery.length > 1 && (
              <div className="absolute bottom-5 end-5 z-10 flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1.5 backdrop-blur-md">
                {gallery.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActive(idx);
                    }}
                    className={`h-2 cursor-pointer rounded-full transition-all duration-300 ${
                      active === idx
                        ? "w-6 bg-white"
                        : "w-2 bg-white/50 hover:bg-white/80"
                    }`}
                    aria-label={`Image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {gallery.map((img, index) => (
                <button
                  key={`${img}-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Vue ${index + 1}`}
                  className={`flex aspect-square h-16 xs:h-20 sm:h-24 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border bg-[#e2ebe1]/60 p-1.5 transition-all duration-300 ${
                    active === index
                      ? "scale-[1.02] border-[#1d4538] shadow-sm ring-2 ring-[#1d4538]/30"
                      : "border-transparent opacity-60 hover:scale-[1.01] hover:opacity-100"
                  }`}
                >
                  <img
                    src={mediaSrc(img) ?? ""}
                    alt=""
                    className="max-h-full max-w-full object-contain mix-blend-multiply"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="w-full min-w-0 lg:pt-7">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[.19em] text-[#728078]">
            {pick(locale, product.category.name, product.category.nameAr)}
            {(pick(locale, product.condition, product.conditionAr)) ? ` / ${pick(locale, product.condition, product.conditionAr)}` : ""}
          </p>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-[clamp(1.75rem,4vw,3.5rem)] font-medium leading-[1.1] tracking-[-.05em] text-[#17251f] break-words">
              {headline}
            </h1>
            <span
              className={`rounded-full px-3 py-2 font-mono text-[9px] font-bold uppercase tracking-[.12em] ${
                STOCK_TONE[product.availability]
              }`}
            >
              {STOCK_LABEL[product.availability]}
            </span>
          </div>

          {(product.description || product.descriptionAr) && (
            <p className="mt-7 max-w-lg text-[16px] leading-7 text-[#5d6c64]">
              {pick(locale, product.description, product.descriptionAr)}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-baseline gap-3 border-y border-[#17251f]/10 py-6">
            <strong className="whitespace-nowrap font-mono text-4xl font-medium tracking-[-.07em]">
              {fmtDA(price, locale)}
            </strong>
            {selectedConfig?.price == null && product.promoPrice != null && product.price != null && (
              <span className="whitespace-nowrap font-mono text-lg text-[#9aa39c] line-through">
                {fmtDA(product.price, locale)}
              </span>
            )}
          </div>

          {product.configurations.length > 0 && (
            <div className="mt-7">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[.15em] text-[#7b8981]">
                {t.product.configTitle}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {product.configurations.map((config, index) => (
                  <button
                    key={`${config.label}-${index}`}
                    type="button"
                    onClick={() => setConfigIndex(index)}
                    aria-pressed={configIndex === index}
                    className={`cursor-pointer rounded-xl border p-3.5 text-start transition ${
                      configIndex === index
                        ? "border-[#1d4538] bg-[#e4eee5] shadow-sm"
                        : "border-[#17251f]/12 bg-white hover:border-[#1d4538]/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <b className="min-w-0 break-words text-sm font-semibold text-[#17251f]">
                        {pick(locale, config.label, config.labelAr)}
                      </b>
                      {config.price != null && (
                        <span className="whitespace-nowrap font-mono text-[11px] font-bold text-[#1d4538]">
                          {fmtDA(config.price, locale)}
                        </span>
                      )}
                    </div>
                    <span className="mt-1 block break-words text-[11px] text-[#617068]">
                      {pick(locale, config.sub, config.subAr)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap sm:flex-nowrap items-center gap-3">
            <button
              type="button"
              onClick={handleOrderNow}
              disabled={outOfStock && !onRequest}
              className="flex flex-1 min-w-[200px] cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-[#1d4538] py-4 sm:py-5 px-4 text-[12px] font-bold uppercase tracking-[.1em] text-white shadow-md transition-all duration-200 hover:bg-[#14352b] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>
                {onRequest
                  ? t.product.onRequest
                  : outOfStock
                    ? t.product.outOfStock
                    : t.product.orderNow}
              </span>
              {!onRequest && !outOfStock && (
                <>
                  <span className="whitespace-nowrap font-mono opacity-80">· {fmtDA(price, locale)}</span>
                  <span className={`text-base ${isRTL ? "rotate-180" : ""}`}>→</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleAddToCart}
              aria-label={addedPulse ? t.product.addedSuccess : t.product.addToCart}
              title={addedPulse ? t.product.addedSuccess : t.product.addToCart}
              className={`grid h-[54px] sm:h-[58px] w-[54px] sm:w-[58px] shrink-0 cursor-pointer place-items-center rounded-xl border shadow-xs transition ${
                addedPulse
                  ? "border-[#1d4538] bg-[#edf3ee] text-[#1d4538]"
                  : "border-[#17251f]/15 bg-white text-[#17251f] hover:border-[#1d4538] hover:bg-[#edf3ee]"
              }`}
            >
              <Cart className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={handleFavorite}
              aria-label={interpolate(
                has(product.id)
                  ? t.favorites.removeAria
                  : t.favorites.addAria,
                { name: pick(locale, product.name, product.nameAr) },
              )}
              title={t.favorites.eyebrow}
              className="grid h-[54px] sm:h-[58px] w-[54px] sm:w-[58px] shrink-0 cursor-pointer place-items-center rounded-xl border border-[#17251f]/15 bg-white text-[#17251f] shadow-xs transition hover:border-[#1d4538] hover:bg-[#edf3ee]"
            >
              <HeartIcon
                className="h-5 w-5"
                filled={has(product.id)}
                animating={animatingFav}
              />
            </button>
          </div>

          {(pick(locale, product.deliveryNote, product.deliveryNoteAr)) && (
            <p className="mt-3 text-center text-[11px] text-[#718078]">
              {pick(locale, product.deliveryNote, product.deliveryNoteAr)}
            </p>
          )}

          {product.promises.length > 0 && (
            <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {product.promises.map((promise, index) => {
                const Icon = PROMISE_ICONS[promise.icon] ?? PROMISE_ICONS.check;
                return (
                  <div
                    key={`${promise.title}-${index}`}
                    className="group rounded-2xl border border-[#1d4538]/15 bg-[#f4f7f3] p-4.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#1d4538]/30 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-xl text-[#1d4538] ${
                          PROMISE_TONES[index % PROMISE_TONES.length]
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" />
                      </span>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[#1d4538]/70">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-4 text-[14px] font-bold tracking-tight text-[#17251f]">
                      {pick(locale, promise.title, promise.titleAr)}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-5 text-[#58675f]">
                      {pick(locale, promise.text, promise.textAr)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {!onRequest && !outOfStock && (
        <ProductOrderForm
          product={product}
          wilayas={wilayas}
          unitPrice={price ?? 0}
          configLabel={selectedConfig?.label}
        />
      )}

      {product.similar.length > 0 && (
        <section className="mx-auto max-w-[1360px] px-5 pb-20 sm:px-8">
          <div className="border-t border-[#17251f]/10 pt-10">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-[#718078]">
              {t.product.sameCategory}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              {product.similar.map((item) => (
                <Link
                  key={item.id}
                  href={`/produit/${item.id}`}
                  className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#17251f]/12 bg-[#f8f7f2] p-2.5 sm:p-3 transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className="h-32 xs:h-36 sm:h-40 overflow-hidden rounded-xl"
                    style={{ backgroundColor: item.tone }}
                  >
                    {item.imageUrl && (
                      <img
                        src={mediaSrc(item.imageUrl) ?? ""}
                        alt={pick(locale, item.name, item.nameAr)}
                        className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105"
                      />
                    )}
                  </div>
                  <div className="px-0.5 pb-0.5 pt-3 sm:px-1 sm:pb-1 sm:pt-4">
                    <h3 className="line-clamp-2 text-[13px] sm:text-[15px] font-medium tracking-[-.04em]">
                      {pick(locale, item.name, item.nameAr)}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-[10px] sm:text-[11px] leading-3.5 sm:leading-4 text-[#718078]">
                      {pick(locale, item.specs, item.specsAr)}
                    </p>
                    <b className="mt-2.5 sm:mt-3 block whitespace-nowrap font-mono text-[13px] sm:text-[14px] text-[#1d2c26]">
                      {fmtDA(item.promoPrice ?? item.price, locale)}
                    </b>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {mounted && lightbox && gallery.length > 0 && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.product.zoom}
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-[99999] flex animate-fade-in items-center justify-center bg-[#11251d]/85 p-3 backdrop-blur-md sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative mx-auto flex max-h-[95vh] w-full max-w-5xl flex-col justify-between overflow-hidden rounded-2xl bg-[#f8f7f2] p-3 shadow-2xl sm:p-5"
          >
            <button
              type="button"
              onClick={() => setLightbox(false)}
              aria-label={t.product.closeGallery}
              className="absolute end-4 top-4 z-20 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white text-xl font-bold text-[#17251f] shadow-md transition hover:bg-gray-100"
            >
              ×
            </button>

            <div
              onTouchStart={(e) => {
                setTouchEnd(null);
                setTouchStart(e.targetTouches[0].clientX);
              }}
              onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
              onTouchEnd={settleSwipe}
              className="relative flex h-[65vh] min-h-[320px] max-h-[75vh] w-full select-none items-center justify-center overflow-hidden rounded-xl bg-[#e5eee4] p-4 touch-pan-y sm:h-[72vh]"
            >
              <img
                key={active}
                src={mediaSrc(gallery[active]) ?? ""}
                alt={interpolate(t.product.imageAlt, {
                  name: pick(locale, product.name, product.nameAr),
                  n: active + 1,
                })}
                className="max-h-full max-w-full animate-fade-in object-contain mix-blend-multiply"
              />
              {gallery.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={isRTL ? nextSlide : prevSlide}
                    aria-label={t.product.prevImage}
                    className="absolute left-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 shadow-md transition hover:bg-white sm:grid"
                  >
                    <Arrow left={!isRTL} flipRtl={false} />
                  </button>
                  <button
                    type="button"
                    onClick={isRTL ? prevSlide : nextSlide}
                    aria-label={t.product.nextImage}
                    className="absolute right-4 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 shadow-md transition hover:bg-white sm:grid"
                  >
                    <Arrow left={isRTL} flipRtl={false} />
                  </button>
                </>
              )}
            </div>

            {gallery.length > 1 && (
              <div className="cart-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {gallery.map((img, index) => (
                  <button
                    key={`${img}-${index}`}
                    type="button"
                    onClick={() => setActive(index)}
                    aria-label={`Vue ${index + 1}`}
                    className={`flex h-14 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-[#e5eee4]/60 p-1 transition ${
                      active === index
                        ? "border-[#1d4538] ring-2 ring-[#1d4538]/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={mediaSrc(img) ?? ""}
                      alt=""
                      className="max-h-full max-w-full object-contain mix-blend-multiply"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
