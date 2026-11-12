"use client";

import type { UploadedPhoto } from "@/lib/schemas/primitives";

/** Longest side after resizing: sharp on large screens, light to load. */
const MAX_SIDE = 1600;

/**
 * Resize and re-encode a photo in the browser before uploading it.
 * Re-encoding through a canvas also drops the file's metadata (camera,
 * GPS location…), which shouldn't end up on a public page.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No pudimos leer esa imagen. Usa una foto JPG, PNG o WebP.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Tu navegador no pudo procesar la imagen.");
  }

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  context.drawImage(bitmap, 0, 0, width, height);
  const webp = await encode("image/webp", 0.82);
  if (webp?.type === "image/webp") {
    bitmap.close();
    return webp;
  }

  // Browsers without WebP encoding: JPEG has no transparency, so paint white first.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const jpeg = await encode("image/jpeg", 0.85);
  if (!jpeg) throw new Error("Tu navegador no pudo procesar la imagen.");
  return jpeg;
}

export async function uploadPhoto(file: File, alt: string): Promise<UploadedPhoto> {
  const blob = await shrinkPhoto(file);
  const body = new FormData();
  body.append("file", blob, blob.type === "image/webp" ? "foto.webp" : "foto.jpg");

  let response: Response;
  try {
    response = await fetch("/api/uploads", { method: "POST", body });
  } catch {
    throw new Error("No se pudo subir la imagen. Revisa tu conexión.");
  }
  const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !data.url) throw new Error(data.error ?? "No se pudo subir la imagen.");
  return { url: data.url, alt: alt.slice(0, 120) };
}
