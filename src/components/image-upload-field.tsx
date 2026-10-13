"use client";

import { useRef, useState } from "react";
import { PackageIcon } from "@/components/icons";
import { optimizedImage } from "@/lib/image-url";
import { uploadImage } from "@/lib/upload-image";

type ErrorMessages = {
  notImage: string;
  tooLarge: string;
  network: string;
  generic: string;
};

export function ImageUploadField({
  value,
  onChange,
  uploadLabel,
  uploadingLabel,
  hintText,
  errorMessages,
}: {
  value: string;
  onChange: (url: string) => void;
  uploadLabel: string;
  uploadingLabel: string;
  hintText: string;
  errorMessages: ErrorMessages;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorText, setErrorText] = useState<string | null>(null);

  function errorMessageForCode(code: string | undefined): string {
    switch (code) {
      case "not_image":
        return errorMessages.notImage;
      case "too_large":
        return errorMessages.tooLarge;
      case "network":
        return errorMessages.network;
      default:
        return errorMessages.generic;
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    setErrorText(null);
    setProgress(0);
    setUploading(true);

    const result = await uploadImage(picked, setProgress);
    setUploading(false);
    if ("error" in result) setErrorText(errorMessageForCode(result.error));
    else onChange(result.url);
  }

  return (
    <div className="flex items-center gap-3">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={optimizedImage(value, "THUMB")}
          alt=""
          className="w-14 h-14 object-cover rounded-[10px] border border-[#eae5dc] shrink-0"
        />
      ) : (
        <div
          className="w-14 h-14 shrink-0 rounded-[10px] border border-dashed border-[#ddd6cb] flex items-center justify-center text-[#c5bdb1]"
          aria-hidden
        >
          <PackageIcon className="w-6 h-6" />
        </div>
      )}
      <div className="flex flex-col gap-1 min-w-0">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[13px] font-semibold border border-[#ddd6cb] bg-white rounded-[9px] px-3.5 py-[7px] disabled:opacity-50 self-start"
        >
          {uploading ? `${uploadingLabel} ${progress}%` : uploadLabel}
        </button>
        {!uploading && !errorText && <p className="text-[11px] text-[#a39a8e]">{hintText}</p>}
        {uploading && (
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="w-32 h-1.5 bg-[#f2efe9] rounded-full overflow-hidden"
          >
            <div
              className="h-full bg-[var(--accent)] transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {errorText && <p className="text-xs text-[#b3402e]">{errorText}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
