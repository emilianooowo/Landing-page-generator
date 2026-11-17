import { one, query, type Db } from "@/lib/server/db";
import type { Role } from "@/lib/server/jwt";

export type UserRow = {
  id: string;
  nombre: string;
  correo: string;
  hash_contrasena: string;
  rol: Role;
  estado: "activo" | "suspendido" | "eliminado";
  suspendido_hasta: Date | null;
  correo_verificado_en: Date | null;
  cambio_obligatorio: boolean;
  totp_secreto_cifrado: string | null;
  totp_activado_en: Date | null;
  totp_ultimo_paso: string | null;
  creado_en: Date;
  ultimo_acceso_en: Date | null;
};

const COLUMNS = `id, nombre, correo, hash_contrasena, rol, estado, suspendido_hasta, correo_verificado_en, cambio_obligatorio,
  totp_secreto_cifrado, totp_activado_en, totp_ultimo_paso, creado_en, ultimo_acceso_en`;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isStaff = (role: Role) => role !== "usuario";

export async function findUserByEmail(email: string, db?: Db): Promise<UserRow | null> {
  const sql = `SELECT ${COLUMNS} FROM usuarios WHERE correo = $1 AND estado <> 'eliminado'`;
  return db ? (await db.query<UserRow>(sql, [normalizeEmail(email)])).rows[0] ?? null : one<UserRow>(sql, [normalizeEmail(email)]);
}

export async function findUserById(id: string, db?: Db): Promise<UserRow | null> {
  const sql = `SELECT ${COLUMNS} FROM usuarios WHERE id = $1 AND estado <> 'eliminado'`;
  return db ? (await db.query<UserRow>(sql, [id])).rows[0] ?? null : one<UserRow>(sql, [id]);
}

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
  twoFactor: boolean;
  /** Staff without two-factor: the session can only set it up. */
  mustSetupTwoFactor: boolean;
};

export function publicUser(row: UserRow, level: "completo" | "configurar_2fa" = "completo"): PublicUser {
  return {
    id: row.id,
    name: row.nombre,
    email: row.correo,
    role: row.rol,
    mustChangePassword: row.cambio_obligatorio,
    twoFactor: Boolean(row.totp_activado_en),
    mustSetupTwoFactor: level === "configurar_2fa",
  };
}

/**
 * Suspension state. A temporary suspension that already ended is lifted here,
 * so the account works again without manual action.
 */
export async function suspension(row: UserRow): Promise<{ suspended: false } | { suspended: true; until: Date | null }> {
  if (row.estado !== "suspendido") return { suspended: false };
  if (row.suspendido_hasta && row.suspendido_hasta.getTime() <= Date.now()) {
    await query("UPDATE usuarios SET estado = 'activo', suspendido_hasta = NULL WHERE id = $1 AND estado = 'suspendido'", [row.id]);
    return { suspended: false };
  }
  return { suspended: true, until: row.suspendido_hasta };
}

export function suspensionMessage(until: Date | null): string {
  return until
    ? `Tu cuenta está suspendida hasta el ${until.toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short", timeZone: "America/Mexico_City" })} por infringir los términos de uso.`
    : "Tu cuenta está suspendida de forma definitiva por infringir los términos de uso.";
}
