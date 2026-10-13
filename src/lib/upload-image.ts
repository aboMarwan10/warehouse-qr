// Client-side: shrinks a picked photo and uploads it to /api/upload (ImageKit),
// reporting progress. Shared by the single-image field and the product
// photos field.
import { shrinkImage } from "@/lib/shrink-image";

export type UploadResult = { url: string } | { error: string };

export async function uploadImage(picked: File, onProgress?: (percent: number) => void): Promise<UploadResult> {
  // Phone photos are shrunk to 1600px before upload (see shrink-image.ts).
  const file = await shrinkImage(picked);
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.min(95, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onload = () => {
      let data: { url?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // generic error below
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        onProgress?.(100);
        resolve({ url: data.url });
      } else {
        resolve({ error: data.error ?? "generic" });
      }
    };
    xhr.onerror = () => resolve({ error: "network" });
    xhr.send(formData);
  });
}
