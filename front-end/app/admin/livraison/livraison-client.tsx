"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, RotateCcw, Search, Upload } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { fmtDA, fmtN } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import {
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_ROW,
  Card,
  ErrorBanner,
  PageHeader,
  Warning,
  ghostBtn,
  hintCls,
  inputCls,
  labelCls,
  primaryBtn,
  smallInputCls,
} from "@/components/admin/ui";
import {
  diffCommuneFees,
  diffWilayaFees,
  effectiveFee,
  importSummary,
  type FeeDrafts,
} from "@/lib/admin/shipping-fees";
import type { Wilaya, WilayaFeesImportResult } from "@/lib/data/types";

const GRID = "grid-cols-[2fr_1fr_1fr_44px]";
/** Cross-wilaya search is capped so a two-letter query can't render 1 500 rows. */
const SEARCH_LIMIT = 60;

interface Row {
  communeId: number;
  communeName: string;
  wilayaCode: number;
  wilayaName: string;
  wilayaFee: number;
  fee: number | null;
}

export function LivraisonClient({
  initialWilayas = [],
}: {
  initialWilayas?: Wilaya[];
}) {
  const { pushToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [wilayas, setWilayas] = useState<Wilaya[]>(initialWilayas);
  const [selected, setSelected] = useState(initialWilayas[0]?.code ?? 1);
  const [search, setSearch] = useState("");
  const [wilayaDrafts, setWilayaDrafts] = useState<FeeDrafts>({});
  const [communeDrafts, setCommuneDrafts] = useState<FeeDrafts>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialWilayas.length > 0) return;
    let alive = true;
    const fetchAll = async () => {
      try {
        const res = await apiFetch("/api/shipping/wilayas");
        if (alive && res.ok) {
          const data = (await res.json()) as Wilaya[];
          setWilayas(data);
          if (data.length > 0) setSelected(data[0].code);
        }
      } catch {
        /* ignore fetch errors */
      }
    };
    void fetchAll();
    return () => {
      alive = false;
    };
  }, [initialWilayas.length]);

  const current = wilayas.find((w) => w.code === selected) ?? wilayas[0];

  const wilayaDiff = diffWilayaFees(wilayas, wilayaDrafts);
  const communeDiff = diffCommuneFees(wilayas, communeDrafts);
  const dirtyCount = wilayaDiff.changes.length + communeDiff.changes.length;
  const invalidCount = wilayaDiff.invalid.length + communeDiff.invalid.length;

  // Closing the tab mid-edit would silently drop the batch.
  useEffect(() => {
    if (dirtyCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);

  const term = search.trim().toLowerCase();
  const rows: Row[] = useMemo(() => {
    const toRow = (w: Wilaya) =>
      w.communes.map(
        (c): Row => ({
          communeId: c.id,
          communeName: c.name,
          wilayaCode: w.code,
          wilayaName: w.name,
          wilayaFee: w.fee,
          fee: c.fee,
        }),
      );
    // A search looks across every wilaya; otherwise the table is the selection.
    if (!term) return current ? toRow(current) : [];
    return wilayas
      .flatMap(toRow)
      .filter(
        (r) =>
          r.communeName.toLowerCase().includes(term) ||
          r.wilayaName.toLowerCase().includes(term),
      );
  }, [term, wilayas, current]);

  const visible = rows.slice(0, SEARCH_LIMIT);
  const hidden = rows.length - visible.length;

  const inheritCount = current
    ? current.communes.filter((c) => c.fee === null).length
    : 0;

  const resetDrafts = () => {
    setWilayaDrafts({});
    setCommuneDrafts({});
  };

  const applyServerState = (next: Wilaya[]) => {
    setWilayas(next);
    resetDrafts();
    setError("");
  };

  const save = async () => {
    if (invalidCount > 0) {
      setError(
        "Certains tarifs sont invalides : saisissez un entier en DA (0 accepté).",
      );
      return;
    }
    if (dirtyCount === 0) return;

    setBusy(true);
    setError("");
    try {
      let latest = wilayas;
      // Wilaya defaults first: a commune that inherits must land on the new
      // default, not on the old one.
      if (wilayaDiff.changes.length > 0) {
        const res = await apiFetch("/api/admin/wilaya-fees", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(wilayaDiff.changes),
        });
        const payload = (await res.json().catch(() => null)) as {
          items?: Wilaya[];
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
        if (payload?.items) latest = payload.items;
      }

      if (communeDiff.changes.length > 0) {
        const res = await apiFetch("/api/admin/wilaya-fees/communes", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(communeDiff.changes),
        });
        const payload = (await res.json().catch(() => null)) as {
          items?: Wilaya[];
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
        if (payload?.items) latest = payload.items;
      }

      applyServerState(latest);
      pushToast("Tarifs de livraison enregistrés", "success");
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await apiFetch("/api/admin/wilaya-fees/import", {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => null)) as
        | (WilayaFeesImportResult & { error?: string })
        | null;
      if (!res.ok) {
        setError(payload?.error ?? "Import impossible.");
        return;
      }
      if (payload) {
        applyServerState(payload.items);
        pushToast(importSummary(payload), "success");
        if (payload.skipped > 0) {
          setError(
            `${payload.skipped} ligne(s) ignorée(s) : commune inconnue ou tarif illisible.`,
          );
        }
      }
    } catch {
      setError("Import impossible.");
    } finally {
      setBusy(false);
      // Let the same file be picked again after a fix.
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const onPickFile = (file: File) => {
    if (dirtyCount > 0) {
      const ok = window.confirm(
        "Vous avez des modifications non enregistrées. L'import va les écraser. Continuer ?",
      );
      if (!ok) {
        if (fileInput.current) fileInput.current.value = "";
        return;
      }
    }
    void importFile(file);
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Tarifs de livraison"
        title="Livraison par wilaya & commune"
        hint="Le tarif d'une commune l'emporte sur celui de sa wilaya. Laissez une case vide pour que la commune hérite du tarif wilaya."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/admin/wilaya-fees/export"
              download
              onClick={(e) => {
                if (dirtyCount > 0) {
                  e.preventDefault();
                  setError(
                    "Enregistrez vos modifications avant d'exporter, sinon le fichier contiendra les anciens tarifs.",
                  );
                }
              }}
              className={ghostBtn}
            >
              <Download className="h-4 w-4" />
              <span>Exporter Excel</span>
            </a>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              className={ghostBtn}
            >
              <Upload className="h-4 w-4" />
              <span>Importer Excel</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickFile(file);
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={save}
              disabled={busy || dirtyCount === 0}
              className={primaryBtn}
            >
              {busy
                ? "Enregistrement…"
                : dirtyCount > 0
                  ? `Enregistrer (${dirtyCount})`
                  : "Enregistrer"}
            </button>
          </div>
        }
      />

      <ErrorBanner>{error}</ErrorBanner>

      {dirtyCount > 0 && (
        <Warning>
          {dirtyCount} tarif{dirtyCount > 1 ? "s" : ""} modifié
          {dirtyCount > 1 ? "s" : ""} non enregistré
          {dirtyCount > 1 ? "s" : ""}.{" "}
          <button
            type="button"
            onClick={resetDrafts}
            className="cursor-pointer font-bold underline"
          >
            Annuler les modifications
          </button>
        </Warning>
      )}

      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="wilaya-select">
            Wilaya
          </label>
          <select
            id="wilaya-select"
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className={`${inputCls} cursor-pointer`}
          >
            {wilayas.map((w) => (
              <option key={w.code} value={w.code}>
                {String(w.code).padStart(2, "0")} — {w.name} (
                {w.communes.length} communes)
              </option>
            ))}
          </select>
          <p className={hintCls}>
            {wilayas.length} wilayas ·{" "}
            {wilayas.reduce((n, w) => n + w.communes.length, 0)} communes au
            total.
          </p>
        </div>

        <div>
          <label className={labelCls} htmlFor="wilaya-fee">
            Tarif par défaut de {current?.name ?? "—"} (DA)
          </label>
          <input
            id="wilaya-fee"
            inputMode="numeric"
            value={
              current
                ? (wilayaDrafts[current.code] ?? String(current.fee))
                : ""
            }
            onChange={(e) => {
              if (!current) return;
              setWilayaDrafts((d) => ({
                ...d,
                [current.code]: e.target.value.replace(/[^0-9]/g, ""),
              }));
            }}
            className={inputCls}
          />
          <p className={hintCls}>
            Appliqué aux {inheritCount} commune{inheritCount > 1 ? "s" : ""} sans
            tarif propre.
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#17251f]/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center gap-2 rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] px-3.5 py-2 sm:w-96">
            <Search className="h-4 w-4 text-[#627269]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une commune dans toutes les wilayas…"
              aria-label="Rechercher une commune"
              className="w-full bg-transparent text-xs font-medium outline-none"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[.14em] text-[#78827b]">
            {term
              ? `${rows.length} résultat${rows.length > 1 ? "s" : ""}`
              : `${rows.length} commune${rows.length > 1 ? "s" : ""}`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className={`${ADMIN_TABLE_HEAD} ${GRID}`}>
              <span>Commune</span>
              <span>Tarif propre (DA)</span>
              <span>Tarif appliqué</span>
              <span />
            </div>

            {visible.map((row) => {
              const draft = communeDrafts[row.communeId];
              const value = draft ?? (row.fee === null ? "" : String(row.fee));
              const dirty = draft !== undefined && draft !== (row.fee === null ? "" : String(row.fee));
              // Preview the effective fee from the drafts, so the admin sees
              // the consequence of a wilaya change before saving.
              const wilayaDraft = wilayaDrafts[row.wilayaCode];
              const wilayaFee =
                wilayaDraft !== undefined && wilayaDraft !== ""
                  ? Number(wilayaDraft)
                  : row.wilayaFee;
              const own = value === "" ? null : Number(value);
              const applied = effectiveFee(
                Number.isFinite(own as number) ? own : null,
                wilayaFee,
              );

              return (
                <div
                  key={row.communeId}
                  className={`${ADMIN_TABLE_ROW} ${GRID} ${dirty ? "bg-[#edf3ee]" : ""}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[#17251f]">
                      {row.communeName}
                    </span>
                    {term && (
                      <span className="font-mono text-[10px] text-[#78827b]">
                        {String(row.wilayaCode).padStart(2, "0")} —{" "}
                        {row.wilayaName}
                      </span>
                    )}
                  </span>

                  <input
                    inputMode="numeric"
                    value={value}
                    onChange={(e) =>
                      setCommuneDrafts((d) => ({
                        ...d,
                        [row.communeId]: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    placeholder={`Hérite · ${fmtN(wilayaFee)}`}
                    aria-label={`Tarif de ${row.communeName}`}
                    className={smallInputCls}
                  />

                  <span
                    className={
                      value === ""
                        ? "font-mono text-[11px] text-[#78827b]"
                        : "font-mono text-[12px] font-bold text-[#17251f]"
                    }
                  >
                    {fmtDA(applied)}
                    {value === "" && " (hérité)"}
                  </span>

                  <button
                    type="button"
                    title="Rétablir l'héritage du tarif wilaya"
                    aria-label={`Rétablir l'héritage pour ${row.communeName}`}
                    disabled={value === ""}
                    onClick={() =>
                      setCommuneDrafts((d) => ({ ...d, [row.communeId]: "" }))
                    }
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#17251f]/15 bg-white text-[#627269] transition hover:border-[#1d4538] hover:text-[#1d4538] disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="p-12 text-center text-sm text-[#78827b]">
                Aucune commune ne correspond à cette recherche.
              </div>
            )}
            {hidden > 0 && (
              <div className="border-t border-[#17251f]/5 p-3 text-center font-mono text-[10px] uppercase tracking-[.14em] text-[#78827b]">
                {hidden} autre{hidden > 1 ? "s" : ""} résultat
                {hidden > 1 ? "s" : ""} — affinez la recherche
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-2 p-5 text-[11px] leading-5 text-[#627269]">
        <p className="font-mono text-[9.5px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
          Modification en masse par Excel
        </p>
        <p>
          <b>Exporter</b> produit un fichier avec une ligne par commune. Modifiez
          la colonne « Tarif commune (DA) » — une case vide fait hériter la
          commune du tarif de sa wilaya — puis <b>importez</b> le fichier.
        </p>
        <p>
          La colonne « Tarif wilaya (DA) » se répète sur chaque ligne de la
          wilaya : il suffit d&apos;en modifier une seule. Si plusieurs lignes
          d&apos;une même wilaya portent des valeurs différentes, la dernière
          l&apos;emporte.
        </p>
        <p>
          Les lignes dont la commune est inconnue ou le tarif illisible sont
          ignorées et comptées dans le résumé d&apos;import.
        </p>
      </Card>
    </div>
  );
}
