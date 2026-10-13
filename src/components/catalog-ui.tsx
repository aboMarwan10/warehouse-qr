"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PackageIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { optimizedImage } from "@/lib/image-url";
import { getEffectivePrice, getSalePercentOff } from "@/lib/effective-price";
import { asProductUnit } from "@/lib/product-unit";

export type Category = {
  id: string;
  name: string;
  order: number;
};

export type Subcategory = {
  id: string;
  name: string;
  order: number;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  inStock: boolean;
  onSale: boolean;
  salePrice: number | null;
  saleBannerImageUrl: string | null;
  categories: Category[];
  subcategory: Subcategory | null;
  /** "UNIT" or "CARTON" (src/lib/product-unit.ts). */
  unit: string;
  /** Secondary photos, after the main one (imageUrl). */
  images: string[];
  /** Set when this product is one option of a card (e.g. one colour). */
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  variantOrder: number;
};

// ---- Product options (several products shown as one card) ----

/** A shop card: one product, or a card's options in their order. */
export type ShopCardItem = { key: string; options: Product[] };

/**
 * Groups a product list into cards. A card takes the place of its first
 * option in the list, so sorting and arranging still apply.
 */
export function groupIntoCards(products: Product[]): ShopCardItem[] {
  const cards: ShopCardItem[] = [];
  const byGroup = new Map<string, ShopCardItem>();
  for (const product of products) {
    const groupId = product.variantGroup?.id;
    if (!groupId) {
      cards.push({ key: product.id, options: [product] });
      continue;
    }
    const existing = byGroup.get(groupId);
    if (existing) {
      existing.options.push(product);
    } else {
      const card = { key: `group-${groupId}`, options: [product] };
      byGroup.set(groupId, card);
      cards.push(card);
    }
  }
  for (const card of Array.from(byGroup.values())) {
    card.options.sort((a, b) => a.variantOrder - b.variantOrder);
  }
  return cards;
}

export function optionLabel(product: Product): string {
  return product.variantLabel || product.name;
}

/** A product's photos: the main one first, then the secondary ones. */
export function productPhotos(product: Product): string[] {
  return [product.imageUrl, ...(product.images ?? [])].filter((url): url is string => !!url);
}

/** The card photo: the chosen option's, else the first option with one. */
export function cardImage(options: Product[], selected: Product | null): string | null {
  return selected?.imageUrl ?? options.find((o) => o.imageUrl)?.imageUrl ?? null;
}

