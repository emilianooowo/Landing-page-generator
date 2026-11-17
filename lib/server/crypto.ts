import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "@/lib/server/config";

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** 256-bit random token, URL safe. Only its SHA-256 is stored. */
export const randomToken = () => randomBytes(32).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function derived(purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", config.dataKey(), "landing-ia", purpose, 32));
}

/** Keyed hash of an IP: lets us count failures per address without storing it. */
export function ipHash(ip: string): string {
  return createHmac("sha256", derived("ip")).update(ip).digest("hex");
}

/** AES-256-GCM. Output: v1.<iv>.<tag>.<ciphertext>, all base64url. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", derived("cifrado"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decrypt(sealed: string): string {
  const [version, iv, tag, data] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Formato de dato cifrado desconocido.");
  const decipher = createDecipheriv("aes-256-gcm", derived("cifrado"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
