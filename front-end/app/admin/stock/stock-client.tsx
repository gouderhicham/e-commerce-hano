"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { frDate } from "@/lib/format";
import { AVAILABILITY_LABELS, AVAILABILITY_PILLS } from "@/lib/labels";
import { useServerList, type ListEnvelope } from "@/lib/admin/use-server-list";
import { useDebounce } from "@/lib/use-debounce";
import { useToast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/pagination";
import {
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_ROW,
  Card,
  PageHeader,
  Pill,
  ProductThumb,
  TabChip,
} from "@/components/admin/ui";
import type { Availability, ProductPublic } from "@/lib/data/types";

const GRID = "grid-cols-[52px_2fr_1.1fr_1fr_1.1fr_1fr]";
const PAGE_SIZE = 8;

type Tab = "tous" | "limite" | "rupture";

interface StockCounts {
  total: number;
  disponible: number;
  stock_limite: number;
  indisponible: number;
}

export type StockEnvelope = ListEnvelope<ProductPublic> & {
  stockCounts: StockCounts;
};

const TAB_AVAILABILITY: Record<Tab, Availability | undefined> = {
  tous: undefined,
  limite: "stock_limite",
  rupture: "indisponible",
};

const defaultStockEnvelope: StockEnvelope = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
  stockCounts: {
    total: 0,
    disponible: 0,
    stock_limite: 0,
    indisponible: 0,
  },
};

export function StockClient({ initial = defaultStockEnvelope }: { initial?: StockEnvelope }) {
  const { pushToast } = useToast();
  const [tab, setTab] = useState<Tab>("tous");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [flash, setFlash] = useState<Record<number, boolean>>({});

  const debouncedSearch = useDebounce(search.trim(), 300);
  const { data, loading, page, setPage, reload } =
    useServerList<StockEnvelope>("/api/admin/products", initial, {
      availability: TAB_AVAILABILITY[tab],
      q: debouncedSearch || undefined,
    });

  const counts = data.stockCounts;
  const rows = data.items;

  /** Commit on blur — the input is a free-text draft until then. */
  const commit = async (product: ProductPublic) => {
    const draft = drafts[product.id];
    setDrafts((d) => {
      const next = { ...d };
      delete next[product.id];
      return next;
    });
    if (draft === undefined || draft === "") return;
    const value = Number(draft);
    if (value === product.stock) return;

    const res = await apiFetch(`/api/admin/products/${product.id}/stock`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stock: value }),
    });
    if (!res.ok) {
      pushToast("Mise à jour du stock impossible.", "error");
      return;
    }
    setFlash((f) => ({ ...f, [product.id]: true }));
    window.setTimeout(
      () => setFlash((f) => ({ ...f, [product.id]: false })),
      700,
    );
    // The edit may flip availability, so refresh the rows and the KPI counts.
    await reload();
  };

  const kpis = [
    { label: "Références totales", value: counts.total, tone: "text-[#17251f]" },
    { label: "En stock", value: counts.disponible, tone: "text-[#2a624b]" },
    { label: "Stock limité", value: counts.stock_limite, tone: "text-[#8a6a25]" },
    { label: "Rupture", value: counts.indisponible, tone: "text-[#8b3a3a]" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Disponibilité"
        title="Gestion du Stock"
        hint="La disponibilité est dérivée du stock : 0 → « Rupture », 1-5 → « Stock limité », au-delà → « En stock »."
      />

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-4">
            <div className={`font-mono text-2xl font-bold ${kpi.tone}`}>
              {kpi.value}
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-[#78827b]">
              {kpi.label}
            </div>
          </Card>
        ))}
      </div>

      <Card className="flex flex-col items-center justify-between gap-4 p-4 sm:flex-row">
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] px-3.5 py-2 sm:w-80">
          <Search className="h-4 w-4 text-[#627269]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par nom ou référence…"
            aria-label="Rechercher un produit"
            className="w-full bg-transparent text-xs font-medium outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <TabChip
            label="Tous"
            count={counts.total}
            active={tab === "tous"}
            onClick={() => {
              setTab("tous");
              setPage(1);
            }}
          />
          <TabChip
            label="Stock limité"
            count={counts.stock_limite}
            active={tab === "limite"}
            onClick={() => {
              setTab("limite");
              setPage(1);
            }}
          />
          <TabChip
            label="Rupture"
            count={counts.indisponible}
            active={tab === "rupture"}
            onClick={() => {
              setTab("rupture");
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={`${ADMIN_TABLE_HEAD} ${GRID}`}>
                <span />
                <span>Nom</span>
                <span>Référence</span>
                <span>Quantité</span>
                <span>Statut</span>
                <span>Maj</span>
              </div>
              {rows.map((product) => (
                <div
                  key={product.id}
                  className={`${ADMIN_TABLE_ROW} ${GRID} py-[11px]`}
                >
                  <ProductThumb
                    imageUrl={product.imageUrl}
                    name={product.name}
                    tone={product.tone}
                  />
                  <span className="min-w-0 font-semibold leading-[1.3]">
                    {product.name}
                  </span>
                  <span className="font-mono text-[11px] tracking-[.05em] text-[#58675f]">
                    {product.reference}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={drafts[product.id] ?? String(product.stock)}
                    onChange={(e) =>
                      setDrafts((d) => ({
                        ...d,
                        [product.id]: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    onBlur={() => commit(product)}
                    aria-label={`Stock de ${product.name}`}
                    className={`h-[38px] w-[84px] rounded-lg border px-2.5 text-center text-sm font-semibold transition-all duration-300 ${
                      flash[product.id]
                        ? "border-[#1d4538] bg-[#dcebdd]"
                        : "border-[#17251f]/15 bg-white"
                    }`}
                  />
                  <span>
                    <Pill
                      label={AVAILABILITY_LABELS[product.availability]}
                      colors={AVAILABILITY_PILLS[product.availability]}
                    />
                  </span>
                  <span className="font-mono text-[11px] text-[#78827b]">
                    {frDate(product.updatedAt)}
                  </span>
                </div>
              ))}
              {rows.length === 0 && (
                <div className="p-12 text-center text-sm text-[#78827b]">
                  Aucun produit dans cette vue.
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-[#17251f]/10 px-4 pb-4">
          <Pagination
            page={page}
            pageCount={data.pageCount}
            total={data.total}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </div>
      </Card>
    </div>
  );
}
