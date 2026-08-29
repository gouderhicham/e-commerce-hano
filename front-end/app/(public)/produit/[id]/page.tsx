import type { Metadata } from "next";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Détail Produit — pc store 39",
    description: "Ordinateur portable reconditionné, testé et garanti.",
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numId = Number(id);

  return <ProductDetailClient productId={Number.isInteger(numId) && numId > 0 ? numId : 1} />;
}
