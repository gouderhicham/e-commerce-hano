"use client";

import { useMemo } from "react";
import {
  Image as ImageIcon,
  Plus,
  Star,
  Trash2,
  Wand2,
} from "lucide-react";
import { mediaSrc } from "@/lib/api-client";
import { fmtDA, fmtN, parseDA } from "@/lib/format";
import { DELIVERY_NOTE_AR } from "@/lib/shop-config";
import {
  Warning,
  hintCls,
  ghostBtn,
  inputCls,
  labelCls,
  primaryBtn,
  sectionCls,
  smallInputCls,
} from "@/components/admin/ui";
import type {
  CategoryWithCount,
  ConfigOption,
  ProductPromise,
  PromiseIcon,
  TagGroup,
} from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see accueil-client.tsx. */

/** Palette of catalogue-thumbnail backgrounds offered by the picker. */
export const TONE_SWATCHES = [
  "#e3ece3",
  "#e9e6dd",
  "#e0e9ec",
  "#eee5d7",
  "#e7eee3",
  "#eee7dd",
  "#e2ecec",
  "#e9e8de",
  "#e7e1d5",
  "#e3ebdf",
  "#e0e7ea",
  "#eae3d8",
  "#e5ece4",
  "#ebe6dd",
];

/** One gallery slot: either an existing image row, or a newly picked file. */
export interface GallerySlot {
  /** ProductImage id — present when the image already exists server-side. */
  id?: number;
  /** Already-hosted URL (seeded asset, or an existing row's URL). */
  url?: string;
  /** Freshly picked file, uploaded on save. */
  file?: File;
  /** Object URL for previewing `file`. */
  preview?: string;
}

/** Everything the form edits. Mirrors the storefront field-for-field. */
export interface ProductDraft {
  id?: number;
  reference: string;
  name: string;
  nameAr: string;
  categoryId: string;
  condition: string;
  conditionAr: string;
  tone: string;
  stock: number;
  active: boolean;

  price: number | null;
  promoPrice: number | null;

  specs: string;
  specsAr: string;
  attributes: Record<string, string | string[]>;

  gallery: GallerySlot[];
  coverIndex: number;

  description: string;
  descriptionAr: string;
  configurations: ConfigOption[];
  deliveryNote: string;
  deliveryNoteAr: string;
  promises: ProductPromise[];
}

export const emptyDraft = (
  categoryId: string,
  deliveryNote: string,
): ProductDraft => ({
  reference: "",
  name: "",
  nameAr: "",
  categoryId,
  condition: "État excellent",
  conditionAr: "حالة ممتازة",
  tone: TONE_SWATCHES[0],
  stock: 0,
  active: true,
  price: null,
  promoPrice: null,
  specs: "",
  specsAr: "",
  attributes: {},
  gallery: [],
  coverIndex: 0,
  description: "",
  descriptionAr: "",
  configurations: [],
  deliveryNote,
  deliveryNoteAr: DELIVERY_NOTE_AR,
  promises: [
    {
      icon: "check",
      title: "Machine 100% Fonctionnelle",
      titleAr: "جهاز يعمل بنسبة 100%",
      text: "Testée et nettoyée par notre atelier.",
      textAr: "تم الفحص والتنظيف الشامل بورشاتنا.",
    },
    {
      icon: "shield",
      title: "1 mois de garantie",
      titleAr: "ضمان ورشة لمدة شهر",
      text: "Pour acheter avec sérénité.",
      textAr: "لتتسوق بكل طمأنينة وأمان.",
    },
    {
      icon: "plug",
      title: "Chargeur inclus",
      titleAr: "الشاحن الأصلي مشمول",
      text: "Prêt dès l'ouverture du colis.",
      textAr: "جاهز للاستخدام فور استلام الطرد.",
    },
  ],
});

/**
 * Arabic columns the storefront reads. An empty one is not fatal — the fiche
 * falls back to French — but it means an Arabic customer silently reads French,
 * so the form surfaces them separately from the hard requirements.
 */
export function missingArabicFields(draft: ProductDraft): string[] {
  const missing: string[] = [];
  if (!draft.nameAr.trim()) missing.push("Nom (AR)");
  if (!draft.specsAr.trim()) missing.push("Résumé specs (AR)");
  if (!draft.descriptionAr.trim()) missing.push("Description (AR)");
  if (draft.promises.some((p) => p.title.trim() && !(p.titleAr ?? "").trim()))
    missing.push("Promesses (AR)");
  if (
    draft.configurations.some((c) => c.label.trim() && !(c.labelAr ?? "").trim())
  ) {
    missing.push("Configurations (AR)");
  }
  return missing;
}

