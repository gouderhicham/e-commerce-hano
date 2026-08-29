import type { PublicProductFilter } from "./data/repos";
import { CATALOGUE_SORTS, type CatalogueSort } from "./data/rules";
import type { Availability } from "./data/types";

const AVAILABILITIES: Availability[] = [
  "disponible",
  "stock_limite",
  "indisponible",
];

function isSort(value: string): value is CatalogueSort {
  return (CATALOGUE_SORTS as readonly string[]).includes(value);
}

/**
 * Translate the catalogue's browser URL into an API filter.
 *
 * The two vocabularies are deliberately different and must NOT be forwarded
 * verbatim to the backend:
 *
 *   URL   `/catalogue?category=pc-portable&cpu=Ryzen,Intel&ram=16 Go&sort=prix_asc`
 *   API   `/api/products?category=pc-portable&attrs=cpu:Ryzen|Intel;ram:16 Go&sort=prix_asc`
 *
 * Each `TagGroup.field` is its own query parameter in the URL (so filters are
 * readable and shareable) but the backend takes them as one packed `attrs`
 * string. Passing the raw URL through means every facet is silently dropped by
 * the DTO whitelist — which is exactly what used to happen.
 */
export function parseCatalogueParams(
  params: URLSearchParams,
  tagGroups: { field: string }[],
  locale: "fr" | "ar" = "fr",
): PublicProductFilter {
  const filter: PublicProductFilter = { locale };

  const q = params.get("q")?.trim();
  if (q) filter.q = q;

  const category = params.get("category")?.trim();
  if (category) filter.categoryIds = [category];

  const sort = params.get("sort")?.trim();
  if (sort && isSort(sort)) filter.sort = sort;

  const page = Number(params.get("page"));
  if (Number.isFinite(page) && page > 1) filter.page = Math.floor(page);

  const priceMin = Number(params.get("priceMin"));
  if (Number.isFinite(priceMin) && params.get("priceMin")) {
    filter.priceMin = Math.max(0, Math.floor(priceMin));
  }
  const priceMax = Number(params.get("priceMax"));
  if (Number.isFinite(priceMax) && params.get("priceMax")) {
    filter.priceMax = Math.max(0, Math.floor(priceMax));
  }

  const availability = (params.get("availability") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is Availability =>
      (AVAILABILITIES as string[]).includes(v),
    );
  if (availability.length) filter.availability = availability;

  const attrs: Record<string, string[]> = {};
  for (const group of tagGroups) {
    const values = (params.get(group.field) ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (values.length) attrs[group.field] = values;
  }
  if (Object.keys(attrs).length) filter.attrs = attrs;

  return filter;
}

/** `searchParams` as handed to a server page, as a `URLSearchParams`. */
export function toSearchParams(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") params.set(key, value);
    else if (Array.isArray(value) && value.length) params.set(key, value[0]);
  }
  return params;
}

/**
 * Serialise a filter into the API's query string.
 *
 * Lives here, not in `data/http/repos.ts`: the catalogue client component needs
 * it too, and that module imports `next/headers` — pulling it into a client
 * bundle breaks the build.
 */
export function productQuery(filter: PublicProductFilter): string {
  const params = new URLSearchParams();
  if (filter.q?.trim()) params.set("q", filter.q.trim());
  if (filter.categoryIds?.length)
    params.set("category", filter.categoryIds.join(","));
  if (filter.availability?.length)
    params.set("availability", filter.availability.join(","));
  if (filter.priceMin != null) params.set("priceMin", String(filter.priceMin));
  if (filter.priceMax != null) params.set("priceMax", String(filter.priceMax));
  if (filter.sort && filter.sort !== "defaut") params.set("sort", filter.sort);
  if (filter.page && filter.page > 1) params.set("page", String(filter.page));
  if (filter.locale && filter.locale !== "fr") params.set("locale", filter.locale);

  const attrs = Object.entries(filter.attrs ?? {})
    .filter(([, values]) => values.length > 0)
    .map(([field, values]) => `${field}:${values.join("|")}`)
    .join(";");
  if (attrs) params.set("attrs", attrs);

  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
