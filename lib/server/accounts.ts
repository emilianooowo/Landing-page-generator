import { assertAcceptablePassword } from "@/lib/auth/checkPassword";
import { query, transaction } from "@/lib/server/db";
import { hashPassword, verifyPassword } from "@/lib/server/passwords";
import type { UserRow } from "@/lib/server/users";

/** The current password plus the 4 before it: the last 5 can't be reused. */
const HISTORY_KEPT = 4;

export class PasswordRejected extends Error {}

/**
 * Validates and stores a new password: policy rules, strength, breaches and
 * history. Moves the old hash into the history and clears the forced-change mark.
 */
export async function setNewPassword(user: UserRow, password: string): Promise<void> {
  try {
    await assertAcceptablePassword(password, { email: user.correo, name: user.nombre, twoFactor: Boolean(user.totp_activado_en) });
  } catch (error) {
    throw new PasswordRejected(error instanceof Error ? error.message : "La contraseña no es válida.");
  }

  const history = await query<{ hash_contrasena: string }>(
    "SELECT hash_contrasena FROM historial_contrasenas WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT $2",
    [user.id, HISTORY_KEPT],
  );
  const previous = [user.hash_contrasena, ...history.map((row) => row.hash_contrasena)];
  for (const hash of previous) {
    if (await verifyPassword(password, hash)) throw new PasswordRejected("No puedes reutilizar ninguna de tus últimas 5 contraseñas.");
  }

  const hash = await hashPassword(password);
  await transaction(async (db) => {
    await db.query("INSERT INTO historial_contrasenas (usuario_id, hash_contrasena) VALUES ($1, $2)", [user.id, user.hash_contrasena]);
    await db.query(
      `DELETE FROM historial_contrasenas WHERE usuario_id = $1 AND id NOT IN (
         SELECT id FROM historial_contrasenas WHERE usuario_id = $1 ORDER BY creado_en DESC, id DESC LIMIT $2)`,
      [user.id, HISTORY_KEPT],
    );
    await db.query(
      "UPDATE usuarios SET hash_contrasena = $2, cambio_obligatorio = FALSE, contrasena_cambiada_en = now() WHERE id = $1",
      [user.id, hash],
    );
  });
}

/**
 * Account deletion requested by its owner: personal data is anonymized at
 * once, projects wait 30 days (recoverable by an administrator) and the
 * retention task removes everything afterwards.
 */
export async function deleteAccount(user: UserRow): Promise<void> {
  await transaction(async (db) => {
    await db.query(
      `UPDATE usuarios SET estado = 'eliminado', eliminado_en = now(), nombre = 'Cuenta eliminada',
         correo = $2, totp_secreto_cifrado = NULL, totp_pendiente_cifrado = NULL WHERE id = $1`,
      [user.id, `${user.id.replace(/[^a-z0-9_-]/g, "")}@eliminado.invalid`],
    );
    await db.query("UPDATE proyectos SET eliminado_en = now() WHERE usuario_id = $1 AND eliminado_en IS NULL", [user.id]);
    await db.query("DELETE FROM historial_contrasenas WHERE usuario_id = $1", [user.id]);
    await db.query("UPDATE sesiones SET revocada_en = now(), motivo_revocacion = 'cuenta_eliminada' WHERE usuario_id = $1 AND revocada_en IS NULL", [user.id]);
  });
}
