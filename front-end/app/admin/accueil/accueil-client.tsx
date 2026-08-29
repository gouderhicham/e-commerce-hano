"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import {
  ErrorBanner,
  PageHeader,
  SavedBanner,
  primaryBtn,
} from "@/components/admin/ui";
import { SectionFavoritesEditor } from "./components/section-favorites-editor";
import type {
  HomeFavoriteItem,
  ProductPublic,
} from "@/lib/data/types";

/**
 * Admin → Page d'accueil (Sélection « Nos favoris »).
 */
export function AccueilClient({
  initialFavorites = [],
  products: initialProducts = [],
}: {
  initialFavorites?: HomeFavoriteItem[];
  products?: ProductPublic[];
}) {
  const [items, setItems] = useState<HomeFavoriteItem[]>(initialFavorites);
  const [products, setProducts] = useState<ProductPublic[]>(initialProducts);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialProducts.length > 0) return;
    let alive = true;
    const fetchAll = async () => {
      try {
        const [favRes, prodRes] = await Promise.all([
          apiFetch("/api/admin/content/home/favorites"),
          apiFetch("/api/admin/products?page=1"),
        ]);
        if (!alive) return;
        if (favRes.ok) {
          const data = (await favRes.json()) as { items: HomeFavoriteItem[] };
          setItems(data.items);
        }
        if (prodRes.ok) {
          const prodData = (await prodRes.json()) as { items: ProductPublic[] };
          setProducts(prodData.items);
        }
      } catch {
        /* ignore fetch errors */
      }
    };
    void fetchAll();
    return () => {
      alive = false;
    };
  }, [initialProducts.length]);

  const readError = async (res: Response, fallback: string) => {
    const body = (await res.json().catch(() => null)) as {
      errors?: Record<string, string>;
      error?: string;
    } | null;
    return body?.errors
      ? (Object.values(body.errors)[0] ?? fallback)
      : (body?.error ?? fallback);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const favRes = await apiFetch("/api/admin/content/home/favorites", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
          })),
        }),
      });
      if (!favRes.ok) {
        throw new Error(
          await readError(
            favRes,
            "Impossible d'enregistrer la sélection des favoris.",
          ),
        );
      }

      const { items: fresh } = (await favRes.json()) as {
        items: HomeFavoriteItem[];
      };
      setItems(fresh);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Impossible d'enregistrer la sélection des favoris.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Contenu éditorial"
        title="Sélection « Nos favoris »"
        hint="Sélectionnez et ordonnez les vignettes de produits mises en avant sur la page d'accueil."
      />

      {saved && <SavedBanner>Sélection des favoris enregistrée !</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <SectionFavoritesEditor
        items={items}
        products={products}
        onItemsChange={setItems}
      />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className={`${primaryBtn} w-full py-3.5`}
      >
        {saving ? "Enregistrement…" : "Enregistrer la sélection"}
      </button>
    </div>
  );
}
