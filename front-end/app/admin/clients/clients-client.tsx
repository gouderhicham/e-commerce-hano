"use client";

import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import {
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_ROW,
  CardPager,
  Pill,
} from "@/components/admin/ui";
import {
  useServerList,
  type ListEnvelope,
} from "@/lib/admin/use-server-list";
import { fmtDA, frDate } from "@/lib/format";
import { ORDER_STATUS_LABELS, ORDER_STATUS_PILLS } from "@/lib/labels";
import type { ClientAggregate, Order, Wilaya } from "@/lib/data/types";

const GRID = "grid-cols-[1.5fr_1.8fr_1.3fr_0.9fr_0.9fr_0.8fr_1.1fr_1.1fr]";
const PAGE_SIZE = 8;

export function ClientsClient({
  initial,
  wilayas,
}: {
  initial: ListEnvelope<ClientAggregate>;
  wilayas: Wilaya[];
}) {
  const { data, loading, setPage } = useServerList<ListEnvelope<ClientAggregate>>(
    "/api/admin/clients",
    initial,
    {},
  );
  const [drawer, setDrawer] = useState<{
    open: boolean;
    client: ClientAggregate | null;
    orders: Order[];
    loading: boolean;
  }>({ open: false, client: null, orders: [], loading: false });

  const getWilayaName = (code: number | null | undefined) => {
    if (code == null) return "—";
    return wilayas.find((w) => w.code === code)?.name ?? code;
  };

  const getCommuneName = (wCode: number | null | undefined, cId: number | null | undefined) => {
    if (wCode == null || cId == null) return "—";
    const w = wilayas.find((w) => w.code === wCode);
    return w?.communes.find((c) => c.id === cId)?.name ?? cId;
  };

  const rows = data.items;

  const openClient = (c: ClientAggregate) => {
    setDrawer({ open: true, client: c, orders: [], loading: true });
    apiFetch(`/api/admin/clients/${c.user.id}`)
      .then((r) => r.json())
      .then((data) =>
        setDrawer((d) =>
          d.client?.user.id === c.user.id
            ? { ...d, orders: data.orders ?? [], loading: false }
            : d,
        ),
      )
      .catch(() => setDrawer((d) => ({ ...d, loading: false })));
  };

  const c = drawer.client;

  return (
    <div>
      <div
        className="overflow-hidden rounded-[14px] border border-[#17251f]/10 bg-white transition-opacity"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={`${ADMIN_TABLE_HEAD} ${GRID}`}>
              <span>Nom</span>
              <span>Email</span>
              <span>Téléphone</span>
              <span>Wilaya</span>
              <span>Commune</span>
              <span>Cmd.</span>
              <span>Total dépensé</span>
              <span>Inscription</span>
            </div>
            {rows.map((row) => (
              <div
                key={row.user.id}
                onClick={() => openClient(row)}
                className={`${ADMIN_TABLE_ROW} ${GRID} cursor-pointer py-[13px] hover:bg-[#edf3ee]`}
              >
                <span className="min-w-0 overflow-hidden font-semibold text-ellipsis whitespace-nowrap">
                  {row.user.name}
                </span>
                <span className="min-w-0 overflow-hidden text-[#58675f] text-ellipsis whitespace-nowrap">
                  {row.user.email}
                </span>
                <span className="text-[13px] text-[#58675f]">
                  {row.user.phone ?? "—"}
                </span>
                <span className="text-[#58675f]">{getWilayaName(row.user.wilayaCode)}</span>
                <span className="text-[#58675f]">{getCommuneName(row.user.wilayaCode, row.user.communeId)}</span>
                <span className="font-mono font-bold">{row.orders}</span>
                <span className="font-mono font-bold whitespace-nowrap">
                  {fmtDA(row.totalSpent)}
                </span>
                <span className="text-[#58675f]">{frDate(row.since)}</span>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="p-12 text-center text-[#78827b]">Aucun client.</div>
            )}
          </div>
        </div>
        <CardPager
          page={data.page}
          pageCount={data.pageCount}
          total={data.total}
          pageSize={PAGE_SIZE}
          onPage={setPage}
        />
      </div>

      {/* CLIENT DRAWER */}
      {drawer.open && c && (
        <>
          <div
            className="fixed inset-0 z-[150] bg-[rgba(23,37,31,0.45)]"
            onClick={() => setDrawer((d) => ({ ...d, open: false }))}
          />
          <div className="fixed top-0 right-0 bottom-0 z-[151] flex w-[480px] max-w-[94vw] flex-col bg-white shadow-[-16px_0_40px_rgba(23,37,31,0.18)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[#17251f]/10 px-6 py-5">
              <h2 className="m-0 font-mono text-xl font-bold">
                Profil client
              </h2>
              <button
                onClick={() => setDrawer((d) => ({ ...d, open: false }))}
                aria-label="Fermer"
                className="h-9 w-9 cursor-pointer rounded-lg border border-[#17251f]/10 bg-white text-xl leading-none text-[#58675f]"
              >
                ×
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto p-6">
              <div className="flex items-center gap-3.5">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1d4538] font-mono text-[22px] font-bold text-white">
                  {c.user.name.charAt(0).toUpperCase()}
                </span>
                <div>
                  <div className="font-mono text-xl font-bold">
                    {c.user.name}
                  </div>
                  <div className="text-[13px] text-[#78827b]">
                    Client depuis {frDate(c.since)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[10px] bg-[#f8f7f2] p-3.5">
                  <div className="font-mono text-[22px] font-bold">
                    {c.orders}
                  </div>
                  <div className="text-xs text-[#78827b]">Commandes</div>
                </div>
                <div className="rounded-[10px] bg-[#f8f7f2] p-3.5">
                  <div className="font-mono text-[22px] font-bold text-[#2a624b]">
                    {fmtDA(c.totalSpent)}
                  </div>
                  <div className="text-xs text-[#78827b]">Total dépensé</div>
                </div>
              </div>
              <div className="flex flex-col gap-[7px] rounded-xl border border-[#17251f]/10 bg-[#f8f7f2] p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-[#78827b]">Email</span>
                  <span className="font-medium">{c.user.email}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#78827b]">Téléphone</span>
                  <span className="font-medium">{c.user.phone ?? "—"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#78827b]">Wilaya</span>
                  <span className="font-medium">{getWilayaName(c.user.wilayaCode)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#78827b]">Commune</span>
                  <span className="font-medium">{getCommuneName(c.user.wilayaCode, c.user.communeId)}</span>
                </div>
              </div>
              <div>
                <div className="mb-3 font-mono text-xs font-bold tracking-[0.1em] text-[#58675f] uppercase">
                  Commandes
                </div>
                {drawer.loading ? (
                  <div className="flex flex-col gap-2">
                    <div className="skeleton h-[58px] rounded-[10px]" />
                    <div className="skeleton h-[58px] rounded-[10px]" />
                  </div>
                ) : drawer.orders.length === 0 ? (
                  <div className="text-sm text-[#78827b]">Aucune commande.</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {drawer.orders.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center justify-between gap-3 rounded-[10px] border border-[#17251f]/10 px-3.5 py-3"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-sm font-bold">
                            {o.id}
                          </div>
                          <div className="text-xs text-[#78827b]">
                            {frDate(o.createdAt)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Pill
                            label={ORDER_STATUS_LABELS[o.status]}
                            colors={ORDER_STATUS_PILLS[o.status]}
                          />
                          <span className="font-mono text-sm font-bold whitespace-nowrap">
                            {fmtDA(o.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
