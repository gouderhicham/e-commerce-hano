"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import {
  Card,
  ErrorBanner,
  PageHeader,
  SavedBanner,
  Warning,
  primaryBtn,
  ghostBtn,
} from "@/components/admin/ui";
import type {
  CategoryWithCount,
  ProductPublic,
  TagGroup,
  FilterTag,
} from "@/lib/data/types";

const subscribe = () => () => {};

interface TagInputState {
  label: string;
  labelAr: string;
}

const GUARANTEES_FR = [
  "Garantie atelier 1 mois certifiée",
  "Livraison rapide dans les 69 wilayas",
  "Paiement en espèces à la livraison",
];

const GUARANTEES_AR = [
  "ضمان ورشة معتمد لمدة شهر كامل",
  "توصيل سريع ومضمون إلى 69 ولاية",
  "الدفع نقداً عند استلام الطلب",
];

export function TagsClient({
  initialGroups,
  categories,
  products,
}: {
  initialGroups: TagGroup[];
  categories: CategoryWithCount[];
  products: ProductPublic[];
}) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  const [groups, setGroups] = useState<TagGroup[]>(initialGroups);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, TagInputState>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  // Group creation modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalName, setModalName] = useState("");
  const [modalNameAr, setModalNameAr] = useState("");
  const [modalTargets, setModalTargets] = useState<string[]>([]);
  const [modalTags, setModalTags] = useState<FilterTag[]>([
    { value: "Option 1", label: "Option 1", labelAr: "الخيار 1" },
  ]);
  const [modalNewTag, setModalNewTag] = useState<TagInputState>({ label: "", labelAr: "" });

  // Interactive replica of the storefront sidebar.
  const filterable = categories.filter((c) => c.filterable);
  const [sidebarCat, setSidebarCat] = useState(
    filterable[0]?.id ?? categories[0]?.id ?? "",
  );
  const [sidebarLang, setSidebarLang] = useState<"fr" | "ar">("fr");
  const [selection, setSelection] = useState<Record<string, string[]>>({});

  // Close modal on Escape and prevent body scrolling
  useEffect(() => {
    if (!showAddModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAddModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [showAddModal]);

function matchAttributeValue(productVal: string, filterVal: string): boolean {
  const p = productVal.trim().toLowerCase();
  const f = filterVal.trim().toLowerCase();
  if (p === f) return true;

  const pNum = p.match(/^\d+/)?.[0];
  const fNum = f.match(/^\d+/)?.[0];
  if (pNum && fNum && pNum === fNum) {
    const pUnit = p.replace(/^\d+/, "").trim();
    const fUnit = f.replace(/^\d+/, "").trim();
    if (!pUnit || !fUnit || pUnit === fUnit) return true;
  }
  return false;
}

  const usageCount = (field: string, value: string) =>
    products.filter((p) => {
      const attr = p.attributes[field];
      if (attr == null) return false;
      const list = Array.isArray(attr) ? attr : [attr];
      return list.some((v) => matchAttributeValue(String(v), value));
    }).length;

  const groupsFor = (categoryId: string) =>
    groups.filter((g) => g.targets.includes(categoryId));

  const patch = (id: string, next: Partial<TagGroup>) =>
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...next } : g)));

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(""), 2500);
  };

  const persist = async (group: TagGroup) => {
    setBusyId(group.id);
    setError("");
    try {
      const body = JSON.stringify({
        name: group.name,
        nameAr: group.nameAr,
        field: group.field,
        targets: group.targets,
        sortOrder: group.sortOrder,
        tags: group.tags,
      });
      const res = await apiFetch(`/api/admin/content/tag-groups/${group.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body,
      });
      const payload = (await res.json().catch(() => null)) as {
        group?: TagGroup;
        error?: string;
        errors?: Record<string, string>;
      } | null;
      if (!res.ok) {
        setError(
          payload?.errors
            ? Object.values(payload.errors)[0]
            : (payload?.error ?? "Enregistrement impossible."),
        );
        return;
      }
      if (payload?.group) {
        setGroups((prev) =>
          prev.map((g) => (g.id === group.id ? { ...payload.group! } : g)),
        );
      }
      flash(`Groupe « ${group.name} » enregistré avec succès.`);
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const removeGroup = async (group: TagGroup) => {
    if (!confirm(`Supprimer le groupe de filtres « ${group.name} » ?`)) return;
    setBusyId(group.id);
    try {
      const res = await apiFetch(
        `/api/admin/content/tag-groups/${group.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error();
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      flash("Groupe supprimé avec succès.");
    } catch {
      setError("Suppression impossible.");
    } finally {
      setBusyId(null);
    }
  };

  const openAddModal = () => {
    setModalName("");
    setModalNameAr("");
    setModalTargets(filterable.length > 0 ? [filterable[0].id] : []);
    setModalTags([
      { value: "Option 1", label: "Option 1", labelAr: "الخيار 1" },
    ]);
    setModalNewTag({ label: "", labelAr: "" });
    setModalError("");
    setShowAddModal(true);
  };

  const handleAddTagToModal = () => {
    const label = modalNewTag.label.trim();
    if (!label) return;
    if (modalTags.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setModalError(`Le tag « ${label} » est déjà présent dans la liste.`);
      return;
    }
    const labelAr = modalNewTag.labelAr.trim() || label;
    setModalTags((prev) => [...prev, { value: label, label, labelAr }]);
    setModalNewTag({ label: "", labelAr: "" });
    setModalError("");
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalName.trim()) {
      setModalError("Le nom du groupe en français est requis.");
      return;
    }
    const cleanField = modalName
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "attr";
    if (modalTags.length === 0) {
      setModalError("Ajoutez au moins un tag de filtre.");
      return;
    }

    setModalBusy(true);
    setModalError("");

    try {
      const payload = {
        name: modalName.trim(),
        nameAr: modalNameAr.trim() || null,
        field: cleanField,
        targets: modalTargets.length > 0 ? modalTargets : (filterable[0] ? [filterable[0].id] : []),
        sortOrder: groups.length,
        tags: modalTags.map((t) => ({
          value: t.label.trim(),
          label: t.label.trim(),
          labelAr: t.labelAr?.trim() || null,
        })),
      };

      const res = await apiFetch("/api/admin/content/tag-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json().catch(() => null)) as {
        group?: TagGroup;
        error?: string;
        errors?: Record<string, string>;
      } | null;

      if (!res.ok) {
        setModalError(
          data?.errors
            ? Object.values(data.errors)[0]
            : (data?.error ?? "Erreur lors de la création du groupe."),
        );
        return;
      }

      if (data?.group) {
        setGroups((prev) => [...prev, data.group!]);
      }

      setShowAddModal(false);
      flash(`Groupe « ${modalName.trim()} » créé et enregistré en base.`);
    } catch {
      setModalError("Erreur réseau ou serveur.");
    } finally {
      setModalBusy(false);
    }
  };

  const addTagToGroup = (groupId: string) => {
    const input = newTagInputs[groupId];
    if (!input || !input.label.trim()) return;
    const label = input.label.trim();
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    if (group.tags.some((t) => t.label.toLowerCase() === label.toLowerCase())) {
      setError(`Le tag « ${label} » existe déjà dans ce groupe.`);
      return;
    }
    const labelAr = input.labelAr.trim() || label;
    patch(groupId, {
      tags: [
        ...group.tags,
        { value: label, label, labelAr },
      ],
    });
    setNewTagInputs((prev) => ({
      ...prev,
      [groupId]: { label: "", labelAr: "" },
    }));
  };

  const toggleSelection = (field: string, value: string) =>
    setSelection((prev) => {
      const current = prev[field] ?? [];
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
    });

  const visibleCount = useMemo(
    () =>
      products.filter((p) => {
        if (p.categoryId !== sidebarCat) return false;
        return Object.entries(selection).every(([field, values]) => {
          if (values.length === 0) return true;
          const value = p.attributes[field];
          if (value == null || (Array.isArray(value) && value.length === 0)) {
            return false;
          }
          const list = Array.isArray(value) ? value : [value];
          return list.some((v) =>
            values.some((sel) => matchAttributeValue(String(v), sel)),
          );
        });
      }).length,
    [products, sidebarCat, selection],
  );

  const activeSelection = Object.entries(selection).flatMap(([field, values]) =>
    values.map((value) => ({ field, value })),
  );

  return (
    <div className="max-w-6xl animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Attributs & Filtres Catalogue"
        title={`Gestion des Tags de Filtres (${groups.length} groupes)`}
        hint="Chaque groupe pilote un attribut produit filtrable dans la sidebar du catalogue. Données 100% bilingues (Français / العربية) sans aucune valeur codée en dur."
        action={
          <button type="button" onClick={openAddModal} className={primaryBtn}>
            <Plus className="h-4 w-4" />
            <span>Nouveau Groupe de Tags</span>
          </button>
        }
      />

      {saved && <SavedBanner>{saved}</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* Groups Cards Column */}
        <div className="grid gap-5 sm:grid-cols-2">
          {groups.map((group) => {
            const duplicateField = groups.some(
              (g) => g.id !== group.id && g.field === group.field,
            );
            const curInput = newTagInputs[group.id] || { value: "", label: "", labelAr: "" };

            return (
              <Card key={group.id} className="flex flex-col justify-between p-5">
                <div>
                  <div className="mb-3 flex items-start justify-between gap-2 border-b border-[#17251f]/10 pb-2">
                    <div className="grid flex-1 gap-1 sm:grid-cols-2">
                      <div>
                        <span className="block font-mono text-[8px] font-bold uppercase text-[#78827b]">
                          Nom FR
                        </span>
                        <input
                          value={group.name}
                          onChange={(e) => patch(group.id, { name: e.target.value })}
                          aria-label="Nom du groupe (FR)"
                          placeholder="Nom FR"
                          className="w-full bg-transparent font-mono text-[11px] font-bold uppercase tracking-[.1em] text-[#1d4538] outline-none"
                        />
                      </div>
                      <div>
                        <span className="block font-mono text-[8px] font-bold uppercase text-[#78827b]">
                          الاسم بالعربية
                        </span>
                        <input
                          value={group.nameAr ?? ""}
                          onChange={(e) => patch(group.id, { nameAr: e.target.value })}
                          dir="rtl"
                          aria-label="Nom du groupe (العربية)"
                          placeholder="الاسم بالعربية"
                          className="w-full bg-transparent font-arabic text-[11px] font-bold text-[#1d4538] outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeGroup(group)}
                      disabled={busyId === group.id}
                      aria-label="Supprimer le groupe"
                      className="shrink-0 cursor-pointer rounded-lg p-1 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mb-3">
                    <label className="mb-1 block font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                      Catégories cibles
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {filterable.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() =>
                            patch(group.id, {
                              targets: group.targets.includes(cat.id)
                                ? group.targets.filter((t) => t !== cat.id)
                                : [...group.targets, cat.id],
                            })
                          }
                          className={`cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold transition ${
                            group.targets.includes(cat.id)
                              ? "border-[#1d4538] bg-[#1d4538] text-white"
                              : "border-[#17251f]/15 bg-white text-[#4a5850] hover:border-[#1d4538]/40"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {duplicateField && (
                    <div className="mb-3">
                      <Warning>
                        Un autre groupe filtre déjà l&apos;attribut « {group.field} ».
                      </Warning>
                    </div>
                  )}

                  {/* Tags list */}
                  <div className="mb-4 space-y-1.5">
                    <div className="flex items-center justify-between font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                      <span>Tags ({group.tags.length})</span>
                      <span>Libellé FR · Libellé AR</span>
                    </div>

                    {group.tags.map((tag, index) => {
                      const tagKey = tag.label || tag.value;
                      const used = usageCount(group.field, tagKey);
                      return (
                        <div
                          key={`${tag.label}-${index}`}
                          className="flex items-center gap-1.5 rounded-lg border border-[#1d4538]/25 bg-[#edf3ee] p-1.5"
                        >
                          <input
                            value={tag.label}
                            onChange={(e) => {
                              const tags = [...group.tags];
                              const label = e.target.value;
                              tags[index] = { ...tags[index], value: label, label };
                              patch(group.id, { tags });
                            }}
                            title="Libellé affiché au client en français"
                            placeholder="Libellé FR"
                            className="w-1/2 rounded border border-[#17251f]/10 bg-white px-2 py-1 text-[11px] font-semibold outline-none focus:border-[#1d4538]"
                          />
                          <input
                            value={tag.labelAr ?? ""}
                            onChange={(e) => {
                              const tags = [...group.tags];
                              tags[index] = { ...tags[index], labelAr: e.target.value };
                              patch(group.id, { tags });
                            }}
                            dir="rtl"
                            title="الاسم المعروض للعملاء بالعربية"
                            placeholder="الاسم بالعربية"
                            className="w-1/2 rounded border border-[#17251f]/10 bg-white px-2 py-1 font-arabic text-[11px] font-semibold outline-none focus:border-[#1d4538]"
                          />
                          <span
                            title="Nombre de produits utilisant ce tag"
                            className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold ${
                              used
                                ? "bg-[#1d4538] text-white"
                                : "border border-amber-200 bg-white text-[#a06b1f]"
                            }`}
                          >
                            {used}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              patch(group.id, {
                                tags: group.tags.filter((_, i) => i !== index),
                              })
                            }
                            aria-label={`Supprimer ${tag.label}`}
                            className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#1d4538]/15 text-[#1d4538] transition hover:bg-red-500 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Add Tag row & Save group button */}
                <div className="space-y-2 border-t border-[#17251f]/10 pt-3">
                  <div className="space-y-1.5 rounded-xl border border-[#17251f]/10 bg-[#fbfcfb] p-2">
                    <span className="block font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                      Ajouter un nouveau tag
                    </span>
                    <div className="flex gap-1.5">
                      <input
                        value={curInput?.label ?? ""}
                        onChange={(e) =>
                          setNewTagInputs((prev) => ({
                            ...prev,
                            [group.id]: { label: e.target.value, labelAr: curInput?.labelAr ?? "" },
                          }))
                        }
                        placeholder="Libellé FR (ex: 32 Go)"
                        className="w-1/2 rounded-lg border border-[#17251f]/15 bg-white px-2.5 py-1 text-[10.5px] outline-none focus:border-[#1d4538]"
                      />
                      <input
                        value={curInput?.labelAr ?? ""}
                        onChange={(e) =>
                          setNewTagInputs((prev) => ({
                            ...prev,
                            [group.id]: { label: curInput?.label ?? "", labelAr: e.target.value },
                          }))
                        }
                        dir="rtl"
                        placeholder="الاسم بالعربية (مثال: 32 جيجابايت)"
                        className="w-1/2 rounded-lg border border-[#17251f]/15 bg-white px-2.5 py-1 font-arabic text-[10.5px] outline-none focus:border-[#1d4538]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => addTagToGroup(group.id)}
                      disabled={!curInput?.label?.trim()}
                      className="inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#1d4538] py-1.5 font-mono text-[10px] font-bold uppercase text-white transition hover:bg-[#14352b] disabled:opacity-40"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Ajouter le tag</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => persist(group)}
                    disabled={busyId === group.id}
                    className={`${primaryBtn} w-full py-2.5`}
                  >
                    {busyId === group.id ? "Enregistrement…" : "Enregistrer le groupe"}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Live replica of the storefront catalogue sidebar with [FR] / [AR] toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[#78827b]">
              Aperçu Sidebar Catalogue
            </span>
            <div className="flex items-center overflow-hidden rounded-lg border border-[#17251f]/15 bg-[#f4f7f3] p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setSidebarLang("fr")}
                className={`cursor-pointer rounded-md px-2 py-0.5 text-[10px] transition ${
                  sidebarLang === "fr"
                    ? "bg-[#1d4538] text-white shadow-2xs"
                    : "text-[#58675f] hover:text-[#17251f]"
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setSidebarLang("ar")}
                className={`cursor-pointer rounded-md px-2 py-0.5 font-arabic text-[10px] transition ${
                  sidebarLang === "ar"
                    ? "bg-[#1d4538] text-white shadow-2xs"
                    : "text-[#58675f] hover:text-[#17251f]"
                }`}
              >
                العربية
              </button>
            </div>
          </div>

          <Card
            className="space-y-4 p-5"
            dir={sidebarLang === "ar" ? "rtl" : "ltr"}
          >
            <div className="border-b border-[#17251f]/10 pb-4">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[.18em] text-[#627269]">
                {sidebarLang === "ar" ? "تصفية النتائج" : "Filtres"}
              </p>
              <h2 className={`mt-1 text-xl font-semibold tracking-[-.04em] text-[#17251f] ${sidebarLang === "ar" ? "font-arabic" : ""}`}>
                {sidebarLang === "ar" ? "تخصيص الخيارات" : "Affiner la sélection"}
              </h2>
            </div>

            <div className="flex items-center gap-2.5 rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] px-3.5 py-2 text-xs">
              <Search className="h-3.5 w-3.5 text-[#627269]" />
              <span className={`font-medium text-[#849088] ${sidebarLang === "ar" ? "font-arabic" : ""}`}>
                {sidebarLang === "ar" ? "ابحث عن موديل..." : "Rechercher un modèle..."}
              </span>
            </div>

            <div>
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-[.18em] text-[#627269]">
                {sidebarLang === "ar" ? "نوع المنتجات" : "Type de produit"}
              </p>
              <div className="mt-2.5 space-y-1">
                {filterable.map((cat) => {
                  const isSelected = sidebarCat === cat.id;
                  const catLabel = sidebarLang === "ar" && cat.nameAr ? cat.nameAr : cat.name;
                  return (
                    <div key={cat.id}>
                      <button
                        type="button"
                        onClick={() => setSidebarCat(cat.id)}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs transition-all duration-200 ${
                          isSelected
                            ? "bg-[#e6efe7] font-bold text-[#1d4538] shadow-2xs"
                            : "text-[#4f5d55] hover:bg-[#f4f7f3] hover:text-[#1d4538]"
                        }`}
                      >
                        <span className={`flex items-center gap-2 ${sidebarLang === "ar" ? "font-arabic" : ""}`}>
                          <span
                            className={`h-2 w-2 rounded-full transition duration-300 ${
                              isSelected ? "scale-125 bg-[#1d4538]" : "bg-[#88978e]/50"
                            }`}
                          />
                          {catLabel}
                        </span>
                        <span className="font-mono text-[9px] text-[#78827b]">
                          {products.filter((p) => p.categoryId === cat.id).length}
                        </span>
                      </button>

                      {isSelected && (
                        <div className="my-2.5 animate-fade-in space-y-3 rounded-xl border border-[#1d4538]/20 bg-[#edf3ee] p-3 text-xs shadow-inner">
                          {groupsFor(cat.id).length === 0 && (
                            <p className="text-[10.5px] font-medium text-[#627269]">
                              {sidebarLang === "ar"
                                ? "لا توجد مجموعات فلاتر لهذه الفئة."
                                : "Aucun groupe ne cible cette catégorie."}
                            </p>
                          )}
                          {groupsFor(cat.id).map((group) => {
                            const groupTitle =
                              sidebarLang === "ar" && group.nameAr ? group.nameAr : group.name;
                            return (
                              <div key={group.id}>
                                <p className={`mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#1d4538] ${sidebarLang === "ar" ? "font-arabic tracking-normal" : ""}`}>
                                  {groupTitle}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.tags.map((tag) => {
                                    const tagKey = tag.label || tag.value;
                                    const active = (
                                      selection[group.field] ?? []
                                    ).includes(tagKey) || (
                                      selection[group.field] ?? []
                                    ).includes(tag.value);
                                    const tagLabel =
                                      sidebarLang === "ar" && tag.labelAr ? tag.labelAr : tag.label;
                                    return (
                                      <button
                                        key={tag.label}
                                        type="button"
                                        onClick={() =>
                                          toggleSelection(group.field, tagKey)
                                        }
                                        className={`cursor-pointer rounded-md border px-2.5 py-1 text-[10.5px] font-medium transition ${
                                          active
                                            ? "border-[#1d4538] bg-[#1d4538] font-semibold text-white shadow-2xs"
                                            : "border-[#17251f]/15 bg-white text-[#4a5850] hover:border-[#1d4538]/40"
                                        } ${sidebarLang === "ar" ? "font-arabic" : ""}`}
                                      >
                                        {tagLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {activeSelection.length > 0 && (
              <div className="border-t border-[#17251f]/10 pt-2">
                <span className="mb-1 block font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                  {sidebarLang === "ar"
                    ? `الفلاتر النشطة (${activeSelection.length}) :`
                    : `Filtres actifs (${activeSelection.length}) :`}
                </span>
                <div className="flex flex-wrap gap-1">
                  {activeSelection.map(({ field, value }) => (
                    <span
                      key={`${field}-${value}`}
                      className="inline-flex items-center gap-1 rounded bg-[#1d4538] px-2 py-0.5 font-mono text-[9px] font-bold text-white"
                    >
                      <span>{value}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelection(field, value)}
                        aria-label={`Retirer ${value}`}
                        className="cursor-pointer hover:opacity-75"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[#1d4538]/20 bg-[#edf3ee] p-2.5 text-center font-mono text-[10px] font-bold uppercase text-[#1d4538]">
              {sidebarLang === "ar"
                ? `${visibleCount} منتج متوفر`
                : `${visibleCount} article${visibleCount !== 1 ? "s" : ""} trouvé${visibleCount !== 1 ? "s" : ""}`}
            </div>

            <div className="border-t border-[#17251f]/10 pt-3">
              <p className="font-mono text-[9px] font-bold uppercase tracking-[.18em] text-[#627269]">
                {sidebarLang === "ar" ? "ضمانات المتجر" : "Nos garanties"}
              </p>
              <div className="mt-2 space-y-1.5 text-[11px] font-medium leading-4 text-[#596860]">
                {(sidebarLang === "ar" ? GUARANTEES_AR : GUARANTEES_FR).map((guarantee) => (
                  <p key={guarantee} className={`flex items-center gap-1.5 ${sidebarLang === "ar" ? "font-arabic" : ""}`}>
                    <span className="font-bold text-[#2c5b48]">✓</span>{" "}
                    {guarantee}
                  </p>
                ))}
              </div>
            </div>
          </Card>

          <p className="rounded-xl border border-[#17251f]/10 bg-[#fdfcf8] p-3 text-[10px] leading-4 text-[#627269]">
            Rappel : le catalogue ignore un filtre pour les produits qui n&apos;ont pas l&apos;attribut correspondant.
          </p>
        </div>
      </div>

      {/* Add Group Modal Portal */}
      {mounted && showAddModal && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Nouveau Groupe de Tags de Filtres"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#17251f]/80 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => !modalBusy && setShowAddModal(false)}
        >
          <div
            className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#17251f]/20 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-[#17251f]/10 bg-white px-6 py-4">
              <div>
                <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[#17251f]">
                  Nouveau Groupe de Tags de Filtres
                </h3>
                <p className="mt-0.5 text-xs text-[#58675f]">
                  Créez un nouveau groupe de filtres bilingue directement enregistré en base.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !modalBusy && setShowAddModal(false)}
                disabled={modalBusy}
                aria-label="Fermer"
                className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#58675f] transition hover:bg-[#f4f7f3] disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              id="add-tag-group-form"
              onSubmit={handleCreateGroupSubmit}
              className="flex-1 overflow-y-auto p-6 space-y-4 cart-scrollbar"
            >
              {modalError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 font-medium">
                  {modalError}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-mono text-[9px] font-bold uppercase text-[#78827b]">
                    Nom du groupe (Français) *
                  </label>
                  <input
                    required
                    value={modalName}
                    onChange={(e) => setModalName(e.target.value)}
                    placeholder="Ex: Écran / Résolution"
                    className="w-full rounded-xl border border-[#17251f]/15 bg-white p-2.5 text-xs font-semibold outline-none focus:border-[#1d4538]"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-mono text-[9px] font-bold uppercase text-[#78827b]">
                    الاسم بالعربية (العربية)
                  </label>
                  <input
                    dir="rtl"
                    value={modalNameAr}
                    onChange={(e) => setModalNameAr(e.target.value)}
                    placeholder="مثال: الشاشة والدقة"
                    className="w-full rounded-xl border border-[#17251f]/15 bg-white p-2.5 font-arabic text-xs font-semibold outline-none focus:border-[#1d4538]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block font-mono text-[9px] font-bold uppercase text-[#78827b]">
                  Catégories cibles
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {filterable.map((cat) => {
                    const isChecked = modalTargets.includes(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          setModalTargets((prev) =>
                            isChecked ? prev.filter((t) => t !== cat.id) : [...prev, cat.id],
                          )
                        }
                        className={`cursor-pointer rounded-lg border px-2.5 py-1 font-mono text-[10.5px] font-semibold transition ${
                          isChecked
                            ? "border-[#1d4538] bg-[#1d4538] text-white shadow-2xs"
                            : "border-[#17251f]/15 bg-white text-[#58675f] hover:border-[#1d4538]/50"
                        }`}
                      >
                        {cat.name}
                        {cat.nameAr && ` (${cat.nameAr})`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial tags list */}
              <div className="rounded-2xl border border-[#17251f]/10 bg-[#fbfcfb] p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#17251f]/10 pb-2">
                  <span className="font-mono text-[9px] font-bold uppercase text-[#78827b]">
                    Tags de filtre ({modalTags.length})
                  </span>
                  <span className="text-[10px] text-[#78827b]">Libellé FR · Libellé AR</span>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto cart-scrollbar">
                  {modalTags.map((t, idx) => (
                    <div
                      key={`${t.label}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#1d4538]/20 bg-white p-2 text-xs shadow-2xs"
                    >
                      <span className="truncate font-semibold text-[#17251f]">
                        {t.label}
                      </span>
                      <span className="truncate font-arabic text-[#2c5b48]" dir="rtl">
                        {t.labelAr || "—"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalTags((prev) => prev.filter((_, i) => i !== idx))}
                        className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-red-500 transition hover:bg-red-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-[#17251f]/10">
                  <span className="mb-1 block font-mono text-[8.5px] font-bold uppercase text-[#78827b]">
                    Ajouter un tag au groupe
                  </span>
                  <div className="flex gap-1.5">
                    <input
                      value={modalNewTag.label}
                      onChange={(e) =>
                        setModalNewTag((prev) => ({ ...prev, label: e.target.value }))
                      }
                      placeholder="Libellé FR (ex: Full HD)"
                      className="w-1/2 rounded-lg border border-[#17251f]/15 bg-white p-2 text-[10.5px] outline-none focus:border-[#1d4538]"
                    />
                    <input
                      dir="rtl"
                      value={modalNewTag.labelAr}
                      onChange={(e) =>
                        setModalNewTag((prev) => ({ ...prev, labelAr: e.target.value }))
                      }
                      placeholder="الاسم AR (مثال: دقة عالية)"
                      className="w-1/2 rounded-lg border border-[#17251f]/15 bg-white p-2 font-arabic text-[10.5px] outline-none focus:border-[#1d4538]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTagToModal}
                    disabled={!modalNewTag.label.trim()}
                    className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1 rounded-lg bg-[#1d4538] py-1.5 font-mono text-[10px] font-bold uppercase text-white transition hover:bg-[#14352b] disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Ajouter à la liste des tags</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Fixed Footer */}
            <div className="flex shrink-0 gap-3 border-t border-[#17251f]/10 bg-[#fafafa] px-6 py-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={modalBusy}
                className={`${ghostBtn} flex-1 py-2.5`}
              >
                Annuler
              </button>
              <button
                type="submit"
                form="add-tag-group-form"
                disabled={modalBusy}
                className={`${primaryBtn} flex-1 py-2.5 shadow-md`}
              >
                {modalBusy ? "Création en cours…" : "Créer et enregistrer"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
