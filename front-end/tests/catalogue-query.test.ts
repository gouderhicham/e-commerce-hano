import { describe, expect, it } from "vitest";
import {
  parseCatalogueParams,
  productQuery,
  toSearchParams,
} from "@/lib/catalogue-query";
import { CATALOGUE_SORTS } from "@/lib/data/rules";

/**
 * Values the backend's `PRODUCT_SORTS` accepts
 * (`src/server/services/catalog.schema.ts`). Anything else is rejected
 * with a 400 that the catalogue swallows, so the page silently stops sorting.
 */
const BACKEND_SORTS = ["nouveautes", "prix_asc", "prix_desc", "nom"];

const GROUPS = [{ field: "cpu" }, { field: "ram" }, { field: "ssdCap" }];

const url = (qs: string) => new URLSearchParams(qs);

describe("catalogue sort vocabulary", () => {
  it("matches the backend's accepted values", () => {
    // "defaut" is front-end only: it means "send no sort at all".
    const sent = CATALOGUE_SORTS.filter((s) => s !== "defaut");
    expect([...sent].sort()).toEqual([...BACKEND_SORTS].sort());
  });

  it("omits the default sort from the query string", () => {
    expect(productQuery({ sort: "defaut" })).toBe("");
    expect(productQuery({ sort: "prix_asc" })).toBe("?sort=prix_asc");
  });
});

describe("parseCatalogueParams", () => {
  it("packs per-group URL params into the API's attrs string", () => {
    const filter = parseCatalogueParams(url("cpu=Ryzen,Intel&ram=16 Go"), GROUPS);
    expect(filter.attrs).toEqual({ cpu: ["Ryzen", "Intel"], ram: ["16 Go"] });

    // Round-trip through URLSearchParams the way the backend's query parser
    // does — `toString()` encodes a space as "+", which decodeURIComponent
    // alone would leave in place.
    const attrs = new URLSearchParams(productQuery(filter)).get("attrs");
    expect(attrs).toBe("cpu:Ryzen|Intel;ram:16 Go");
  });

  it("ignores params that are not declared tag groups", () => {
    const filter = parseCatalogueParams(url("colour=rouge"), GROUPS);
    expect(filter.attrs).toBeUndefined();
  });

  it("carries search, category, sort and page through", () => {
    const filter = parseCatalogueParams(
      url("q=elitebook&category=pc-portable&sort=nom&page=3"),
      GROUPS,
    );
    expect(filter).toMatchObject({
      q: "elitebook",
      categoryIds: ["pc-portable"],
      sort: "nom",
      page: 3,
    });
  });

  it("drops a sort value the backend would reject", () => {
    // The dropdown used to emit "price_asc", which is not in PRODUCT_SORTS.
    expect(parseCatalogueParams(url("sort=price_asc"), GROUPS).sort).toBeUndefined();
  });

  it("selects no category when the URL names none", () => {
    // A blank selection must mean "all products", not "the first category".
    expect(parseCatalogueParams(url(""), GROUPS).categoryIds).toBeUndefined();
  });

  it("sends the reading locale only when it is not the default", () => {
    expect(productQuery(parseCatalogueParams(url(""), GROUPS, "fr"))).toBe("");
    expect(productQuery(parseCatalogueParams(url(""), GROUPS, "ar"))).toBe(
      "?locale=ar",
    );
  });
});

describe("toSearchParams", () => {
  it("normalises a server page's searchParams object", () => {
    const params = toSearchParams({
      q: "ssd",
      cpu: ["Ryzen", "Intel"],
      empty: undefined,
    });
    expect(params.get("q")).toBe("ssd");
    expect(params.get("cpu")).toBe("Ryzen");
    expect(params.has("empty")).toBe(false);
  });
});
