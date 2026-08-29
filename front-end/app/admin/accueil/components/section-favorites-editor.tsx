"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { Card, Pill, labelCls } from "@/components/admin/ui";
import { availabilityOf } from "@/lib/data/rules";
import { AVAILABILITY_LABELS, AVAILABILITY_PILLS } from "@/lib/labels";
import { ProductPickerModal } from "./product-picker-modal";
import type { HomeFavoriteItem, ProductPublic } from "@/lib/data/types";


/* eslint-disable @next/next/no-img-element -- admin previews mirror storefront <img> handling */

interface SectionFavoritesEditorProps {
  items: HomeFavoriteItem[];
  products: ProductPublic[];
  onItemsChange: (items: HomeFavoriteItem[]) => void;
}

const cardCls = "p-6 space-y-4";

export function SectionFavoritesEditor({
  items,
  products,
  onItemsChange,
}: SectionFavoritesEditorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const findProduct = (id: number | null) =>
    id ? products.find((p) => p.id === id) : undefined;

  const addFavoriteProduct = (product: ProductPublic) => {
    const newItem: HomeFavoriteItem = {
      id: `fav-${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      spec: product.specs || "",
      price: product.promoPrice ?? product.price ?? 0,
      image: product.imageUrl ?? "",
    };
    onItemsChange([...items, newItem]);
  };

  const removeItem = (index: number) => {
    onItemsChange(items.filter((_, i) => i !== index));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const next = [...items];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    onItemsChange(next);
  };

  return (
    <>
      <Card className={cardCls}>
        <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-3">
          <h2 className="text-base font-medium tracking-tight text-[#17251f]">
            Sélection « Nos favoris »
          </h2>
          <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#78827b]">
            #favoris
          </span>
        </div>

        {/* Selected Favoris Products List */}
        <div>
          <div className="mb-3 flex items-center justify-between border-b border-[#17251f]/10 pb-2">
            <div>
              <label className={`${labelCls} mb-0`}>
                Vignettes « Nos favoris » ({items.length})
              </label>
              <p className="text-[10px] text-[#78827b]">
                Produits choisis depuis le catalogue. Leurs informations sont verrouillées et synchronisées.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPickerOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1d4538] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[.08em] text-white shadow-sm transition hover:bg-[#16352b]"
            >
              <Plus className="h-3.5 w-3.5" /> Choisir un produit du catalogue
            </button>
          </div>

          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const linked = findProduct(item.productId);
              const displayName = linked?.name ?? item.name ?? "Produit sans nom";
              const displaySpec = linked?.specs ?? item.spec ?? "";
              const displayPrice = linked ? (linked.promoPrice ?? linked.price ?? 0) : item.price;
              const displayImage = linked?.imageUrl ?? item.image ?? "";

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-[#17251f]/10 bg-[#fbfcfb] p-3 shadow-xs transition hover:border-[#1d4538]/30"
                >
                  {/* Position Badge */}
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#e7eee5] font-mono text-[11px] font-bold text-[#1d4538]">
                    #{idx + 1}
                  </span>

                  {/* Thumbnail */}
                  <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl border border-[#17251f]/10 bg-white">
                    {displayImage ? (
                      <img
                        src={mediaSrc(displayImage) ?? ""}
                        alt={displayName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[#f4f7f3] text-[9px] text-[#78827b]">
                        Pas d&apos;image
                      </div>
                    )}
                  </div>

                  {/* Locked Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-xs font-semibold text-[#17251f]">
                        {displayName}
                      </h4>
                      {linked && (
                        <a
                          href={`/admin/produits?product=${linked.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Voir la fiche produit"
                          className="inline-flex items-center gap-1 font-mono text-[9px] text-[#1d4538] hover:underline"
                        >
                          <span>#{linked.id}</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    <p className="truncate text-[11px] text-[#58675f]">
                      {displaySpec || "Aucune caractéristique disponible"}
                    </p>

                    <div className="mt-1 flex items-center gap-3 font-mono text-[10px]">
                      <span className="font-bold text-[#1d4538]">
                        {fmtDA(displayPrice > 0 ? displayPrice : null)}
                      </span>
                      {linked && (
                        <Pill
                          label={AVAILABILITY_LABELS[availabilityOf(linked.stock)]}
                          colors={AVAILABILITY_PILLS[availabilityOf(linked.stock)]}
                        />
                      )}
                    </div>
                  </div>

                  {/* Actions: Reorder + Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveItem(idx, "up")}
                      aria-label="Monter"
                      title="Monter"
                      className="cursor-pointer rounded-lg p-1.5 text-[#58675f] transition hover:bg-[#e7eee5] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === items.length - 1}
                      onClick={() => moveItem(idx, "down")}
                      aria-label="Descendre"
                      title="Descendre"
                      className="cursor-pointer rounded-lg p-1.5 text-[#58675f] transition hover:bg-[#e7eee5] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label="Retirer des favoris"
                      title="Retirer des favoris"
                      className="ml-1 cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#17251f]/15 p-8 text-center">
                <p className="font-mono text-xs font-semibold text-[#58675f]">
                  Aucun produit favori sélectionné.
                </p>
                <p className="mt-1 text-[11px] text-[#78827b]">
                  Cliquez sur « Choisir un produit du catalogue » pour ajouter des vignettes.
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <ProductPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        products={products}
        selectedProductIds={items.map((i) => i.productId)}
        onSelectProduct={addFavoriteProduct}
      />
    </>
  );
}

