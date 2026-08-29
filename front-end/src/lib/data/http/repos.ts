// Repositories over the API.
//
// The API is no longer a separate service: it is the Hono app mounted in this
// same Worker, so these methods dispatch straight into it rather than opening a
// connection. A page render therefore costs zero network round trips to reach
// its data — that hop, paid on every server component in the old split
// deployment, is where most of the previous architecture's latency lived.
//
// The call still goes through the router (not the services directly) so the
// auth guards, validation and error contract apply exactly as they do to a
// browser request. Browser mutations do NOT come through here — they call
// /api/* on the same origin, which lands on the same app.
//
// Public vs admin split: some repo methods (settings.get, products.listAll) are
// called from BOTH anonymous storefront pages and admin pages. The backend
// separates these into public and admin endpoints, so those methods try the
// admin endpoint when a session cookie is present and fall back to the public
// endpoint otherwise (public callers only ever use the public subset anyway).
//
// Only the methods actually invoked from server components / layouts are
// implemented; every other member throws (it would only ever be reached by a
// browser call, which is proxied, never routed through getRepos()).

import { cookies } from "next/headers";
import type {
  CartRepo,
  CategoriesRepo,
  ContentRepo,
  DashboardRepo,
  FavoritesRepo,
  MessagesRepo,
  MiscRepo,
  NotificationsRepo,
  OrdersRepo,
  ProductsRepo,
  Repos,
  SettingsRepo,
  UsersRepo,
  WilayaFeesRepo,
} from "../repos";
import type {
  AdminBadges,
  CartLine,
  CategoryCard,
  CategoryWithCount,
  ContactMessage,
  DashboardData,
  HomeContent,
  HomeFavoriteItem,
  Notification,
  Paginated,
  ProductDetail,
  ProductPublic,
  PublicSettings,
  Settings,
  SiteContent,
  TagGroup,
  Wilaya,
} from "../types";
import { createApp } from "@/server/app";
import { getRuntime } from "@/server/runtime";
import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/shared";
import { productQuery } from "@/lib/catalogue-query";
import type { ExecutionContext } from "hono";

/**
 * One app instance per isolate. `createApp()` only builds the router, so this
 * is cheap, but rebuilding it per request would be pure waste.
 */
let cachedApp: ReturnType<typeof createApp> | null = null;

function api() {
  if (!cachedApp) cachedApp = createApp();
  return cachedApp;
}

/** Forward every request cookie so the backend's Admin/User guards see the session. */
async function cookieHeader(): Promise<string> {
  const all = (await cookies()).getAll();
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** True when any cookie is present — used to decide admin-first vs public-only. */
async function hasSession(): Promise<boolean> {
  return (await cookies()).getAll().length > 0;
}

class BackendError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

/**
 * GET an API endpoint in-process, forwarding cookies and the reading locale
 * (the API translates its error messages from `x-locale`). Throws BackendError
 * on non-2xx.
 */
async function backendGet<T>(path: string): Promise<T> {
  const store = await cookies();
  const rawLocale = store.get(LOCALE_COOKIE)?.value;
  const { env, ctx } = getRuntime();

  // The URL host is irrelevant — nothing dials it — but `Request` requires an
  // absolute URL, and the router matches on the path.
  const request = new Request(`https://internal${path}`, {
    headers: {
      cookie: await cookieHeader(),
      "x-locale": isLocale(rawLocale) ? rawLocale : "fr",
    },
  });
  const res = await api().fetch(request, env, ctx as ExecutionContext | undefined);
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      /* body not JSON */
    }
    throw new BackendError(res.status, `GET ${path} → ${res.status} ${detail}`);
  }
  return (await res.json()) as T;
}

/**
 * The admin list endpoints are hard-capped at 8 items/page (PAGE_SIZE_ADMIN),
 * so walk every page and concatenate. Returns the aggregated items plus the
 * first page (for envelope extras like `totals`).
 */