// useLayoutEffect warns when React renders on the server; it only needs to
// run in the browser (to measure), so fall back to useEffect there.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// The options as buttons when they all fit on one line of the card, otherwise
// a dropdown (e.g. six cup sizes on a narrow phone card). A hidden copy of the
// button row is measured against the card's width, and re-measured when the
// card resizes. Sold-out options can't be chosen.
export function OptionPicker({
  options,
  selectedId,
  onSelect,
  highlight = false,
  size = "sm",
}: {
  options: Product[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Draws attention after "add" was tapped with nothing chosen. */
  highlight?: boolean;
  size?: "sm" | "lg";
}) {
  const { t } = useLocale();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(true);

  useIsomorphicLayoutEffect(() => {
    const box = boxRef.current;
    const row = rowRef.current;
    if (!box || !row) return;
    const measure = () => setFits(row.scrollWidth <= box.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [options, size]);

  const ring = highlight ? "ring-2 ring-[#b3402e] ring-offset-1" : "";
  const buttonClass = (option: Product) => {
    const active = option.id === selectedId;
    return `shrink-0 whitespace-nowrap rounded-[7px] border font-semibold leading-tight ${
      size === "lg" ? "px-3 py-2 text-sm" : "px-2 py-1 text-[11px]"
    } ${
      active
        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
        : option.inStock
          ? "bg-white border-[#e6e0d6] text-[#2b2620] hover:border-[var(--accent)]"
          : "bg-[#f7f5f1] border-[#eee9e1] text-[#b5ada2] line-through"
    }`;
  };

  return (
    <div ref={boxRef} className="relative w-full min-w-0">
      {/* Measuring copy: never seen or tapped. */}
      <div ref={rowRef} aria-hidden className="absolute top-0 start-0 invisible pointer-events-none flex gap-1 w-max">
        {options.map((option) => (
          <span key={option.id} className={buttonClass(option)}>
            {optionLabel(option)}
          </span>
        ))}
      </div>

      {fits ? (
        <div className={`flex gap-1 rounded-[8px] ${ring}`} role="radiogroup">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === selectedId}
              disabled={!option.inStock}
              onClick={() => onSelect(option.id)}
              title={option.inStock ? undefined : t("catalog.outOfStock")}
              className={buttonClass(option)}
            >
              {optionLabel(option)}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={selectedId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          aria-label={t("catalog.chooseOption")}
          className={`w-full border rounded-[8px] bg-white font-semibold ${
            selectedId ? "border-[var(--accent)] text-[var(--accent)]" : "border-[#e6e0d6] text-[#2b2620]"
          } ${size === "lg" ? "px-3 py-2.5 text-sm" : "px-2 py-1.5 text-xs"} ${ring}`}
        >
          <option value="" disabled>
            {t("catalog.chooseOption")}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.inStock}>
              {optionLabel(option)}
              {option.inStock ? "" : ` (${t("catalog.soldOutShort")})`}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

/** "From ₪X" while no option is chosen and the options' prices differ. */
function FromPrice({ options }: { options: Product[] }) {
  const { t } = useLocale();
  const prices = options.map(getEffectivePrice);
  const min = Math.min(...prices);
  return (
    <p className="text-sm font-bold text-[#1a1714] flex items-baseline gap-1 flex-wrap">
      <span>{t("catalog.priceFrom", { price: min.toFixed(2) })}</span>
      <span className="text-[#8a8177] font-medium text-[0.78em]">
        / {t(`catalog.unitName.${asProductUnit(options[0].unit)}`)}
      </span>
    </p>
  );
}

/**
 * A shop card for one product or for a card's options. With options, the
 * buyer picks one (buttons / dropdown) and the price, photo, stock and
 * quantity shown are that option's; each option is its own cart line.
 */
export function ShopCard({
  options,
  cart,
  onAdd,
  onSetQuantity,
  onExpand,
}: {
  options: Product[];
  cart: Record<string, number>;
  onAdd: (productId: string) => void;
  onSetQuantity: (productId: string, quantity: number) => void;
  onExpand: (product: Product) => void;
}) {
  // Start on an option that's already in the cart, so its quantity shows.
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (options.length === 1 ? options[0].id : options.find((o) => (cart[o.id] ?? 0) > 0)?.id ?? null)
  );
  const [needsChoice, setNeedsChoice] = useState(false);

  if (options.length === 1) {
    const product = options[0];
    return (
      <ProductCard
        product={product}
        quantity={cart[product.id] ?? 0}
        onAdd={() => onAdd(product.id)}
        onSetQuantity={(qty) => onSetQuantity(product.id, qty)}
        onExpand={() => onExpand(product)}
      />
    );
  }

  const selected = options.find((o) => o.id === selectedId) ?? null;
  // Shown while nothing is chosen: the first option still available.
  const shown = selected ?? options.find((o) => o.inStock) ?? options[0];
  const samePrice = new Set(options.map(getEffectivePrice)).size === 1;
  return (
    <ProductCard
      product={shown}
      title={options[0].variantGroup?.name}
      imageUrl={cardImage(options, selected)}
      photoCount={productPhotos(selected ?? options.find((o) => o.imageUrl) ?? shown).length}
      price={!selected && !samePrice ? <FromPrice options={options} /> : undefined}
      picker={
        <OptionPicker
          options={options}
          selectedId={selectedId}
          highlight={needsChoice && !selected}
          onSelect={(id) => {
            setSelectedId(id);
            setNeedsChoice(false);
          }}
        />
      }
      quantity={selected ? cart[selected.id] ?? 0 : 0}
      onAdd={() => {
        if (selected) onAdd(selected.id);
        else setNeedsChoice(true);
      }}
      onSetQuantity={(qty) => selected && onSetQuantity(selected.id, qty)}
      onExpand={() => onExpand(shown)}
    />
  );
}

function PriceDisplay({ product, size = "sm" }: { product: Product; size?: "sm" | "lg" }) {
  const { t } = useLocale();
  const isOnSale = product.onSale && product.salePrice != null;
  const priceClass = size === "lg" ? "text-xl font-bold" : "text-sm font-bold";
  // "/ קרטון": what the price is for.
  const per = (
    <span className="text-[#8a8177] font-medium text-[0.78em]">
      / {t(`catalog.unitName.${asProductUnit(product.unit)}`)}
    </span>
  );
  if (!isOnSale) {
    return (
      <p className={`${priceClass} text-[#1a1714] flex items-baseline gap-1 flex-wrap`}>
        <span>₪{product.price.toFixed(2)}</span>
        {per}
      </p>
    );
  }
  return (
    <p className={`${priceClass} flex items-baseline gap-1.5 flex-wrap`}>
      <span className="text-[#b3402e]">₪{product.salePrice!.toFixed(2)}</span>
      <span className="text-[#a39a8e] font-medium line-through text-[0.85em]">
        ₪{product.price.toFixed(2)}
      </span>
      {per}
    </p>
  );
}

// The orders API accepts at most 10,000 of one product per order.
const MAX_QUANTITY = 10000;
const MAX_QUANTITY_DIGITS = String(MAX_QUANTITY).length;

export function AddToCartControl({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  size = "sm",
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  size?: "sm" | "lg";
}) {
  const { t } = useLocale();
  const [quantityInput, setQuantityInput] = useState(String(quantity));

  useEffect(() => {
    setQuantityInput(String(quantity));
  }, [quantity]);

  function commitQuantityInput() {
    const parsed = parseInt(quantityInput, 10);
    const clamped = Number.isNaN(parsed) ? 1 : Math.min(MAX_QUANTITY, Math.max(1, parsed));
    onSetQuantity(clamped);
    setQuantityInput(String(clamped));
  }

  if (!product.inStock) {
    if (size === "lg") {
      return (
        <p className="text-center font-semibold text-[#8a8177] bg-[#f2efe9] rounded-[9px] text-sm py-3">
          {t("catalog.outOfStock")}
        </p>
      );
    }
    return (
      <span className="shrink-0 flex items-center justify-center text-center leading-[1.1] text-[9px] font-semibold text-[#8a8177] bg-[#f2efe9] rounded-[9px] h-9 px-1.5 max-w-[78px]">
        {t("catalog.outOfStock")}
      </span>
    );
  }

  if (quantity === 0) {
    if (size === "lg") {
      return (
        <button
          onClick={onAdd}
          className="bg-[var(--accent)] text-white font-semibold rounded-[9px] w-full text-sm py-3"
        >
          {t("catalog.addToCart")}
        </button>
      );
    }
    return (
      <button
        onClick={onAdd}
        aria-label={t("catalog.addToCart")}
        className="shrink-0 flex items-center justify-center bg-[var(--accent)] text-white rounded-[9px] w-9 h-9"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`flex items-center justify-between rounded-[9px] p-[2px] ${
        size === "lg"
          ? "w-full bg-[#1a1714] text-white"
          : "shrink-0 min-w-[104px] h-9 bg-white border border-[var(--accent)] text-[var(--accent)]"
      }`}
    >
      <button
        onClick={() => onSetQuantity(quantity - 1)}
        aria-label="Decrease quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-7 h-full text-base"
        }`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={quantityInput}
        onChange={(e) => setQuantityInput(e.target.value.replace(/[^0-9]/g, "").slice(0, MAX_QUANTITY_DIGITS))}
        onBlur={commitQuantityInput}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label="Quantity"
        // Widens with the number of digits, so 5 and 1250 both fit.
        style={{ width: `${Math.max(size === "lg" ? 3 : 2, quantityInput.length) + 1}ch` }}
        className={`min-w-0 bg-transparent text-center font-semibold outline-none tabular-nums ${
          size === "lg" ? "text-base" : "text-[13px]"
        }`}
      />
      <button
        onClick={() => onSetQuantity(Math.min(MAX_QUANTITY, quantity + 1))}
        aria-label="Increase quantity"
        className={`shrink-0 font-bold leading-none ${
          size === "lg" ? "w-10 h-10 text-lg" : "w-7 h-full text-base"
        }`}
      >
        +
      </button>
    </div>
  );
}

export function ProductCard({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onExpand,
  title,
  imageUrl = product.imageUrl,
  price,
  picker,
  photoCount = productPhotos(product).length,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onExpand: () => void;
  /** Card with options (ShopCard): the card's name, photo, price and picker. */
  title?: string;
  imageUrl?: string | null;
  price?: ReactNode;
  picker?: ReactNode;
  /** How many photos the details window has; 2+ shows a camera badge. */
  photoCount?: number;
}) {
  const { t } = useLocale();
  const percentOff = getSalePercentOff(product);
  // Out-of-stock cards fade their image and text but keep the "out of stock"
  // label at full strength, so it's the first thing a buyer reads.
  const fade = !product.inStock ? "opacity-[.55]" : "";
  return (
    <div className="border border-[#eae5dc] rounded-[14px] overflow-hidden flex flex-col bg-white">
      <div
        className={`relative aspect-square flex items-center justify-center overflow-hidden p-2 ${
          imageUrl ? "bg-white" : "bg-[#f2efe9]"
        }`}
      >
        {!product.inStock && (
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-20 mx-auto w-fit bg-[#1a1714]/85 text-white text-xs font-bold rounded-full px-3 py-1">
            {t("catalog.outOfStock")}
          </span>
        )}
        {percentOff !== null && (
          <span className="absolute top-1.5 start-1.5 z-10 bg-[#b3402e] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
            -{percentOff}%
          </span>
        )}
        {photoCount > 1 && (
          // More photos in the details window ("פרטים").
          <span
            aria-label={t("catalog.morePhotos", { count: photoCount })}
            className="absolute bottom-1.5 end-1.5 z-10 flex items-center gap-1 bg-[#1a1714]/70 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5"
          >
            <CameraIcon className="w-3 h-3" />
            {photoCount}
          </span>
        )}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={optimizedImage(imageUrl, "CARD")}
            alt={title ?? product.name}
            className={`w-full h-full object-contain ${fade}`}
          />
        ) : (
          <PackageIcon className={`w-6 h-6 text-[#c5bdb1] ${fade}`} />
        )}
      </div>

      <div className={`p-[9px] pb-2.5 flex flex-col gap-[5px] flex-1 ${fade}`}>
        <p className="text-xs font-medium text-[#2b2620] line-clamp-2 min-h-[33px] leading-tight">
          {title ?? product.name}
        </p>
        {price ?? <PriceDisplay product={product} />}
        {picker}

        <div className="mt-auto flex items-center gap-1.5">
          <button
            onClick={onExpand}
            className="flex-1 min-w-0 h-9 border border-[var(--secondary)] text-[var(--secondary)] font-semibold rounded-[9px] text-[11px]"
          >
            {t("catalog.details")}
          </button>
          <AddToCartControl
            product={product}
            quantity={quantity}
            onAdd={onAdd}
            onSetQuantity={onSetQuantity}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

export function ProductDetailModal({
  product,
  quantity,
  onAdd,
  onSetQuantity,
  onClose,
  options = [],
  onSelectOption,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onSetQuantity: (quantity: number) => void;
  onClose: () => void;
  /** The card's options when `product` is one of them (picker shown). */
  options?: Product[];
  onSelectOption?: (product: Product) => void;
}) {
  const hasOptions = options.length > 1;
  const title = hasOptions ? product.variantGroup?.name ?? product.name : product.name;
  // The chosen product's photos; an option without its own falls back to the
  // card's photo.
  const ownPhotos = productPhotos(product);
  const fallback = hasOptions ? cardImage(options, product) : null;
  const photos = ownPhotos.length > 0 ? ownPhotos : fallback ? [fallback] : [];
  const { t } = useLocale();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Freeze the page behind the window so it can't scroll while open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    // A centered window on every screen size, like checkout. The overlay
    // covers the page, so nothing behind it can be tapped; tapping the
    // overlay itself closes the window.
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#1a1714]/55"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md bg-white rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {/* Keyed by product: switching option starts at its first photo. */}
          <PhotoGallery key={product.id} photos={photos} alt={title} />
          <button
            onClick={onClose}
            aria-label={t("checkout.close")}
            className="absolute top-3 end-3 w-9 h-9 rounded-full bg-white/95 text-[#6b6259] flex items-center justify-center text-lg shadow-sm"
          >
            ×
          </button>
        </div>

        <div className="p-[18px] pb-[22px]">
          <h2 className="text-lg font-bold text-[#1a1714] mb-1">{title}</h2>
          <div className="mb-2">
            <PriceDisplay product={product} size="lg" />
          </div>
          {(product.categories.length > 0 || product.subcategory) && (
            <p className="text-xs text-[#8a8177] mb-2">
              {product.categories.map((category) => category.name).join(", ")}
              {product.subcategory ? ` · ${product.subcategory.name}` : ""}
            </p>
          )}
          {hasOptions && (
            <div className="mb-3">
              <OptionPicker
                options={options}
                selectedId={product.id}
                onSelect={(id) => {
                  const next = options.find((o) => o.id === id);
                  if (next) onSelectOption?.(next);
                }}
                size="lg"
              />
            </div>
          )}
          {product.description && (
            <p className="text-sm text-[#6b6259] leading-relaxed mb-4">{product.description}</p>
          )}

          <AddToCartControl
            product={product}
            quantity={quantity}
            onAdd={onAdd}
            onSetQuantity={onSetQuantity}
            size="lg"
          />
        </div>
      </div>
    </div>
  );
}

// Auto-play for the details window's photos, like the home page's sale
// carousel: next photo every few seconds (looping), paused while the buyer
// swipes / taps and for a while after.
const GALLERY_AUTOPLAY_MS = 5000;
const GALLERY_RESUME_AFTER_MS = 7000;
// How long one slide takes: slower for the slideshow, a bit quicker when the
// buyer taps a thumbnail or arrow.
const GALLERY_AUTO_SLIDE_MS = 900;
const GALLERY_TAP_SLIDE_MS = 500;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Slides a scroll-snap row to photo `index` with an eased animation (the
 * browser's own smooth scroll is quick and can't be slowed). Snapping is
 * switched off while animating, or it would fight every frame. In RTL the
 * row scrolls toward negative scrollLeft. Returns a cancel function.
 */
function slideTo(el: HTMLElement, index: number, duration: number): () => void {
  const rtl = getComputedStyle(el).direction === "rtl";
  const from = el.scrollLeft;
  const to = (rtl ? -1 : 1) * index * el.clientWidth;
  if (Math.abs(to - from) < 1) return () => {};
  const start = performance.now();
  el.style.scrollSnapType = "none";
  let frame = requestAnimationFrame(function step(now) {
    const t = Math.min(1, (now - start) / duration);
    el.scrollLeft = from + (to - from) * easeInOutCubic(t);
    if (t < 1) frame = requestAnimationFrame(step);
    else el.style.scrollSnapType = "";
  });
  return () => {
    cancelAnimationFrame(frame);
    el.style.scrollSnapType = "";
  };
}

// The details window's photos: swipe between them (scroll-snap, so it feels
// native on phones), dots for where you are, thumbnails to jump, arrows on
// larger screens, and auto-play. A single photo (or none) shows as before.
function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const { t } = useLocale();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const lastInteractionRef = useRef(0);
  const cancelSlideRef = useRef<() => void>(() => {});
  const frame = "aspect-square max-h-[45dvh] w-full rounded-t-2xl";

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (photos.length < 2) return;
    // Respect "reduce motion": no slideshow, manual only.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastInteractionRef.current < GALLERY_RESUME_AFTER_MS) return;
      const el = scrollerRef.current;
      if (!el) return;
      cancelSlideRef.current();
      cancelSlideRef.current = slideTo(el, (indexRef.current + 1) % photos.length, GALLERY_AUTO_SLIDE_MS);
    }, GALLERY_AUTOPLAY_MS);
    return () => {
      clearInterval(timer);
      cancelSlideRef.current();
    };
  }, [photos.length]);

  // A touch stops any slide in progress, so the finger takes over smoothly.
  const markInteraction = () => {
    lastInteractionRef.current = Date.now();
    cancelSlideRef.current();
  };

  if (photos.length === 0) {
    return (
      <div className={`${frame} flex items-center justify-center bg-[#f2efe9]`}>
        <PackageIcon className="w-16 h-16 text-[#c5bdb1]" />
      </div>
    );
  }
  if (photos.length === 1) {
    return (
      <div className={`${frame} flex items-center justify-center overflow-hidden p-6 bg-white`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={optimizedImage(photos[0], "DETAIL")} alt={alt} className="w-full h-full object-contain" />
      </div>
    );
  }

  function goTo(next: number) {
    markInteraction();
    const el = scrollerRef.current;
    if (el) cancelSlideRef.current = slideTo(el, next, GALLERY_TAP_SLIDE_MS);
  }

  return (
    <div>
      <div className="relative bg-white rounded-t-2xl">
        <div
          ref={scrollerRef}
          // A finger or mouse on the photos pauses the slideshow.
          onPointerDown={markInteraction}
          onTouchStart={markInteraction}
          onWheel={markInteraction}
          onScroll={(e) => {
            const el = e.currentTarget;
            // RTL scrollLeft is negative in most browsers; the size of the
            // offset is what counts.
            setIndex(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
          }}
          className={`${frame} flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {photos.map((url, i) => (
            <div key={url} className="w-full h-full shrink-0 snap-center p-6 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizedImage(url, "DETAIL")}
                alt={`${alt} (${i + 1}/${photos.length})`}
                loading={i === 0 ? "eager" : "lazy"}
                className="w-full h-full object-contain"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => goTo(Math.max(0, index - 1))}
          disabled={index === 0}
          aria-label={t("catalog.prevPhoto")}
          className="hidden sm:flex absolute top-1/2 -translate-y-1/2 start-2 w-9 h-9 rounded-full bg-white/95 shadow text-[#1a1714] items-center justify-center disabled:opacity-0"
        >
          {/* RTL: "previous" is to the right */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => goTo(Math.min(photos.length - 1, index + 1))}
          disabled={index === photos.length - 1}
          aria-label={t("catalog.nextPhoto")}
          className="hidden sm:flex absolute top-1/2 -translate-y-1/2 end-2 w-9 h-9 rounded-full bg-white/95 shadow text-[#1a1714] items-center justify-center disabled:opacity-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5" aria-hidden>
          {photos.map((url, i) => (
            <span
              key={url}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-[var(--accent)]" : "w-1.5 bg-[#1a1714]/25"}`}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2 px-[18px] pt-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => goTo(i)}
            aria-label={t("catalog.photoN", { n: i + 1 })}
            aria-current={i === index ? "true" : undefined}
            className={`w-14 h-14 shrink-0 rounded-[10px] border-2 bg-white p-1 ${
              i === index ? "border-[var(--accent)]" : "border-[#eae5dc]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={optimizedImage(url, "THUMB")} alt="" className="w-full h-full object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}
