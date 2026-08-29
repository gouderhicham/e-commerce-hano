import type { Metadata } from "next";
import { getRepos } from "@/lib/data/repos";
import type { ProductDetail } from "@/lib/data/types";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

async function loadProduct(idParam: string): Promise<ProductDetail | null> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  try {
    return await getRepos().products.publicDetail(id);
  } catch {
    return null;
  }
}

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
  const product = Number.isInteger(numId) && numId > 0 ? await loadProduct(id) : null;

  return <ProductDetailClient initialProduct={product} productId={numId || 1} />;
}
