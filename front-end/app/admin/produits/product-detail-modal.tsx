"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

import {
  Edit3,
  ExternalLink,
  Layers,
  Sparkles,
  Tag,
  Truck,
  X,
} from "lucide-react";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { AVAILABILITY_LABELS, AVAILABILITY_PILLS } from "@/lib/labels";
import { Pill } from "@/components/admin/ui";
import { pick } from "@/lib/i18n/localize";
import type { Locale } from "@/lib/i18n/types";
import type { ProductPublic } from "@/lib/data/types";

/**
 * The FR/AR toggle previews the PRODUCT DATA in each language — it flips the
 * `*Ar` columns, the text direction and the Arabic face. The chrome around the
 * preview stays French, because the back office is French-only: hand-writing
 * Arabic section headings here only invents strings the storefront never shows.
 */

/* eslint-disable @next/next/no-img-element -- admin previews mirror storefront <img> handling */

const subscribe = () => () => {};

interface ProductDetailModalProps {
  product: ProductPublic | null;
  categoryName: string;
  onClose: () => void;
  onEdit?: (product: ProductPublic) => void;
}

export function ProductDetailModal({
  product,
  categoryName,
  onClose,
  onEdit,
}: ProductDetailModalProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [lang, setLang] = useState<Locale>("fr");

  if (!product || !mounted) return null;

  const defaultImage = product.imageUrl ?? (product.images[0]?.url || null);
  const currentImage = selectedImage ?? defaultImage;
  const displayPrice = product.promoPrice ?? product.price;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#17251f]/75 p-4 backdrop-blur-sm animate-fade-in">
      <div className="light-scrollbar flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#17251f]/20 bg-[#fafafa] shadow-2xl">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#17251f]/10 bg-white px-6 py-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="rounded-md bg-[#edf3ee] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[#1d4538]">
              {categoryName}
            </span>
            <span className="font-mono text-xs font-bold text-[#78827b]">
              #{product.id}
            </span>
            {product.reference && (
              <span className="font-mono text-xs font-medium text-[#78827b]">
                (Ref: {product.reference})
              </span>
            )}
            <Pill
              label={AVAILABILITY_LABELS[product.availability]}
              colors={AVAILABILITY_PILLS[product.availability]}
            />
            {!product.active && (
              <span className="rounded-full bg-gray-200 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-gray-700">
                Inactif
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center overflow-hidden rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLang("fr")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition ${
                  lang === "fr"
                    ? "bg-[#1d4538] text-white shadow-xs"
                    : "text-[#58675f] hover:text-[#17251f]"
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setLang("ar")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-arabic transition ${
                  lang === "ar"
                    ? "bg-[#1d4538] text-white shadow-xs"
                    : "text-[#58675f] hover:text-[#17251f]"
                }`}
              >
                العربية
              </button>
            </div>
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(product);
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#17251f]/15 bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase text-[#17251f] shadow-2xs hover:border-[#1d4538] hover:text-[#1d4538]"
              >
                <Edit3 className="h-3.5 w-3.5" /> Éditer
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border border-[#17251f]/10 bg-white text-[#58675f] hover:bg-[#f4f7f3] hover:text-[#17251f]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="light-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
          
          {/* Top Section: Visual Gallery & Main Summary */}
          <div className="grid gap-6 rounded-2xl border border-[#17251f]/10 bg-white p-5 shadow-xs md:grid-cols-[1.1fr_1fr]">
            
            {/* Gallery Column */}
            <div className="flex flex-col gap-3">
              <div
                className="relative h-64 overflow-hidden rounded-xl border border-[#17251f]/10 bg-[#f4f7f3]"
                style={{ backgroundColor: product.tone || "#f4f7f3" }}
              >
                {currentImage ? (
                  <img
                    src={mediaSrc(currentImage) ?? ""}
                    alt={product.name}
                    className="h-full w-full object-cover mix-blend-multiply"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center font-mono text-xs text-[#78827b]">
                    Aucune image disponible
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {product.images.map((img) => {
                    const isSelected = currentImage === img.url;
                    return (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setSelectedImage(img.url)}
                        className={`h-12 w-14 overflow-hidden rounded-lg border transition ${
                          isSelected
                            ? "border-2 border-[#1d4538] shadow-xs"
                            : "border-[#17251f]/10 opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={mediaSrc(img.url) ?? ""}
                          alt="Miniature"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Price & Primary Details Column */}
            <div className="flex flex-col justify-between" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div>
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-[#78827b]">
                  <span>
                    {pick(lang, product.condition, product.conditionAr)}
                  </span>
                  <span>•</span>
                  <span>
                    {`${product.stock} en stock`}
                  </span>
                  {product.sold > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-bold text-[#1d4538]">
                        {`${product.sold} vendus`}
                      </span>
                    </>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-2">
                  <h2 className={`text-xl font-bold tracking-tight text-[#17251f] ${lang === "ar" ? "font-arabic" : ""}`}>
                    {pick(lang, product.name, product.nameAr)}
                  </h2>
                  {lang === "fr" && product.nameAr && (
                    <span className="rounded bg-[#e0ebe1] px-2 py-0.5 font-arabic text-sm font-semibold text-[#1d4538]">
                      {product.nameAr}
                    </span>
                  )}
                </div>

                <p className={`mt-2 text-xs leading-5 text-[#58675f] ${lang === "ar" ? "font-arabic" : ""}`}>
                  {pick(lang, product.specs, product.specsAr)}
                </p>

                {/* Price Display */}
                <div className="mt-4 rounded-xl border border-[#17251f]/10 bg-[#f8f7f2] p-3.5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-2xl font-extrabold text-[#17251f] whitespace-nowrap">
                      {fmtDA(displayPrice, lang)}
                    </span>
                    {product.promoPrice !== null && (
                      <span className="font-mono text-sm font-semibold text-[#78827b] line-through whitespace-nowrap">
                        {fmtDA(product.price, lang)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Public Link CTA */}
              <div className="mt-5 border-t border-[#17251f]/10 pt-4">
                <Link
                  href={`/produit/${product.id}`}
                  target="_blank"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1d4538] py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-[#16352b]"
                >
                  <span>Voir la fiche sur la boutique</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Section 1: Filter Attributes & Chips */}
          <div className="rounded-2xl border border-[#17251f]/10 bg-white p-5 shadow-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
            <div className="mb-3 flex items-center gap-2 border-b border-[#17251f]/10 pb-2.5">
              <Tag className="h-4 w-4 text-[#1d4538]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#17251f]">
                Attributs &amp; Filtres catalogue
              </h3>
            </div>

            {Object.keys(product.attributes).length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(product.attributes).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-[#17251f]/10 bg-[#fbfcfb] px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-[10px] font-medium uppercase text-[#78827b]">
                      {key}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#17251f]">
                      {Array.isArray(val) ? val.join(", ") : val || "—"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs italic text-[#78827b]">
                Aucun attribut défini.
              </p>
            )}
          </div>

          {/* Section 2: Full Description */}
          {(pick(lang, product.description, product.descriptionAr)) && (
            <div className="rounded-2xl border border-[#17251f]/10 bg-white p-5 shadow-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="mb-3 flex items-center gap-2 border-b border-[#17251f]/10 pb-2.5">
                <Sparkles className="h-4 w-4 text-[#1d4538]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17251f]">
                  Description éditoriale
                </h3>
              </div>
              <div className={`prose max-w-none text-xs leading-6 text-[#17251f] ${lang === "ar" ? "font-arabic" : ""}`}>
                {pick(lang, product.description, product.descriptionAr)}
              </div>
            </div>
          )}

          {/* Section 3: Configurations / Variants */}
          {product.configurations.length > 0 && (
            <div className="rounded-2xl border border-[#17251f]/10 bg-white p-5 shadow-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="mb-3 flex items-center gap-2 border-b border-[#17251f]/10 pb-2.5">
                <Layers className="h-4 w-4 text-[#1d4538]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17251f]">
                  {`Options & Configurations (${product.configurations.length})`}
                </h3>
              </div>
              <div className="space-y-2">
                {product.configurations.map((config, idx) => {
                  const label = pick(lang, config.label, config.labelAr);
                  const sub = pick(lang, config.sub, config.subAr);
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#17251f]/10 bg-[#f9faf8] p-3 text-xs"
                    >
                      <div>
                        <span className={`font-semibold text-[#17251f] ${lang === "ar" ? "font-arabic" : ""}`}>
                          {label}
                        </span>
                        {sub && (
                          <span className={`mx-2 font-mono text-[11px] text-[#58675f] ${lang === "ar" ? "font-arabic" : ""}`}>
                            ({sub})
                          </span>
                        )}
                      </div>
                      {config.price != null && (
                        <span className="font-mono text-xs font-bold text-[#1d4538] whitespace-nowrap">
                          {fmtDA(config.price, lang)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Livraison & Promesses */}
          {((pick(lang, product.deliveryNote, product.deliveryNoteAr)) ||
            product.promises.length > 0) && (
            <div className="rounded-2xl border border-[#17251f]/10 bg-white p-5 shadow-xs" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div className="mb-3 flex items-center gap-2 border-b border-[#17251f]/10 pb-2.5">
                <Truck className="h-4 w-4 text-[#1d4538]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#17251f]">
                  Livraison &amp; Engagements
                </h3>
              </div>
              {(pick(lang, product.deliveryNote, product.deliveryNoteAr)) && (
                <p className={`mb-3 text-xs leading-5 text-[#58675f] ${lang === "ar" ? "font-arabic" : ""}`}>
                  {pick(lang, product.deliveryNote, product.deliveryNoteAr)}
                </p>
              )}
              {product.promises.length > 0 && (
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {product.promises.map((p, idx) => {
                    const title = pick(lang, p.title, p.titleAr);
                    const text = pick(lang, p.text, p.textAr);
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-[#17251f]/10 bg-[#f8f7f2] p-3"
                      >
                        <span className={`font-mono text-xs font-bold text-[#1d4538] ${lang === "ar" ? "font-arabic" : ""}`}>
                          {title}
                        </span>
                        <p className={`mt-1 text-[11px] text-[#58675f] ${lang === "ar" ? "font-arabic" : ""}`}>{text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-[#17251f]/10 bg-white px-6 py-3.5">
          <span className="font-mono text-[10px] text-[#78827b]">
            Créé le {new Date(product.createdAt).toLocaleDateString("fr-FR")}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-xl border border-[#17251f]/15 bg-white px-5 py-2 font-mono text-xs font-bold uppercase text-[#17251f] transition hover:bg-[#f4f7f3]"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>,
    document.body,
  );
}

