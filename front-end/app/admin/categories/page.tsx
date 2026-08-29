import { CategoriesClient } from "./categories-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Catégories — Administration" };

export default function AdminCategoriesPage() {
  return <CategoriesClient />;
}
