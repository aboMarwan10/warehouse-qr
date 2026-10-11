# Royal Stock — product overview

What the product is, who uses it, every feature, and the decisions behind them. Written so a
similar project (another shop, different look) can reuse the idea; `CLAUDE.md` covers the code.

## The idea

A wholesale warehouse (cleaning products, laundry, paper goods, disposables) gets a simple online
ordering site instead of phone/WhatsApp orders. Buyers are mostly small businesses. A printed QR
code in the warehouse opens the shop. There are **no buyer accounts**: a buyer browses, fills a
cart and sends the order with their name, business name and phone. The owner receives the order
as a PDF by email and handles delivery and payment as usual.

Two kinds of users:

- **Buyer** (phone-first, Hebrew or Arabic): find products fast, order in a few taps.
- **Owner** (not technical, also mostly on the phone): manage products, prices, stock, coupons and
  orders himself, without calling the developer.

## Buyer features

- **Home**: sale carousel (products on sale) and category tiles with images.
- **Category page**: products grouped into subcategory sections, a sticky chip bar to jump between
  them, filters (in stock only, price range, sort).
- **Search** across all products from the header.
- **Product card**: photo, name, price with unit ("₪45 / קרטון"), sale price and % badge,
  "details" window, add-to-cart with a quantity stepper. Out-of-stock products are shown faded and
  can't be added.
- **Product options**: one card for a product that comes in colours or sizes (e.g. a fork in
  transparent / black / cream, cups in 2.5–12 OZ). Options show as buttons when they fit on one
  line of the card, otherwise as a dropdown; the chosen one uses the brand accent colour. Each
  option has its own price, photo and stock; sold-out options are crossed out. Tapping add with
  nothing chosen highlights the options instead of guessing.
- **Cart page** (prices labelled "before VAT"), then a centred **checkout window**:
  - coupons (several allowed, shown as removable tags),
  - totals: subtotal, one line per coupon, total before VAT, VAT 18%, **total to pay**,
  - name, business name, phone (validated as an Israeli number),
  - payment method: cash; credit card (shown, but "not available yet"); pay-later (only appears
    once a valid coupon is applied).
- The cart survives closing the browser; on return the buyer is asked whether to continue the
  saved order or start over.
- Hebrew / Arabic switch, both right-to-left; contact footer with call and WhatsApp links;
  back-to-top button.

## Owner (admin) features

- Login with password reset by email; stays logged in (no automatic logout when idle);
  installable as a phone app.
- **Dashboard**: the shop QR code (download / print), counts of products and pending orders.
- **Categories**: add, rename, delete, drag to reorder, tile image.
- **Subcategories card** (one place for everything about subcategories and arrangement): pick a
  category; add / delete / drag subcategories; open one subcategory at a time to drag its products
  into the order buyers see; tick products for bulk actions — out of stock / in stock, move to
  another subcategory, delete, **merge into one card**, **unmerge**.
- **Products**: add (with photo upload — phone photos are shrunk automatically), edit window
  (name, price, description, unit, stock quantity, sale price or % off, categories, subcategory,
  photo), duplicate, delete (a product that was ever ordered can't be deleted, only hidden by
  marking out of stock). Search, category/subcategory filter, low-stock filter, low-stock badge.
- **Orders**: list with status (pending / confirmed / cancelled), items with units and per-item
  coupons, VAT line, totals, whether the email went out; delete only after cancelling.
- **Coupons**: code, percent, applies to the whole order or chosen categories, activate /
  deactivate / delete.
- **Pay-later**: open debts grouped by customer, mark a customer's orders as paid.

## Rules and decisions (and why)

- **No buyer accounts.** Wholesale buyers order occasionally and on the phone; any login step loses
  orders. Identity = name + business + phone per order.
- **Prices are entered and shown before VAT; VAT (18%) is added at checkout.** Matches how
  wholesale prices are quoted. Each order stores the VAT rate it was charged, so a future rate
  change never rewrites old orders. *Open question for the owner's accountant:* if private
  customers buy too, Israeli law generally expects prices shown including VAT.
- **Orders are snapshots.** Price, coupon and VAT are copied onto the order; editing or deleting a
  product or coupon later never changes past orders.
- **Stock is optional per product.** Empty = not tracked (works like before stock existed). When
  tracked: orders take stock off atomically, an order larger than what's left is refused with
  "only N left", 0 → out of stock automatically, cancelling returns the stock. **Buyers never see
  the quantity** (it's stripped before reaching the browser), only in / out of stock.
- **Units**: each product is sold either per unit (יחידה) or per carton (קרטון); the unit is shown
  next to every price and quantity, including the PDF.
- **Coupons**: several per order; each item gets the single biggest coupon that covers it (no
  stacking); a category coupon that matches nothing in the cart is refused with a clear message.
  The server recalculates every discount — the buyer's screen is only a preview.
- **Pay-later only with a coupon**: the owner hands coupons to trusted business customers; the
  coupon is what unlocks paying at the end of the month.
- **Credit card not live yet**: no payment provider is connected (the owner uses Isracard and needs
  an online terminal from them). The option is visible but explains it isn't available, and the
  server rejects it, so no "paid" receipt can go out without a real charge.
- **Notifications never block an order.** If email (or later WhatsApp) fails, the order is still
  saved and the admin sees it wasn't sent. WhatsApp sending is built but switched off until the
  owner's WhatsApp Business setup is ready; email (with the PDF) is the channel today.
- **Product options are just grouped products**, not a new kind of product, so cart, stock,
  coupons and PDF work unchanged.
- **One way to do each thing in the admin.** The owner isn't technical; several paths to the same
  result confused him. E.g. cards are made and undone only from the bulk bar; names are edited in
  one window.
- **Confirm before anything destructive**, with a short explanation of the consequence; small
  toast messages after every save.
- **Phone first**: every screen is designed at phone width first; windows (checkout, product
  details, edit) are centred dialogs.
- **Light theme only**, brand colours from environment variables (name, logo, accent, secondary
  colour, contact phone) so the same code can serve another shop.
- **Images on ImageKit** (resized on the fly per use: card, detail, thumbnail), uploads shrunk in
  the browser to stay within the free plan.

## Operations

- Hosting: Railway (web service + Postgres), domain royalstockonline.com. Deploys on push to
  `master`; database migrations apply automatically on start.
- Plan: Railway **Hobby** is enough for this site. For handover, the owner opens his own Railway
  account on Hobby, the project is transferred to him (project → Settings → Members → invite →
  Transfer Ownership; both sides need an active plan), and he invites the developer back as a
  project member.
- Email: SendGrid (verified sender). Images: ImageKit.
- Open items: credit-card payments (Isracard online terminal), WhatsApp Business setup, legal pages
  (terms, privacy, accessibility statement), the VAT-display question above.

## Reusing this for a similar project

Start from a copy of this repository (or a GitHub template of it) so `CLAUDE.md` and this file come
along, then change branding through the environment variables and adjust the frontend. The parts
most worth keeping as they are: order snapshots + `order-totals.ts`, stock bookkeeping in
`stock.ts`, the public-product stripping, non-blocking notifications, the i18n/RTL setup, and the
"one way per task" admin approach.
