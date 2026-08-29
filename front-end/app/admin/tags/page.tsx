import { getRepos } from "@/lib/data/repos";
import { TagsClient } from "./tags-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tags & filtres — Administration" };

export default async function AdminTagsPage() {
  const repos = getRepos();
  const [groups, categories, products] = await Promise.all([
    repos.content.tagGroups(),
    repos.categories.listWithCounts({ activeOnly: false }),
    repos.products.listAll(),
  ]);

  return (
    <TagsClient
      initialGroups={groups}
      categories={categories}
      products={products}
    />
  );
}
