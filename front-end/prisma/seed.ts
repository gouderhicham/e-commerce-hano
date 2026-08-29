/**
 * Idempotent seed for pc store .39.
 *
 * Source of truth: prisma/seed-data/pc-store-data.json — shaped 1:1 to the
 * Prisma models, and carrying the mock-up's catalogue, editorial copy and
 * images (all served from /public/images). Plaintext dev passwords are hashed
 * here with the same PBKDF2 routine the app uses. Running twice must not
 * duplicate anything:
 * every write is an upsert, except rows with no natural key (order lines,
 * product gallery) which are cleared then recreated for their parent.
 *
 * Override the data file with SEED_DATA_PATH.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NotificationType,
  OrderStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  Role,
} from "@prisma/client";
import sharp from "sharp";
import { SHIP_FEE } from "../src/server/domain/shop-config";
import {
  IMAGE_QUALITY,
  MAX_IMAGE_DIMENSION,
  MAX_STORED_BYTES,
} from "../src/server/domain/image-policy";
import { hashPassword } from "../src/server/infra/password";

const prisma = new PrismaClient();

// ── Data-file shapes ─────────────────────────────────────────────────────────

interface SeedSettings {
  telegramBotToken: string;
  telegramChatId: string;
}

interface SeedCategory {
  id: string;
  slug: string;
  name: string;
  nameAr?: string | null;
  description?: string | null;
  descriptionAr?: string | null;
  imageUrl?: string | null;
  filterable: boolean;
  sortOrder: number;
}

interface SeedTagGroup {
  id: string;
  name: string;
  nameAr?: string | null;
  field: string;
  targets: string[];
  sortOrder: number;
  tags: { value: string; label: string; labelAr?: string | null }[];
}

interface SeedSiteContent {
  showcase: unknown;
}

interface SeedHomeFavorite {
  productId: number;
  sortOrder: number;
}

interface SeedProduct {
  id: number;
  reference: string;
  name: string;
  nameAr?: string | null;
  categoryId: string;
  price: number | null;
  promoPrice?: number | null;
  stock: number;
  active: boolean;
  sold: number;
  specs: string;
  specsAr?: string | null;
  attributes: Record<string, string>;
  tone: string;
  imageUrl: string | null;
  gallery: string[];
  condition: string;
  conditionAr?: string | null;
  description: string;
  descriptionAr?: string | null;
  configurations: {
    label: string;
    labelAr?: string | null;
    sub: string;
    subAr?: string | null;
    price?: number | null;
  }[];
  deliveryNote: string;
  deliveryNoteAr?: string | null;
  promises: {
    icon: string;
    title: string;
    titleAr?: string | null;
    text: string;
    textAr?: string | null;
  }[];
  createdAt?: string;
}

interface SeedUser {
  id: string;
  email: string;
  password: string;
  role: string;
  name: string;
  phone?: string | null;
  adresse?: string | null;
  createdAt?: string;
  favoriteProductIds?: number[];
}

interface SeedOrderLine {
  productId: number | null;
  name: string;
  meta: string;
  imageUrl: string | null;
  qty: number;
  unitPrice: number;
}

interface SeedOrder {
  id: string;
  userId?: string | null;
  customerName: string;
  email?: string | null;
  phone: string;
  wilayaName: string;
  communeName: string;
  status: string;
  method: string;
  subtotal: number;
  shippingFee: number;
  total: number;
  createdAt?: string;
  lines: SeedOrderLine[];
}

interface SeedMessage {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  subject: string;
  message: string;
  read: boolean;
  createdAt?: string;
}

interface SeedNotification {
  id: string;
  /** Defaults to ORDER when the data file predates typed notifications. */
  type?: "ORDER" | "MESSAGE" | "STOCK";
  orderId?: string | null;
  /** Reference of the product a STOCK alert points at. */
  productReference?: string | null;
  contactMessageId?: string | null;
  message: string;
  read: boolean;
  createdAt?: string;
}

