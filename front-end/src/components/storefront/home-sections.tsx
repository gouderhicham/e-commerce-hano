"use client";

import Link from "next/link";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import type {
  HomeCategoryCard,
  HomeFavorites,
  Showcase,
} from "@/lib/data/types";
import { useI18n } from "@/lib/i18n/context";
import { localizeShowcase, pick } from "@/lib/i18n/localize";
import { Arrow, HOME_PROMISE_ICONS } from "./icons";

/* eslint-disable @next/next/no-img-element -- see home-sections.tsx. */

/** Tints of the three "Notre promesse" icon bubbles, in order. */
const PROMISE_TONES = [
  "bg-[#e1ece2] text-[#2c5b48]",
  "bg-[#f1e6d3] text-[#806642]",
  "bg-[#dbe7dc] text-[#1d4538]",
];

/** Default hero image, used until the back office uploads its own. */
const FALLBACK_HERO_IMAGE = "/images/hero-right-side.png";

/**
 * Resolve one editorial block: the database value wins, the dictionary is the
 * fallback. Both locales walk the SAME path — there is no French-only constant
 * shadowing the dictionary, which is what used to make the page say different
 * things in French and in Arabic on a fresh install.
 */
export function HeroSection() {
  const { t } = useI18n();

  const stats = [
    { value: t.home.statGuaranteeVal, label: t.home.statGuaranteeLabel },
    { value: t.home.statDeliveryVal, label: t.home.statDeliveryLabel },
    { value: t.home.statRatingVal, label: t.home.statRatingLabel },
  ];

  return (
    <section
      id="accueil"
      className="mx-auto grid max-w-[1360px] border-x border-[#17251f]/10 lg:grid-cols-[.93fr_1.07fr]"
    >
      <div className="flex min-h-[520px] flex-col justify-between px-6 py-10 sm:min-h-[640px] sm:px-12 sm:py-14">
        <div>
          <h1 className="mt-2 max-w-xl text-[clamp(3.2rem,6.5vw,6.5rem)] font-medium leading-[.95] tracking-[-.07em] sm:mt-4">
            {t.home.titleLead}
            <br />
            <span className="text-[#789a89]">{t.home.titleAccent}</span>
          </h1>
          <p className="mt-8 max-w-sm text-[16px] leading-7 text-[#58675f]">
            {t.home.text}
          </p>
          <Link
            href="/catalogue"
            className="mt-7 inline-flex items-center gap-4 rounded-full bg-[#1d4538] px-6 py-4 text-[12px] font-bold uppercase tracking-[.08em] text-white transition hover:bg-[#14352b]"
          >
            {t.home.ctaCatalog}{" "}
            <span className="rounded-full bg-white/15 p-1">
              <Arrow />
            </span>
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4 border-t border-[#17251f]/10 pt-5 text-[11px] text-[#647169]">
          {stats.map((stat, i) => (
            <p key={`${stat.label}-${i}`}>
              <b className="block text-xl font-medium tracking-[-.05em] text-[#1d2c26]">
                {stat.value}
              </b>
              {stat.label}
            </p>
          ))}
        </div>
      </div>

      <div className="relative -mt-6 hidden min-h-[430px] items-center justify-center p-2 sm:-mt-10 sm:p-6 lg:-mt-14 lg:flex lg:min-h-[640px]">
        <img
          src={mediaSrc(FALLBACK_HERO_IMAGE) ?? ""}
          alt={t.home.imageAlt}
          className="hero-image-animate h-auto max-h-[680px] w-full max-w-[720px] scale-110 object-contain drop-shadow-2xl transition duration-500 lg:max-w-[820px]"
        />
      </div>
    </section>
  );
}

export function HeroShowcase({ showcase }: { showcase: Showcase }) {
  const { locale } = useI18n();
  const s = localizeShowcase(showcase, locale) ?? showcase;

  return (
    <section
      id="hero-laptop-showcase"
      className="mx-auto max-w-[1360px] border-x border-b border-[#17251f]/10"
    >
      <div className="relative min-h-[460px] w-full overflow-hidden bg-[#dbe7dc] sm:min-h-[560px] lg:min-h-[640px]">
        {s.image && (
          <img
            src={mediaSrc(s.image) ?? ""}
            alt={s.imageAlt || ""}
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-center transition duration-1000"
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,37,31,0.3)_0%,rgba(23,37,31,0.15)_40%,rgba(23,37,31,0.75)_100%)]" />

        {s.eyebrow && (
          <span className="absolute start-4 top-4 z-10 font-mono text-[8.5px] uppercase tracking-[.15em] text-white/90 sm:start-7 sm:top-8 sm:text-[10px]">
            {s.eyebrow}
          </span>
        )}

        <div className="absolute bottom-4 start-4 end-4 z-10 flex flex-col gap-3.5 sm:bottom-8 sm:start-8 sm:end-8 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-[420px] border-s-2 border-[#e4d7ba] ps-3 text-white sm:ps-4">
            {s.title && (
              <span className="font-mono text-[9px] uppercase tracking-[.16em] text-white/80 sm:text-[10px]">
                {s.title}
              </span>
            )}
            {s.subtitle && (
              <h3 className="mt-0.5 text-xl font-medium leading-6 tracking-[-.04em] text-white sm:mt-1 sm:text-3xl sm:leading-7">
                {s.subtitle}
              </h3>
            )}
            {s.description && (
              <p className="mt-1 text-[11px] leading-4 text-white/80 sm:mt-2 sm:text-sm sm:leading-5">
                {s.description}
              </p>
            )}
          </div>

          {s.specs && s.specs.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/15 bg-[#17251f]/25 p-3 backdrop-blur-md sm:grid-cols-4 sm:rounded-2xl sm:bg-[#17251f]/60 sm:p-5">
              {s.specs.map((spec, i) => (
                <div key={`${spec.label}-${i}`} className="flex flex-col gap-0.5">
                  <span className="font-mono text-[8px] uppercase tracking-[.14em] text-white/60 sm:text-[9px]">
                    {spec.label}
                  </span>
                  <span className="text-[10.5px] font-semibold tracking-tight text-white sm:text-sm">
                    {spec.val}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function CategoriesSection({ cards }: { cards: HomeCategoryCard[] }) {
  const { locale, t } = useI18n();

  return (
    <section
      id="categories"
      className="mx-auto max-w-[1360px] border-x border-[#17251f]/10 px-6 py-20 sm:px-12 sm:py-28"
    >
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#78827b]">
            {t.home.categoriesEyebrow}
          </p>
          <h2 className="mt-3 text-4xl font-medium tracking-[-.07em] sm:text-5xl">
            {t.home.categoriesTitle}
          </h2>
        </div>
        <div className="max-w-xs">
          <p className="text-sm leading-6 text-[#65736b]">
            {t.home.categoriesText}
          </p>
          <Link
            href="/catalogue"
            className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.1em] text-[#2c5b48] hover:text-[#1d4538]"
          >
            {t.home.categoriesCta} <Arrow />
          </Link>
        </div>
      </div>
      <div className="mt-8 sm:mt-12 grid grid-cols-2 gap-px border border-[#17251f]/10 bg-[#17251f]/10 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            href={`/catalogue?category=${encodeURIComponent(card.slug)}`}
            key={card.id}
            aria-label={`${t.home.exploreCategory} : ${pick(locale, card.name, card.nameAr)}`}
            className="group bg-[#f8f7f2] p-2.5 sm:p-3 transition hover:bg-white"
          >
            <div className="relative h-32 xs:h-40 sm:h-48 overflow-hidden rounded-lg bg-[#dde6dd]">
              <img
                src={mediaSrc(card.img) ?? ""}
                alt={pick(locale, card.name, card.nameAr)}
                className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105"
              />
            </div>
            <div className="flex items-end justify-between px-1 pb-1 pt-3 sm:pb-2 sm:pt-4">
              <div>
                <h3 className="text-[14px] sm:text-[17px] font-medium tracking-[-.045em]">
                  {pick(locale, card.name, card.nameAr)}
                </h3>
                <p className="mt-0.5 sm:mt-1 line-clamp-1 text-[10px] sm:text-xs text-[#758078]">
                  {pick(locale, card.detail, card.detailAr)}
                </p>
              </div>
              <span className="mb-0.5 sm:mb-1 text-[#3d6655] opacity-0 transition group-hover:opacity-100">
                <Arrow />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FavoritesSection({ favorites }: { favorites: HomeFavorites }) {
  // `isRTL` flips the affordance arrow: in Arabic "forward" points left.
  const { locale, t, isRTL } = useI18n();

  return (
    <section id="boutique" className="bg-[#e9eee7] py-16 sm:py-28">
      <div className="mx-auto max-w-[1360px] px-4 sm:px-12">
        <div className="grid gap-8 lg:grid-cols-[.38fr_1.62fr]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#78827b]">
              {t.home.favoritesEyebrow}
            </p>
            <h2 className="mt-3 max-w-xs text-3xl sm:text-5xl font-medium leading-[.92] tracking-[-.07em]">
              {t.home.favoritesTitle}
            </h2>
            <p className="mt-4 sm:mt-7 max-w-sm text-sm sm:text-[15px] leading-6 sm:leading-7 text-[#5b6962]">
              {t.home.favoritesText}
            </p>
            <Link
              href="/catalogue"
              className="mt-5 sm:mt-7 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.1em] text-[#2c5b48] hover:text-[#1d4538]"
            >
              {t.home.favoritesCta} <Arrow />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {favorites.items.map((item) => (
              <Link
                key={item.id}
                href={
                  item.productId
                    ? `/produit/${item.productId}`
                    : "/catalogue"
                }
                className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#17251f]/10 bg-[#f8f7f2] p-2.5 sm:p-3 transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-32 xs:h-40 sm:h-48 overflow-hidden rounded-xl bg-[#dce5dd]">
                  <img
                    src={mediaSrc(item.image) ?? ""}
                    alt={pick(locale, item.name, item.nameAr)}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between px-0.5 pb-0.5 pt-3 sm:px-1 sm:pb-1 sm:pt-4">
                  <div>
                    <h3 className="line-clamp-2 text-[13px] sm:text-[16px] font-medium tracking-[-.04em] text-[#17251f] transition group-hover:text-[#1d4538]">
                      {pick(locale, item.name, item.nameAr)}
                    </h3>
                    <p className="mt-1 line-clamp-2 min-h-7 sm:min-h-9 text-[10px] sm:text-[11px] leading-3.5 sm:leading-4 text-[#718078]">
                      {pick(locale, item.spec, item.specAr)}
                    </p>
                  </div>
                  <div className="mt-3 sm:mt-4 flex items-center justify-between border-t border-[#17251f]/10 pt-2.5 sm:pt-3">
                    <b className="whitespace-nowrap font-mono text-[13px] sm:text-[15px] font-bold text-[#1d2c26]">
                      {fmtDA(item.price, locale)}
                    </b>
                    <span className="text-xs font-semibold text-[#1d4538] transition group-hover:translate-x-0.5">
                      {isRTL ? "←" : "→"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Icon order is fixed and matches `promise1..3` in the dictionaries, so the
 * three cards mean the same thing in both languages.
 */
export function PromiseSection() {
  const { t } = useI18n();

  const cards = [
    { icon: "check" as const, title: t.home.promise1Title, text: t.home.promise1Text },
    { icon: "shield" as const, title: t.home.promise2Title, text: t.home.promise2Text },
    { icon: "zap" as const, title: t.home.promise3Title, text: t.home.promise3Text },
  ];

  return (
    <section
      id="engagement"
      className="mx-auto max-w-[1360px] border-x border-[#17251f]/10 px-6 py-20 sm:px-12 sm:py-28"
    >
      <div className="grid gap-12 lg:grid-cols-[.42fr_1.58fr]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#78827b]">
            {t.home.promisesEyebrow}
          </p>
          <h2 className="mt-3 max-w-lg text-4xl font-medium leading-[.95] tracking-[-.07em] sm:text-5xl">
            {t.home.promisesTitle}
            <br />
            <span className="text-[#789a89]">{t.home.promisesSubtitle}</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-6 text-[#58675f]">
            {t.home.promisesText}
          </p>
        </div>

        <div className="grid gap-px bg-[#17251f]/10 sm:grid-cols-3">
          {cards.map((card, index) => {
            const Icon =
              HOME_PROMISE_ICONS[card.icon] ?? HOME_PROMISE_ICONS.check;
            return (
              <div
                key={`${card.title}-${index}`}
                className="flex flex-col justify-between bg-[#f8f7f2] p-6"
              >
                <div>
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-full ${
                      PROMISE_TONES[index % PROMISE_TONES.length]
                    }`}
                  >
                    <Icon />
                  </span>
                  <h3 className="mt-6 text-lg font-medium tracking-[-.04em] text-[#17251f]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#617068]">
                    {card.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
