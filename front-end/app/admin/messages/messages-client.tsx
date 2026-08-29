"use client";

import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CardPager } from "@/components/admin/ui";
import { useAdminBadges } from "@/components/admin/badges-context";
import { useServerList } from "@/lib/admin/use-server-list";
import { useToast } from "@/components/ui/toast";
import { frDate } from "@/lib/format";
import type { ContactMessage } from "@/lib/data/types";
import type { MessagesEnvelope } from "./page";

const PAGE_SIZE = 8;

const defaultMessagesEnvelope: MessagesEnvelope = {
  items: [],
  total: 0,
  page: 1,
  pageCount: 1,
  unreadCount: 0,
};

export function MessagesClient({
  initial = defaultMessagesEnvelope,
  focusId,
}: {
  initial?: MessagesEnvelope;
  /** `?message=<id>` — a bell notification asking for this message. */
  focusId?: string | null;
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { refresh: refreshBadges } = useAdminBadges();
  const { data, loading, page, setPage, reload } =
    useServerList<MessagesEnvelope>("/api/admin/messages", initial, {});
  const [expanded, setExpanded] = useState<string | null>(focusId ?? null);

  const messages = data.items;

  const markRead = async (id: string) => {
    const res = await apiFetch(`/api/admin/messages/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) return;
    await reload(); // refresh the read dot for this page
    await refreshBadges(); // sidebar + bell counters
    router.refresh();
  };

  // Arriving from the bell: the message is already expanded, so reading it is
  // exactly what the admin just did.
  useEffect(() => {
    if (!focusId) return;
    const target = initial.items.find((m) => m.id === focusId);
    if (target && !target.read) void markRead(focusId);
    // Runs once for the deep link; markRead is stable enough for this purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const toggle = (m: ContactMessage) => {
    const opening = expanded !== m.id;
    setExpanded(opening ? m.id : null);
    if (opening && !m.read) void markRead(m.id);
  };

  const remove = async (id: string) => {
    const res = await apiFetch(`/api/admin/messages/${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("Suppression impossible.", "error");
      return;
    }
    if (expanded === id) setExpanded(null);
    pushToast("Message supprimé", "success");
    // Deleting the only row on a later page would strand it on an empty page.
    if (messages.length === 1 && page > 1) setPage(page - 1);
    else void reload();
    void refreshBadges();
    router.refresh();
  };

  if (data.total === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[#17251f]/15 bg-white px-6 py-[72px] text-center">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#c3cbc5"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mx-auto mb-3 block"
        >
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <path d="M22 6l-10 7L2 6" />
        </svg>
        <div className="mb-1.5 text-[17px] font-semibold">Aucun message</div>
        <div className="text-sm text-[#78827b]">
          Les messages envoyés depuis la page Contact apparaîtront ici.
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-3.5 transition-opacity"
      style={{ opacity: loading ? 0.6 : 1 }}
    >
      {messages.map((m) => {
        const isOpen = expanded === m.id;
        return (
          <div
            key={m.id}
            className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
              isOpen
                ? "border-[#1d4538]/30 bg-[#fbfcfb] shadow-sm ring-1 ring-[#1d4538]/10"
                : m.read
                  ? "border-[#17251f]/10 bg-white hover:border-[#17251f]/20 hover:shadow-xs"
                  : "border-[#1d4538]/25 bg-[#f3f7f4] hover:border-[#1d4538]/40 hover:shadow-xs"
            }`}
          >
            {/* Clickable Header */}
            <div
              onClick={() => toggle(m)}
              className="flex cursor-pointer items-center gap-3.5 px-5 py-4 select-none"
            >
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors ${
                  m.read ? "bg-[#c8d2cb]" : "bg-[#1d4538] ring-4 ring-[#1d4538]/15"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="text-sm text-[#17251f]"
                    style={{ fontWeight: m.read ? 600 : 700 }}
                  >
                    {m.name}
                  </span>
                  <span className="inline-flex h-[22px] items-center rounded-full border border-[#1d4538]/30 bg-[#edf3ee] px-2.5 text-[11px] font-semibold whitespace-nowrap text-[#1d4538]">
                    {m.subject}
                  </span>
                  {!isOpen && (
                    <span className="hidden text-xs text-[#78827b] truncate sm:inline max-w-md">
                      · {m.message.length > 80 ? `${m.message.slice(0, 80)}…` : m.message}
                    </span>
                  )}
                </div>
                {isOpen && (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#58675f]">
                    <span className="font-mono">{m.email}</span>
                    {m.phone && <span className="font-mono">· {m.phone}</span>}
                  </div>
                )}
              </div>

              <span className="font-mono text-xs whitespace-nowrap text-[#78827b]">
                {frDate(m.createdAt)}
              </span>

              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#58675f] transition-all hover:bg-[#e7eee5]">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-transform duration-200"
                  style={{ transform: `rotate(${isOpen ? 180 : 0}deg)` }}
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
            </div>

            {/* Expanded Body with Generous Spacing */}
            {isOpen && (
              <div className="space-y-4 border-t border-[#17251f]/10 px-5 pt-4 pb-5">
                {/* Full Message Box */}
                <div className="rounded-xl border border-[#17251f]/10 bg-[#f8f7f2] p-4 sm:p-5 text-sm leading-relaxed whitespace-pre-wrap text-[#22332a]">
                  {m.message}
                </div>

                {/* Action Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject} — pc store 39`)}`}
                      className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1d4538] px-4 text-xs font-bold uppercase tracking-[.06em] !text-white shadow-xs transition hover:bg-[#14352b]"
                    >
                      Répondre par email
                    </a>
                    {m.phone && (
                      <a
                        href={`tel:${m.phone}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#17251f]/15 bg-white px-3 text-xs font-semibold text-[#17251f] shadow-xs transition hover:bg-[#f4f7f3]"
                      >
                        Appeler ({m.phone})
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(m.id)}
                    className="h-9 cursor-pointer rounded-lg border border-[#17251f]/15 bg-white px-3.5 text-xs font-semibold text-red-600 shadow-xs transition hover:border-red-300 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <CardPager
        page={data.page}
        pageCount={data.pageCount}
        total={data.total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  );
}
