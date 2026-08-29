import { getRepos } from "@/lib/data/repos";
import { CategoriesClient } from "./categories-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Catégories — Administration" };

export default async function AdminCategoriesPage() {
  const repos = getRepos();
  const categories = await repos.categories.listWithCounts({ activeOnly: false });

  return <CategoriesClient initialCategories={categories} />;
}
