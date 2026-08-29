import { getRepos } from "@/lib/data/repos";
import { ProduitsClient } from "./produits-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produits — Administration" };

export default async function AdminProduitsPage({
  searchParams,
}: {
  // `?product=<id>` — where a stock notification lands.
  searchParams: Promise<{ product?: string }>;
}) {
  const repos = getRepos();
  const [{ product }, products, categories, tagGroups] = await Promise.all([
    searchParams,
    repos.products.listAll(),
    repos.categories.listWithCounts({ activeOnly: false }),
    repos.content.tagGroups(),
  ]);

  return (
    <ProduitsClient
      initialProducts={products}
      categories={categories}
      tagGroups={tagGroups}
      focusProductId={product ? Number(product) : null}
    />
  );
}
