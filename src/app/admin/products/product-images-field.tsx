"use client";

import { useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { optimizedImage } from "@/lib/image-url";
import { uploadImage } from "@/lib/upload-image";

// Plenty for a product; keeps the details window quick to swipe through.
export const MAX_PRODUCT_IMAGES = 8;

// A product's photos in the add form and the edit window: the main photo
// (marked, shown on the shop card) first, then the secondary ones. "★" makes a
// secondary photo the main one (the old main takes its place); ✕ removes a
// photo (removing the main promotes the next one). Several photos can be
// picked at once; the first upload of a product with no photo becomes main.
export function ProductImagesField({
  main,
  extras,
  onChange,
}: {
  main: string;
  extras: string[];
  onChange: (main: string, extras: string[]) => void;
}) {
  const { t } = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number; progress: number } | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const all = main ? [main, ...extras] : extras;
  const room = MAX_PRODUCT_IMAGES - all.length;

  function errorFor(code: string): string {
    if (code === "not_image") return t("admin.products.uploadErrorNotImage");
    if (code === "too_large") return t("admin.products.uploadErrorTooLarge");
    if (code === "network") return t("admin.products.uploadErrorNetwork");
    return t("admin.products.uploadErrorGeneric");
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).slice(0, Math.max(0, room));
    e.target.value = "";
    if (picked.length === 0) return;
    setErrorText(null);
    let current = all;
    for (let i = 0; i < picked.length; i++) {
      setUploading({ done: i, total: picked.length, progress: 0 });
      const result = await uploadImage(picked[i], (progress) =>
        setUploading({ done: i, total: picked.length, progress })
      );
      if ("error" in result) {
        setErrorText(errorFor(result.error));
        continue;
      }
      current = [...current, result.url];
      onChange(current[0], current.slice(1));
    }
    setUploading(null);
  }

  function makeMain(url: string) {
    // Swap: the chosen photo becomes main, the old main takes its spot.
    onChange(
      url,
      extras.map((u) => (u === url ? main : u))
    );
  }

  function remove(url: string) {
    const next = all.filter((u) => u !== url);
    onChange(next[0] ?? "", next.slice(1));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {all.map((url, index) => (
          <div key={url} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImage(url, "THUMB")}
              alt=""
              className={`w-[72px] h-[72px] object-contain bg-white rounded-[10px] border ${
                index === 0 ? "border-2 border-[var(--accent)]" : "border-[#eae5dc]"
              }`}
            />
            {index === 0 ? (
              <span className="absolute bottom-1 inset-x-1 text-center text-[10px] font-bold rounded-full bg-[var(--accent)] text-white py-0.5">
                {t("admin.products.mainImage")}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => makeMain(url)}
                className="absolute bottom-1 inset-x-1 text-[10px] font-bold rounded-full bg-white/95 border border-[#e6e0d6] text-[#4a443c] py-0.5"
              >
                ★ {t("admin.products.makeMain")}
              </button>
            )}
            <button
              type="button"
              onClick={() => remove(url)}
              aria-label={t("admin.products.removeImage")}
              className="absolute -top-1.5 -end-1.5 w-5 h-5 rounded-full bg-[#1a1714] text-white text-xs leading-none flex items-center justify-center"
            >
              ×
            </button>
          </div>
        ))}
        {room > 0 && (
          <button
            type="button"
            disabled={!!uploading}
            onClick={() => inputRef.current?.click()}
            className="w-[72px] h-[72px] rounded-[10px] border border-dashed border-[#d9d2c7] text-[#6b6259] text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 disabled:opacity-60"
          >
            {uploading ? (
              <span className="tabular-nums">
                {uploading.total > 1 ? `${uploading.done + 1}/${uploading.total} · ` : ""}
                {uploading.progress}%
              </span>
            ) : (
              <>
                <span className="text-xl leading-none">+</span>
                {t("admin.products.addImages")}
              </>
            )}
          </button>
        )}
      </div>
      <p className="text-[11px] text-[#a39a8e]">
        {all.length > 1 ? t("admin.products.imagesHintMain") : t("admin.products.imagesHint", { max: MAX_PRODUCT_IMAGES })}
      </p>
      {errorText && <p className="text-xs text-[#b3402e]">{errorText}</p>}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFiles}
        className="hidden"
      />
    </div>
  );
}
