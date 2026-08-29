// TypeScript mirrors of the backend's Prisma models + API response shapes.
// Every product field here maps to something the storefront actually renders —
// see the comments on `Product` for where each one shows up.

export type Role = "ADMIN" | "CLIENT";
// Cash on delivery (COD) order progression.
export type OrderStatus =
  | "NOUVELLE"
  | "PRETE_A_LIVRER"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "ANNULEE";
/** Cash on delivery is the only method the shop accepts. */
export type PaymentMethod = "COD";

/** Derived, never stored: stock <= 0 → indisponible, <= 5 → stock_limite, else disponible. */
export type Availability = "disponible" | "stock_limite" | "indisponible";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  name: string;
  phone: string | null;
  wilayaCode: number | null;
  communeId: number | null;
  adresse: string | null;
  createdAt: string;
  updatedAt: string;
}

/** User without credentials — safe for API responses. */
export type PublicUser = Omit<User, "passwordHash">;

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  description: string | null;
  descriptionAr?: string | null;
  imageUrl: string | null;
  /** Offered in the catalogue sidebar ("Type de produit"). */
  filterable: boolean;
  sortOrder: number;
}

/** A single product gallery image. */
export interface ProductImage {
  id: number;
  url: string;
  isCover: boolean;
  sortOrder: number;
}

/** Filterable attributes, keyed by TagGroup.field (cpu, cores, ram, …). */
export type ProductAttributes = Record<string, string | string[]>;

/** One "Configuration choisie" button on the fiche. */
export interface ConfigOption {
  label: string;
  labelAr?: string | null;
  sub: string;
  subAr?: string | null;
  price?: number | null;
}

export type PromiseIcon = "check" | "shield" | "plug";

/** One of the 3 reassurance cards under the order button. */
export interface ProductPromise {
  icon: PromiseIcon;
  title: string;
  titleAr?: string | null;
  text: string;
  textAr?: string | null;
}

export interface Product {
  id: number;
  reference: string;
  /** Catalogue card title. */
  name: string;
  nameAr?: string | null;
  categoryId: string;
  /** DA. null = "Sur commande" (quote request only, no add-to-cart). */
  price: number | null;
  /** DA. Discounted sale price; always < price. null = no promotion. */
  promoPrice: number | null;
  stock: number;
  active: boolean;
  sold: number;

  // ── Catalogue card ─────────────────────────────────────────────────────────
  /** One-line spec summary under the card title. */
  specs: string;
  specsAr?: string | null;
  attributes: ProductAttributes;
  /** Background colour of the card thumbnail. */
  tone: string;

  // ── Media ──────────────────────────────────────────────────────────────────
  /** Denormalized cover URL (mirrors the image with isCover=true). */
  imageUrl: string | null;
  /** Ordered gallery. Empty when the product has no images. */
  images: ProductImage[];

  // ── Fiche produit ──────────────────────────────────────────────────────────
  condition: string;
  conditionAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  configurations: ConfigOption[];
  deliveryNote: string;
  deliveryNoteAr?: string | null;
  promises: ProductPromise[];

  createdAt: string;
  updatedAt: string;
}

export interface Favorite {
  userId: string;
  productId: number;
  createdAt: string;
}

export interface OrderLine {
  id: number;
  orderId: string;
  productId: number | null;
  /** Snapshots taken at purchase time. */
  name: string;
  meta: string;
  imageUrl: string | null;
  unitPrice: number;
  qty: number;
}

