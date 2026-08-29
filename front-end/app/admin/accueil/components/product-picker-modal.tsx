"use client";

import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import type { ProductPublic } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- admin previews mirror storefront <img> handling */

const subscribe = () => () => {};

interface ProductPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductPublic[];
  selectedProductIds: (number | null)[];
  onSelectProduct: (product: ProductPublic) => void;
}

export function ProductPickerModal({
  isOpen,
  onClose,
  products,
  selectedProductIds,
  onSelectProduct,
}: ProductPickerModalProps) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const [pickerQuery, setPickerQuery] = useState("");

  if (!isOpen || !mounted) return null;


  const filteredProducts = products.filter((p) => {
    const q = pickerQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.specs && p.specs.toLowerCase().includes(q)) ||
      (p.reference && p.reference.toLowerCase().includes(q)) ||
      p.categoryId.toLowerCase().includes(q)
    );
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#17251f]/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#17251f]/15 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#17251f]/10 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight text-[#17251f]">
              Sélectionner un produit du catalogue
            </h3>
            <p className="text-[11px] text-[#58675f]">
              Recherchez et ajoutez un produit à la sélection « Nos favoris ».
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="cursor-pointer rounded-lg p-1.5 text-[#58675f] hover:bg-[#f4f7f3]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Search Input */}
        <div className="border-b border-[#17251f]/10 bg-[#f9faf8] p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78827b]" />
            <input
              type="text"
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Rechercher par nom, référence, processeur, SSD..."
              className="w-full rounded-xl border border-[#17251f]/15 bg-white py-2.5 pl-9 pr-8 text-xs font-semibold text-[#17251f] outline-none focus:border-[#1d4538]"
              autoFocus
            />
            {pickerQuery && (
              <button
                type="button"
                onClick={() => setPickerQuery("")}
                aria-label="Effacer"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#78827b] hover:text-[#17251f]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Product List */}
        <div className="light-scrollbar flex-1 space-y-2 overflow-y-auto p-4">
          {filteredProducts.map((p) => {
            const isAlreadySelected = selectedProductIds.includes(p.id);
            const displayPrice = p.promoPrice ?? p.price;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${
                  isAlreadySelected
                    ? "border-[#17251f]/10 bg-[#f4f7f3]/60 opacity-60"
                    : "border-[#17251f]/10 bg-white hover:border-[#1d4538]/40 hover:shadow-xs"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Image */}
                  <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg border border-[#17251f]/10 bg-[#e0ebe1]">
                    {p.imageUrl ? (
                      <img
                        src={mediaSrc(p.imageUrl) ?? ""}
                        alt={p.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-[#f4f7f3] text-[9px] text-[#78827b]">
                        Pas d&apos;image
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="truncate text-xs font-semibold text-[#17251f]">
                        {p.name}
                      </h4>
                      {p.reference && (
                        <span className="font-mono text-[9px] text-[#78827b]">
                          ({p.reference})
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10.5px] text-[#58675f]">
                      {p.specs || "Aucune spec"}
                    </p>
                    <div className="mt-0.5 font-mono text-[10px] font-bold text-[#1d4538]">
                      {displayPrice !== null ? fmtDA(displayPrice) : "Sur commande"}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  type="button"
                  disabled={isAlreadySelected}
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider transition ${
                    isAlreadySelected
                      ? "bg-[#e7eee5] text-[#78827b]"
                      : "cursor-pointer bg-[#1d4538] text-white hover:bg-[#16352b]"
                  }`}
                >
                  {isAlreadySelected ? "Déjà ajouté" : "Sélectionner"}
                </button>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <p className="py-8 text-center font-mono text-xs text-[#78827b]">
              Aucun produit trouvé pour « {pickerQuery} ».
            </p>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-[#17251f]/10 bg-[#f9faf8] px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-[#17251f]/15 bg-white px-4 py-1.5 text-xs font-semibold text-[#17251f] hover:bg-[#f4f7f3]"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
 
