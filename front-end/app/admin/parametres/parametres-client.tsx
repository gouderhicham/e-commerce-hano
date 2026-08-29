"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
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
import type { Settings } from "@/lib/data/types";

/**
 * Admin → Paramètres. The Telegram relay is the only setting still stored in
 * the database; the shop identity, the delivery numbers and every piece of
 * storefront copy are static (`src/lib/shop-config.ts`).
 */
const DEFAULT_SETTINGS: Settings = {
  telegramBotToken: "",
  telegramChatId: "",
};

export function ParametresClient({ initial }: { initial?: Settings }) {
  const [settings, setSettings] = useState<Settings>(initial ?? DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initial) return;
    apiFetch("/api/admin/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { settings?: Settings } | null) => {
        if (data?.settings) {
          setSettings(data.settings);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [initial]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
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
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl animate-fade-in space-y-6">
        <PageHeader
          eyebrow="Configuration globale"
          title="Paramètres Boutique"
          hint="Le relais Telegram du formulaire de contact. Les frais de livraison se gèrent dans « Livraison & Tarifs »."
        />
        <Card className="space-y-6 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-48 rounded bg-[#17251f]/10" />
            <div className="h-10 rounded bg-[#17251f]/10" />
            <div className="h-10 rounded bg-[#17251f]/10" />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Configuration globale"
        title="Paramètres Boutique"
        hint="Le relais Telegram du formulaire de contact. Les frais de livraison se gèrent dans « Livraison & Tarifs »."
      />

      {saved && <SavedBanner>Paramètres enregistrés !</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <Card className="space-y-6 p-6">
        <div>
          <h2 className="mb-4 border-b border-[#17251f]/10 pb-2 text-base font-medium text-[#17251f]">
            Intégration Notifications Telegram
          </h2>
          <div className="space-y-3">
            <Warning>
              Le formulaire de contact envoie le message à Telegram directement
              depuis le navigateur : ces deux valeurs sont donc visibles par
              quiconque inspecte la page. N&apos;utilisez qu&apos;un bot dédié à
              cet usage, et videz les champs pour désactiver le relais.
            </Warning>
            <div>
              <label className={labelCls}>Telegram Bot Token</label>
              <input
                value={settings.telegramBotToken}
                onChange={(e) => set("telegramBotToken", e.target.value)}
                placeholder="Vide = relais désactivé"
                className={`${inputCls} font-mono font-normal`}
              />
            </div>
            <div>
              <label className={labelCls}>Chat ID Récepteur</label>
              <input
                value={settings.telegramChatId}
                onChange={(e) => set("telegramChatId", e.target.value)}
                placeholder="Vide = relais désactivé"
                className={`${inputCls} font-mono font-normal`}
              />
            </div>
            <p className={hintCls}>
              Les frais de livraison se règlent par wilaya et par commune dans{" "}
              <a
                href="/admin/livraison"
                className="font-semibold text-[#1d4538] underline"
              >
                Livraison &amp; Tarifs
              </a>
              . L&apos;identité de la boutique et les montants de repli sont
              écrits en dur dans <code>front-end/src/lib/shop-config.ts</code> ;
              les textes affichés aux clients vivent dans{" "}
              <code>front-end/src/lib/i18n/dictionaries/</code> (français et
              arabe).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={`${primaryBtn} w-full py-3.5`}
        >
          {saving ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
      </Card>
    </div>
  );
}
