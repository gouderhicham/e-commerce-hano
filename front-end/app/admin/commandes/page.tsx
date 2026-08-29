import { CommandesClient } from "./commandes-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Commandes — Administration" };

export default async function AdminCommandesPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <CommandesClient
      focusOrderId={order ?? null}
    />
  );
}
