"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  Package,
  Trash2,
  Warehouse,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { frDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { useAdminBadges } from "@/components/admin/badges-context";
import {
  Card,
  PageHeader,
  ghostBtn,
  primaryBtn,
} from "@/components/admin/ui";
import type { Notification } from "@/lib/data/types";

/**
 * Where a notification takes the admin. A stock alert opens the product that
 * ran low, a message alert opens that message, an order alert opens the order
 * sheet — never the generic Commandes list for all three.
 */
function target(n: Notification): { href: string; label: string } {
  switch (n.type) {
    case "STOCK":
      return {
        href: n.productId
          ? `/admin/produits?product=${n.productId}`
          : "/admin/stock",
        label: n.productId ? "Voir le produit" : "Voir le stock",
      };
    case "MESSAGE":
      return {
        href: n.contactMessageId
          ? `/admin/messages?message=${n.contactMessageId}`
          : "/admin/messages",
        label: "Lire le message",
      };
    case "ORDER":
    default:
      return {
        href: n.orderId
          ? `/admin/commandes?order=${encodeURIComponent(n.orderId)}`
          : "/admin/commandes",
        label: n.orderId ?? "Voir la commande",
      };
  }
}

const ICONS = {
  ORDER: Package,
  MESSAGE: MessageSquare,
  STOCK: Warehouse,
} as const;

export function NotificationsClient({
  initial,
}: {
  initial: { items: Notification[]; unreadCount: number };
}) {
  const router = useRouter();
  const { pushToast } = useToast();
  const { refresh: refreshBadges } = useAdminBadges();
  const [items, setItems] = useState(initial.items);
  const [unread, setUnread] = useState(initial.unreadCount);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    const res = await apiFetch("/api/admin/notifications");
    if (!res.ok) return;
    const data = (await res.json()) as {
      items: Notification[];
      unreadCount: number;
    };
    setItems(data.items);
    setUnread(data.unreadCount);
    // The bell in the top bar reads its own counter — keep it in step.
    await refreshBadges();
  };

  const markRead = async (id: string): Promise<boolean> => {
    const res = await apiFetch(`/api/admin/notifications/${id}/read`, {
      method: "PATCH",
    });
    if (!res.ok) {
      pushToast("Impossible de marquer comme lue.", "error");
      return false;
    }
    // Optimistic: the row must stop looking unread even before the reload.
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
    setUnread((prev) => Math.max(0, prev - 1));
    return true;
  };

  /** Opening a notification is what "reading" it means. */
  const open = async (n: Notification) => {
    setBusy(true);
    try {
      if (!n.read) {
        await markRead(n.id);
        await refreshBadges();
      }
      router.push(target(n).href);
    } finally {
      setBusy(false);
    }
  };

  const markReadOnly = async (n: Notification) => {
    setBusy(true);
    try {
      if (await markRead(n.id)) await reload();
    } finally {
      setBusy(false);
    }
  };

  const markAllRead = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) {
        pushToast("Impossible de tout marquer comme lu.", "error");
        return;
      }
      pushToast("Toutes les notifications sont lues", "success");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/notifications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        pushToast("Suppression impossible.", "error");
        return;
      }
      const targetItem = items.find((n) => n.id === id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      if (targetItem && !targetItem.read) {
        setUnread((prev) => Math.max(0, prev - 1));
      }
      pushToast("Notification supprimée de la base", "success");
      await refreshBadges();
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    setBusy(true);
    try {
      const res = await apiFetch("/api/admin/notifications", {
        method: "DELETE",
      });
      if (!res.ok) {
        pushToast("Suppression impossible.", "error");
        return;
      }
      setItems([]);
      setUnread(0);
      pushToast("Toutes les notifications ont été supprimées", "success");
      await refreshBadges();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl animate-fade-in space-y-6">
      <PageHeader
        eyebrow="Activité"
        title={`Notifications${unread > 0 ? ` (${unread} non lues)` : ""}`}
        hint="Les 8 dernières alertes. Ouvrir une alerte la marque comme lue et vous emmène à la commande, au message ou au produit concerné."
        action={
          items.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={busy}
                  className={primaryBtn}
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Tout marquer comme lu</span>
                </button>
              )}
              <button
                type="button"
                onClick={removeAll}
                disabled={busy}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#17251f]/15 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-[#dc2626] shadow-xs transition hover:border-[#dc2626]/30 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Tout effacer</span>
              </button>
            </div>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <Card className="px-6 py-16 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-[#c3cbc5]" />
          <div className="mb-1.5 text-[17px] font-semibold text-[#17251f]">
            Aucune notification
          </div>
          <div className="text-sm text-[#78827b]">
            Les nouvelles commandes et alertes de stock apparaîtront ici.
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {items.map((n) => {
            const { href, label } = target(n);
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <div
                key={n.id}
                className={`flex items-center gap-3.5 border-b border-[#17251f]/5 px-5 py-4 last:border-b-0 ${
                  n.read ? "bg-[#fdfcf8]" : "bg-[#edf3ee]"
                }`}
              >
                <span
                  className={`h-[9px] w-[9px] shrink-0 rounded-full ${
                    n.read ? "bg-[#d3dad5]" : "bg-[#1d4538]"
                  }`}
                />
                <Icon className="h-4 w-4 shrink-0 text-[#1d4538]" />
                <button
                  type="button"
                  onClick={() => open(n)}
                  disabled={busy}
                  title={`Ouvrir : ${href}`}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <p
                    className={`text-sm text-[#17251f] ${n.read ? "font-medium" : "font-bold"}`}
                  >
                    {n.message}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#78827b]">
                    {frDateTime(n.createdAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => open(n)}
                  disabled={busy}
                  className="shrink-0 cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[.1em] text-[#1d4538] hover:underline"
                >
                  {label}
                </button>
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => markReadOnly(n)}
                    disabled={busy}
                    className={`${ghostBtn} h-8 shrink-0 px-3 py-0 text-[10px]`}
                  >
                    Lu
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  disabled={busy}
                  title="Supprimer de la base de données"
                  aria-label="Supprimer de la base de données"
                  className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg text-[#78827b] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
