import { getRepos } from "@/lib/data/repos";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const repos = getRepos();
  const [data, categories, tagGroups, products, categoryCards] =
    await Promise.all([
      repos.dashboard.get(),
      repos.categories.listWithCounts({ activeOnly: false }),
      repos.content.tagGroups(),
      repos.products.listAll(),
      repos.content.categoryCards(),
    ]);

  // The landing page renders a tile per FILTERABLE category, so the KPI counts
  // the same subset — counting every category advertised tiles nobody sees.
  const visibleCards = categoryCards.filter((card) => {
    const category = categories.find((c) => c.id === card.categoryId);
    return category ? category.filterable : true;
  });

  return (
    <DashboardClient
      data={data}
      categories={categories}
      tagGroups={tagGroups}
      products={products}
      categoryCardCount={visibleCards.length}
    />
  );
}