/** Fields the fiche renders — empty means a visible hole on the site. */
export function missingFields(draft: ProductDraft): string[] {
  const missing: string[] = [];
  if (!draft.name.trim()) missing.push("Nom");
  if (!draft.reference.trim()) missing.push("Référence");
  if (!draft.specs.trim()) missing.push("Résumé specs");
  if (!Object.values(draft.attributes).some(Boolean))
    missing.push("Attributs de filtre");
  if (!draft.description.trim()) missing.push("Description");
  if (!draft.gallery.length) missing.push("Galerie");
  if (draft.promises.length !== 3) missing.push("3 promesses");
  return missing;
}

const sectionLabel = (text: string) => (
  <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
    {text}
  </span>
);

export function ProductForm({
  draft,
  categories,
  tagGroups,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  draft: ProductDraft;
  categories: CategoryWithCount[];
  tagGroups: TagGroup[];
  onChange: (next: ProductDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  const set = <K extends keyof ProductDraft>(
    key: K,
    value: ProductDraft[K],
  ) => onChange({ ...draft, [key]: value });

  const category = categories.find((c) => c.id === draft.categoryId);

  const toggleAttribute = (field: string, tagLabel: string) => {
    const attributes = { ...draft.attributes };
    const currentVal = attributes[field];
    const currentList = Array.isArray(currentVal)
      ? currentVal
      : typeof currentVal === "string" && currentVal
        ? [currentVal]
        : [];

    const exists = currentList.includes(tagLabel);
    const nextList = exists
      ? currentList.filter((v) => v !== tagLabel)
      : [...currentList, tagLabel];

    if (nextList.length === 0) {
      delete attributes[field];
    } else if (nextList.length === 1) {
      attributes[field] = nextList[0];
    } else {
      attributes[field] = nextList;
    }
    onChange({ ...draft, attributes });
  };

  // Groups that target this category, plus any group whose value is already set
  // on the product (so a category change never silently orphans an attribute).
  const relevantGroups = useMemo(
    () =>
      tagGroups.filter(
        (g) =>
          g.targets.includes(draft.categoryId) ||
          Boolean(draft.attributes[g.field]),
      ),
    [tagGroups, draft.categoryId, draft.attributes],
  );

  const selectedTagLabels = relevantGroups
    .flatMap((g) => {
      const current = draft.attributes[g.field];
      if (!current) return [];
      const list = Array.isArray(current) ? current : [current];
      return g.tags
        .filter(
          (t) =>
            list.includes(t.label) || (t.value && list.includes(t.value)),
        )
        .map((t) => t.label);
    })
    .filter((l): l is string => Boolean(l));

  const selectedTagLabelsAr = relevantGroups
    .flatMap((g) => {
      const current = draft.attributes[g.field];
      if (!current) return [];
      const list = Array.isArray(current) ? current : [current];
      return g.tags
        .filter(
          (t) =>
            list.includes(t.label) || (t.value && list.includes(t.value)),
        )
        .map((t) => t.labelAr || t.label);
    })
    .filter((l): l is string => Boolean(l));

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const slots: GallerySlot[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    set("gallery", [...draft.gallery, ...slots]);
  };

  const removeSlot = (index: number) => {
    const slot = draft.gallery[index];
    if (slot.preview) URL.revokeObjectURL(slot.preview);
    const gallery = draft.gallery.filter((_, i) => i !== index);
    onChange({
      ...draft,
      gallery,
      coverIndex: Math.min(draft.coverIndex, Math.max(0, gallery.length - 1)),
    });
  };

  const missing = missingFields(draft);
  const missingAr = missingArabicFields(draft);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4 text-xs"
    >
      {/* 01 · Identité ------------------------------------------------ */}
      <div className={sectionCls}>
        {sectionLabel("01 · Identité & visibilité")}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nom du produit * (carte catalogue - Français)</label>
            <input
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex: HP EliteBook 845 G8"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Nom du produit en arabe (العربية)</label>
            <input
              dir="rtl"
              value={draft.nameAr}
              onChange={(e) => set("nameAr", e.target.value)}
              placeholder="مثال: إتش بي إيليت بوك 845 G8"
              className={`${inputCls} font-arabic`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Référence * (unique)</label>
            <input
              required
              value={draft.reference}
              onChange={(e) => set("reference", e.target.value)}
              placeholder="Ex: PC-ELB845-G8"
              className={`${inputCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Catégorie *</label>
            <select
              value={draft.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              className={inputCls}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.nameAr ? ` (${cat.nameAr})` : ""}
                  {cat.filterable ? "" : " (masquée au catalogue)"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {category && !category.filterable && (
          <Warning>
            La sidebar du catalogue ne propose que les catégories marquées
            « Sidebar ». Un produit rangé dans « {category.name} »
            n&apos;apparaîtra dans aucun filtre du frontoffice.
          </Warning>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>État / Condition (Français)</label>
            <input
              value={draft.condition}
              onChange={(e) => set("condition", e.target.value)}
              placeholder="Ex: État excellent"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>État / Condition en arabe (العربية)</label>
            <input
              dir="rtl"
              value={draft.conditionAr}
              onChange={(e) => set("conditionAr", e.target.value)}
              placeholder="مثال: حالة ممتازة"
              className={`${inputCls} font-arabic`}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Stock (unités)</label>
            <input
              type="number"
              min={0}
              value={draft.stock}
              onChange={(e) => set("stock", Math.max(0, Number(e.target.value)))}
              className={inputCls}
            />
            <p className={hintCls}>
              0: Rupture, 1-5: Limité, &gt;5: En stock.
            </p>
          </div>
          <div>
            <label className={labelCls}>Visibilité</label>
            <select
              value={draft.active ? "actif" : "inactif"}
              onChange={(e) => set("active", e.target.value === "actif")}
              className={inputCls}
            >
              <option value="actif">Actif (visible)</option>
              <option value="inactif">Inactif (masqué)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 02 · Prix ---------------------------------------------------- */}
      <div className={sectionCls}>
        {sectionLabel("02 · Prix affiché")}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Prix (DA)</label>
            <input
              value={draft.price !== null && draft.price > 0 ? fmtN(draft.price) : ""}
              onChange={(e) => {
                const v = parseDA(e.target.value);
                set("price", v > 0 ? v : null);
              }}
              placeholder="Vide = Sur commande"
              className={inputCls}
            />
            <p className="mt-1 font-mono text-[10px] text-[#78827b]">
              Rendu site : {fmtDA(draft.price)}
            </p>
          </div>
          <div>
            <label className={labelCls}>Prix promo (DA)</label>
            <input
              value={draft.promoPrice ? fmtN(draft.promoPrice) : ""}
              onChange={(e) => {
                const v = parseDA(e.target.value);
                set("promoPrice", v > 0 ? v : null);
              }}
              placeholder="Aucune promo"
              className={inputCls}
            />
            {draft.promoPrice !== null &&
              draft.price !== null &&
              draft.promoPrice >= draft.price && (
                <p className="mt-1 text-[10px] font-semibold text-red-600">
                  Le prix promo doit être inférieur au prix.
                </p>
              )}
          </div>
        </div>
      </div>

      {/* 03 · Carte catalogue & filtres ------------------------------- */}
      <div className={sectionCls}>
        {sectionLabel("03 · Carte catalogue & filtres")}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>
              Résumé specs * (carte catalogue - Français)
            </label>
            <input
              required
              value={draft.specs}
              onChange={(e) => set("specs", e.target.value)}
              placeholder="Ex: Ryzen 5 Pro · 6 cœurs · 16 Go · 3200 MHz · 512 Go SSD"
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => set("specs", selectedTagLabels.join(" · "))}
              disabled={!selectedTagLabels.length}
              className="mt-1 inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline disabled:opacity-40"
            >
              <Wand2 className="h-3 w-3" /> Composer depuis les attributs
            </button>
          </div>

          <div>
            <label className={labelCls}>
              Résumé specs en arabe (العربية)
            </label>
            <input
              dir="rtl"
              value={draft.specsAr}
              onChange={(e) => set("specsAr", e.target.value)}
              placeholder="مثال: رايزن 5 برو · 6 أنوية · 16 جيجابايت · 512 جيجابايت SSD"
              className={`${inputCls} font-arabic`}
            />
            <button
              type="button"
              onClick={() => set("specsAr", selectedTagLabelsAr.join(" · "))}
              disabled={!selectedTagLabelsAr.length}
              className="mt-1 inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline disabled:opacity-40"
            >
              <Wand2 className="h-3 w-3" /> Composer en arabe depuis les attributs
            </button>
            <p className={hintCls}>Sous-titre de la carte en version arabe.</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-[#1d4538]/20 bg-[#edf3ee] p-3.5">
          <div className="flex items-center justify-between border-b border-[#1d4538]/15 pb-2">
            <span className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
              Attributs filtrables (sidebar catalogue)
            </span>
            <span className="text-[10px] text-[#627269]">Sélection multiple autorisée</span>
          </div>

          {relevantGroups.length === 0 ? (
            <p className="text-[10.5px] font-medium text-[#627269]">
              Aucun groupe de filtres ne cible « {category?.name ?? "cette catégorie"} ».
            </p>
          ) : (
            relevantGroups.map((group) => {
              const current = draft.attributes[group.field];
              const currentList = Array.isArray(current)
                ? current
                : typeof current === "string" && current
                  ? [current]
                  : [];

              return (
                <div key={group.id}>
                  <div className="mb-1.5 flex items-baseline gap-2 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
                    <span>{group.name}</span>
                    {group.nameAr && (
                      <span className="font-arabic font-semibold normal-case text-[#2c5b48]">
                        ({group.nameAr})
                      </span>
                    )}
                    {!group.targets.includes(draft.categoryId) && (
                      <span className="font-sans text-[9px] font-semibold normal-case text-amber-700">
                        (hors catégorie)
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((tag) => {
                      const active =
                        currentList.includes(tag.label) ||
                        (tag.value ? currentList.includes(tag.value) : false);

                      return (
                        <button
                          key={tag.label}
                          type="button"
                          onClick={() =>
                            toggleAttribute(group.field, tag.label)
                          }
                          className={`cursor-pointer rounded-md border px-2.5 py-1 text-[10.5px] font-medium transition ${
                            active
                              ? "border-[#1d4538] bg-[#1d4538] font-semibold text-white shadow-2xs"
                              : "border-[#17251f]/15 bg-white text-[#17251f] hover:border-[#1d4538]/50"
                          }`}
                        >
                          <span className="font-mono">{active ? "✓ " : "+ "}</span>
                          <span>{tag.label}</span>
                          {tag.labelAr && tag.labelAr !== tag.label && (
                            <span className={`ml-1.5 font-arabic text-[10px] ${active ? "text-[#d7e6d9]" : "text-[#627269]"}`}>
                              ({tag.labelAr})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 04 · Visuels ------------------------------------------------- */}
      <div className={sectionCls}>
        {sectionLabel("04 · Visuels")}

        <div>
          <div className="mb-2.5 flex items-center justify-between border-b border-[#17251f]/10 pb-2">
            <label className={`${labelCls} mb-0`}>
              Galerie fiche produit ({draft.gallery.length})
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline">
              <Plus className="h-3 w-3" /> Ajouter des images
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>
          </div>

          {draft.gallery.length === 0 && (
            <p className="text-[10.5px] font-medium text-[#a06b1f]">
              Sans galerie, le slider de la fiche produit reste vide.
            </p>
          )}

          <div className="light-scrollbar max-h-56 space-y-2 overflow-y-auto pr-1">
            {draft.gallery.map((slot, idx) => {
              const src = slot.preview ?? mediaSrc(slot.url ?? null) ?? "";
              return (
                <div
                  key={`${slot.id ?? slot.url ?? "new"}-${idx}`}
                  className="flex items-center gap-2 rounded-xl border border-[#17251f]/10 bg-white p-2"
                >
                  <span className="grid h-10 w-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#e0ebe1]">
                    {src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-full w-full object-cover mix-blend-multiply"
                      />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-[#78827b]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#627269]">
                    {slot.file ? slot.file.name : (slot.url ?? "—")}
                  </span>
                  <button
                    type="button"
                    title="Utiliser comme image principale"
                    aria-label="Définir comme couverture"
                    onClick={() => set("coverIndex", idx)}
                    className="shrink-0 cursor-pointer rounded-lg p-1.5 text-[#1d4538] transition hover:bg-[#edf3ee]"
                  >
                    <Star
                      className={`h-3.5 w-3.5 ${
                        draft.coverIndex === idx ? "fill-[#1d4538]" : ""
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSlot(idx)}
                    aria-label="Supprimer l'image"
                    className="shrink-0 cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
          <p className={hintCls}>
            JPEG, PNG ou WebP, 5 Mo max. L&apos;étoile désigne la vignette du
            catalogue.
          </p>
        </div>
      </div>

      {/* 05 · Fiche produit ------------------------------------------- */}
      <div className={sectionCls}>
        {sectionLabel("05 · Fiche produit")}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Description (Français - sous le titre)</label>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${inputCls} resize-y font-normal`}
            />
          </div>

          <div>
            <label className={labelCls}>Description en arabe (العربية)</label>
            <textarea
              dir="rtl"
              rows={3}
              value={draft.descriptionAr}
              onChange={(e) => set("descriptionAr", e.target.value)}
              className={`${inputCls} resize-y font-arabic font-normal`}
            />
            <p className={hintCls}>Texte d&apos;accroche sous le titre pour clients en arabe.</p>
          </div>
        </div>

        <div>
          <div className="mb-2.5 flex items-center justify-between border-b border-[#17251f]/10 pb-2">
            <label className={`${labelCls} mb-0`}>
              Configuration choisie ({draft.configurations.length})
            </label>
            <button
              type="button"
              onClick={() =>
                set("configurations", [
                  ...draft.configurations,
                  { label: "16 Go / 512 Go", labelAr: "16 جيجابايت / 512 جيجابايت", sub: "Précision", subAr: "مواصفات" },
                ])
              }
              className="inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline"
            >
              <Plus className="h-3 w-3" /> Ajouter une configuration
            </button>
          </div>

          <div className="space-y-3">
            {draft.configurations.length === 0 && (
              <p className="text-[10.5px] font-medium text-[#627269]">
                Aucune configuration : le bloc est masqué sur la fiche.
              </p>
            )}
            {draft.configurations.map((config, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-xl border border-[#17251f]/10 bg-white p-3 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-[9px] font-bold text-[#78827b]">
                    {idx === 0 ? "ACTIVE" : `0${idx + 1}`}
                  </span>
                  <input
                    value={config.label}
                    onChange={(e) => {
                      const next = [...draft.configurations];
                      next[idx] = { ...next[idx], label: e.target.value };
                      set("configurations", next);
                    }}
                    placeholder="Libellé FR (ex: 256 Go SSD)"
                    className={`${smallInputCls} font-semibold`}
                  />
                  <input
                    dir="rtl"
                    value={config.labelAr ?? ""}
                    onChange={(e) => {
                      const next = [...draft.configurations];
                      next[idx] = { ...next[idx], labelAr: e.target.value };
                      set("configurations", next);
                    }}
                    placeholder="الاسم بالعربية (مثال: 256 جيجابايت SSD)"
                    className={`${smallInputCls} font-arabic font-semibold`}
                  />
                  <input
                    value={config.price ? fmtN(config.price) : ""}
                    onChange={(e) => {
                      const v = parseDA(e.target.value);
                      const next = [...draft.configurations];
                      next[idx] = { ...next[idx], price: v > 0 ? v : null };
                      set("configurations", next);
                    }}
                    placeholder="Prix (DA)"
                    className={`${smallInputCls} w-24 font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "configurations",
                        draft.configurations.filter((_, i) => i !== idx),
                      )
                    }
                    aria-label="Supprimer"
                    className="shrink-0 cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 pl-6">
                  <input
                    value={config.sub}
                    onChange={(e) => {
                      const next = [...draft.configurations];
                      next[idx] = { ...next[idx], sub: e.target.value };
                      set("configurations", next);
                    }}
                    placeholder="Sous-titre FR (ex: 16 Go RAM · 256 Go SSD)"
                    className={smallInputCls}
                  />
                  <input
                    dir="rtl"
                    value={config.subAr ?? ""}
                    onChange={(e) => {
                      const next = [...draft.configurations];
                      next[idx] = { ...next[idx], subAr: e.target.value };
                      set("configurations", next);
                    }}
                    placeholder="تفاصيل بالعربية (مثال: 16 جيجابايت RAM · 256 جيجابايت SSD)"
                    className={`${smallInputCls} font-arabic`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Note sous le bouton de commande (Français)</label>
            <input
              value={draft.deliveryNote}
              onChange={(e) => set("deliveryNote", e.target.value)}
              placeholder="Ex: Livraison en 1 à 3 jours · Retours simples sous 14 jours"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Note sous le bouton en arabe (العربية)</label>
            <input
              dir="rtl"
              value={draft.deliveryNoteAr}
              onChange={(e) => set("deliveryNoteAr", e.target.value)}
              placeholder="مثال: توصيل سريع إلى 69 ولاية · الدفع نقداً عند الاستلام"
              className={`${inputCls} font-arabic`}
            />
          </div>
        </div>

        <div>
          <div className="mb-2.5 border-b border-[#17251f]/10 pb-2">
            <label className={`${labelCls} mb-0`}>
              Les 3 cartes de réassurance
            </label>
          </div>
          <div className="space-y-3">
            {draft.promises.map((promise, idx) => (
              <div
                key={idx}
                className="space-y-2 rounded-xl border border-[#17251f]/10 bg-white p-3 shadow-2xs"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0 font-mono text-[9px] font-bold text-[#78827b]">
                    0{idx + 1}
                  </span>
                  <select
                    value={promise.icon}
                    onChange={(e) => {
                      const next = [...draft.promises];
                      next[idx] = {
                        ...next[idx],
                        icon: e.target.value as PromiseIcon,
                      };
                      set("promises", next);
                    }}
                    className="w-24 shrink-0 cursor-pointer rounded-lg border border-[#17251f]/15 bg-white p-2 text-[11px] font-semibold outline-none focus:border-[#1d4538]"
                  >
                    <option value="check">Check</option>
                    <option value="shield">Garantie</option>
                    <option value="plug">Prise</option>
                  </select>
                  <input
                    value={promise.title}
                    onChange={(e) => {
                      const next = [...draft.promises];
                      next[idx] = { ...next[idx], title: e.target.value };
                      set("promises", next);
                    }}
                    placeholder="Titre FR"
                    className={`${smallInputCls} font-semibold`}
                  />
                  <input
                    dir="rtl"
                    value={promise.titleAr ?? ""}
                    onChange={(e) => {
                      const next = [...draft.promises];
                      next[idx] = { ...next[idx], titleAr: e.target.value };
                      set("promises", next);
                    }}
                    placeholder="العنوان بالعربية"
                    className={`${smallInputCls} font-arabic font-semibold`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      set(
                        "promises",
                        draft.promises.filter((_, i) => i !== idx),
                      )
                    }
                    aria-label="Supprimer"
                    className="shrink-0 cursor-pointer rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 pl-6">
                  <input
                    value={promise.text}
                    onChange={(e) => {
                      const next = [...draft.promises];
                      next[idx] = { ...next[idx], text: e.target.value };
                      set("promises", next);
                    }}
                    placeholder="Texte explicatif FR"
                    className={smallInputCls}
                  />
                  <input
                    dir="rtl"
                    value={promise.textAr ?? ""}
                    onChange={(e) => {
                      const next = [...draft.promises];
                      next[idx] = { ...next[idx], textAr: e.target.value };
                      set("promises", next);
                    }}
                    placeholder="النص التوضيحي بالعربية"
                    className={`${smallInputCls} font-arabic`}
                  />
                </div>
              </div>
            ))}
            {draft.promises.length < 3 && (
              <button
                type="button"
                onClick={() =>
                  set("promises", [
                    ...draft.promises,
                    { icon: "check", title: "Nouvelle promesse", titleAr: "ميزة جديدة", text: "", textAr: "" },
                  ])
                }
                className="inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline"
              >
                <Plus className="h-3 w-3" /> Ajouter une carte (3 attendues)
              </button>
            )}
          </div>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10.5px] font-medium text-amber-900">
          <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase">
            Champs manquants pour une fiche complète
          </span>
          <p className="mt-1.5">{missing.join(" · ")}</p>
        </div>
      )}

      {missingAr.length > 0 && (
        <div className="rounded-xl border border-[#17251f]/12 bg-[#f1f5f0] p-3 text-[10.5px] font-medium text-[#3d5a4c]">
          <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-bold uppercase">
            Traductions arabes manquantes
          </span>
          <p className="mt-1.5">{missingAr.join(" · ")}</p>
          <p className="mt-1.5 text-[10px] text-[#5c7466]">
            La fiche reste publiable : ces champs afficheront le texte français
            aux clients arabophones.
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className={`${ghostBtn} flex-1 py-3`}
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={busy}
          className={`${primaryBtn} flex-1 py-3`}
        >
          {busy ? "Enregistrement…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
