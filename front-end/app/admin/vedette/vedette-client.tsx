"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Upload, Image as ImageIcon } from "lucide-react";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import {
  Card,
  ErrorBanner,
  PageHeader,
  SavedBanner,
  Warning,
  hintCls,
  inputCls,
  labelCls,
  primaryBtn,
} from "@/components/admin/ui";
import type { Showcase } from "@/lib/data/types";
import { compressImage } from "@/lib/image-compress";

/* eslint-disable @next/next/no-img-element -- see accueil-client.tsx. */

const defaultShowcase: Showcase = {
  eyebrow: "",
  eyebrowAr: "",
  title: "",
  titleAr: "",
  subtitle: "",
  subtitleAr: "",
  description: "",
  descriptionAr: "",
  image: "",
  imageAlt: "",
  imageAltAr: "",
  specs: [],
};

export function VedetteClient({ initial = defaultShowcase }: { initial?: Showcase }) {
  const [showcase, setShowcase] = useState<Showcase>(initial);

  useEffect(() => {
    if (initial.title) return;
    let alive = true;
    apiFetch("/api/home")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.showcase) {
          setShowcase(data.showcase);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initial.title]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<"fr" | "ar">("fr");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof Showcase>(key: K, value: Showcase[K]) =>
    setShowcase((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      let finalImageUrl = showcase.image;

      if (imageFile) {
        const fd = new FormData();
        // Compressed client-side: the bytes are stored in Postgres.
        fd.append("file", await compressImage(imageFile));
        const uploadRes = await apiFetch("/api/admin/uploads/showcase-image", {
          method: "POST",
          body: fd,
        });

        if (!uploadRes.ok) {
          throw new Error("Échec du téléversement de l'image.");
        }

        const uploadData = (await uploadRes.json()) as { imageUrl: string };
        finalImageUrl = uploadData.imageUrl;
        set("image", finalImageUrl);
      }

      const updatedShowcase = { ...showcase, image: finalImageUrl };

      const res = await apiFetch("/api/admin/content/home", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ showcase: updatedShowcase }),
      });
      if (!res.ok) throw new Error();
      setImageFile(null);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Impossible d'enregistrer le produit vedette.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const previewData = {
    eyebrow: previewLang === "ar" ? (showcase.eyebrowAr || showcase.eyebrow) : showcase.eyebrow,
    title: previewLang === "ar" ? (showcase.titleAr || showcase.title) : showcase.title,
    subtitle: previewLang === "ar" ? (showcase.subtitleAr || showcase.subtitle) : showcase.subtitle,
    description: previewLang === "ar" ? (showcase.descriptionAr || showcase.description) : showcase.description,
    imageAlt: previewLang === "ar" ? (showcase.imageAltAr || showcase.imageAlt) : showcase.imageAlt,
    specs: showcase.specs.map((s) => ({
      label: previewLang === "ar" ? (s.labelAr || s.label) : s.label,
      val: previewLang === "ar" ? (s.valAr || s.val) : s.val,
    })),
  };

  return (
    <div className="max-w-6xl animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Landing Page Highlight"
        title="Produit Vedette (Hero Showcase)"
        hint="Bloc pleine largeur affiché sous le hero de la page d'accueil avec support bilingue (Français & Arabe)."
      />

      {saved && (
        <SavedBanner>Modifications du produit vedette enregistrées !</SavedBanner>
      )}
      <ErrorBanner>{error}</ErrorBanner>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <Card className="space-y-5 p-6">
          <h2 className="border-b border-[#17251f]/10 pb-3 text-base font-medium tracking-tight text-[#17251f]">
            Éditer le Pavé Vedette (Bilingue)
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Mention haut (Français)</label>
              <input
                value={showcase.eyebrow}
                onChange={(e) => set("eyebrow", e.target.value)}
                placeholder="ex: Choix de l'Atelier"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Mention haut (العربية)</label>
              <input
                value={showcase.eyebrowAr ?? ""}
                onChange={(e) => set("eyebrowAr", e.target.value)}
                dir="rtl"
                placeholder="مثال: اختيار الورشة"
                className={`${inputCls} font-arabic`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Ligne mono au-dessus (Français)</label>
              <input
                value={showcase.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="ex: Alienware Aurora R16"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Ligne mono au-dessus (العربية)</label>
              <input
                value={showcase.titleAr ?? ""}
                onChange={(e) => set("titleAr", e.target.value)}
                dir="rtl"
                placeholder="مثال: ألين وير أورورا R16"
                className={`${inputCls} font-arabic`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Titre principal (Français)</label>
              <input
                value={showcase.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="ex: La bête de course Gaming & Création."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Titre principal (العربية)</label>
              <input
                value={showcase.subtitleAr ?? ""}
                onChange={(e) => set("subtitleAr", e.target.value)}
                dir="rtl"
                placeholder="مثال: وحش الأداء للألعاب وصناعة المحتوى."
                className={`${inputCls} font-arabic`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Description courte (Français)</label>
              <textarea
                rows={3}
                value={showcase.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Description en français..."
                className={`${inputCls} resize-y font-normal`}
              />
            </div>
            <div>
              <label className={labelCls}>Description courte (العربية)</label>
              <textarea
                rows={3}
                value={showcase.descriptionAr ?? ""}
                onChange={(e) => set("descriptionAr", e.target.value)}
                dir="rtl"
                placeholder="الوصف بالعربية..."
                className={`${inputCls} resize-y font-arabic font-normal`}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Visuel (Image depuis votre appareil)</label>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-[#17251f]/15 bg-[#f4f7f3]">
                {filePreview || showcase.image ? (
                  <img
                    src={filePreview || (mediaSrc(showcase.image) ?? "")}
                    alt="Aperçu visuel vedette"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[#78827b]">
                    <ImageIcon className="h-6 w-6 opacity-50" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#17251f]/15 bg-white px-4 py-2.5 font-mono text-xs font-semibold text-[#17251f] shadow-2xs hover:bg-[#edf3ee] hover:text-[#1d4538]">
                  <Upload className="h-4 w-4" />
                  <span>
                    {imageFile
                      ? imageFile.name
                      : "Choisir une image depuis votre appareil…"}
                  </span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <p className={hintCls}>Format PNG, JPEG ou WebP (5 Mo max).</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>
                Texte alternatif de l&apos;image (Français)
              </label>
              <input
                value={showcase.imageAlt}
                onChange={(e) => set("imageAlt", e.target.value)}
                className={`${inputCls} font-normal`}
              />
              <p className={hintCls}>Lu par les lecteurs d&apos;écran et le SEO.</p>
            </div>
            <div>
              <label className={labelCls}>
                Texte alternatif de l&apos;image (العربية)
              </label>
              <input
                value={showcase.imageAltAr ?? ""}
                onChange={(e) => set("imageAltAr", e.target.value)}
                dir="rtl"
                placeholder="مثال: حاسوب محمول مجدد"
                className={`${inputCls} font-arabic`}
              />
              <p className={hintCls}>Vide = le texte français est utilisé.</p>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between border-b border-[#17251f]/10 pb-2">
              <label className={`${labelCls} mb-0`}>
                Spécifications clés ({showcase.specs.length})
              </label>
              <button
                type="button"
                onClick={() =>
                  set("specs", [
                    ...showcase.specs,
                    { label: "Spec", labelAr: "مواصفة", val: "Valeur", valAr: "قيمة" },
                  ])
                }
                className="inline-flex cursor-pointer items-center gap-1 font-mono text-[9.5px] font-bold uppercase text-[#1d4538] hover:underline"
              >
                <Plus className="h-3 w-3" />
                <span>Ajouter Spec</span>
              </button>
            </div>

            {showcase.specs.length !== 4 && (
              <div className="mb-2.5">
                <Warning>
                  La grille du frontoffice est prévue pour 4 specs (2 colonnes
                  sur mobile, 4 sur desktop). {showcase.specs.length} spec
                  {showcase.specs.length !== 1 ? "s" : ""} laisseront un rendu
                  déséquilibré.
                </Warning>
              </div>
            )}

            <div className="light-scrollbar max-h-72 space-y-3 overflow-y-auto pr-1">
              {showcase.specs.map((spec, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-xl border border-[#17251f]/10 bg-[#f4f7f3] p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold uppercase text-[#78827b]">
                      Spécification {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "specs",
                          showcase.specs.filter((_, i) => i !== index),
                        )
                      }
                      aria-label="Supprimer"
                      className="cursor-pointer rounded-lg p-1 text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={spec.label}
                      onChange={(e) => {
                        const updated = [...showcase.specs];
                        updated[index] = { ...updated[index], label: e.target.value };
                        set("specs", updated);
                      }}
                      placeholder="Libellé (FR)"
                      className="rounded-lg border border-[#17251f]/15 bg-white p-2 text-xs font-semibold outline-none focus:border-[#1d4538]"
                    />
                    <input
                      value={spec.labelAr ?? ""}
                      onChange={(e) => {
                        const updated = [...showcase.specs];
                        updated[index] = { ...updated[index], labelAr: e.target.value };
                        set("specs", updated);
                      }}
                      dir="rtl"
                      placeholder="الاسم (العربية)"
                      className="rounded-lg border border-[#17251f]/15 bg-white p-2 font-arabic text-xs font-semibold outline-none focus:border-[#1d4538]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={spec.val}
                      onChange={(e) => {
                        const updated = [...showcase.specs];
                        updated[index] = { ...updated[index], val: e.target.value };
                        set("specs", updated);
                      }}
                      placeholder="Valeur (FR)"
                      className="rounded-lg border border-[#17251f]/15 bg-white p-2 text-xs font-semibold outline-none focus:border-[#1d4538]"
                    />
                    <input
                      value={spec.valAr ?? ""}
                      onChange={(e) => {
                        const updated = [...showcase.specs];
                        updated[index] = { ...updated[index], valAr: e.target.value };
                        set("specs", updated);
                      }}
                      dir="rtl"
                      placeholder="القيمة (العربية)"
                      className="rounded-lg border border-[#17251f]/15 bg-white p-2 font-arabic text-xs font-semibold outline-none focus:border-[#1d4538]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`${primaryBtn} mt-2 w-full py-3.5`}
          >
            {saving ? "Enregistrement…" : "Enregistrer l'Affiche Vedette"}
          </button>
        </Card>

        {/* Live preview with language toggle */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-[.15em] text-[#78827b]">
              Rendu Visuel (Hero Showcase Landing Page)
            </span>
            <div className="inline-flex rounded-xl border border-[#17251f]/15 bg-white p-0.5 text-[10px] font-bold shadow-2xs">
              <button
                type="button"
                onClick={() => setPreviewLang("fr")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition ${
                  previewLang === "fr"
                    ? "bg-[#1d4538] text-white"
                    : "text-[#627269] hover:text-[#17251f]"
                }`}
              >
                Français
              </button>
              <button
                type="button"
                onClick={() => setPreviewLang("ar")}
                className={`cursor-pointer rounded-lg px-2.5 py-1 transition ${
                  previewLang === "ar"
                    ? "bg-[#1d4538] text-white"
                    : "text-[#627269] hover:text-[#17251f]"
                }`}
              >
                العربية
              </button>
            </div>
          </div>

          <div
            dir={previewLang === "ar" ? "rtl" : "ltr"}
            className="relative min-h-[460px] w-full overflow-hidden rounded-2xl border border-[#17251f]/10 bg-[#dbe7dc] shadow-md"
          >
            {(filePreview || showcase.image) && (
              <img
                src={filePreview || (mediaSrc(showcase.image) ?? "")}
                alt={previewData.imageAlt}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,37,31,0.3)_0%,rgba(23,37,31,0.15)_40%,rgba(23,37,31,0.75)_100%)]" />

            {previewData.eyebrow && (
              <span className="absolute start-4 top-4 z-10 font-mono text-[9px] uppercase tracking-[.15em] text-white/90">
                {previewData.eyebrow}
              </span>
            )}

            <div className="absolute bottom-4 start-4 end-4 z-10 flex flex-col gap-3.5">
              <div className="max-w-[420px] border-s-2 border-[#e4d7ba] ps-3 text-white">
                {previewData.title && (
                  <span className="font-mono text-[9px] uppercase tracking-[.16em] text-white/80">
                    {previewData.title}
                  </span>
                )}
                {previewData.subtitle && (
                  <h3 className="mt-0.5 text-xl font-medium leading-6 tracking-[-.04em] text-white">
                    {previewData.subtitle}
                  </h3>
                )}
                {previewData.description && (
                  <p className="mt-1 text-[11px] leading-4 text-white/80">
                    {previewData.description}
                  </p>
                )}
              </div>

              {previewData.specs.length > 0 && (
                <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-white/15 bg-[#17251f]/60 p-3 backdrop-blur-md">
                  {previewData.specs.map((spec, idx) => (
                    <div key={idx} className="flex flex-col gap-0.5">
                      <span className="font-mono text-[8px] uppercase tracking-[.14em] text-white/60">
                        {spec.label}
                      </span>
                      <span className="truncate text-[10.5px] font-semibold tracking-tight text-white">
                        {spec.val}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <p className="rounded-xl border border-[#17251f]/10 bg-[#fdfcf8] p-3 text-[10px] leading-4 text-[#627269]">
            Sur desktop, le frontoffice affiche le texte à gauche et les 4 specs
            alignées à droite en une seule rangée (ou inversé en Arabe).
          </p>
        </div>
      </div>
    </div>
  );
}
