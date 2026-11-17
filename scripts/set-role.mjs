/**
 * Asigna un rol a una cuenta existente y verificada desde la terminal del
 * servidor. Así se crea el primer administrador; después los roles se
 * gestionan desde el panel. Cierra las sesiones de la cuenta y deja
 * constancia en la bitácora.
 *
 * Uso: npm run user:role -- correo@dominio.com administrador|analista|usuario
 */
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const [email, role] = process.argv.slice(2);
if (!email || !["usuario", "analista", "administrador"].includes(role)) {
  console.error("Uso: npm run user:role -- correo@dominio.com administrador|analista|usuario");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL, options: "-c search_path=landing_ia" });
await client.connect();
try {
  const { rows } = await client.query(
    "SELECT id, rol, correo_verificado_en FROM usuarios WHERE correo = $1 AND estado <> 'eliminado'",
    [email.trim().toLowerCase()],
  );
  const user = rows[0];
  if (!user) throw new Error("No existe una cuenta con ese correo.");
  if (!user.correo_verificado_en) throw new Error("La cuenta aún no confirma su correo.");
  await client.query("UPDATE usuarios SET rol = $2 WHERE id = $1", [user.id, role]);
  await client.query("UPDATE sesiones SET revocada_en = now(), motivo_revocacion = 'cambio_rol' WHERE usuario_id = $1 AND revocada_en IS NULL", [user.id]);
  await client.query(
    `INSERT INTO bitacora_auditoria (actor_rol, accion, objetivo_tipo, objetivo_id, detalles)
     VALUES ('sistema', 'rol_cambiado', 'usuario', $1, $2)`,
    [user.id, JSON.stringify({ de: user.rol, a: role, via: "terminal" })],
  );
  console.log(`Rol de ${email}: ${user.rol} → ${role}.${role === "usuario" ? "" : " Al iniciar sesión deberá activar la verificación en dos pasos."}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
