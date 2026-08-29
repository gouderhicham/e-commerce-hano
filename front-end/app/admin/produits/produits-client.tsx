"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Eye, Plus, Search, Trash2, X } from "lucide-react";

import { apiFetch, mediaSrc } from "@/lib/api-client";
import { fmtDA } from "@/lib/format";
import { AVAILABILITY_LABELS, AVAILABILITY_PILLS } from "@/lib/labels";
import {
  Card,
  ErrorBanner,
  PageHeader,
  Pill,
  SavedBanner,
  TabChip,
  dangerBtn,
  primaryBtn,
} from "@/components/admin/ui";
import { Modal } from "@/components/ui/modal";
import {
  ProductForm,
  emptyDraft,
  missingFields,
  type GallerySlot,
  type ProductDraft,
} from "./product-form";
import { ProductDetailModal } from "./product-detail-modal";
import { DELIVERY_NOTE } from "@/lib/shop-config";
import type {
  CategoryWithCount,
  ProductPublic,
  TagGroup,
} from "@/lib/data/types";
import { compressImage } from "@/lib/image-compress";

/* eslint-disable @next/next/no-img-element -- see accueil-client.tsx. */

/** Turn a stored product into the shape the form edits. */
function toDraft(product: ProductPublic): ProductDraft {
  const gallery: GallerySlot[] = product.images.map((img) => ({
    id: img.id,
    url: img.url,
  }));
  const coverIndex = Math.max(
    product.images.findIndex((img) => img.isCover),
    0,
  );
  return {
    id: product.id,
    reference: product.reference,
    name: product.name,
    nameAr: product.nameAr ?? "",
    categoryId: product.categoryId,
    condition: product.condition,
    conditionAr: product.conditionAr ?? "",
    tone: product.tone,
    stock: product.stock,
    active: product.active,
    price: product.price,
    promoPrice: product.promoPrice,
    specs: product.specs,
    specsAr: product.specsAr ?? "",
    attributes: { ...product.attributes },
    gallery,
    coverIndex,
    description: product.description,
    descriptionAr: product.descriptionAr ?? "",
    configurations: product.configurations.map((c) => ({ ...c })),
    deliveryNote: product.deliveryNote,
    deliveryNoteAr: product.deliveryNoteAr ?? "",
    promises: product.promises.map((p) => ({ ...p })),
  };
}

/**
 * Build the multipart body. New files ride along as repeated `images` fields;
 * `imageOrder` tells the backend how to reassemble the gallery from existing
 * rows, already-hosted URLs and the freshly uploaded files (by index).
 */
async function toFormData(draft: ProductDraft): Promise<FormData> {
  const fd = new FormData();
  fd.set("reference", draft.reference.trim());
  fd.set("name", draft.name.trim());
  if (draft.nameAr.trim()) fd.set("nameAr", draft.nameAr.trim());
  fd.set("categoryId", draft.categoryId);
  fd.set("condition", draft.condition);
  if (draft.conditionAr.trim()) fd.set("conditionAr", draft.conditionAr.trim());
  fd.set("tone", draft.tone);
  fd.set("stock", String(draft.stock));
  fd.set("active", String(draft.active));
  fd.set("price", draft.price === null ? "" : String(draft.price));
  fd.set("promoPrice", draft.promoPrice === null ? "" : String(draft.promoPrice));
  fd.set("specs", draft.specs);
  if (draft.specsAr.trim()) fd.set("specsAr", draft.specsAr.trim());
  fd.set("attributes", JSON.stringify(draft.attributes));
  fd.set("description", draft.description);
  if (draft.descriptionAr.trim()) fd.set("descriptionAr", draft.descriptionAr.trim());
  fd.set("configurations", JSON.stringify(draft.configurations));
  fd.set("deliveryNote", draft.deliveryNote);
  if (draft.deliveryNoteAr.trim()) fd.set("deliveryNoteAr", draft.deliveryNoteAr.trim());
  fd.set("promises", JSON.stringify(draft.promises));

  // Compress before uploading: these bytes end up in Postgres, so a phone
  // photo has to become a ~150 KB WebP rather than a 5 MB JPEG.
  let newIndex = 0;
  const order: ({ newIndex: number } | { id: number } | { url: string })[] = [];
  for (const slot of draft.gallery) {
    if (slot.file) {
      fd.append("images", await compressImage(slot.file));
      order.push({ newIndex: newIndex++ });
    } else if (slot.id !== undefined) {
      order.push({ id: slot.id });
    } else if (slot.url !== undefined) {
      order.push({ url: slot.url });
    }
    // A slot with no file, no id and no url references nothing — skip it
    // rather than sending an entry the server would silently drop anyway.
  }
  fd.set("imageOrder", JSON.stringify(order));
  fd.set("coverIndex", String(draft.coverIndex));
  return fd;
}

