import { randomToken, sha256 } from "@/lib/server/crypto";
import { one, query } from "@/lib/server/db";

/**
 * Single-use tokens sent by email. Only the SHA-256 is stored; issuing a new
 * one cancels the previous ones of the same type.
 * - verificación: 24 hours;
 * - restablecer: 30 minutes (security policy, "Caducidad").
 */
export type EmailTokenType = "verificacion" | "restablecer";
export const TOKEN_TTL_MS: Record<EmailTokenType, number> = {
  verificacion: 24 * 60 * 60_000,
  restablecer: 30 * 60_000,
};
/** Minimum time between two emails of the same type to the same account. */
export const RESEND_INTERVAL_MS = 60_000;

export async function issueEmailToken(userId: string, type: EmailTokenType, email: string): Promise<string> {
  const token = randomToken();
  await query("UPDATE tokens_correo SET usado_en = now() WHERE usuario_id = $1 AND tipo = $2 AND usado_en IS NULL", [userId, type]);
  await query(
    `INSERT INTO tokens_correo (usuario_id, tipo, hash_token, correo, expira_en)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [userId, type, sha256(token), email, TOKEN_TTL_MS[type] / 1000],
  );
  return token;
}

/** True when an email of this type went out less than a minute ago. */
export async function recentlySent(userId: string, type: EmailTokenType): Promise<boolean> {
  return Boolean(await one(
    "SELECT 1 FROM tokens_correo WHERE usuario_id = $1 AND tipo = $2 AND creado_en > now() - make_interval(secs => $3)",
    [userId, type, RESEND_INTERVAL_MS / 1000],
  ));
}

/** Marks the token used and returns its owner, or null if unknown, used or expired. */
export async function consumeEmailToken(token: string, type: EmailTokenType): Promise<{ userId: string; email: string } | null> {
  if (!/^[A-Za-z0-9_-]{30,60}$/.test(token)) return null;
  const row = await one<{ usuario_id: string; correo: string }>(
    `UPDATE tokens_correo SET usado_en = now()
      WHERE hash_token = $1 AND tipo = $2 AND usado_en IS NULL AND expira_en > now()
      RETURNING usuario_id, correo`,
    [sha256(token), type],
  );
  return row ? { userId: row.usuario_id, email: row.correo } : null;
}
