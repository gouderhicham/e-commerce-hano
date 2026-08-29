import { Suspense } from "react";
import type { Metadata } from "next";
import { getRepos } from "@/lib/data/repos";
import { parseCatalogueParams, toSearchParams } from "@/lib/catalogue-query";
import { resolveLocale } from "@/lib/i18n/server";
import { CatalogueClient } from "./catalogue-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalogue — pc store 39",
  description:
    "Ordinateurs portables reconditionnés, mémoire, SSD et accessoires testés et garantis.",
};

export default async function CataloguePage() {
  const repos = getRepos();
  const categories = await repos.categories.listWithCounts();
  const tagGroups = await repos.content.tagGroups();

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f7f2]" />}>
      <CatalogueClient
        categories={categories}
        tagGroups={tagGroups}
        initial={{ items: [], total: 0, page: 1, pageCount: 1 }}
      />
    </Suspense>
  );
}
