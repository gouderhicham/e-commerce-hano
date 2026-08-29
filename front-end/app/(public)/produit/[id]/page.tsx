import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepos } from "@/lib/data/repos";
import { fmtDA } from "@/lib/format";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

const loadProduct = cache(async (idParam: string) => {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  return getRepos().products.publicDetail(id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) return { title: "Produit introuvable — pc store 39" };
  return {
    title: `${product.name} — pc store 39`,
    description:
      product.description ||
      `${product.name} — ${product.specs} · ${fmtDA(product.promoPrice ?? product.price)}`,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) notFound();

  // Wilayas + communes feed the on-page quick-order form (and its live
  // delivery-fee preview), so the visitor never has to reach the cart.
  const wilayas = await getRepos().misc.wilayas();

  return <ProductDetailClient product={product} wilayas={wilayas} />;
}
