"use client";

import { SHOP } from "@/lib/shop-config";
import { useI18n } from "@/lib/i18n/context";

export function SiteFooter() {
  const { t } = useI18n();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#17251f]/10 px-6 py-8 text-[11px] text-[#758078] sm:px-12">
      <div className="mx-auto flex max-w-[1360px] flex-col justify-between gap-3 sm:flex-row">
        <span>
          © {year} {SHOP.name} — {t.footer.copyright}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{t.footer.testedAndGuaranteed}</span>
          <span aria-hidden="true">·</span>
          <span>{t.footer.deliveryWilayas}</span>
        </span>
        <span>{t.footer.motto}</span>
      </div>
    </footer>
  );
}