async function backendGetAll<E extends { items: T[]; pageCount: number }, T>(
  path: string,
): Promise<{ items: T[]; first: E }> {
  const sep = path.includes("?") ? "&" : "?";
  const first = await backendGet<E>(`${path}${sep}page=1`);
  const items = [...first.items];
  for (let page = 2; page <= first.pageCount; page++) {
    const next = await backendGet<E>(`${path}${sep}page=${page}`);
    items.push(...next.items);
  }
  return { items, first };
}

/**
 * Wrap a partial implementation as a full repo: implemented methods pass
 * through; any other member throws a clear "not routed server-side" error
 * instead of a confusing `undefined is not a function`.
 */
function repo<T extends object>(impl: Partial<T>, name: string): T {
  return new Proxy(impl, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      return () => {
        throw new Error(
          `${name}.${String(prop)}() is not available server-side — ` +
            `browser calls reach /api/* on the same origin instead.`,
        );
      };
    },
  }) as T;
}

/** Serialise the catalogue filter into the backend's query string. */

const products = repo<ProductsRepo>(
  {
    async publicList(filter): Promise<Paginated<ProductPublic>> {
      return backendGet<Paginated<ProductPublic>>(
        `/api/products${productQuery(filter)}`,
      );
    },
    // Admin pages need inactive products too; storefront pages filter to active.
    // Try the admin endpoint when authenticated, else the public catalogue.
    async listAll(): Promise<ProductPublic[]> {
      if (await hasSession()) {
        try {
          const { items } = await backendGetAll<
            Paginated<ProductPublic>,
            ProductPublic
          >("/api/admin/products");
          return items;
        } catch (err) {
          if (
            !(err instanceof BackendError) ||
            (err.status !== 401 && err.status !== 403)
          )
            throw err;
          // Logged in but not admin — fall through to the public catalogue.
        }
      }
      const { items } = await backendGetAll<
        Paginated<ProductPublic>,
        ProductPublic
      >("/api/products");
      return items;
    },
    async publicDetail(id: number): Promise<ProductDetail | null> {
      try {
        return await backendGet<ProductDetail>(`/api/products/${id}`);
      } catch (err) {
        if (err instanceof BackendError && err.status === 404) return null;
        throw err;
      }
    },
  },
  "products",
);

const categories = repo<CategoriesRepo>(
  {
    // Public catalogue counts (active only) vs admin (includes inactive).
    async listWithCounts(opts): Promise<CategoryWithCount[]> {
      const path =
        opts?.activeOnly === false ? "/api/admin/categories" : "/api/categories";
      return backendGet<CategoryWithCount[]>(path);
    },
    // No plain-list endpoint; the with-counts payload is a superset of Category.
    async list() {
      return backendGet<CategoryWithCount[]>("/api/categories");
    },
  },
  "categories",
);

const content = repo<ContentRepo>(
  {
    async home(): Promise<HomeContent> {
      return backendGet<HomeContent>("/api/home");
    },
    async tagGroups(): Promise<TagGroup[]> {
      return backendGet<TagGroup[]>("/api/tag-groups");
    },
    async siteContent(): Promise<SiteContent> {
      const { content } = await backendGet<{ content: SiteContent }>(
        "/api/admin/content/home",
      );
      return content;
    },
    async homeFavorites(): Promise<HomeFavoriteItem[]> {
      const { items } = await backendGet<{ items: HomeFavoriteItem[] }>(
        "/api/admin/content/home/favorites",
      );
      return items;
    },
    async categoryCards(): Promise<CategoryCard[]> {
      const { items } = await backendGet<{ items: CategoryCard[] }>(
        "/api/admin/content/category-cards",
      );
      return items;
    },
  },
  "content",
);

const users = repo<UsersRepo>({}, "users");

const favorites = repo<FavoritesRepo>(
  {
    // Both derive from the session; the userId arg is ignored server-side.
    async productIds(): Promise<number[]> {
      const { items } = await backendGet<{ items: ProductPublic[] }>(
        "/api/account/favorites",
      );
      return items.map((p) => p.id);
    },
    async listProducts(): Promise<ProductPublic[]> {
      const { items } = await backendGet<{ items: ProductPublic[] }>(
        "/api/account/favorites",
      );
      return items;
    },
  },
  "favorites",
);

