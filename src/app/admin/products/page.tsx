"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryFilter, matchesCategoryFilter, type CategoryFilterValue } from "@/components/category-filter";
import { ImageUploadField } from "@/components/image-upload-field";
import { ActionsMenu } from "./actions-menu";
import { CategoryList } from "./category-list";
import { UnitStockFields, parseStockInput } from "./unit-stock-fields";
import { ProductImagesField } from "./product-images-field";
import { VariantOptionsSection } from "./variant-options-section";
import { ProductOrderSection } from "./product-order-list";
import { ChevronDownIcon, DuplicateIcon, EditIcon, PackageIcon, TrashIcon } from "@/components/icons";
import { useLocale } from "@/components/locale-provider";
import { useConfirm } from "@/components/confirm-dialog";
import { Spinner, useToast } from "@/components/toast";
import { optimizedImage } from "@/lib/image-url";
import { LOW_STOCK_THRESHOLD, PRODUCT_UNIT, asProductUnit } from "@/lib/product-unit";
import { DESKTOP_QUERY, useMediaQuery } from "@/lib/use-media-query";

type Category = {
  id: string;
  name: string;
  order: number;
  imageUrl: string | null;
};

type Subcategory = {
  id: string;
  name: string;
  order: number;
  categoryId: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  images: string[];
  inStock: boolean;
  sortOrder: number;
  unit: string;
  stockQuantity: number | null;
  onSale: boolean;
  salePrice: number | null;
  saleBannerImageUrl: string | null;
  categories: Category[];
  subcategoryId: string | null;
  subcategory: Subcategory | null;
  variantGroup: { id: string; name: string } | null;
  variantLabel: string | null;
  variantOrder: number;
};

