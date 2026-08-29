import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRepos } from "@/lib/data/repos";
import type { ProductDetail } from "@/lib/data/types";
import { fmtDA } from "@/lib/format";
import { ProductDetailClient } from "./product-detail-client";

export const dynamic = "force-dynamic";

const inFlight = new Map<string, Promise<ProductDetail | null>>();

async function loadProduct(idParam: string): Promise<ProductDetail | null> {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) return null;
  const existing = inFlight.get(idParam);
  if (existing) return existing;
  const p = getRepos()
    .products.publicDetail(id)
    .finally(() => {
      inFlight.delete(idParam);
    });
  inFlight.set(idParam, p);
  return p;
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
  const product = await loadProduct(id);
  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