interface SeedData {
  settings: SeedSettings;
  categories: SeedCategory[];
  tagGroups: SeedTagGroup[];
  siteContent: SeedSiteContent;
  homeFavorites: SeedHomeFavorite[];
  products: SeedProduct[];
  users: SeedUser[];
  orders: SeedOrder[];
  messages: SeedMessage[];
  notifications: SeedNotification[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DATA_PATH_CANDIDATES = [
  process.env.SEED_DATA_PATH,
  join(__dirname, "seed-data", "pc-store-data.json"),
].filter((p): p is string => Boolean(p));

const DATA_PATH =
  DATA_PATH_CANDIDATES.find((p) => existsSync(p)) ??
  DATA_PATH_CANDIDATES[DATA_PATH_CANDIDATES.length - 1];

function loadData(): SeedData {
  return JSON.parse(readFileSync(DATA_PATH, "utf-8")) as SeedData;
}

const toDate = (iso?: string | null): Date | undefined =>
  iso ? new Date(iso) : undefined;

const json = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

/**
 * Accent/case-insensitive compare key, so "Béjaïa" matches "bejaia".
 * NFD splits accented letters into base + combining mark; dropping everything
 * outside [a-z0-9] then removes the marks, spaces, apostrophes and hyphens.
 */
const norm = (s: string): string =>
  s
    .normalize("NFD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// ── Seed routines ────────────────────────────────────────────────────────────

// ── Media ────────────────────────────────────────────────────────────────────

/** `/images/products/foo.jpg` → `/media/products/seed-foo.webp`. */
const mediaUrls = new Map<string, string>();

/** Rewrite a seed image path to the media URL it was stored under. */
const media = (url?: string | null): string | null =>
  url ? (mediaUrls.get(url) ?? url) : null;

/** Deterministic key, so re-seeding replaces rather than duplicates. */
function mediaKeyFor(publicPath: string): string | null {
  const m = /^\/images\/(products|categories|showcase)\/(.+)\.[a-z0-9]+$/i.exec(
    publicPath,
  );
  return m ? `${m[1]}/seed-${m[2]}.webp` : null;
}

/**
 * True when a stored `/media/<key>` URL still has its bytes. Anything else — a
 * static `/images/...` path or an external URL — is not ours to verify, so it
 * is reported as missing and the seeded image wins.
 */
async function mediaExists(url: string): Promise<boolean> {
  const at = url.indexOf("/media/");
  if (at === -1) return false;
  const key = url.slice(at + "/media/".length);
  return (await prisma.mediaObject.count({ where: { key } })) > 0;
}

/** Every `/images/...` string anywhere inside a JSON value. */
function collectImagePaths(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (value.startsWith("/images/")) out.add(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectImagePaths(v, out);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectImagePaths(v, out);
  }
}

/**
 * Store every catalogue image in the database, compressed.
 *
 * The seed used to leave images as static files and only write their paths, so
 * a fresh database had rows pointing at assets it did not own. Storing them
 * makes the seed self-contained: one `prisma db seed` produces a complete shop,
 * and the same `/media/<key>` path serves seeded and admin-uploaded images
 * alike.
 *
 * Compression is not optional here. These bytes live in Postgres, and Neon's
 * free tier is 500 MB for the entire database — the source PNGs run to 700 KB
 * each, so storing them raw would spend the quota on a handful of demo photos.
 * sharp is a devDependency: it runs here and in CI, never in the Worker.
 */
async function seedMedia(data: SeedData): Promise<void> {
  const paths = new Set<string>();
  collectImagePaths(data.products, paths);
  collectImagePaths(data.categories, paths);
  collectImagePaths(data.siteContent, paths);

  let stored = 0;
  let before = 0;
  let after = 0;
  let skipped = 0;

  for (const publicPath of [...paths].sort()) {
    const key = mediaKeyFor(publicPath);
    if (!key) continue;

    const file = join(__dirname, "..", "public", publicPath);
    if (!existsSync(file)) {
      skipped += 1;
      console.warn(`  missing asset, left as a static path: ${publicPath}`);
      continue;
    }

    const source = readFileSync(file);
    const webp = await sharp(source)
      // `rotate()` with no argument applies the EXIF orientation, so a photo
      // taken sideways is stored upright rather than rotated in every viewer.
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: Math.round(IMAGE_QUALITY * 100) })
      .toBuffer();

    if (webp.byteLength > MAX_STORED_BYTES) {
      throw new Error(
        `${publicPath} is ${Math.round(webp.byteLength / 1024)} KB after ` +
          `compression, over the ${Math.round(MAX_STORED_BYTES / 1024)} KB ceiling.`,
      );
    }

    const record = {
      contentType: "image/webp",
      size: webp.byteLength,
      // Prisma's `Bytes` wants a plain Uint8Array; sharp returns a Node Buffer
      // whose backing store is typed loosely enough that TS rejects it.
      data: new Uint8Array(webp),
    };
    await prisma.mediaObject.upsert({
      where: { key },
      create: { key, ...record },
      update: record,
    });

    mediaUrls.set(publicPath, `/media/${key}`);
    stored += 1;
    before += source.byteLength;
    after += webp.byteLength;
  }

  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  console.log(
    `  media: ${stored} images, ${kb(before)} → ${kb(after)} ` +
      `(${before ? Math.round((1 - after / before) * 100) : 0}% smaller, ` +
      `avg ${stored ? kb(after / stored) : "0 KB"})` +
      (skipped ? `, ${skipped} skipped` : ""),
  );
}


async function seedSettings(s: SeedSettings): Promise<void> {
  // Only the Telegram relay is still stored; the rest of the shop config is
  // static (src/common/shop-config.ts).
  const data = {
    telegramBotToken: s.telegramBotToken,
    telegramChatId: s.telegramChatId,
  };
  await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
}

async function seedCategories(categories: SeedCategory[]): Promise<void> {
  for (const c of categories) {
    const data = {
      slug: c.slug,
      name: c.name,
      nameAr: c.nameAr ?? null,
      description: c.description ?? null,
      descriptionAr: c.descriptionAr ?? null,
      filterable: c.filterable,
      sortOrder: c.sortOrder,
    };
    // Keep an image uploaded from the admin UI — but only if it still
    // resolves. A URL whose object has since been deleted is worse than the
    // seeded image: it renders as a broken tile and nothing ever repairs it.
    const existing = await prisma.category.findUnique({
      where: { id: c.id },
      select: { imageUrl: true },
    });
    const keepExisting =
      existing?.imageUrl != null && (await mediaExists(existing.imageUrl));

    await prisma.category.upsert({
      where: { id: c.id },
      create: { id: c.id, ...data, imageUrl: media(c.imageUrl) },
      update: {
        ...data,
        ...(keepExisting ? {} : { imageUrl: media(c.imageUrl) }),
      },
    });
  }
}

async function seedProducts(products: SeedProduct[]): Promise<void> {
  const seedIds = products.map((p) => p.id);
  await prisma.homeFavorite.deleteMany({
    where: { productId: { notIn: seedIds } },
  });
  await prisma.favorite.deleteMany({
    where: { productId: { notIn: seedIds } },
  });
  await prisma.cartItem.deleteMany({
    where: { productId: { notIn: seedIds } },
  });
  await prisma.orderLine.deleteMany({
    where: { productId: { notIn: seedIds } },
  });
  await prisma.productImage.deleteMany({
    where: { productId: { notIn: seedIds } },
  });
  await prisma.product.deleteMany({
    where: { id: { notIn: seedIds } },
  });

  for (const p of products) {
    const data = {
      reference: p.reference,
      name: p.name,
      nameAr: p.nameAr ?? null,
      categoryId: p.categoryId,
      price: p.price,
      promoPrice: p.promoPrice ?? null,
      stock: p.stock,
      active: p.active,
      sold: p.sold,
      specs: p.specs,
      specsAr: p.specsAr ?? null,
      attributes: json(p.attributes),
      tone: p.tone,
      imageUrl: media(p.imageUrl),
      condition: p.condition,
      conditionAr: p.conditionAr ?? null,
      description: p.description,
      descriptionAr: p.descriptionAr ?? null,
      configurations: json(p.configurations),
      deliveryNote: p.deliveryNote,
      deliveryNoteAr: p.deliveryNoteAr ?? null,
      promises: json(p.promises),
      ...(p.createdAt && { createdAt: toDate(p.createdAt) }),
    };
    await prisma.product.upsert({
      where: { id: p.id },
      create: { id: p.id, ...data },
      update: data,
    });

    // Gallery rows have no natural key — clear and recreate. The cover is
    // Product.imageUrl when it is part of the gallery, else the first image.
    await prisma.productImage.deleteMany({ where: { productId: p.id } });
    const sources = p.gallery.length ? p.gallery : p.imageUrl ? [p.imageUrl] : [];
    const urls = sources.map((u) => media(u)).filter((u): u is string => !!u);
    if (urls.length) {
      const coverIndex = Math.max(urls.indexOf(media(p.imageUrl) ?? ""), 0);
      await prisma.productImage.createMany({
        data: urls.map((url, i) => ({
          productId: p.id,
          url,
          isCover: i === coverIndex,
          sortOrder: i,
        })),
      });
    }
  }

  // Explicit-id inserts do NOT advance the autoincrement sequence, so a later
  // create() would collide at id=1. Reset it to MAX(id)+1.
  await prisma.$executeRawUnsafe(
    // Schema-qualified: `pg_get_serial_sequence` resolves its argument against
    // search_path, and a pooled connection (Neon) does not always put `public`
    // there — unqualified, it fails with "relation Product does not exist".
    `SELECT setval(pg_get_serial_sequence('public."Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 0) + 1, false)`,
  );
}

async function seedTagGroups(groups: SeedTagGroup[]): Promise<void> {
  for (const g of groups) {
    const data = {
      name: g.name,
      nameAr: g.nameAr ?? null,
      field: g.field || g.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "attr",
      targets: g.targets,
      sortOrder: g.sortOrder,
    };
    await prisma.tagGroup.upsert({
      where: { id: g.id },
      create: { id: g.id, ...data },
      update: data,
    });

    for (const [i, tag] of g.tags.entries()) {
      const val = tag.value || tag.label;
      await prisma.filterTag.upsert({
        where: { groupId_value: { groupId: g.id, value: val } },
        create: {
          groupId: g.id,
          value: val,
          label: tag.label,
          labelAr: tag.labelAr ?? null,
          sortOrder: i,
        },
        update: {
          label: tag.label,
          labelAr: tag.labelAr ?? null,
          sortOrder: i,
        },
      });
    }
    // Drop tags removed from the data file.
    await prisma.filterTag.deleteMany({
      where: { groupId: g.id, value: { notIn: g.tags.map((t) => t.value || t.label) } },
    });
  }
}

async function seedSiteContent(
  content: SeedSiteContent,
  favorites: SeedHomeFavorite[],
): Promise<void> {
  // The showcase is stored as a JSON blob, so its image path is rewritten in
  // place rather than through a column.
  const showcase = { ...((content?.showcase as Record<string, unknown>) ?? {}) };
  if (typeof showcase.image === "string") {
    showcase.image = media(showcase.image) ?? showcase.image;
  }
  const data = { showcase: json(showcase) };
  await prisma.siteContent.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });

  await prisma.homeFavorite.deleteMany({});
  for (const f of favorites) {
    await prisma.homeFavorite.create({
      data: {
        productId: f.productId,
        sortOrder: f.sortOrder,
      },
    });
  }
}

