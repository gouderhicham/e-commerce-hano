import { fetchAdminList } from "@/lib/admin/server-list";
import { getRepos } from "@/lib/data/repos";
import type { Order, OrderStatus } from "@/lib/data/types";
import { CommandesClient } from "./commandes-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Commandes — Administration" };

interface Envelope {
  items: Order[];
  total: number;
  page: number;
  pageCount: number;
  counts: Record<OrderStatus | "toutes", number>;
}

export default async function AdminCommandesPage({
  searchParams,
}: {
  // `?order=CMD-…` — where a "nouvelle commande" notification lands.
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const [initial, wilayas] = await Promise.all([
    fetchAdminList<Envelope>(
      `/api/admin/orders?page=1${order ? `&q=${encodeURIComponent(order)}` : ""}`,
    ),
    getRepos().misc.wilayas(),
  ]);

  return (
    <CommandesClient
      initial={initial}
      wilayas={wilayas}
      focusOrderId={order ?? null}
    />
  );
}
