import { fetchAdminList } from "@/lib/admin/server-list";
import type { ListEnvelope } from "@/lib/admin/use-server-list";
import type { ClientAggregate } from "@/lib/data/types";
import { ClientsClient } from "./clients-client";
import { getRepos } from "@/lib/data/repos";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients — Administration" };

export default async function AdminClientsPage() {
  const [initial, wilayas] = await Promise.all([
    fetchAdminList<ListEnvelope<ClientAggregate>>("/api/admin/clients?page=1"),
    getRepos().misc.wilayas(),
  ]);
  return <ClientsClient initial={initial} wilayas={wilayas} />;
}