async function seedUsers(users: SeedUser[]): Promise<void> {
  for (const u of users) {
    const passwordHash = await hashPassword(u.password);
    const data = {
      email: u.email,
      passwordHash,
      role: u.role as Role,
      name: u.name,
      phone: u.phone ?? null,
      wilayaCode: null,
      communeId: null,
      adresse: u.adresse ?? null,
      createdAt: toDate(u.createdAt),
    };
    await prisma.user.upsert({
      where: { id: u.id },
      create: { id: u.id, ...data },
      update: data,
    });

    for (const productId of u.favoriteProductIds ?? []) {
      await prisma.favorite.upsert({
        where: { userId_productId: { userId: u.id, productId } },
        create: { userId: u.id, productId },
        update: {},
      });
    }
  }
}

/**
 * The 69 delivery zones (Algeria's 58 wilayas plus the 11 delegated
 * circumscriptions that carry their own tariff) and their communes. Delivery
 * starts at the static SHIP_FEE everywhere; the admin overrides per wilaya or
 * per commune afterwards in Admin → Livraison.
 *
 * `nameAr` is seeded for every wilaya. Communes have no Arabic name in the
 * dataset yet, so they keep `null` and the storefront falls back to the French
 * name — visibly incomplete rather than silently blank.
 */
async function seedWilayasAndCommunes(defaultFee: number): Promise<void> {
  const jsonPath = [
    join(__dirname, "..", "..", "wilayas-with-municipalities.json"),
    join(__dirname, "seed-data", "wilayas-with-municipalities.json"),
  ].find((p) => existsSync(p));
  if (!jsonPath) {
    console.warn(
      "[!] wilayas-with-municipalities.json not found — skipping wilayas/communes",
    );
    return;
  }

  const wilayasData = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
    wilayaCode: number;
    nameFr: string;
    nameAr?: string | null;
    communes: { id: number | null; nameFr: string; nameAr?: string | null }[];
  }[];

  // Fallback ids for the few communes whose JSON id is null — a global counter
  // so two wilayas never hand out the same fallback id.
  let nextCommuneId = 9000;

  for (const w of wilayasData) {
    const wilayaNameAr = w.nameAr?.trim() || null;
    await prisma.wilaya.upsert({
      where: { code: w.wilayaCode },
      create: {
        code: w.wilayaCode,
        name: w.nameFr,
        nameAr: wilayaNameAr,
        fee: defaultFee,
      },
      update: { name: w.nameFr, nameAr: wilayaNameAr },
    });

    for (const c of w.communes) {
      const cId = c.id ?? nextCommuneId++;
      const communeNameAr = c.nameAr?.trim() || null;
      await prisma.commune.upsert({
        where: { id: cId },
        create: {
          id: cId,
          name: c.nameFr,
          nameAr: communeNameAr,
          wilayaCode: w.wilayaCode,
        },
        update: {
          name: c.nameFr,
          nameAr: communeNameAr,
          wilayaCode: w.wilayaCode,
        },
      });
    }
  }
}

