import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";
import { ARGON2_PARAMS, needsRehash } from "@/lib/auth/hash";
import { config } from "@/lib/server/config";

/**
 * Server-side Argon2id (OWASP minimum: 19 MiB, 2 iterations, 1 lane) with an
 * optional pepper kept outside the database (PASSWORD_PEPPER). Passwords never
 * reach logs or API responses.
 */
function secret(): Uint8Array | undefined {
  const pepper = config.pepper();
  return pepper ? new TextEncoder().encode(pepper) : undefined;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2id({ password, salt: randomBytes(16), secret: secret(), ...ARGON2_PARAMS, outputType: "encoded" });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("$argon2id$")) return false;
  try {
    return await argon2Verify({ password, hash: stored, secret: secret() });
  } catch {
    return false;
  }
}

export { needsRehash };

let dummy: Promise<string> | null = null;
/** Same work as a real check, so unknown emails answer as slowly as wrong passwords. */
export async function burnVerification(password: string): Promise<void> {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(password, await dummy);
}