function CategoryMultiSelect({
  categories,
  selectedIds,
  onChange,
  placeholder,
}: {
  categories: Category[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((existing) => existing !== id) : [...selectedIds, id]
    );
  }

  const label =
    selectedIds.length === 0
      ? placeholder
      : categories
          .filter((category) => selectedIds.includes(category.id))
          .map((category) => category.name)
          .join(", ");

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5 bg-white text-start truncate"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[180px] max-h-56 overflow-y-auto bg-white border border-[#e6e0d6] rounded-[10px] shadow-lg p-1.5 space-y-0.5">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-[7px] hover:bg-[#f7f5f1] text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(category.id)}
                onChange={() => toggle(category.id)}
              />
              {category.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

type ProductAction = "stock" | "sale" | "duplicate" | "delete" | "save";

// Tracked products at or below the threshold (0 included) need restocking.
function isLowStock(product: { stockQuantity: number | null }): boolean {
  return product.stockQuantity != null && product.stockQuantity <= LOW_STOCK_THRESHOLD;
}

export default function AdminProductsPage() {
  const { t } = useLocale();
  const toast = useToast();
  const confirm = useConfirm();
  // Which product action is in flight, so its button can show a spinner and
  // the row's other buttons can't be double-clicked meanwhile.
  const [busy, setBusy] = useState<{ id: string; action: ProductAction } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState<string>(PRODUCT_UNIT.UNIT);
  const [stock, setStock] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subcategoryId, setSubcategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [imageCategoryId, setImageCategoryId] = useState("");


  const [searchQuery, setSearchQuery] = useState("");
  const [listFilter, setListFilter] = useState<CategoryFilterValue>({ categoryId: "", subcategoryId: "" });
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [subcatsOpen, setSubcatsOpen] = useState(false);
  // Desktop lays the page out as side-by-side cards: the subcategories and
  // add-product cards are always open instead of tap-to-open sections.
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const showSubcats = subcatsOpen || isDesktop;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editSubcategoryId, setEditSubcategoryId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editUnit, setEditUnit] = useState<string>(PRODUCT_UNIT.UNIT);
  const [editStock, setEditStock] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editOnSale, setEditOnSale] = useState(false);
  const [editSaleMode, setEditSaleMode] = useState<"amount" | "percent">("amount");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editSalePercent, setEditSalePercent] = useState("");
  const [editSaleBannerImageUrl, setEditSaleBannerImageUrl] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // `quiet` refreshes in the background after an action instead of swapping
  // the whole list for the "loading..." text.
  async function loadAll({ quiet = false }: { quiet?: boolean } = {}) {
    if (!quiet) setLoading(true);
    const [productsRes, categoriesRes, subcategoriesRes] = await Promise.all([
      fetch("/api/products"),
      fetch("/api/categories"),
      fetch("/api/subcategories"),
    ]);
    const [productsData, categoriesData, subcategoriesData] = await Promise.all([
      productsRes.json(),
      categoriesRes.json(),
      subcategoriesRes.json(),
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setSubcategories(subcategoriesData);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setCategoryError(null);

    if (!newCategoryName.trim()) {
      setCategoryError(t("admin.products.categoryNameRequired"));
      return;
    }

    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim(), order: categories.length }),
    });

    if (!res.ok) {
      setCategoryError(t("admin.products.categoryError"));
      return;
    }

    setNewCategoryName("");
    loadAll();
  }

  async function removeCategoryImage(category: Category) {
    const ok = await confirm({
      title: t("admin.confirmDialog.categoryImageTitle", { name: category.name }),
      message: t("admin.confirmDialog.categoryImageBody"),
      confirmLabel: t("admin.confirmDialog.remove"),
    });
    if (ok) await setCategoryImage(category.id, "");
  }

  async function setCategoryImage(id: string, url: string) {
    setCategories((current) =>
      current.map((category) => (category.id === id ? { ...category, imageUrl: url || null } : category))
    );
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url || null }),
    });
  }

  // Saves a new category order after a drag. Renumbers 0..n (which also fixes
  // any duplicate `order` values left from before) and only sends the rows
  // whose position changed. The home page lists categories in this order.
  async function saveCategoryOrder(reordered: Category[]) {
    const changed = reordered.filter((category, position) => category.order !== position);
    setCategories(reordered.map((category, position) => ({ ...category, order: position })));
    await Promise.all(
      changed.map((category) =>
        fetch(`/api/categories/${category.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: reordered.indexOf(category) }),
        })
      )
    );
  }

  async function deleteCategory(id: string) {
    const category = categories.find((c) => c.id === id);
    if (!category) return;
    // Products are never deleted with a category, but ones with no other
    // category drop out of the shop, which looks like deletion to a buyer.
    const inCategory = products.filter((p) => p.categories.some((c) => c.id === id));
    const leftWithout = inCategory.filter((p) => p.categories.length === 1).length;
    const ok = await confirm({
      title: t("admin.confirmDialog.categoryTitle", { name: category.name }),
      message:
        inCategory.length === 0
          ? t("admin.confirmDialog.categoryBodyEmpty")
          : leftWithout > 0
            ? t("admin.confirmDialog.categoryBodyOrphans", { count: inCategory.length, orphans: leftWithout })
            : t("admin.confirmDialog.categoryBody", { count: inCategory.length }),
    });
    if (!ok) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
    loadAll();
  }


  // Adds a subcategory at the end of its category's list. Returns an error
  // message to show, or null on success.
  async function addSubcategory(categoryId: string, name: string): Promise<string | null> {
    if (!name.trim()) return t("admin.products.subcategoryNameRequired");
    const res = await fetch("/api/subcategories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        categoryId,
        order: subcategories.filter((subcategory) => subcategory.categoryId === categoryId).length,
      }),
    });
    if (!res.ok) return t("admin.products.subcategoryError");
    loadAll({ quiet: true });
    return null;
  }

  // Saves a new subcategory order after a drag (within the chosen category):
  // renumbers them 0..n and only sends the ones whose position changed. The
  // shop shows a category's subcategory chips and sections in this order.
  async function saveSubcategoryOrder(reordered: Subcategory[]) {
    const changed = reordered.filter((subcategory, position) => subcategory.order !== position);
    const positions = new Map(reordered.map((subcategory, position) => [subcategory.id, position]));
    setSubcategories((current) =>
      current
        .map((subcategory) =>
          positions.has(subcategory.id) ? { ...subcategory, order: positions.get(subcategory.id)! } : subcategory
        )
        .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "he"))
    );
    await Promise.all(
      changed.map((subcategory) =>
        fetch(`/api/subcategories/${subcategory.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order: positions.get(subcategory.id) }),
        })
      )
    );
  }

  async function deleteSubcategory(id: string) {
    const subcategory = subcategories.find((s) => s.id === id);
    if (!subcategory) return;
    const ok = await confirm({
      title: t("admin.confirmDialog.subcategoryTitle", { name: subcategory.name }),
      message: t("admin.confirmDialog.subcategoryBody"),
    });
    if (!ok) return;
    await fetch(`/api/subcategories/${id}`, { method: "DELETE" });
    loadAll();
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsedPrice = Number(price);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError(t("admin.products.invalidProduct"));
      return;
    }
    const parsedStock = parseStockInput(stock);
    if (Number.isNaN(parsedStock)) {
      setError(t("admin.products.invalidStock"));
      return;
    }

    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || undefined,
        price: parsedPrice,
        imageUrl: imageUrl || undefined,
        images,
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        subcategoryId: subcategoryId || undefined,
        unit,
        stockQuantity: parsedStock,
      }),
    });

    if (!res.ok) {
      setError(t("admin.products.addProductFailed"));
      return;
    }

    setName("");
    setDescription("");
    setPrice("");
    setStock("");
    setImageUrl("");
    setImages([]);
    setCategoryIds([]);
    setSubcategoryId("");
    toast(t("admin.products.toastAdded"));
    loadAll({ quiet: true });
  }

  async function duplicateProduct(product: Product) {
    const ok = await confirm({
      title: t("admin.confirmDialog.duplicateTitle", { name: product.name }),
      message: t("admin.confirmDialog.duplicateBody", { copy: t("admin.products.duplicateName", { name: product.name }) }),
      confirmLabel: t("admin.confirmDialog.duplicate"),
      tone: "normal",
    });
    if (!ok) return;
    setBusy({ id: product.id, action: "duplicate" });
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t("admin.products.duplicateName", { name: product.name }),
        description: product.description || undefined,
        price: product.price,
        imageUrl: product.imageUrl || undefined,
        images: product.images,
        inStock: product.inStock,
        unit: product.unit,
        categoryIds: product.categories.map((category) => category.id),
        subcategoryId: product.subcategoryId || undefined,
      }),
    });

    if (!res.ok) {
      setBusy(null);
      toast(t("admin.products.toastFailed"), "error");
      return;
    }
    const newProduct: Product = await res.json();
    await loadAll({ quiet: true });
    setBusy(null);
    toast(t("admin.products.toastDuplicated"));
    startEdit(newProduct);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditName(product.name);
    setEditDescription(product.description ?? "");
    setEditPrice(String(product.price));
    setEditUnit(product.unit);
    setEditStock(product.stockQuantity != null ? String(product.stockQuantity) : "");
    setEditImageUrl(product.imageUrl ?? "");
    setEditImages(product.images ?? []);
    setEditOnSale(product.onSale);
    setEditSaleMode("amount");
    setEditSalePrice(product.salePrice != null ? String(product.salePrice) : "");
    setEditSalePercent("");
    setEditSaleBannerImageUrl(product.saleBannerImageUrl ?? "");
    setEditCategoryIds(product.categories.map((category) => category.id));
    setEditSubcategoryId(product.subcategoryId ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(productId: string) {
    setEditError(null);

    const parsedPrice = Number(editPrice);
    if (!editName.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setEditError(t("admin.products.invalidProduct"));
      return;
    }
    const parsedStock = parseStockInput(editStock);
    if (Number.isNaN(parsedStock)) {
      setEditError(t("admin.products.invalidStock"));
      return;
    }

    let parsedSalePrice: number | null = null;
    if (editOnSale) {
      if (editSaleMode === "percent") {
        const parsedPercent = Number(editSalePercent);
        if (!Number.isFinite(parsedPercent) || parsedPercent <= 0 || parsedPercent >= 100) {
          setEditError(t("admin.products.invalidSalePercent"));
          return;
        }
        parsedSalePrice = Math.round(parsedPrice * (1 - parsedPercent / 100) * 100) / 100;
      } else {
        parsedSalePrice = editSalePrice.trim() === "" ? null : Number(editSalePrice);
      }

      if (
        parsedSalePrice == null ||
        !Number.isFinite(parsedSalePrice) ||
        parsedSalePrice <= 0 ||
        parsedSalePrice >= parsedPrice
      ) {
        setEditError(t("admin.products.invalidSalePrice"));
        return;
      }
    }

    const ok = await confirm({
      title: t("admin.confirmDialog.saveTitle", { name: editName.trim() }),
      message: t("admin.confirmDialog.saveBody"),
      confirmLabel: t("admin.confirmDialog.save"),
      tone: "normal",
    });
    if (!ok) return;

    setBusy({ id: productId, action: "save" });
    const res = await fetch(`/api/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        description: editDescription || undefined,
        price: parsedPrice,
        imageUrl: editImageUrl || null,
        images: editImages,
        onSale: editOnSale,
        salePrice: editOnSale ? parsedSalePrice : null,
        saleBannerImageUrl: editOnSale ? editSaleBannerImageUrl || null : null,
        categoryIds: editCategoryIds,
        unit: editUnit,
        stockQuantity: parsedStock,
        // A subcategory only makes sense under one of the product's categories.
        subcategoryId: subcategories.some(
          (s) => s.id === editSubcategoryId && editCategoryIds.includes(s.categoryId)
        )
          ? editSubcategoryId
          : null,
      }),
    });

    if (!res.ok) {
      setBusy(null);
      setEditError(t("admin.products.editProductFailed"));
      return;
    }

    await loadAll({ quiet: true });
    setBusy(null);
    setEditingId(null);
    toast(t("admin.products.toastSaved"));
  }

  // Runs a one-click product action with a spinner on its button, then a
  // success or failure toast once the list has refreshed.
  async function runAction(
    product: Product,
    action: ProductAction,
    request: () => Promise<Response>,
    successMessage: string,
    failureMessage: (res: Response) => string = () => t("admin.products.toastFailed")
  ) {
    setBusy({ id: product.id, action });
    let res: Response | null = null;
    try {
      res = await request();
    } catch {
      res = null;
    }
    if (res?.ok) await loadAll({ quiet: true });
    setBusy(null);
    if (res?.ok) toast(successMessage);
    else toast(res ? failureMessage(res) : t("admin.products.toastFailed"), "error");
  }

  async function toggleStock(product: Product) {
    const ok = await confirm(
      product.inStock
        ? {
            title: t("admin.confirmDialog.outOfStockTitle", { name: product.name }),
            message: t("admin.confirmDialog.outOfStockBody"),
            confirmLabel: t("admin.confirmDialog.markOutOfStock"),
            tone: "normal",
          }
        : {
            title: t("admin.confirmDialog.inStockTitle", { name: product.name }),
            message: t("admin.confirmDialog.inStockBody"),
            confirmLabel: t("admin.confirmDialog.markInStock"),
            tone: "normal",
          }
    );
    if (!ok) return;
    runAction(
      product,
      "stock",
      () =>
        fetch(`/api/products/${product.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inStock: !product.inStock }),
        }),
      product.inStock ? t("admin.products.toastOutOfStock") : t("admin.products.toastInStock")
    );
  }

  async function toggleSale(product: Product) {
    if (product.onSale) {
      const ok = await confirm({
        title: t("admin.confirmDialog.endSaleTitle", { name: product.name }),
        message: t("admin.confirmDialog.endSaleBody"),
        confirmLabel: t("admin.confirmDialog.endSale"),
        tone: "normal",
      });
      if (!ok) return;
      runAction(
        product,
        "sale",
        () =>
          fetch(`/api/products/${product.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ onSale: false, salePrice: null, saleBannerImageUrl: null }),
          }),
        t("admin.products.toastRemovedFromSale")
      );
      return;
    }
    startEdit(product);
    setEditOnSale(true);
  }

  async function deleteProduct(product: Product) {
    const ok = await confirm({
      title: t("admin.confirmDialog.productTitle", { name: product.name }),
      message: t("admin.confirmDialog.productBody"),
    });
    if (!ok) return;
    runAction(
      product,
      "delete",
      () => fetch(`/api/products/${product.id}`, { method: "DELETE" }),
      t("admin.products.toastDeleted"),
      (res) => (res.status === 409 ? t("admin.products.toastDeleteHasOrders") : t("admin.products.toastFailed"))
    );
  }

  const editingProduct = products.find((product) => product.id === editingId) ?? null;

  // Freeze the page behind the edit window while it's open.
  useEffect(() => {
    if (!editingId) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [editingId]);

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
      matchesCategoryFilter(product, listFilter) &&
      (!lowStockOnly || isLowStock(product))
  );
  const listFiltered = searchQuery.trim() !== "" || listFilter.categoryId !== "" || lowStockOnly;

  // The add-product form: inline (tap to open) on phones, its own card on desktop.
  function renderAddForm(className: string) {
    return (
      <form onSubmit={addProduct} className={className}>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_130px] gap-2.5">
          <input
            type="text"
            placeholder={t("admin.products.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
          />
          <CategoryMultiSelect
            categories={categories}
            selectedIds={categoryIds}
            onChange={(ids) => {
              setCategoryIds(ids);
              if (!subcategories.some((s) => s.id === subcategoryId && ids.includes(s.categoryId))) {
                setSubcategoryId("");
              }
            }}
            placeholder={t("admin.products.noCategoryOption")}
          />
          <input
            type="number"
            step="0.01"
            placeholder={t("admin.products.pricePlaceholder")}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
          />
        </div>
        {categoryIds.length > 0 && subcategories.some((s) => categoryIds.includes(s.categoryId)) && (
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
          >
            <option value="">{t("admin.products.noSubcategoryOption")}</option>
            {subcategories
              .filter((s) => categoryIds.includes(s.categoryId))
              .map((subcategory) => (
                <option key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </option>
              ))}
          </select>
        )}
        <input
          type="text"
          placeholder={t("admin.products.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-[#e6e0d6] rounded-[10px] px-3.5 py-2.5"
        />
        <UnitStockFields unit={unit} onUnitChange={setUnit} stock={stock} onStockChange={setStock} />
        <ProductImagesField
          main={imageUrl}
          extras={images}
          onChange={(main, extras) => {
            setImageUrl(main);
            setImages(extras);
          }}
        />
        <div className="flex items-center gap-3.5 flex-wrap">
          <button
            type="submit"
            className="ms-auto bg-[var(--accent)] text-white rounded-[10px] px-5 py-2.5 text-sm font-semibold"
          >
            {t("admin.products.addProduct")}
          </button>
        </div>
        {error && <p className="text-sm text-[#b3402e]">{error}</p>}
      </form>
    );
  }

  return (
    // Phones: one column. Desktop (lg): categories on one side, subcategories
    // and add-product stacked on the other, then the products card.
    <div className="mx-auto max-w-3xl lg:max-w-7xl px-4 py-4 lg:px-8 lg:py-6 space-y-[22px]">
      <h1 className="hidden lg:block text-2xl font-bold text-[#1a1714]">{t("admin.products.productsTitle")}</h1>

      <div className="space-y-[22px] lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-[22px]">
      <div className="lg:bg-white lg:border lg:border-[#eae5dc] lg:rounded-[14px]">
        <h1 className="text-xl font-bold text-[#1a1714] mb-4 lg:mb-0 lg:text-base lg:px-[18px] lg:py-3.5 lg:border-b lg:border-[#eae5dc]">
          {t("admin.products.categoriesTitle")}
        </h1>

        <div className="lg:p-[18px]">
        <form onSubmit={addCategory} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder={t("admin.products.newCategoryPlaceholder")}
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5"
          />
          <button
            type="submit"
            className="bg-[var(--accent)] text-white rounded-[10px] px-4 py-2.5 text-sm font-semibold"
          >
            {t("admin.products.add")}
          </button>
        </form>
        {categoryError && <p className="text-sm text-[#b3402e] mb-3">{categoryError}</p>}

        <CategoryList
          categories={categories}
          expandedId={imageCategoryId}
          onToggleExpanded={(id) => setImageCategoryId(imageCategoryId === id ? "" : id)}
          onDelete={deleteCategory}
          onReorder={saveCategoryOrder}
          renderExpanded={(category) => (
            <div className="border-t border-[#eae5dc] px-3.5 py-3">
              <p className="text-sm font-semibold text-[#1a1714] mb-2">
                {t("admin.products.categoryImageTitle", { name: category.name })}
              </p>
              <ImageUploadField
                value={category.imageUrl ?? ""}
                onChange={(url) => setCategoryImage(category.id, url)}
                uploadLabel={t("admin.products.uploadImage")}
                uploadingLabel={t("admin.products.uploading")}
                hintText={t("admin.products.categoryImageHint")}
                errorMessages={{
                  notImage: t("admin.products.uploadErrorNotImage"),
                  tooLarge: t("admin.products.uploadErrorTooLarge"),
                  network: t("admin.products.uploadErrorNetwork"),
                  generic: t("admin.products.uploadErrorGeneric"),
                }}
              />
              {category.imageUrl && (
                <button
                  type="button"
                  onClick={() => removeCategoryImage(category)}
                  className="mt-2 text-xs text-[#a39a8e] hover:text-[#b3402e]"
                >
                  {t("admin.products.removeCategoryImage")}
                </button>
              )}
            </div>
          )}
        />
        </div>
      </div>

      {/* Desktop: both columns end at the same line (the grid stretches the
          categories card; the add-product card fills any leftover height). */}
      <div className="space-y-[22px] lg:space-y-0 lg:flex lg:flex-col lg:gap-[22px]">
      {/* Phones: collapsed by default, the header opens it. Desktop: always open. */}
      <div className="bg-white border border-[#eae5dc] rounded-[14px]">
        <button
          type="button"
          onClick={() => setSubcatsOpen((open) => !open)}
          aria-expanded={showSubcats}
          disabled={isDesktop}
          className="w-full flex items-center justify-between gap-3 px-[18px] py-3.5 text-start lg:cursor-default lg:border-b lg:border-[#eae5dc]"
        >
          <span>
            <span className="block text-base font-bold text-[#1a1714]">{t("admin.products.subcategoriesTitle")}</span>
            <span className="block text-[13px] text-[#8a8177]">{t("admin.products.subcategoriesHint")}</span>
          </span>
          <ChevronDownIcon
            className={`w-5 h-5 shrink-0 text-[#6b6259] transition-transform lg:hidden ${subcatsOpen ? "rotate-180" : ""}`}
          />
        </button>
        {showSubcats && (
          <div className="px-[18px] pb-[18px] lg:pt-[18px]">
            {/* Everything for subcategories in one place: add, delete, drag to
                reorder, and open one to arrange its products. */}
            <ProductOrderSection
              categories={categories}
              subcategories={subcategories}
              products={products}
              onSaved={() => loadAll({ quiet: true })}
              onReorderSubcategories={(orderedIds) =>
                saveSubcategoryOrder(
                  orderedIds.flatMap((id) => subcategories.filter((subcategory) => subcategory.id === id))
                )
              }
              onAddSubcategory={addSubcategory}
              onDeleteSubcategory={deleteSubcategory}
            />
          </div>
        )}
      </div>

      {isDesktop && (
        <div className="flex-1 bg-white border border-[#eae5dc] rounded-[14px]">
          <h2 className="text-base font-bold text-[#1a1714] px-[18px] py-3.5 border-b border-[#eae5dc]">
            {t("admin.products.addProductToggle")}
          </h2>
          {renderAddForm("p-[18px] space-y-2.5")}
        </div>
      )}
      </div>
      </div>

      <div className="lg:bg-white lg:border lg:border-[#eae5dc] lg:rounded-[14px] lg:p-[18px]">
        {/* Desktop shows this title in the page header instead. */}
        <h1 className="text-xl font-bold text-[#1a1714] mb-4 lg:hidden">
          {t("admin.products.productsTitle")}
        </h1>

        {/* Phones only (desktop has its own add-product card). Collapsed
            by default so the product list and search are what you see first;
            the arrow opens the add-product form. */}
        <div className="bg-white border border-[#eae5dc] rounded-[14px] mb-4 lg:hidden">
          <button
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            aria-expanded={addOpen}
            className="w-full flex items-center justify-between gap-3 px-[18px] py-3.5 text-sm font-semibold text-[#1a1714]"
          >
            {t("admin.products.addProductToggle")}
            <ChevronDownIcon className={`w-5 h-5 text-[#6b6259] transition-transform ${addOpen ? "rotate-180" : ""}`} />
          </button>
          {addOpen && !isDesktop && renderAddForm("px-[18px] pb-[18px] pt-1 space-y-2.5")}
        </div>

        {/* Desktop: one full-width toolbar row; search fills the space and the
            filters sit at the far end, checkbox before the category dropdown. */}
        <div className="lg:flex lg:items-center lg:gap-3 lg:mb-3">
        <input
          type="search"
          placeholder={t("admin.products.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full border border-[#e6e0d6] bg-white rounded-[10px] px-3.5 py-2.5 mb-2 lg:mb-0 lg:w-auto lg:flex-1"
        />
        <div className="mb-2 lg:mb-0 lg:order-2">
          <CategoryFilter
            categories={categories}
            subcategories={subcategories}
            value={listFilter}
            onChange={setListFilter}
          />
        </div>
        <label className="flex items-center gap-2 text-[13px] font-medium text-[#4a443c] mb-2 lg:mb-0 lg:order-1 w-fit shrink-0">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="w-4 h-4 accent-[var(--accent)]"
          />
          {t("admin.products.lowStockOnly", { threshold: LOW_STOCK_THRESHOLD })}
        </label>
        </div>
        {listFiltered && !loading && (
          <p className="text-[13px] text-[#8a8177] mb-3">
            {t("admin.products.filterMatches", { count: filteredProducts.length, total: products.length })}
          </p>
        )}
        {!listFiltered && <div className="mb-2" />}


        {loading ? (
          <p className="text-sm text-[#8a8177]">{t("admin.products.loading")}</p>
        ) : products.length === 0 ? (
          <p className="text-sm text-[#8a8177]">{t("admin.products.noProductsYet")}</p>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-[#8a8177]">
            {searchQuery.trim()
              ? t("admin.products.noProductsMatch", { query: searchQuery })
              : t("catalog.noProductsMatchFilter")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredProducts.map((product) => {
              const subcategory = subcategories.find((s) => s.id === product.subcategoryId);
              return (
                <li
                  key={product.id}
                  className="bg-white border border-[#eae5dc] rounded-[14px] overflow-hidden flex flex-col"
                >
                  <div className="relative h-44 bg-white flex items-center justify-center border-b border-[#f2efe9]">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={optimizedImage(product.imageUrl, "CARD")}
                        alt=""
                        className={`w-full h-full object-contain p-3 ${product.inStock ? "" : "opacity-50"}`}
                      />
                    ) : (
                      <PackageIcon className="w-10 h-10 text-[#c5bdb1]" />
                    )}
                    <div className="absolute top-2.5 end-2.5">
                      <ActionsMenu
                        label={t("admin.products.actionsMenu", { name: product.name })}
                        disabled={busy?.id === product.id}
                        busyIcon={busy?.id === product.id ? <Spinner /> : undefined}
                        items={[
                          {
                            label: t("admin.products.edit"),
                            icon: <EditIcon className="w-4 h-4" />,
                            onClick: () => startEdit(product),
                          },
                          {
                            label: product.inStock ? t("admin.products.markOutOfStock") : t("admin.products.markInStock"),
                            icon: <PackageIcon className="w-4 h-4" />,
                            onClick: () => toggleStock(product),
                          },
                          {
                            label: product.onSale ? t("admin.products.removeFromSale") : t("admin.products.markOnSale"),
                            icon: <span className="text-sm font-bold">%</span>,
                            onClick: () => toggleSale(product),
                          },
                          {
                            label: t("admin.products.duplicate"),
                            icon: <DuplicateIcon className="w-4 h-4" />,
                            onClick: () => duplicateProduct(product),
                          },
                          {
                            label: t("admin.products.delete"),
                            icon: <TrashIcon className="w-4 h-4" />,
                            onClick: () => deleteProduct(product),
                            danger: true,
                          },
                        ]}
                      />
                    </div>
                    <div className="absolute top-2.5 start-2.5 flex flex-col items-start gap-1">
                      <span
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                          product.inStock ? "bg-[#f1f7f1] text-[#2f6b3a]" : "bg-[#f2efe9] text-[#6b6259]"
                        }`}
                      >
                        {product.inStock ? t("admin.products.inStockLabel") : t("admin.products.outOfStockLabel")}
                      </span>
                      {product.onSale && (
                        <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-[var(--accent)] text-white">
                          {t("admin.products.onSaleLabel")}
                        </span>
                      )}
                      {isLowStock(product) && product.stockQuantity !== 0 && (
                        <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-[#fdf1e3] text-[#9a5a06]">
                          {t("admin.products.lowStockBadge")}
                        </span>
                      )}
                      {product.variantGroup && (
                        <span className="text-xs font-semibold rounded-full px-2.5 py-1 bg-[#eef2fb] text-[#33508f] max-w-[180px] truncate">
                          {t("admin.variants.badge", {
                            card: product.variantGroup.name,
                            label: product.variantLabel || product.name,
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(product)}
                    className="flex-1 flex flex-col gap-1.5 p-3.5 text-start"
                  >
                    <span className="text-[15px] font-semibold text-[#1a1714] leading-snug line-clamp-2">
                      {product.name}
                    </span>
                    <span className="flex items-baseline gap-2">
                      {product.onSale && product.salePrice != null ? (
                        <>
                          <span className="text-base font-bold text-[#b3402e]">₪{product.salePrice.toFixed(2)}</span>
                          <span className="text-xs text-[#a39a8e] line-through">₪{product.price.toFixed(2)}</span>
                        </>
                      ) : (
                        <span className="text-base font-bold text-[#1a1714]">₪{product.price.toFixed(2)}</span>
                      )}
                      <span className="text-xs text-[#8a8177]">/ {t(`catalog.unitName.${asProductUnit(product.unit)}`)}</span>
                    </span>
                    {product.stockQuantity != null && (
                      <span
                        className={`text-[13px] font-semibold ${
                          isLowStock(product) ? "text-[#9a5a06]" : "text-[#2f6b3a]"
                        }`}
                      >
                        {t("admin.products.stockLine", {
                          count: product.stockQuantity,
                          unit: t(`catalog.unitMany.${asProductUnit(product.unit)}`),
                        })}
                      </span>
                    )}
                    <span className="text-xs text-[#8a8177] line-clamp-1">
                      {product.categories.length > 0
                        ? product.categories.map((category) => category.name).join(", ")
                        : t("admin.products.noCategoryOption")}
                      {subcategory ? ` · ${subcategory.name}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editingProduct && (
        // Centered edit window; the page behind can't be tapped or scrolled.
        // !mt-0: the page's space-y gap would otherwise push the overlay down.
        <div className="fixed inset-0 !mt-0 z-40 flex items-center justify-center p-4 bg-[#1a1714]/55">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("admin.products.editTitle", { name: editingProduct.name })}
            className="w-full max-w-lg bg-white rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-[#f2efe9]">
              <h2 className="text-base font-bold text-[#1a1714] truncate">
                {t("admin.products.editTitle", { name: editingProduct.name })}
              </h2>
              <button
                type="button"
                onClick={cancelEdit}
                aria-label={t("admin.products.cancel")}
                className="w-8 h-8 shrink-0 rounded-full bg-[#f2efe9] text-[#6b6259] flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveEdit(editingProduct.id);
              }}
              className="space-y-2.5 p-5"
            >
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="block text-xs font-semibold text-[#6b6259] mb-1">{t("admin.products.namePlaceholder")}</span>
                <input
                  type="text"
                  placeholder={t("admin.products.namePlaceholder")}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                />
                </label>
                <label className="w-24">
                  <span className="block text-xs font-semibold text-[#6b6259] mb-1">{t("admin.products.pricePlaceholder")}</span>
                <input
                  type="number"
                  step="0.01"
                  placeholder={t("admin.products.pricePlaceholder")}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                />
                </label>
              </div>
              <span className="block text-xs font-semibold text-[#6b6259] mb-1">{t("admin.products.descriptionPlaceholder")}</span>
              <input
                type="text"
                placeholder={t("admin.products.descriptionPlaceholder")}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
              />
              <UnitStockFields
                unit={editUnit}
                onUnitChange={setEditUnit}
                stock={editStock}
                onStockChange={setEditStock}
              />
              <VariantOptionsSection
                key={editingProduct.id}
                product={editingProduct}
                allProducts={products}
                onChanged={() => loadAll({ quiet: true })}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-1.5 text-sm text-[#4a443c]">
                  <input
                    type="checkbox"
                    checked={editOnSale}
                    onChange={(e) => setEditOnSale(e.target.checked)}
                  />
                  {t("admin.products.onSaleLabel")}
                </label>
                {editOnSale && (
                  <>
                    <div className="flex rounded-[9px] border border-[#e6e0d6] overflow-hidden text-sm">
                      <button
                        type="button"
                        onClick={() => setEditSaleMode("amount")}
                        className={`px-2.5 py-2 ${
                          editSaleMode === "amount" ? "bg-[#1a1714] text-white" : "bg-white text-[#4a443c]"
                        }`}
                      >
                        {t("admin.products.salePriceModeAmount")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSaleMode("percent")}
                        className={`px-2.5 py-2 ${
                          editSaleMode === "percent" ? "bg-[#1a1714] text-white" : "bg-white text-[#4a443c]"
                        }`}
                      >
                        {t("admin.products.salePriceModePercent")}
                      </button>
                    </div>
                    {editSaleMode === "amount" ? (
                      <input
                        type="number"
                        step="0.01"
                        placeholder={t("admin.products.salePricePlaceholder")}
                        value={editSalePrice}
                        onChange={(e) => setEditSalePrice(e.target.value)}
                        className="w-28 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                      />
                    ) : (
                      <input
                        type="number"
                        step="1"
                        placeholder={t("admin.products.salePercentPlaceholder")}
                        value={editSalePercent}
                        onChange={(e) => setEditSalePercent(e.target.value)}
                        className="w-24 border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                      />
                    )}
                  </>
                )}
              </div>
              {editOnSale &&
                editSaleMode === "percent" &&
                (() => {
                  const priceNum = Number(editPrice);
                  const percentNum = Number(editSalePercent);
                  if (
                    !Number.isFinite(priceNum) ||
                    priceNum <= 0 ||
                    !Number.isFinite(percentNum) ||
                    percentNum <= 0 ||
                    percentNum >= 100
                  ) {
                    return null;
                  }
                  const preview = Math.round(priceNum * (1 - percentNum / 100) * 100) / 100;
                  return (
                    <p className="text-xs text-[#8a8177]">
                      {t("admin.products.salePricePreview", { amount: preview.toFixed(2) })}
                    </p>
                  );
                })()}
              {editOnSale && (
                <div>
                  <p className="text-xs text-[#8a8177] mb-1.5">
                    {t("admin.products.saleBannerLabel")}
                  </p>
                  <ImageUploadField
                    value={editSaleBannerImageUrl}
                    onChange={setEditSaleBannerImageUrl}
                    uploadLabel={t("admin.products.uploadImage")}
                    uploadingLabel={t("admin.products.uploading")}
                    hintText={t("admin.products.saleBannerHint")}
                    errorMessages={{
                      notImage: t("admin.products.uploadErrorNotImage"),
                      tooLarge: t("admin.products.uploadErrorTooLarge"),
                      network: t("admin.products.uploadErrorNetwork"),
                      generic: t("admin.products.uploadErrorGeneric"),
                    }}
                  />
                </div>
              )}
              <ProductImagesField
                main={editImageUrl}
                extras={editImages}
                onChange={(main, extras) => {
                  setEditImageUrl(main);
                  setEditImages(extras);
                }}
              />
              <span className="block text-xs font-semibold text-[#6b6259] mb-1">{t("admin.products.colCategory")}</span>
              <CategoryMultiSelect
                categories={categories}
                selectedIds={editCategoryIds}
                onChange={(ids) => {
                  setEditCategoryIds(ids);
                  if (!subcategories.some((s) => s.id === editSubcategoryId && ids.includes(s.categoryId))) {
                    setEditSubcategoryId("");
                  }
                }}
                placeholder={t("admin.products.noCategoryOption")}
              />
              {subcategories.some((s) => editCategoryIds.includes(s.categoryId)) && (
                <select
                  value={editSubcategoryId}
                  onChange={(e) => setEditSubcategoryId(e.target.value)}
                  className="w-full border border-[#e6e0d6] rounded-[9px] px-3 py-2 text-sm bg-white"
                >
                  <option value="">{t("admin.products.noSubcategoryOption")}</option>
                  {subcategories
                    .filter((s) => editCategoryIds.includes(s.categoryId))
                    .map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>
                        {subcategory.name}
                      </option>
                    ))}
                </select>
              )}
              {editError && <p className="text-sm text-[#b3402e]">{editError}</p>}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 h-11 rounded-[10px] border border-[#e6e0d6] text-[#1a1714] text-sm font-semibold"
                >
                  {t("admin.products.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy?.id === editingProduct.id}
                  className="flex-1 h-11 inline-flex items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-70"
                >
                  {busy?.id === editingProduct.id && busy.action === "save" && <Spinner />}
                  {t("admin.products.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
