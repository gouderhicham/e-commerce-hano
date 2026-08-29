import { ClientsClient } from "./clients-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Clients — Administration" };

export default function AdminClientsPage() {
  return <ClientsClient />;
}
