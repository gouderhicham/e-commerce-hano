import { TagsClient } from "./tags-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tags & filtres — Administration" };

export default function AdminTagsPage() {
  return <TagsClient />;
}