async function seedOrders(orders: SeedOrder[]): Promise<void> {
  await prisma.orderLine.deleteMany({});
  await prisma.order.deleteMany({});

  if (orders.length === 0) return;

  const wilayas = await prisma.wilaya.findMany({
    select: { code: true, name: true },
  });
  const communes = await prisma.commune.findMany({
    select: { id: true, name: true, wilayaCode: true },
  });

  for (const o of orders) {
    const wilaya = wilayas.find((w) => norm(w.name) === norm(o.wilayaName));
    if (!wilaya) {
      console.warn(
        `[!] order ${o.id}: unknown wilaya "${o.wilayaName}" — skipped`,
      );
      continue;
    }
    const commune =
      communes.find(
        (c) =>
          c.wilayaCode === wilaya.code && norm(c.name) === norm(o.communeName),
      ) ?? communes.find((c) => c.wilayaCode === wilaya.code);
    if (!commune) {
      console.warn(
        `[!] order ${o.id}: no commune for wilaya ${wilaya.name} — skipped`,
      );
      continue;
    }

    const data = {
      userId: o.userId ?? null,
      customerName: o.customerName,
      email: o.email ?? null,
      phone: o.phone,
      wilayaCode: wilaya.code,
      communeId: commune.id,
      status: (o.status === "EN_TRAITEMENT" ? "EN_LIVRAISON" : o.status) as OrderStatus,
      method: o.method as PaymentMethod,
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      total: o.total,
      createdAt: toDate(o.createdAt),
    };
    await prisma.order.upsert({
      where: { id: o.id },
      create: { id: o.id, ...data },
      update: data,
    });

    // Lines have no natural key — clear and recreate for idempotency.
    await prisma.orderLine.deleteMany({ where: { orderId: o.id } });
    await prisma.orderLine.createMany({
      data: o.lines.map((l) => ({
        orderId: o.id,
        productId: l.productId,
        name: l.name,
        meta: l.meta,
        imageUrl: l.imageUrl,
        unitPrice: l.unitPrice,
        qty: l.qty,
      })),
    });
  }
}

