import { ProduitsClient } from "./produits-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produits — Administration" };

export default async function AdminProduitsPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;

  return (
    <ProduitsClient
      focusProductId={product ? Number(product) : null}
    />
  );
}