export function ProduitsClient({
  initialProducts = [],
  categories: initialCategories = [],
  tagGroups: initialTagGroups = [],
  focusProductId,
}: {
  initialProducts?: ProductPublic[];
  categories?: CategoryWithCount[];
  tagGroups?: TagGroup[];
  /** `?product=<id>` — a stock notification asking for this fiche. */
  focusProductId?: number | null;
}) {
  const router = useRouter();
  const [products, setProducts] = useState<ProductPublic[]>(initialProducts);
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [tagGroups, setTagGroups] = useState<TagGroup[]>(initialTagGroups);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<"Tous" | string>("Tous");
  const [creating, setCreating] = useState<ProductDraft | null>(null);
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  // `?product=<id>` (a stock notification) opens that fiche on first paint.
  const [preview, setPreview] = useState<ProductPublic | null>(
    () => initialProducts.find((p) => p.id === focusProductId) ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const reload = async () => {
    try {
      const [pRes, cRes, tRes] = await Promise.all([
        apiFetch("/api/admin/products?page=1"),
        apiFetch("/api/categories"),
        apiFetch("/api/tag-groups"),
      ]);
      if (pRes.ok) {
        const first = (await pRes.json()) as {
          items: ProductPublic[];
          pageCount: number;
        };
        const all = [...first.items];
        for (let page = 2; page <= first.pageCount; page++) {
          const next = await apiFetch(`/api/admin/products?page=${page}`);
          if (!next.ok) break;
          const body = (await next.json()) as { items: ProductPublic[] };
          all.push(...body.items);
        }
        setProducts(all);
        if (focusProductId) {
          const found = all.find((p) => p.id === focusProductId);
          if (found) setPreview(found);
        }
      }
      if (cRes.ok) {
        const cats = (await cRes.json()) as CategoryWithCount[];
        setCategories(cats);
      }
      if (tRes.ok) {
        const tags = (await tRes.json()) as TagGroup[];
        setTagGroups(tags);
      }
    } catch {
      /* ignore fetch errors */
    }
  };

  useEffect(() => {
    if (initialProducts.length > 0) return;
    let alive = true;
    const fetchAll = async () => {
      try {
        const [pRes, cRes, tRes] = await Promise.all([
          apiFetch("/api/admin/products?page=1"),
          apiFetch("/api/categories"),
          apiFetch("/api/tag-groups"),
        ]);
        if (!alive) return;
        if (pRes.ok) {
          const first = (await pRes.json()) as {
            items: ProductPublic[];
            pageCount: number;
          };
          const all = [...first.items];
          for (let page = 2; page <= first.pageCount; page++) {
            const next = await apiFetch(`/api/admin/products?page=${page}`);
            if (!next.ok || !alive) break;
            const body = (await next.json()) as { items: ProductPublic[] };
            all.push(...body.items);
          }
          if (alive) {
            setProducts(all);
            if (focusProductId) {
              const found = all.find((p) => p.id === focusProductId);
              if (found) setPreview(found);
            }
          }
        }
        if (alive && cRes.ok) {
          const cats = (await cRes.json()) as CategoryWithCount[];
          setCategories(cats);
        }
        if (alive && tRes.ok) {
          const tags = (await tRes.json()) as TagGroup[];
          setTagGroups(tags);
        }
      } catch {
        /* ignore fetch errors */
      }
    };
    void fetchAll();
    return () => {
      alive = false;
    };
  }, [initialProducts.length, focusProductId]);

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? id;
  const isFilterable = (id: string) =>
    categories.find((c) => c.id === id)?.filterable ?? false;

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(""), 2500);
  };

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchCat = catFilter === "Tous" || p.categoryId === catFilter;
        const haystack =
          `${p.name} ${p.reference} ${categoryName(p.categoryId)} ${p.specs} ` +
          Object.values(p.attributes).flat().join(" ");
        return (
          matchCat && haystack.toLowerCase().includes(search.toLowerCase())
        );
      }),
    // categoryName reads `categories`, which never changes on this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, catFilter, search],
  );

  const submit = async (draft: ProductDraft, isNew: boolean) => {
    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(
        isNew ? "/api/admin/products" : `/api/admin/products/${draft.id}`,
        { method: isNew ? "POST" : "PATCH", body: await toFormData(draft) },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
          errors?: Record<string, string>;
        } | null;
        setError(
          payload?.errors
            ? Object.values(payload.errors)[0]
            : (payload?.error ?? "Enregistrement impossible."),
        );
        return;
      }
      await reload();
      setCreating(null);
      setEditing(null);
      flash(isNew ? "Produit créé." : "Produit mis à jour.");
      router.refresh();
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (product: ProductPublic) => {
    if (!confirm(`Supprimer définitivement « ${product.name} » ?`)) return;
    const res = await apiFetch(`/api/admin/products/${product.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      flash("Produit supprimé.");
      router.refresh();
    } else {
      setError("Suppression impossible.");
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Catalogue Équipements"
        title={`Gestion des Produits & Fiches (${filtered.length})`}
        hint="Chaque champ correspond à un élément réellement affiché sur la carte catalogue ou la fiche produit."
        action={
          <button
            type="button"
            onClick={() =>
              setCreating(emptyDraft(categories[0]?.id ?? "", DELIVERY_NOTE))
            }
            className={primaryBtn}
          >
            <Plus className="h-4 w-4" />
            <span>Nouveau produit</span>
          </button>
        }
      />

      {saved && <SavedBanner>{saved}</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <Card className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] px-3.5 py-2 sm:w-80">
          <Search className="h-4 w-4 text-[#627269]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un modèle, spec, attribut..."
            aria-label="Rechercher un produit"
            className="w-full bg-transparent text-xs font-medium outline-none"
          />
        </div>

        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:pb-0">
          <TabChip
            label="Tous"
            count={products.length}
            active={catFilter === "Tous"}
            onClick={() => setCatFilter("Tous")}
          />
          {categories.map((cat) => (
            <TabChip
              key={cat.id}
              label={cat.name}
              count={products.filter((p) => p.categoryId === cat.id).length}
              active={catFilter === cat.id}
              onClick={() => setCatFilter(cat.id)}
            />
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-[#627269]">
            Aucun produit ne correspond à cette recherche.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const gaps = missingFields(toDraft(item));
            const attributeValues = Object.values(item.attributes)
              .flat()
              .filter(Boolean);
            return (
              <article
                key={item.id}
                className="group flex flex-col justify-between rounded-2xl border border-[#17251f]/12 bg-[#fdfcf8] p-4 transition-all duration-300 hover:border-[#1d4538]/30 hover:shadow-xl"
              >
                <div
                  className="relative h-52 overflow-hidden rounded-xl"
                  style={{ backgroundColor: item.tone }}
                >
                  <span className="absolute right-3 top-3 z-10">
                    <Pill
                      label={AVAILABILITY_LABELS[item.availability]}
                      colors={AVAILABILITY_PILLS[item.availability]}
                    />
                  </span>
                  {!item.active && (
                    <span className="absolute bottom-3 left-3 z-10 rounded-full bg-[#17251f]/80 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-[.1em] text-white">
                      Inactif
                    </span>
                  )}
                  {item.imageUrl && (
                    <img
                      src={mediaSrc(item.imageUrl) ?? ""}
                      alt={item.name}
                      className="h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-105"
                    />
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between px-1 pb-1 pt-4">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-[9px] font-semibold uppercase tracking-[.13em] text-[#78827b]">
                        {categoryName(item.categoryId)}
                        {item.condition ? ` / ${item.condition}` : ""}
                      </p>
                      <span className="shrink-0 rounded bg-[#edf3ee] px-1.5 py-0.5 font-mono text-[8.5px] font-bold text-[#1d4538]">
                        {item.images.length} img
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <h3 className="text-[17px] font-semibold tracking-[-.045em] text-[#17251f]">
                        {item.name}
                      </h3>
                      {item.nameAr && (
                        <span className="rounded bg-[#e0ebe1] px-1.5 py-0.5 font-arabic text-[11px] font-semibold text-[#1d4538]">
                          {item.nameAr}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11.5px] leading-4 text-[#627269]">
                      {item.specs}
                    </p>
                    {item.specsAr && (
                      <p className="mt-0.5 line-clamp-1 font-arabic text-[10.5px] leading-4 text-[#78827b]">
                        {item.specsAr}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-1">
                      {attributeValues.map((value) => (
                        <span
                          key={value}
                          className="rounded border border-[#1d4538]/25 bg-[#edf3ee] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[#1d4538]"
                        >
                          {value}
                        </span>
                      ))}
                      {attributeValues.length === 0 && (
                        <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-800">
                          aucun filtre
                        </span>
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1 font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                      <span className="rounded bg-[#f4f7f3] px-1.5 py-0.5">
                        {item.configurations.length} config.
                      </span>
                      {!isFilterable(item.categoryId) && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                          masqué catalogue
                        </span>
                      )}
                    </div>

                    {gaps.length > 0 && (
                      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-[9.5px] font-medium leading-4 text-amber-900">
                        Fiche incomplète : {gaps.join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 border-t border-[#17251f]/10 pt-3">
                    <div className="mb-3 flex items-baseline justify-between">
                      <div>
                        <b className="font-mono text-[16px] font-bold text-[#17251f]">
                          {fmtDA(item.promoPrice ?? item.price)}
                        </b>
                      </div>
                      <span className="font-mono text-[10px] text-[#78827b]">
                        {item.stock} en stock
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPreview(item)}
                        title="Aperçu de la fiche"
                        className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#1d4538]/30 bg-[#edf3ee] py-1.5 font-mono text-[10px] font-bold uppercase text-[#1d4538] transition hover:bg-[#1d4538] hover:text-white"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Aperçu</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(toDraft(item))}
                        className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#17251f]/15 bg-white py-1.5 font-mono text-[10px] font-bold uppercase text-[#17251f] transition hover:border-[#1d4538] hover:text-[#1d4538]"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Éditer</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(item)}
                        className={`${dangerBtn} justify-center py-1.5`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Effacer</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={!!creating}
        onClose={() => setCreating(null)}
        maxWidth={820}
        closeOnClickOutside={false}
      >
        {creating && (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
              <div>
                <span className="font-mono text-[9.5px] font-bold uppercase text-[#1d4538]">
                  Catalogue &amp; Fiche
                </span>
                <h2 className="text-xl font-bold text-[#17251f]">
                  Nouveau produit complet
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreating(null)}
                aria-label="Fermer"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#58675f] transition hover:bg-[#edf3ee] hover:text-[#17251f]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ProductForm
              draft={creating}
              categories={categories}
              tagGroups={tagGroups}
              onChange={setCreating}
              onSubmit={() => submit(creating, true)}
              onCancel={() => setCreating(null)}
              submitLabel="Enregistrer le produit"
              busy={busy}
            />
          </>
        )}
      </Modal>

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        maxWidth={820}
        closeOnClickOutside={false}
      >
        {editing && (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
              <div>
                <span className="font-mono text-[9.5px] font-bold uppercase text-[#1d4538]">
                  Modification fiche
                </span>
                <h2 className="text-xl font-bold text-[#17251f]">
                  Éditer {editing.name || `produit #${editing.id}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Fermer"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#58675f] transition hover:bg-[#edf3ee] hover:text-[#17251f]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ProductForm
              draft={editing}
              categories={categories}
              tagGroups={tagGroups}
              onChange={setEditing}
              onSubmit={() => submit(editing, false)}
              onCancel={() => setEditing(null)}
              submitLabel="Mettre à jour"
              busy={busy}
            />
          </>
        )}
      </Modal>

      <ProductDetailModal
        product={preview}
        categoryName={preview ? categoryName(preview.categoryId) : ""}
        onClose={() => setPreview(null)}
        onEdit={(prod) => setEditing(toDraft(prod))}
      />
    </div>
  );
}
