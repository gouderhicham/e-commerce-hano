// Repository interfaces — the only door between the app and its data.
// Implementation: src/lib/data/http (the Hono API, dispatched in-process).
//
// Only the methods actually invoked from server components / layouts are
// implemented; the rest exist so the contract is documented in one place.
// Browser mutations never come through here — they go straight to the backend
// through the same-origin proxy (next.config.ts).

import type {
  AdminBadges,
  Availability,
  CartLine,
  Category,
  CategoryCard,
  CategoryWithCount,
  ClientAggregate,
  CommuneFee,
  ContactMessage,
  DashboardData,
  HomeContent,
  HomeFavoriteItem,
  Notification,
  Order,
  OrderCreateInput,
  OrderStatus,
  Paginated,
  Product,
  ProductDetail,
  ProductInput,
  ProductPublic,
  PublicSettings,
  Settings,
  SiteContent,
  SuggestItem,
  TagGroup,
  User,
  Wilaya,
  WilayaFee,
} from "./types";

import type { CatalogueSort } from "./rules";

export type { CatalogueSort };

export interface PublicProductFilter {
  q?: string;
  categoryIds?: string[];
  availability?: Availability[];
  /** Selected sidebar facets: { cpu: ["Ryzen"], ram: ["16 Go"] }. */
  attrs?: Record<string, string[]>;
  priceMin?: number | null;
  priceMax?: number | null;
  sort?: CatalogueSort;
  page?: number;
  /** Reading language — only affects "Nom A-Z" ordering. */
  locale?: "fr" | "ar";
}

export interface AdminProductFilter {
  q?: string;
  categoryId?: string;
  status?: "actif" | "inactif";
  page?: number;
}

export type OrderCreateResult =
  | { ok: true; order: Order }
  | { ok: false; error: string; status: number };

export interface ProductsRepo {
  /** Active products only. */
  publicList(filter: PublicProductFilter): Promise<Paginated<ProductPublic>>;
  suggest(q: string): Promise<SuggestItem[]>;
  /** null when missing or inactive. */
  publicDetail(id: number): Promise<ProductDetail | null>;
  adminList(filter: AdminProductFilter): Promise<Paginated<ProductPublic>>;
  getById(id: number): Promise<Product | null>;
  create(input: ProductInput): Promise<Product>;
  update(id: number, input: Partial<ProductInput>): Promise<Product | null>;
  delete(id: number): Promise<boolean>;
  setActive(id: number, active: boolean): Promise<Product | null>;
  setStock(id: number, stock: number): Promise<Product | null>;
  /** Every product the caller may see (admin: incl. inactive). */
  listAll(): Promise<ProductPublic[]>;
}

export interface CategoriesRepo {
  list(): Promise<Category[]>;
  /** productCount counts active products only on the public endpoint. */
  listWithCounts(opts?: { activeOnly?: boolean }): Promise<CategoryWithCount[]>;
  create(input: {
    name: string;
    description?: string | null;
  }): Promise<Category>;
  update(
    id: string,
    patch: { name?: string; description?: string | null },
  ): Promise<Category | null>;
  /** Refuses when the category still contains products. */
  delete(
    id: string,
  ): Promise<{ ok: true } | { ok: false; productCount: number }>;
}

/** Editorial content: the landing page blocks and the catalogue sidebar. */
export interface ContentRepo {
  /** Everything the landing page renders, in one round trip. */
  home(): Promise<HomeContent>;
  /** Sidebar filter blocks. */
  tagGroups(): Promise<TagGroup[]>;
  /** Admin view of the editorial singleton. */
  siteContent(): Promise<SiteContent>;
  /** Admin view of the "Nos favoris" tiles. */
  homeFavorites(): Promise<HomeFavoriteItem[]>;
  /** Admin view of the home category tiles. */
  categoryCards(): Promise<CategoryCard[]>;
}

export interface UsersRepo {
  findById(id: string): Promise<User | null>;
  clientsAggregate(
    page: number,
    pageSize: number,
  ): Promise<Paginated<ClientAggregate>>;
}

export interface FavoritesRepo {
  productIds(userId: string): Promise<number[]>;
  listProducts(userId: string): Promise<ProductPublic[]>;
}

export interface CartRepo {
  /** Server cart of the session user (`id` = product id). */
  lines(userId: string): Promise<CartLine[]>;
}

export interface OrdersRepo {
  /** Recomputes money server-side, validates stock, decrements, notifies. */
  create(input: OrderCreateInput): Promise<OrderCreateResult>;
  getById(id: string): Promise<Order | null>;
  adminList(filter: {
    status?: OrderStatus;
    q?: string;
    page?: number;
  }): Promise<Paginated<Order>>;
  setStatus(
    id: string,
    status: OrderStatus,
  ): Promise<Order | { error: string } | null>;
  cancel(id: string): Promise<Order | null>;
}

export interface MessagesRepo {
  /**
   * `focusId` deep-links a bell notification: the backend answers with the page
   * holding that message rather than `page`.
   */
  list(
    page?: number,
    focusId?: string,
  ): Promise<Paginated<ContactMessage> & { unreadCount: number }>;
}

export interface NotificationsRepo {
  latest(): Promise<{ items: Notification[]; unreadCount: number }>;
}

export interface WilayaFeesRepo {
  /** Admin view: the 69 wilayas with their communes and delivery fees. */
  adminList(): Promise<Wilaya[]>;
  /** Public view, same shape — the checkout reads its fees from here. */
  list(): Promise<Wilaya[]>;
  bulkUpsert(items: WilayaFee[]): Promise<Wilaya[]>;
  /** Commune fee overrides; fee null clears the override (inherit wilaya). */
  bulkUpsertCommunes(items: CommuneFee[]): Promise<Wilaya[]>;
}

export interface SettingsRepo {
  /** Admin endpoint when a session is present, else the public one. */
  get(): Promise<Settings>;
  /** Never needs a session. */
  getPublic(): Promise<PublicSettings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export interface DashboardRepo {
  get(): Promise<DashboardData>;
}

export interface MiscRepo {
  wilayas(): Promise<Wilaya[]>;
  /** Sidebar + bell counters for the admin layout. */
  adminBadges(): Promise<AdminBadges>;
}

export interface Repos {
  products: ProductsRepo;
  categories: CategoriesRepo;
  content: ContentRepo;
  users: UsersRepo;
  favorites: FavoritesRepo;
  cart: CartRepo;
  orders: OrdersRepo;
  messages: MessagesRepo;
  notifications: NotificationsRepo;
  wilayaFees: WilayaFeesRepo;
  settings: SettingsRepo;
  dashboard: DashboardRepo;
  misc: MiscRepo;
}

import { createHttpRepos } from "./http/repos";

/**
 * The only door between the app and its data. Server components call this
 * in-process; it returns repositories backed by the Hono API in this same app
 * (forwarding the session cookie). Browser calls reach the backend via the
 * same-origin proxy in next.config.ts.
 */
export function getRepos(): Repos {
  return createHttpRepos();
}
