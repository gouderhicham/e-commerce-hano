<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# pc store .39

E-commerce for **refurbished computers and components** (laptops, RAM, SSDs,
CPUs, accessories) for the Algerian market. Two roles: a **guest storefront**
(bilingual FR/AR, RTL) and a single **ADMIN** back office (French only).
Currency is **DA**, integers only — no decimals anywhere.

One app, one Cloudflare Worker: the pages and the API ship together.

```
app/api/[[...route]]/   the whole API (Hono router)
app/media/[...key]/     uploaded images, served from Postgres
src/server/routes/      HTTP layer — validation, guards, response shapes
src/server/services/    data logic reused by routes and server components
src/server/domain/      framework-free rules (availability, pagination, i18n)
src/server/infra/       password, jwt, cookies, storage, mail, notify
```

## Architecture rules (non-negotiable)

1. **Response shapes are raw, not enveloped.**
   - Validation failure → `400 { errors: { field: "message" } }` (first issue
     per field, messages authored in French).
   - Other errors → `{ error: "message" }` with 401/403/404/409/429/500.
   - Paginated lists → `{ items, total, page, pageCount }` (`page` default 1;
     pageSize 8 for admin tables, 16 for the catalogue).
   - JSON in/out, money = integer DA, dates = ISO strings.
2. **Errors are written in French and translated on the way out**, once, from
   the `x-locale` header — `src/server/domain/messages.ts`. Never write a
   message in two languages at the throw site.
3. **No admin registration.** The single admin comes from the seed.
   `POST /api/auth/register` always creates role CLIENT.
4. **Availability is derived, never stored**: `stock <= 0 → "indisponible"`,
   `<= 5 → "stock_limite"`, else `"disponible"`. Computed server-side and
   included in product responses. The storefront prints them as
   « Rupture » / « Stock limité » / « En stock ».
5. **Server-side money recomputation** — never trust client totals.
   `POST /api/orders` recomputes unit prices, subtotal and shipping
   (`subtotal > FREE_SHIPPING_THRESHOLD` strictly → 0; else commune fee →
   wilaya fee → base `SHIP_FEE`), validates stock, decrements it, increments
   `sold`, snapshots each line's name/spec/image, creates the admin
   `Notification` (**always** — there is no opt-out) and generates the order
   number `CMD-<year>-<4 digits>` — all in one transaction.
6. **`price = null` = "Sur commande"** — such products can never enter a cart
   or an order line; the product page offers a quote request instead.
7. **Inactive products are invisible publicly**: catalogue, suggest, detail
   (404), similar, home. Admin endpoints see everything.
8. **Order statuses** are `NOUVELLE | PRETE_A_LIVRER | EN_LIVRAISON | LIVREE |
   ANNULEE`. There is no "awaiting payment" state — the money is collected on
   delivery. `ANNULEE` is reachable only through
   `POST /admin/orders/:id/cancel`, which restocks every line; a cancelled
   order is then frozen.
9. **Category delete is guarded**: `409 { error: "Cette catégorie contient N
   produits" }` when non-empty.
10. **Cash on delivery only.** `PaymentMethod` has a single value, `COD`; the
    checkout never asks for a card and there is no `/pay` endpoint. The delivery
    address is **wilaya + commune only** — no street address, no delivery note.
    The shop phones the customer to arrange the drop-off. `POST /api/orders`
    takes `{ name, phone, email?, wilayaCode, communeId, lines }`, so the
    storefront can post it from a product page as well as from the cart.
11. **Never serialize `passwordHash`** — an explicit Prisma `select`
    (`USER_PUBLIC_SELECT`) everywhere a user is returned.
12. **Editorial content lives in the database** (`SiteContent`, `HomeFavorite`,
    `TagGroup`/`FilterTag`, `Category`) and is editable from the back office.
    The *shop copy* is the exception: identity, warranty and fixed
    catalogue/checkout text are static in `src/lib/shop-config.ts`. `SHIP_FEE`
    is only a last-resort fallback — real prices are `Wilaya.fee` /
    `Commune.fee`, edited in Admin → Livraison (CSV export/import round trip).
13. **Notifications carry their target.** Every `Notification` has a `type`
    (ORDER / MESSAGE / STOCK) and the matching id (`orderId`,
    `contactMessageId`, `productId`), so the back office links a stock alert to
    the product, a message alert to the message and an order alert to the order
    sheet. Opening one in the bell marks it read.

## Bilingualism (FR / AR)

Two sources of text, never mixed:

| Text | Where it lives | Resolved by |
| --- | --- | --- |
| Interface chrome | `src/lib/i18n/dictionaries/{fr,ar}.ts` | `t.*` |
| Shop data (products, categories, zones, editorial) | `*Ar` columns in the DB | `pick(locale, value, valueAr)` |

- **No hard-coded translation in a component.** Never
  `locale === "ar" ? "…" : "…"`.
- The locale lives in exactly one place: the `pcstore39_locale` cookie, read
  server-side so `<html lang dir>` is correct in the first byte.
- An empty `*Ar` column **falls back to French** — never blank text.
- The back office is French-only by design.

## Workers constraints that shaped the code

These are not preferences; the runtime forbids the alternatives.

- **No TCP sockets** → Postgres is reached through the Hyperdrive binding, and
  email goes over Resend's HTTP API (SMTP is impossible).
- **No filesystem** → uploaded images are rows in `MediaObject`, served by
  `app/media/[...key]`. Seeded images stay static files under `public/images/`.
- **CPU is billed** → passwords use PBKDF2 through Web Crypto, not a pure-JS
  bcrypt loop. Legacy bcrypt digests still verify and are re-hashed on the next
  successful login.
- **Isolates are per-request** → no in-process pub/sub and no SSE; the bell
  polls. Best-effort work (email, cleanup) goes through `waitUntil`.
- **Nothing reads `process.env` in production** — every value is a binding or a
  secret (`wrangler.jsonc`). `src/server/runtime.ts` substitutes `.env.local`
  for local development only.
