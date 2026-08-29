"use client";

import { useState } from "react";
import Link from "next/link";
import { Cart, HeartIcon } from "./icons";
import { useCart } from "./cart-context";
import { useFavorites } from "./favorites-context";
import { useI18n } from "@/lib/i18n/context";
import { LanguageSwitcher } from "./language-switcher";

/** Small count bubble on the favourites / cart buttons. */
function Bubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -end-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#1d4538] px-1 font-mono text-[9px] font-bold leading-none text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SiteHeader() {
  const [isOpen, setIsOpen] = useState(false);
  const { count } = useCart();
  const { ids } = useFavorites();
  const { t, isRTL } = useI18n();

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="sticky top-0 z-40 border-b border-[#17251f]/10 bg-[#f8f7f2]">
      <div className="mx-auto flex h-[78px] max-w-[1360px] items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          onClick={closeMenu}
          className="group flex items-center gap-3.5 transition"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/pc-logo.jpg"
            alt="pc store 39"
            className="h-9 w-9 rounded-full border border-[#1d4538]/20 object-cover shadow-sm transition duration-300 group-hover:scale-105"
          />
          <div className="hidden flex-col justify-center leading-none sm:flex">
            <div className="flex items-baseline gap-1 font-mono text-[16px] font-extrabold uppercase tracking-[.18em] text-[#17251f]">
              <span>pc store</span>
              <span className="font-black text-[#1d4538]">.39</span>
            </div>
            <span className="mt-0.5 font-mono text-[8px] font-semibold uppercase tracking-[.25em] text-[#78827b]">
              {t.nav.tagline}
            </span>
          </div>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-8 text-[12px] font-medium uppercase tracking-[.12em] text-[#4e5d56] md:flex">
          <Link href="/catalogue" className="transition hover:text-[#1d4538]">
            {t.nav.boutique}
          </Link>
          <Link href="/#categories" className="transition hover:text-[#1d4538]">
            {t.nav.categories}
          </Link>
          <Link href="/contact" className="transition hover:text-[#1d4538]">
            {t.nav.contact}
          </Link>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher className="hidden sm:inline-flex" />

          <Link
            href="/favoris"
            aria-label={`${t.nav.favorites} (${ids.length})`}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] transition hover:bg-[#e7eee5] hover:text-[#1d4538]"
          >
            <HeartIcon className="h-[17px] w-[17px]" />
            <Bubble count={ids.length} />
          </Link>
          <Link
            href="/panier"
            aria-label={`${t.nav.cart} (${count})`}
            className="relative grid h-9 w-9 place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] transition hover:bg-[#e7eee5] hover:text-[#1d4538]"
          >
            <Cart />
            <Bubble count={count} />
          </Link>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-label={isOpen ? t.nav.closeMenu : t.nav.openMenu}
            aria-expanded={isOpen}
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#17251f] transition hover:bg-[#e7eee5] md:hidden"
          >
            <span
              className={`text-lg leading-none transition-transform duration-300 ${
                isOpen ? "rotate-90 font-bold text-[#1d4538]" : ""
              }`}
            >
              {isOpen ? "✕" : "☰"}
            </span>
          </button>
        </div>
      </div>

      {/* Full-width mobile drawer */}
      <div
        className={`fixed inset-x-0 bottom-0 top-[78px] z-[9999] flex flex-col justify-between border-b border-[#17251f]/10 bg-[#f8f7f2] p-6 shadow-2xl transition-all duration-300 ease-in-out sm:p-8 md:hidden ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-4 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-6 pt-2">
          <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-3">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-[#1d4538]">
              {t.nav.boutique}
            </span>
            <LanguageSwitcher />
          </div>
          <nav className="flex flex-col gap-4 text-2xl font-medium tracking-tight text-[#17251f]">
            <Link
              href="/catalogue"
              onClick={closeMenu}
              className="flex items-center justify-between border-b border-[#17251f]/10 pb-3 transition hover:text-[#1d4538]"
            >
              <span>{t.nav.boutique}</span>
              <span className={`text-base text-[#1d4538] ${isRTL ? "rotate-180" : ""}`}>→</span>
            </Link>
            <Link
              href="/#categories"
              onClick={closeMenu}
              className="flex items-center justify-between border-b border-[#17251f]/10 pb-3 transition hover:text-[#1d4538]"
            >
              <span>{t.nav.categories}</span>
              <span className={`text-base text-[#1d4538] ${isRTL ? "rotate-180" : ""}`}>→</span>
            </Link>
            <Link
              href="/contact"
              onClick={closeMenu}
              className="flex items-center justify-between border-b border-[#17251f]/10 pb-3 transition hover:text-[#1d4538]"
            >
              <span>{t.nav.contact}</span>
              <span className={`text-base text-[#1d4538] ${isRTL ? "rotate-180" : ""}`}>→</span>
            </Link>
            <Link
              href="/favoris"
              onClick={closeMenu}
              className="flex items-center justify-between border-b border-[#17251f]/10 pb-3 transition hover:text-[#1d4538]"
            >
              <span>{t.nav.favorites} {ids.length > 0 && `(${ids.length})`}</span>
              <HeartIcon className="h-5 w-5 text-[#1d4538]" />
            </Link>
            <Link
              href="/panier"
              onClick={closeMenu}
              className="flex items-center justify-between border-b border-[#17251f]/10 pb-3 transition hover:text-[#1d4538]"
            >
              <span>{t.nav.cart} {count > 0 && `(${count})`}</span>
              <Cart className="h-5 w-5 text-[#1d4538]" />
            </Link>
          </nav>
        </div>

        <div className="space-y-4 pb-2 pt-6">
          <Link
            href="/catalogue"
            onClick={closeMenu}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d4538] py-4 text-xs font-bold uppercase tracking-[.12em] text-white shadow-md transition hover:bg-[#14352b]"
          >
            {t.home.seeAll}
          </Link>

          <p className="text-center font-mono text-[9px] uppercase tracking-[.18em] text-[#78827b]">
            pc store .39 · {t.nav.tagline}
          </p>
        </div>
      </div>
    </nav>
  );
}
