"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, MapPin, Phone, Search, Wallet, X } from "lucide-react";
import { apiFetch, mediaSrc } from "@/lib/api-client";
import { fmtDA, frDateTime } from "@/lib/format";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_PILLS,
  ORDER_STATUS_SHORT,
  PAYMENT_METHOD_LABELS,
} from "@/lib/labels";
import { useServerList } from "@/lib/admin/use-server-list";
import {
  Card,
  ErrorBanner,
  PageHeader,
  Pill,
  SavedBanner,
  TabChip,
  TableSkeleton,
  dangerBtn,
} from "@/components/admin/ui";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@/lib/use-debounce";
import type { Order, OrderStatus, Wilaya } from "@/lib/data/types";

/* eslint-disable @next/next/no-img-element -- see accueil-client.tsx. */

const PAGE_SIZE = 8;

interface Envelope {
  items: Order[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<OrderStatus | "toutes", number>;
}

const defaultEnvelope: Envelope = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
  counts: {
    toutes: 0,
    NOUVELLE: 0,
    PRETE_A_LIVRER: 0,
    EN_LIVRAISON: 0,
    LIVREE: 0,
    ANNULEE: 0,
  },
};

export function CommandesClient({
  initial = defaultEnvelope,
  wilayas: initialWilayas = [],
  focusOrderId,
}: {
  initial?: Envelope;
  wilayas?: Wilaya[];
  /** `?order=CMD-…` — a bell notification asking for this order sheet. */
  focusOrderId?: string | null;
}) {
  const [wilayas, setWilayas] = useState<Wilaya[]>(initialWilayas);
  const [status, setStatus] = useState<OrderStatus | "">("");
  // The server already filtered on the deep-linked order; keep the box in sync
  // so clearing it is how the admin gets back to the full list.
  const [search, setSearch] = useState(focusOrderId ?? "");
  const debouncedSearch = useDebounce(search, 250);

  useEffect(() => {
    if (initialWilayas.length > 0) return;
    let alive = true;
    apiFetch("/api/shipping/wilayas")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (alive && Array.isArray(data)) setWilayas(data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [initialWilayas.length]);

  const { data, loading, page, setPage, reload } = useServerList<Envelope>(
    "/api/admin/orders",
    initial,
    { status: status || undefined, q: debouncedSearch || undefined },
  );

  const [selected, setSelected] = useState<Order | null>(null);
  const [closedFocus, setClosedFocus] = useState(false);

  const activeOrder: Order | null = useMemo<Order | null>(() => {
    if (selected) return selected;
    if (focusOrderId && !closedFocus) {
      return data.items.find((o: Order) => o.id === focusOrderId) ?? null;
    }
    return null;
  }, [selected, focusOrderId, closedFocus, data.items]);

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const wilayaLabel = (code: number) => {
    const w = wilayas.find((x) => x.code === code);
    return w ? `${String(w.code).padStart(2, "0")} - ${w.name}` : `#${code}`;
  };
  const communeLabel = (wilayaCode: number, communeId: number) =>
    wilayas
      .find((w) => w.code === wilayaCode)
      ?.communes.find((c) => c.id === communeId)?.name ?? "";

  const flash = (message: string) => {
    setSaved(message);
    window.setTimeout(() => setSaved(""), 2500);
  };

  const applyStatus = async (order: Order, next: OrderStatus) => {
    setBusy(true);
    setError("");
    try {
      const res =
        next === "ANNULEE"
          ? await apiFetch(`/api/admin/orders/${order.id}/cancel`, {
              method: "POST",
            })
          : await apiFetch(`/api/admin/orders/${order.id}/status`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: next }),
            });
      const payload = (await res.json().catch(() => null)) as {
        order?: Order;
        error?: string;
      } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Mise à jour impossible.");
        return;
      }
      if (payload?.order && selected?.id === order.id) setSelected(payload.order);
      await reload();
      flash(
        next === "ANNULEE"
          ? `Commande ${order.id} annulée — stock réapprovisionné.`
          : `Commande ${order.id} : ${ORDER_STATUS_LABELS[next]}.`,
      );
    } catch {
      setError("Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  };

  const itemCount = (order: Order) =>
    order.lines.reduce((sum, line) => sum + line.qty, 0);

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Suivi des Ventes"
        title={`Gestion des Commandes (${data.total})`}
        hint="Chaque commande reprend exactement le formulaire de checkout : coordonnées, livraison, panier et paiement à la livraison."
      />

      {saved && <SavedBanner>{saved}</SavedBanner>}
      <ErrorBanner>{error}</ErrorBanner>

      <Card className="flex flex-col items-center justify-between gap-4 p-4 lg:flex-row">
        <div className="flex w-full items-center gap-2 rounded-xl border border-[#17251f]/15 bg-[#f4f7f3] px-3.5 py-2 lg:w-72">
          <Search className="h-4 w-4 text-[#627269]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="N° de commande ou client…"
            aria-label="Rechercher une commande"
            className="w-full bg-transparent text-xs font-medium outline-none"
          />
        </div>

        <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 lg:w-auto lg:pb-0">
          <TabChip
            label="Toutes"
            count={data.counts?.toutes}
            active={status === ""}
            onClick={() => {
              setStatus("");
              setPage(1);
            }}
          />
          {ORDER_STATUSES.map((s) => (
            <TabChip
              key={s}
              label={ORDER_STATUS_SHORT[s]}
              count={data.counts?.[s]}
              active={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            />
          ))}
        </div>
      </Card>

      {loading ? (
        <TableSkeleton />
      ) : data.items.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-[#627269]">
            Aucune commande pour ce filtre.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#17251f]/10 bg-[#f4f7f3] font-mono text-[9.5px] uppercase tracking-[.14em] text-[#78827b]">
                <tr>
                  <th className="p-4">ID Commande</th>
                  <th className="p-4">Client &amp; Contact</th>
                  <th className="p-4">Destination</th>
                  <th className="p-4">Panier</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Total</th>
                  <th className="p-4">Statut</th>
                  <th className="p-4 text-right">Fiche</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#17251f]/10 font-medium">
                {data.items.map((order) => (
                  <tr key={order.id} className="transition hover:bg-[#f8faf7]">
                    <td className="p-4 font-mono font-bold text-[#1d4538]">
                      {order.id}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-[#17251f]">
                        {order.customerName}
                      </p>
                      <p className="text-[10px] text-[#627269]">{order.phone}</p>
                    </td>
                    <td className="p-4 text-[#4f5d55]">
                      <p>{wilayaLabel(order.wilayaCode)}</p>
                      <p className="text-[10px] text-[#627269]">
                        {communeLabel(order.wilayaCode, order.communeId)}
                      </p>
                    </td>
                    <td className="p-4 text-[#4f5d55]">
                      <p className="font-mono text-[11px] font-bold">
                        {itemCount(order)} art.
                      </p>
                      <p className="max-w-[140px] truncate text-[10px] text-[#627269]">
                        {order.lines.map((l) => l.name).join(", ")}
                      </p>
                    </td>
                    <td className="p-4 text-[11px] text-[#627269]">
                      {frDateTime(order.createdAt)}
                    </td>
                    <td className="p-4 font-mono text-sm font-bold text-[#17251f]">
                      {fmtDA(order.total)}
                    </td>
                    <td className="p-4">
                      <select
                        value={order.status}
                        disabled={busy || order.status === "ANNULEE"}
                        onChange={(e) =>
                          applyStatus(order, e.target.value as OrderStatus)
                        }
                        aria-label={`Statut de ${order.id}`}
                        className="cursor-pointer rounded-lg border border-[#17251f]/20 bg-white px-2.5 py-1 font-mono text-[10px] font-bold outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ORDER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {ORDER_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(order)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#1d4538] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#14352b]"
                      >
                        <span>Voir</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      )}

      <Modal
        open={!!activeOrder}
        onClose={() => {
          setSelected(null);
          setClosedFocus(true);
        }}
        maxWidth={560}
      >
        {activeOrder && (
          <>
            <div className="mb-4 flex items-center justify-between border-b border-[#17251f]/10 pb-4">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[#1d4538]">
                  Fiche de commande
                </span>
                <h2 className="text-xl font-bold text-[#17251f]">
                  {activeOrder.id}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelected(null);
                  setClosedFocus(true);
                }}
                aria-label="Fermer"
                className="cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5 rounded-xl bg-[#edf3ee] p-4">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
                  01 · Coordonnées
                </span>
                <p className="text-sm font-bold text-[#17251f]">
                  {activeOrder.customerName}
                </p>
                <p className="flex items-center gap-1.5 text-[#627269]">
                  <Phone className="h-3.5 w-3.5" /> {activeOrder.phone}
                </p>
                {activeOrder.email && (
                  <p className="text-[#627269]">{activeOrder.email}</p>
                )}
              </div>

              <div className="space-y-1.5 rounded-xl border border-[#17251f]/10 bg-[#f4f7f3] p-4">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[.14em] text-[#1d4538]">
                  02 · Livraison
                </span>
                <p className="flex items-start gap-1.5 font-medium text-[#4f5d55]">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {communeLabel(activeOrder.wilayaCode, activeOrder.communeId)} —{" "}
                    {wilayaLabel(activeOrder.wilayaCode)}
                  </span>
                </p>
                <p className="text-[11px] text-[#78827b]">
                  Appeler le client pour convenir du point de livraison.
                </p>
                <p className="pt-1 font-mono text-[10px] text-[#78827b]">
                  Reçue le {frDateTime(activeOrder.createdAt)}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-mono text-[10px] font-bold uppercase text-[#1d4538]">
                  Panier ({itemCount(activeOrder)} articles)
                </h3>
                <div className="divide-y divide-[#17251f]/10 border-y border-[#17251f]/10">
                  {activeOrder.lines.map((line) => (
                    <div key={line.id} className="flex items-center gap-3 py-2.5">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[#17251f]/10 bg-[#e0ebe1]">
                        {line.imageUrl && (
                          <img
                            src={mediaSrc(line.imageUrl) ?? ""}
                            alt=""
                            className="h-full w-full object-cover mix-blend-multiply"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold leading-4 text-[#17251f]">
                          {line.name}{" "}
                          <span className="font-mono text-[10px] text-[#627269]">
                            ×{line.qty}
                          </span>
                        </p>
                        <p className="text-[10.5px] text-[#627269]">
                          {line.meta}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-mono font-bold text-[#1d4538]">
                        {fmtDA(line.unitPrice * line.qty)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <p className="flex justify-between font-medium text-[#627269]">
                  <span>Sous-total</span>
                  <span className="font-mono font-semibold text-[#17251f]">
                    {fmtDA(activeOrder.subtotal)}
                  </span>
                </p>
                <p className="flex justify-between font-medium text-[#627269]">
                  <span>Livraison</span>
                  <span className="font-mono font-semibold text-[#17251f]">
                    {fmtDA(activeOrder.shippingFee)}
                  </span>
                </p>
                <div className="flex items-baseline justify-between border-t border-[#17251f]/10 pt-2.5">
                  <span className="text-sm font-bold text-[#17251f]">
                    Total à percevoir
                  </span>
                  <span className="font-mono text-xl font-extrabold text-[#1d4538]">
                    {fmtDA(activeOrder.total)}
                  </span>
                </div>
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase text-[#1d4538]">
                  <Wallet className="h-3.5 w-3.5" />{" "}
                  {PAYMENT_METHOD_LABELS[activeOrder.method]}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Pill
                    label={ORDER_STATUS_LABELS[activeOrder.status]}
                    colors={ORDER_STATUS_PILLS[activeOrder.status]}
                  />
                </div>
              </div>

              <div className="border-t border-[#17251f]/10 pt-3">
                <label className="mb-1 block font-mono text-[9.5px] font-bold uppercase text-[#78827b]">
                  Mettre à jour le statut :
                </label>
                <div className="flex flex-wrap gap-2">
                  {ORDER_STATUSES.filter((s) => s !== "ANNULEE").map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={busy || activeOrder.status === "ANNULEE"}
                      onClick={() => applyStatus(activeOrder, s)}
                      className={`cursor-pointer rounded-lg px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        activeOrder.status === s
                          ? "bg-[#1d4538] text-white"
                          : "border border-[#17251f]/15 bg-white text-[#17251f] hover:bg-gray-50"
                      }`}
                    >
                      {ORDER_STATUS_SHORT[s]}
                    </button>
                  ))}
                </div>
                {activeOrder.status !== "ANNULEE" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        confirm(
                          "Annuler cette commande ? Le stock de chaque ligne sera réapprovisionné.",
                        )
                      )
                        void applyStatus(activeOrder, "ANNULEE");
                    }}
                    className={`${dangerBtn} mt-3 w-full justify-center py-2`}
                  >
                    Annuler la commande (restocke)
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
