import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Photo storage on the server's disk: <DATA_DIR>/uploads/<id>.<ext>.
 *
 * DATA_DIR defaults to ./data and is meant to be a persistent volume when
 * deployed (it will also hold published landings). Server-only module.
 */

/** Photos arrive already resized by the browser; this is a generous cap. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type ImageExt = keyof typeof CONTENT_TYPES;

const FILE_NAME = /^up_[a-f0-9]{24}\.(jpg|png|webp)$/;

export function uploadsDir(): string {
  return path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "uploads");
}

/**
 * Identify the format from the file's first bytes, never from its name or the
 * declared MIME type, both of which the client controls.
 */
export function sniffImage(bytes: Uint8Array): ImageExt | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) return "webp";
  return null;
}

export class UploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "UploadError";
  }
}

export async function saveUpload(bytes: Uint8Array): Promise<{ url: string }> {
  if (bytes.length === 0) throw new UploadError("La imagen está vacía.", 400);
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("La imagen pesa demasiado. El máximo es 4 MB.", 413);
  const ext = sniffImage(bytes);
  if (!ext) throw new UploadError("Solo se aceptan imágenes JPG, PNG o WebP.", 415);

  const name = `up_${randomBytes(12).toString("hex")}.${ext}`;
  const dir = uploadsDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes, { flag: "wx" });
  return { url: `/api/uploads/${name}` };
}

export async function readUpload(name: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const match = FILE_NAME.exec(name);
  if (!match) return null;
  try {
    const bytes = await readFile(path.join(uploadsDir(), name));
    return { bytes: new Uint8Array(bytes), contentType: CONTENT_TYPES[match[1] as ImageExt] };
  } catch {
    return null;
  }
}