export interface Order {
  /** Human order number, e.g. "CMD-2026-4821". */
  id: string;
  userId: string | null;
  customerName: string;
  email: string | null;
  phone: string;
  wilayaCode: number;
  /** Delivery is addressed by commune — no street address is collected. */
  communeId: number;
  status: OrderStatus;
  method: PaymentMethod;
  subtotal: number;
  shippingFee: number;
  total: number;
  lines: OrderLine[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

/** What a bell notification is about — decides where its link points. */
export type NotificationType = "ORDER" | "MESSAGE" | "STOCK";

export interface Notification {
  id: string;
  type: NotificationType;
  /** Set on ORDER alerts. */
  orderId: string | null;
  /** Set on STOCK alerts — the product that ran low. */
  productId: number | null;
  /** Set on MESSAGE alerts. */
  contactMessageId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Commune {
  id: number;
  name: string;
  nameAr?: string | null;
  wilayaCode: number;
  /** Delivery fee override (DA); null → inherits the wilaya fee. */
  fee: number | null;
}

export interface Wilaya {
  code: number;
  name: string;
  nameAr?: string | null;
  fee: number;
  communes: Commune[];
}

/** PUT /api/admin/wilaya-fees row — the wilaya's default delivery fee. */
export interface WilayaFee {
  code: number;
  fee: number;
}

/** PUT /api/admin/wilaya-fees/communes row. fee null clears the override. */
export interface CommuneFee {
  id: number;
  fee: number | null;
}

/** POST /api/admin/wilaya-fees/import — summary + the refreshed list. */
export interface WilayaFeesImportResult {
  updatedWilayas: number;
  updatedCommunes: number;
  /** Rows ignored: unknown commune/wilaya, or an unreadable fee cell. */
  skipped: number;
  items: Wilaya[];
}

/**
 * The shop settings still stored in the database. Identity, shipping numbers
 * and storefront copy are static — see `src/lib/shop-config.ts`.
 */
export interface Settings {
  /** Telegram relay used by the contact form. */
  telegramBotToken: string;
  telegramChatId: string;
}

/** The storefront reads the same fields without needing a session. */
export type PublicSettings = Settings;

// ===== Catalogue filters =====

export interface FilterTag {
  /** Value stored in Product.attributes. */
  value: string;
  /** Label shown to the customer. */
  label: string;
  labelAr?: string | null;
}

/** One block of the catalogue sidebar ("Affiner la sélection"). */
export interface TagGroup {
  id: string;
  name: string;
  nameAr?: string | null;
  /** Key read from Product.attributes. */
  field: string;
  /** Category ids this block appears under. */
  targets: string[];
  sortOrder: number;
  tags: FilterTag[];
}

// ===== Home page content =====

export interface HomeStat {
  value: string;
  valueAr?: string | null;
  label: string;
  labelAr?: string | null;
}

export interface HomeHero {
  eyebrow?: string;
  eyebrowAr?: string | null;
  titleLead?: string;
  titleLeadAr?: string | null;
  /** Second title line, in the accent green. */
  titleAccent?: string;
  titleAccentAr?: string | null;
  text?: string;
  textAr?: string | null;
  ctaLabel?: string;
  ctaLabelAr?: string | null;
  ctaHref?: string;
  stats?: HomeStat[];
  image?: string;
  imageAlt?: string;
  imageAltAr?: string | null;
}

export type PromiseCardIcon = "zap" | "shield" | "check";

export interface PromiseCard {
  icon: PromiseCardIcon;
  title: string;
  titleAr?: string | null;
  text: string;
  textAr?: string | null;
}

/**
 * "Notre promesse" block. `badge` is the mono eyebrow, `title` + `subtitle` the
 * two headline lines, `text` the intro paragraph — one naming scheme only, the
 * same one the back office writes and `localizePromise` translates.
 */
export interface HomePromise {
  badge?: string;
  badgeAr?: string | null;
  title?: string;
  titleAr?: string | null;
  subtitle?: string;
  subtitleAr?: string | null;
  text?: string;
  textAr?: string | null;
  cards?: PromiseCard[];
}

export interface Showcase {
  eyebrow: string;
  eyebrowAr?: string | null;
  /** Mono line above the title. */
  title: string;
  titleAr?: string | null;
  subtitle: string;
  subtitleAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  image: string;
  imageAlt: string;
  imageAltAr?: string | null;
  specs: { label: string; labelAr?: string | null; val: string; valAr?: string | null }[];
}

export interface HomeFavoriteItem {
  id: string;
  /** Catalogue product this tile links to; null = showcase-only model. */
  productId: number | null;
  name: string;
  nameAr?: string | null;
  spec: string;
  specAr?: string | null;
  price: number;
  image: string;
}

/**
 * The "Nos favoris" strip. Only the tiles come from the database — the block's
 * heading and CTA are interface chrome and live in the i18n dictionaries.
 */
export interface HomeFavorites {
  items: HomeFavoriteItem[];
}

export interface HomeCategoryCard {
  id: string;
  name: string;
  nameAr?: string | null;
  detail: string;
  detailAr?: string | null;
  img: string;
  /** Value put in /catalogue?category=… */
  slug: string;
  categoryId: string;
  sortOrder: number;
}

/** GET /api/home — everything the landing page renders. */
export interface HomeContent {
  showcase: Showcase;
  favorites: HomeFavorites;
  categoryCards: HomeCategoryCard[];
}

/** Admin shape of the editorial singleton (Admin → Produit vedette). */
export interface SiteContent {
  showcase: Showcase;
}

/** Admin row for a home category tile. */
export interface CategoryCard {
  id: string;
  name: string;
  detail: string;
  img: string;
  slug: string;
  categoryId: string;
  sortOrder: number;
}

// ===== Derived / DTO shapes =====

export interface ProductPublic extends Product {
  availability: Availability;
}

export interface ProductDetail extends ProductPublic {
  category: Category;
  /** Up to 4 products of the same category. */
  similar: ProductPublic[];
}

export interface SuggestItem {
  id: number;
  name: string;
  reference: string;
  imageUrl: string | null;
  price: number | null;
}

export interface CategoryWithCount extends Category {
  productCount: number;
}

/** One cart line — `id` is the product id (client store + /account/cart). */
export interface CartLine {
  id: number;
  qty: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

export interface ClientAggregate {
  user: PublicUser;
  orders: number;
  /** Sum of paid (paymentStatus PAYEE) order totals. */
  totalSpent: number;
  since: string;
}

export interface SalesPoint {
  date: string;
  revenue: number;
}

export interface DashboardData {
  kpis: {
    caTotal: number;
    ordersTotal: number;
    newOrders: number;
    activeProducts: number;
    clients: number;
  };
  salesSeries: SalesPoint[];
  latestOrders: Order[];
  topProducts: ProductPublic[];
  stockAlerts: ProductPublic[];
}

/** GET /api/admin/badges — sidebar + bell counters. */
export interface AdminBadges {
  /** Orders awaiting handling (status NOUVELLE). */
  newOrders: number;
  unreadQuotes: number;
  unreadMessages: number;
  unreadNotifications: number;
}

export interface OrderCreateInput {
  userId: string | null;
  name: string;
  phone: string;
  email: string | null;
  wilayaCode: number;
  communeId: number;
  method?: PaymentMethod;
  lines: { productId: number; qty: number }[];
}

/** Body of POST/PATCH /api/admin/products (sent as multipart/form-data). */
export interface ProductInput {
  reference: string;
  name: string;
  nameAr?: string;
  categoryId: string;
  price: number | null;
  promoPrice?: number | null;
  stock: number;
  active: boolean;

  specs: string;
  specsAr?: string;
  attributes: ProductAttributes;
  tone: string;
  badge: string;
  badgeAr?: string;

  condition: string;
  description: string;
  descriptionAr?: string;
  configurations: ConfigOption[];
  deliveryNote: string;
  promises: ProductPromise[];
}
