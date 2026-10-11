# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For *what* the product is and *why* it behaves the way it does (features, rules, decisions), read
`docs/PRODUCT.md` first; this file covers *how* the code is organised.

## What this is

**Royal Stock** (royalstockonline.com): a Next.js 14 (App Router) wholesale ordering site for a
cleaning-supplies / disposables warehouse in Israel. A buyer scans a QR code (or opens the site),
browses categories, fills a cart and submits an order with name + business name + phone. There are
no buyer accounts. The order is saved, a PDF is generated and emailed to the owner (SendGrid). The
owner manages everything in `/admin` (products, categories, coupons, orders, pay-later debts).
The UI is Hebrew and Arabic, both right-to-left.

## Commands

- `npm run dev` — dev server (localhost:3000).
- `npm run build` / `npm run start` — production build and serve. `start` runs
  `prisma migrate deploy` first, so pending migrations apply automatically on every Railway deploy.
- `npm run lint` — ESLint. The only expected warnings are the two `alt-text` ones in
  `src/lib/order-pdf.tsx` (react-pdf's `<Image>` has no alt prop).
- `npx tsc --noEmit` — type-check (there is no test suite; this plus lint is the check).
- `npx prisma migrate dev --name <name>` — create and apply a migration after editing
  `prisma/schema.prisma`. On Windows, stop the dev server first: it locks the Prisma engine DLL
  and `prisma generate` fails with EPERM. After a schema change, restart the dev server or it
  keeps the old client ("Unknown field ..." errors).
- `npm run db:seed` — seed admin user / categories / sample products (idempotent).
- `npm run db:studio` — Prisma Studio.
- After `migrate dev`, `git checkout -- prisma/migrations/migration_lock.toml` (Windows rewrites
  its line endings; don't commit that noise).

## Environments and data

- **Local DB ≠ live DB.** Local `.env` points at a dev database. Products/orders created on
  localhost never appear on the live site.
- **Production**: Railway (service `web` + a Postgres service). Env vars live in Railway settings.
  Changing live data is done by the developer running a one-off Node script on the Railway
  container (`railway ssh --service web`, with `NODE_PATH=$(pwd)/node_modules`), not from a local
  machine. Prefer the admin UI for anything the owner can do himself.
- **Images**: ImageKit (`src/lib/imagekit.ts` uploads, `src/lib/image-url.ts` builds resized URLs
  via presets). Uploads are shrunk in the browser first (`src/lib/shrink-image.ts`, 1600px) and
  capped at 1600px by ImageKit. `scripts/` holds one-off migration/import scripts (SQLite→Postgres,
  Cloudinary→ImageKit, product import, background removal) — history, not part of the app.
- **Email**: SendGrid HTTPS API (`src/lib/order-email.ts`, `src/lib/password-reset.ts`). Raw SMTP
  is blocked on Railway. Don't change `SENDGRID_FROM_EMAIL` without verifying the new sender in
  SendGrid first.
- **WhatsApp**: code exists (`src/lib/whatsapp.ts`) but sending is switched off
  (`ORDER_WHATSAPP_NOTIFICATIONS_ENABLED = false` in `src/app/api/orders/route.ts`) until the
  owner's WhatsApp Business setup is done. Orders go out by email only.

See `.env.example` for every variable.

## Architecture

### Data model (`prisma/schema.prisma`, Postgres)

- `Category` (ordered, optional tile image) → `Subcategory` (ordered, belongs to one category).
- `Product`: many categories, at most one subcategory, `sortOrder` (admin-arranged), `price`
  (before VAT), `onSale`/`salePrice`, `unit` (`UNIT`|`CARTON`, `src/lib/product-unit.ts`),
  `stockQuantity` (null = not tracked), `inStock`, and optional `variantGroupId`/`variantLabel`/
  `variantOrder` (see Product options).
- `VariantGroup`: one shop card holding several products as options.
- `Coupon`: `code` (stored uppercased), `discountPercent`, `active`, and `categories` (empty =
  whole order).
- `Order` + `OrderItem`: everything about the money is a **snapshot** taken at order time —
  item `price`, item `couponCode`/`discountPercent`, order `vatPercent`. Never recompute an old
  order from current products/coupons. Older orders have an order-level `discountPercent` and/or
  null `vatPercent`; `calculateOrderTotals` handles both shapes.
- `Order.status` and `Order.paymentMethod` are plain strings constrained by
  `src/lib/order-status.ts` and `src/lib/payment-method.ts` — use those constants.
- `OrderItem.stockDeducted` records whether that line took stock, so cancelling returns exactly
  what was taken.
- `Admin` + `PasswordResetToken` (hashed, 30-minute, single-use) for the owner's login.

### Money: `src/lib/order-totals.ts` is the single source of truth

`calculateOrderTotals(lines, orderCoupon, vatPercent)` is used by the checkout window, the orders
API, the PDF, the email, the admin orders page and the pay-later page — never compute totals
elsewhere. `VAT_PERCENT = 18`. `bestCouponFor()` picks, per product, the biggest applied coupon
that covers it (whole-order coupons cover everything; category coupons cover products in any of
their categories). Coupons never stack on one item. The orders API re-derives every discount
server-side from the DB; the client's preview is never trusted.

### Stock: `src/lib/stock.ts`

`deductStock` runs inside the order transaction with conditional decrements (no overselling under
concurrent orders); a shortage rolls back the whole order and returns `insufficient_stock` with what
is available. Reaching 0 sets `inStock = false`. `PATCH /api/orders/[id]` to CANCELLED calls
`restoreOrderStock`; reopening calls `redeductOrderStock` (floors at 0). Untracked products
(`stockQuantity` null) are never touched.

**Buyers never receive `stockQuantity`**: every product handed to the shop goes through
`toPublicProduct()` (`src/lib/public-product.ts`) — server components and the public
`GET /api/products` (the admin, with a session, gets the full object). Keep that when adding new
product queries for the shop. Product queries use `PRODUCT_INCLUDE` from `src/lib/variant-groups.ts`.

### Product options (one card, several products)

Each option (a colour, a size) is a normal `Product` with its own price/stock/photo/cart line,
linked by `variantGroupId`. Cart, orders, stock, coupons and PDF need no special handling. In the
shop, `groupIntoCards()` (`src/components/catalog-ui.tsx`) turns a product list into cards (a card
takes its first option's place, so sorting/arranging still applies); `ShopCard` renders one, and
`OptionPicker` shows buttons when they fit on one line of the card (measured with a hidden copy +
ResizeObserver) and a dropdown otherwise. Admin: cards are created/extended/undone only from the
arrange list's bulk bar (`merge-options-dialog.tsx`, `POST/PATCH /api/variant-groups`,
bulk `unmerge`); the edit window only offers "edit names and order". `deleteEmptyVariantGroups()`
dissolves cards left with one option. Keep it to one way per task — the owner asked for that.

### Shop (`src/app/(shop)/`, public)

- `layout.tsx` wraps everything in `StorefrontShell` (`src/components/storefront-shell.tsx`):
  header + search, cart state (localStorage, with a "continue your order?" prompt), floating cart
  bar, product detail modal, back-to-top, and the `CheckoutSheet` (coupons, VAT totals, buyer
  details, payment method). `useCart()` exposes it to pages.
- `page.tsx` (home): sale carousel + category tiles. `category/[categoryId]`: products grouped into
  subcategory sections with a sticky chip bar and filters (`use-product-filters.ts`).
  `cart/page.tsx`: the cart, then "continue to payment" opens the checkout window.
- Server components read Prisma directly (no fetch round-trip) and pass `toPublicProduct` data to
  client components.

### Orders (`POST /api/orders`, public)

Validates (zod), rate-limits per IP and per phone (`src/lib/rate-limit.ts`, in-memory — fine for a
single Railway instance), checks the Israeli phone (`src/lib/phone.ts`), re-derives coupons, rejects
`CREDIT` (`credit_unavailable` — no payment provider yet) and `PAY_LATER` without a used coupon,
then in one transaction deducts stock and creates the order with snapshots. Afterwards it builds
the PDF (`src/lib/order-pdf.tsx`, react-pdf, Hebrew font) and emails it. **Notification failures
never fail the order** — the order is always saved; `emailSentAt`/`whatsappSentAt` stay null and the
error is returned so the admin can see it. Keep that non-blocking behaviour.

### Admin (`src/app/admin/`)

NextAuth Credentials, JWT sessions (`src/lib/auth.ts`). `src/middleware.ts` protects `/admin` and
everything under it except login, forgot/reset password and the app icons. There is no idle
logout (removed at the owner's request); sessions last NextAuth's default 30 days. Pages: dashboard (QR
code to `NEXT_PUBLIC_SITE_URL`, counts), products (categories with images and drag order;
subcategories card = add/delete/drag subcategories, arrange products per subcategory, bulk
stock/move/delete/merge/unmerge; product list with search, category filter, low-stock filter, edit
modal), orders (status, cancelled-only delete, per-item coupons, VAT), coupons (scope: whole order or
categories), pay-later (debts grouped by customer, mark paid). Admin pages are client components
calling the JSON API routes; destructive actions go through `useConfirm()`, feedback through
`useToast()`. Mutating API routes check `getServerSession`.

### i18n (Hebrew/Arabic, both RTL)

No library: `src/lib/i18n/` — `dictionaries.ts` (all fixed UI copy, both languages; add every new
string to **both**), `locales.ts`, `get-locale.ts` (server-only, reads the `locale` cookie),
`cookie.ts` (cookie name, safe for client code). The root layout sets `<html lang dir>` from the
cookie and seeds `LocaleProvider`; client components use `useLocale().t("dot.path", {params})`.
Product, category and coupon names are not translated. Use logical Tailwind utilities (`ps-`/`pe-`,
`ms-`/`me-`, `start-`/`end-`), never `pl-`/`left-` etc., or RTL breaks. `/admin` (`page.tsx`) is the
pattern for server data + translated client rendering (`dashboard-content.tsx`).

### Branding

`src/lib/branding.ts` reads `NEXT_PUBLIC_WAREHOUSE_NAME`, `_LOGO_URL`, `_ACCENT_COLOR`,
`_SECONDARY_COLOR`, `_CONTACT_PHONE`; the root layout exposes the colours as CSS variables
`--accent` / `--secondary`. Use `var(--accent)` for selected/primary states (not black). The page
background is fixed light in `globals.css` — do not add a `prefers-color-scheme: dark` override
(it once turned the site black for dark-mode visitors). Both the shop and admin have PWA manifests
and icons.

## Working conventions

- Hebrew in shell arguments gets mangled on Windows (Git Bash → `????`). Put Hebrew in files
  (scripts, JSON) rather than in `curl -d '...'` arguments.
- Commit only when asked; end commit messages with the attribution lines the session provides.
