"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, Upload, Edit3, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import { slugify } from "@/lib/format";
import {
  Card,
  ErrorBanner,
  PageHeader,
  SavedBanner,
  dangerBtn,
  ghostBtn,
  hintCls,
  inputCls,
  labelCls,
  primaryBtn,
} from "@/components/admin/ui";
import { Modal } from "@/components/ui/modal";
import { Toggle } from "@/components/ui/toggle";
import type { CategoryWithCount } from "@/lib/data/types";
import { compressImage } from "@/lib/image-compress";

/* eslint-disable @next/next/no-img-element -- admin previews mirror storefront <img> handling */

interface CategoryDraft {
  id?: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  filterable: boolean;
  imageUrl?: string | null;
  imageFile?: File | null;
}

const emptyDraft = (): CategoryDraft => ({
  name: "",
  nameAr: "",
  description: "",
  descriptionAr: "",
  filterable: true,
  imageUrl: null,
  imageFile: null,
});

function CategoryFormModal({
  draft,
  isOpen,
  onClose,
  onSave,
  busy,
}: {
  draft: CategoryDraft | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: CategoryDraft) => void;
  busy: boolean;
}) {
  const [current, setCurrent] = useState<CategoryDraft>(draft || emptyDraft());
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Reload the form whenever the parent opens it on a different category.
  // Adjusting during render rather than in an effect means the modal never
  // paints one frame holding the previously-edited category's values.
  const [syncedDraft, setSyncedDraft] = useState(draft);
  if (draft && syncedDraft !== draft) {
    setSyncedDraft(draft);
    setCurrent(draft);
    setFilePreview(null);
  }

  if (!isOpen || !draft) return null;

  const generatedSlug = slugify(current.name || "");
  const previewImage = filePreview || (current.imageUrl ? mediaSrc(current.imageUrl) : null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCurrent((prev) => ({ ...prev, imageFile: file }));
      setFilePreview(URL.createObjectURL(file));
    }
  };

  return (
    <Modal open={isOpen} onClose={onClose} maxWidth={640}>
      <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
        <div>
          <span className="font-mono text-[9.5px] font-bold uppercase text-[#1d4538]">
            Gestion Catalogue
          </span>
          <h2 className="text-xl font-bold text-[#17251f]">
            {current.id ? `Éditer la catégorie « ${current.name} »` : "Nouvelle catégorie"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="cursor-pointer rounded-lg p-1 text-[#58675f] hover:bg-[#f4f7f3]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(current);
        }}
        className="space-y-4 text-xs"
      >
        {/* Title FR & AR */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Titre (Français) *</label>
            <input
              required
              value={current.name}
              onChange={(e) => setCurrent({ ...current, name: e.target.value })}
              placeholder="Ex: Ordinateurs portables"
              className={inputCls}
              autoFocus
            />
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-[#78827b]">
              <span>Slug :</span>
              <span className="font-bold text-[#1d4538]">
                {generatedSlug || "—"}
              </span>
            </div>
          </div>

          <div>
            <label className={labelCls}>Titre en arabe (العربية)</label>
            <input
              dir="rtl"
              value={current.nameAr}
              onChange={(e) => setCurrent({ ...current, nameAr: e.target.value })}
              placeholder="مثال: حواسيب محمولة"
              className={`${inputCls} font-arabic`}
            />
            <p className={hintCls}>Affiché pour les clients en langue arabe.</p>
          </div>
        </div>

        {/* Subtitle / Description FR & AR */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Description (Français)</label>
            <input
              value={current.description}
              onChange={(e) => setCurrent({ ...current, description: e.target.value })}
              placeholder="Ex: Pour travailler, créer et avancer."
              className={inputCls}
            />
            <p className={hintCls}>Affiché sous le titre dans l&apos;accueil.</p>
          </div>

          <div>
            <label className={labelCls}>Description en arabe (العربية)</label>
            <input
              dir="rtl"
              value={current.descriptionAr}
              onChange={(e) => setCurrent({ ...current, descriptionAr: e.target.value })}
              placeholder="مثال: للعمل، الإبداع والتطور."
              className={`${inputCls} font-arabic`}
            />
            <p className={hintCls}>Accroche en version arabe.</p>
          </div>
        </div>

        {/* Image File Upload from device */}
        <div>
          <label className={labelCls}>Image (Fichier depuis votre appareil)</label>
          <div className="flex items-center gap-4">
            <div className="relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border border-[#17251f]/15 bg-[#f4f7f3]">
              {previewImage ? (
                <img src={previewImage} alt="Aperçu" className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[#78827b]">
                  <ImageIcon className="h-6 w-6 opacity-50" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#17251f]/15 bg-white px-4 py-2.5 font-mono text-xs font-semibold text-[#17251f] shadow-2xs hover:bg-[#edf3ee] hover:text-[#1d4538]">
                <Upload className="h-4 w-4" />
                <span>{current.imageFile ? current.imageFile.name : "Choisir un fichier d'image…"}</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              <p className={hintCls}>Format PNG, JPEG ou WebP (max 5 Mo).</p>
            </div>
          </div>
        </div>

        {/* Filterable Toggle */}
        <div className="rounded-xl border border-[#17251f]/10 bg-[#fbfcfb] p-3">
          <Toggle
            checked={current.filterable}
            onChange={() => setCurrent({ ...current, filterable: !current.filterable })}
            label="Afficher dans le catalogue (Sidebar)"
          />
        </div>

        {/* Submit Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={`${ghostBtn} flex-1 py-3`}>
            Annuler
          </button>
          <button type="submit" disabled={busy || !current.name.trim()} className={`${primaryBtn} flex-1 py-3`}>
            {busy ? "Enregistrement…" : current.id ? "Mettre à jour" : "Créer la catégorie"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoriesClient({
  initialCategories = [],
}: {
  initialCategories?: CategoryWithCount[];
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryWithCount[]>(initialCategories);
  const [editingDraft, setEditingDraft] = useState<CategoryDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialCategories.length > 0) return;
    let alive = true;
    const fetchAll = async () => {
      try {
        const res = await apiFetch("/api/categories");
        if (alive && res.ok) {
          const data = (await res.json()) as CategoryWithCount[];
          setCategories(data);
        }
      } catch {
        /* ignore fetch errors */
      }
    };
    void fetchAll();
    return () => {
      alive = false;
    };
  }, [initialCategories.length]);

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(""), 2500);
  };

  const handleSave = async (draft: CategoryDraft) => {
    setBusy(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("name", draft.name.trim());
      if (draft.nameAr.trim()) {
        fd.append("nameAr", draft.nameAr.trim());
      }
      fd.append("description", draft.description.trim());
      if (draft.descriptionAr.trim()) {
        fd.append("descriptionAr", draft.descriptionAr.trim());
      }
      fd.append("filterable", String(draft.filterable));
      if (draft.imageFile) {
        // Compressed client-side: the bytes are stored in Postgres.
        fd.append("image", await compressImage(draft.imageFile));
      }

      const res = draft.id
        ? await apiFetch(`/api/admin/categories/${draft.id}`, {
            method: "PATCH",
            body: fd,
          })
        : await apiFetch("/api/admin/categories", {
            method: "POST",
            body: fd,
          });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(payload?.message || "Enregistrement impossible.");
        return;
      }

      const savedCat = (await res.json()) as CategoryWithCount;
      if (draft.id) {
        setCategories((prev) => prev.map((c) => (c.id === savedCat.id ? savedCat : c)));
        flash(`Catégorie « ${savedCat.name} » mise à jour.`);
      } else {
        setCategories((prev) => [...prev, savedCat]);
        flash(`Catégorie « ${savedCat.name} » créée.`);
      }

      setEditingDraft(null);
      router.refresh();
    } catch {
      setError("Erreur lors de la communication avec le serveur.");
    } finally {
      setBusy(false);
    }
  };

  const toggleFilterable = async (category: CategoryWithCount) => {
    const next = !category.filterable;
    setCategories((prev) =>
      prev.map((c) => (c.id === category.id ? { ...c, filterable: next } : c)),
    );

    const fd = new FormData();
    fd.append("filterable", String(next));

    const res = await apiFetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      body: fd,
    });

    if (!res.ok) {
      setCategories((prev) =>
        prev.map((c) => (c.id === category.id ? { ...c, filterable: !next } : c)),
      );
      setError("Impossible de modifier la visibilité.");
    } else {
      router.refresh();
    }
  };

  const deleteCategory = async (category: CategoryWithCount) => {
    if (category.productCount > 0) {
      setError(
        `Impossible de supprimer : la catégorie « ${category.name} » contient ${category.productCount} produit(s). Reattribuez ou supprimez d'abord ces produits.`,
      );
      return;
    }
    if (!confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;

    setBusy(true);
    setError("");
    try {
      const res = await apiFetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== category.id));
        flash(`Catégorie « ${category.name} » supprimée.`);
        router.refresh();
        return;
      }
      const payload = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(payload?.message || "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Gestion du catalogue"
        title={`Catégories (${categories.length})`}
        hint="Les catégories organisent le catalogue et apparaissent sur la page d'accueil et la barre latérale."
        action={
          <button
            type="button"
            onClick={() => setEditingDraft(emptyDraft())}
            className={primaryBtn}
          >
            <Plus className="h-4 w-4" />
            <span>Nouvelle catégorie</span>
          </button>
        }
      />

      {saved && <SavedBanner>{saved}</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#17251f]/10 font-mono text-[9.5px] uppercase tracking-[.14em] text-[#78827b]">
              <tr>
                <th className="pb-3">Visuel</th>
                <th className="pb-3">Catégorie (FR / AR)</th>
                <th className="pb-3">Slug</th>
                <th className="pb-3">Produits</th>
                <th className="pb-3">Catalogue Sidebar</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#17251f]/5 font-medium">
              {categories.map((cat) => (
                <tr key={cat.id} className="transition hover:bg-[#f8faf7]">
                  <td className="py-3">
                    <div className="h-12 w-14 overflow-hidden rounded-lg border border-[#17251f]/10 bg-[#e0ebe1]">
                      {cat.imageUrl ? (
                        <img
                          src={mediaSrc(cat.imageUrl) ?? ""}
                          alt={cat.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center bg-[#f4f7f3] text-[9px] text-[#78827b]">
                          Pas d&apos;image
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#17251f]">{cat.name}</span>
                      {cat.nameAr && (
                        <span className="rounded bg-[#e0ebe1] px-1.5 py-0.5 font-arabic text-[11px] font-semibold text-[#1d4538]">
                          {cat.nameAr}
                        </span>
                      )}
                    </div>
                    {(cat.description || cat.descriptionAr) && (
                      <div className="mt-0.5 text-[11px] text-[#627269]">
                        {cat.description} {cat.descriptionAr && `· ${cat.descriptionAr}`}
                      </div>
                    )}
                  </td>
                  <td className="py-3 font-mono text-[10px] text-[#627269]">
                    {cat.slug}
                  </td>
                  <td className="py-3 font-mono font-bold text-[#1d4538]">
                    {cat.productCount} produit{cat.productCount > 1 ? "s" : ""}
                  </td>
                  <td className="py-3">
                    <Toggle
                      checked={cat.filterable}
                      onChange={() => toggleFilterable(cat)}
                      label={`Afficher ${cat.name} dans la sidebar`}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDraft({
                            id: cat.id,
                            name: cat.name,
                            nameAr: cat.nameAr || "",
                            description: cat.description || "",
                            descriptionAr: cat.descriptionAr || "",
                            filterable: cat.filterable,
                            imageUrl: cat.imageUrl,
                            imageFile: null,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#17251f]/15 bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold text-[#17251f] hover:border-[#1d4538] hover:text-[#1d4538]"
                      >
                        <Edit3 className="h-3 w-3" /> Éditer
                      </button>

                      <button
                        type="button"
                        disabled={cat.productCount > 0}
                        onClick={() => deleteCategory(cat)}
                        aria-label={`Supprimer ${cat.name}`}
                        title={
                          cat.productCount > 0
                            ? `Impossible de supprimer : cette catégorie contient ${cat.productCount} produit(s)`
                            : `Supprimer ${cat.name}`
                        }
                        className={`${dangerBtn} disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#17251f]`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <CategoryFormModal
        key={editingDraft ? (editingDraft.id || "new") : "closed"}
        draft={editingDraft}
        isOpen={!!editingDraft}
        onClose={() => setEditingDraft(null)}
        onSave={handleSave}
        busy={busy}
      />
    </div>
  );
}

