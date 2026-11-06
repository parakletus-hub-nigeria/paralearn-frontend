"use client";

/**
 * Turns any image the browser can display (PNG, JPEG, WebP, SVG…) into a small PNG that
 * pdf-lib can embed. Downsizing keeps every booklet small, since the logo is embedded in each.
 */
export async function imageToPngBytes(source: Blob, maxSize = 320): Promise<Uint8Array> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth || maxSize, img.naturalHeight || maxSize));
    const w = Math.max(1, Math.round((img.naturalWidth || maxSize) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxSize) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't convert the logo."))), "image/png")
    );
    return new Uint8Array(await png.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Downloads the school's logo while online; null if it can't be fetched (e.g. no CORS) */
export async function fetchLogo(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await imageToPngBytes(await res.blob());
  } catch {
    return null;
  }
}