async function seedMessages(messages: SeedMessage[]): Promise<void> {
  const seedIds = messages.map((m) => m.id);
  await prisma.contactMessage.deleteMany({
    where: { id: { notIn: seedIds } },
  });

  for (const m of messages) {
    const data = {
      name: m.name,
      email: m.email,
      phone: m.phone ?? null,
      subject: m.subject,
      message: m.message,
      read: m.read,
      createdAt: toDate(m.createdAt),
    };
    await prisma.contactMessage.upsert({
      where: { id: m.id },
      create: { id: m.id, ...data },
      update: data,
    });
  }
}

async function seedNotifications(
  notifications: SeedNotification[],
): Promise<void> {
  await prisma.notification.deleteMany({});
  for (const n of notifications) {
    const type = (n.type ?? "ORDER") as NotificationType;
    // A STOCK alert links to the product, never to the order that emptied it.
    const product = n.productReference
      ? await prisma.product.findUnique({
          where: { reference: n.productReference },
          select: { id: true },
        })
      : null;
    const data = {
      type,
      orderId: type === NotificationType.ORDER ? (n.orderId ?? null) : null,
      productId: product?.id ?? null,
      contactMessageId: n.contactMessageId ?? null,
      message: n.message,
      read: n.read,
      createdAt: toDate(n.createdAt),
    };
    await prisma.notification.upsert({
      where: { id: n.id },
      create: { id: n.id, ...data },
      update: data,
    });
  }
}

// ── Entry point ──────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const data = loadData();

  // First: images must be stored before anything writes a URL pointing at one.
  await seedMedia(data);
  await seedSettings(data.settings);
  await seedCategories(data.categories);
  await seedProducts(data.products);
  await seedTagGroups(data.tagGroups);
  await seedSiteContent(data.siteContent, data.homeFavorites);
  await seedUsers(data.users);
  await seedWilayasAndCommunes(SHIP_FEE);
  await seedOrders(data.orders);
  await seedMessages(data.messages);
  await seedNotifications(data.notifications);

  const [
    users,
    categories,
    products,
    images,
    tagGroups,
    tags,
    favorites,
    orders,
    wilayas,
    communes,
    mediaCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.category.count(),
    prisma.product.count(),
    prisma.productImage.count(),
    prisma.tagGroup.count(),
    prisma.filterTag.count(),
    prisma.homeFavorite.count(),
    prisma.order.count(),
    prisma.wilaya.count(),
    prisma.commune.count(),
    prisma.mediaObject.count(),
  ]);

  console.log("Seed complete:", {
    users,
    categories,
    products,
    images,
    tagGroups,
    tags,
    homeFavorites: favorites,
    orders,
    wilayas,
    communes,
    media: mediaCount,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
