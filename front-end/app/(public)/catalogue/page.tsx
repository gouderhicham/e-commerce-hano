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

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const repos = getRepos();
  const params = toSearchParams(await searchParams);
  const locale = await resolveLocale();

  const categories = await repos.categories.listWithCounts();
  const tagGroups = await repos.content.tagGroups();

  // The server renders exactly what the URL asks for — search, sort, facets and
  // page included. No category is forced when none is selected: "Tous les
  // produits" has to actually show all products on a cold load.
  const initial = await repos.products.publicList(
    parseCatalogueParams(params, tagGroups, locale),
  );

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f7f2]" />}>
      <CatalogueClient
        categories={categories}
        tagGroups={tagGroups}
        initial={initial}
      />
    </Suspense>
  );
}