const cart = repo<CartRepo>(
  {
    // Session cart seed for the public layout; the userId arg is ignored
    // server-side (the backend derives the user from the session cookie).
    async lines(): Promise<CartLine[]> {
      const { items } = await backendGet<{ items: CartLine[] }>(
        "/api/account/cart",
      );
      return items;
    },
  },
  "cart",
);

// Admin order/payment/client LISTS are fetched page-by-page from the client
// (useServerList) and pre-rendered via fetchAdminList — not through these repos.
const orders = repo<OrdersRepo>({}, "orders");

const messages = repo<MessagesRepo>(
  {
    // Admin messages page 1 (SSR seed + the layout's unread badge). Later pages
    // are fetched client-side via the same-origin proxy (useServerList).
    // `focusId` (a bell deep-link) makes the backend return the page that
    // actually contains that message instead of `page`.
    async list(
      page = 1,
      focusId?: string,
    ): Promise<Paginated<ContactMessage> & { unreadCount: number }> {
      const focus = focusId ? `&focus=${encodeURIComponent(focusId)}` : "";
      return backendGet(`/api/admin/messages?page=${page}${focus}`);
    },
  },
  "messages",
);

const notifications = repo<NotificationsRepo>(
  {
    async latest(): Promise<{ items: Notification[]; unreadCount: number }> {
      // Backend already caps at 8.
      return backendGet("/api/admin/notifications");
    },
  },
  "notifications",
);

const settings = repo<SettingsRepo>(
  {
    async getPublic(): Promise<PublicSettings> {
      return backendGet<PublicSettings>("/api/settings/public");
    },
    // Admin Paramètres reads the admin endpoint; anyone else falls back to the
    // public one, which now exposes exactly the same (Telegram-only) fields.
    async get(): Promise<Settings> {
      if (await hasSession()) {
        try {
          const { settings } = await backendGet<{ settings: Settings }>(
            "/api/admin/settings",
          );
          return settings;
        } catch (err) {
          if (
            !(err instanceof BackendError) ||
            (err.status !== 401 && err.status !== 403)
          )
            throw err;
          // Logged in but not admin — fall through to public settings.
        }
      }
      return backendGet<PublicSettings>("/api/settings/public");
    },
  },
  "settings",
);

const wilayaFees = repo<WilayaFeesRepo>(
  {
    async list(): Promise<Wilaya[]> {
      return backendGet<Wilaya[]>("/api/shipping/wilayas");
    },
    // Admin → Livraison SSR seed. Same rows as the public endpoint, but read
    // through the admin route so the page fails loudly if the session lapsed.
    async adminList(): Promise<Wilaya[]> {
      const { items } = await backendGet<{ items: Wilaya[] }>(
        "/api/admin/wilaya-fees",
      );
      return items;
    },
  },
  "wilayaFees",
);

const dashboard = repo<DashboardRepo>(
  {
    async get(): Promise<DashboardData> {
      return backendGet<DashboardData>("/api/admin/dashboard");
    },
  },
  "dashboard",
);

const misc = repo<MiscRepo>(
  {
    async wilayas(): Promise<Wilaya[]> {
      return backendGet<Wilaya[]>("/api/shipping/wilayas");
    },
    // Admin layout SSR seed; the shell re-fetches via the proxy on navigation.
    async adminBadges(): Promise<AdminBadges> {
      return backendGet<AdminBadges>("/api/admin/badges");
    },
  },
  "misc",
);

/** Backend-backed repositories used by server components. */
export function createHttpRepos(): Repos {
  return {
    products,
    categories,
    content,
    users,
    favorites,
    cart,
    orders,
    messages,
    notifications,
    wilayaFees,
    settings,
    dashboard,
    misc,
  };
}
