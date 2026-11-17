/**
 * Tarea diaria de retención (política de protección de datos, "Eliminación").
 * Se ejecuta con el usuario dueño del esquema (DATABASE_MIGRATION_URL), por
 * ejemplo desde cron:  15 3 * * *  cd /app && npm run retention
 *
 * - Proyectos eliminados por su dueño: borrado definitivo a los 30 días.
 * - Cuentas eliminadas: borrado definitivo (con sus imágenes) a los 30 días.
 * - Cuentas inactivas: aviso a los 12 meses y eliminación 30 días después.
 * - Cuentas que nunca confirmaron su correo: se borran a los 7 días.
 * - Bitácora de auditoría: 12 meses.
 * - Sesiones, tokens, contadores de fallos y cuotas: se limpian al vencer.
 * Los registros de la aplicación (stdout) se conservan 90 días en el
 * recolector de registros (ver manual de despliegue).
 */
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { loadEnv } from "./env.mjs";

loadEnv();
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

async function sendMail(to, subject, text) {
  if (process.env.SMTP_URL) {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport(process.env.SMTP_URL);
    await transport.sendMail({ from: process.env.MAIL_FROM || "Landing IA <no-responder@landing-ia.local>", to, subject, text });
    return;
  }
  const dir = path.join(dataDir, "outbox");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-retencion.eml`), `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
}

async function removeImageFiles(rows) {
  for (const row of rows) {
    await unlink(path.join(dataDir, "uploads", `${row.id.trim()}.${row.extension}`)).catch(() => undefined);
  }
}

const client = new pg.Client({ connectionString: process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL, options: "-c search_path=landing_ia" });
await client.connect();
const counts = {};
const run = async (name, sql, values = []) => {
  const result = await client.query(sql, values);
  counts[name] = result.rowCount ?? 0;
  return result.rows;
};

try {
  // Housekeeping of security tables.
  await run("sesiones", "DELETE FROM sesiones WHERE COALESCE(revocada_en, expira_en) < now() - interval '30 days'");
  await run("tokens", "DELETE FROM tokens_correo WHERE COALESCE(usado_en, expira_en) < now() - interval '7 days'");
  await run("fallos_ip", "DELETE FROM fallos_ip WHERE creado_en < now() - interval '1 day'");
  await run("bloqueos_ip", "DELETE FROM bloqueos_ip WHERE hasta < now()");
  await run("uso_generaciones", "DELETE FROM uso_generaciones WHERE creado_en < now() - interval '2 days'");
  await run("bloqueos_cuenta", `DELETE FROM bloqueos_cuenta WHERE NOT requiere_admin AND NOT requiere_restablecer
    AND (bloqueado_hasta IS NULL OR bloqueado_hasta < now()) AND actualizado_en < now() - interval '30 days'`);

  // Projects deleted by their owner more than 30 days ago.
  await run("proyectos", "DELETE FROM proyectos WHERE eliminado_en < now() - interval '30 days'");

  // Accounts that never confirmed their email.
  await run("sin_verificar", "DELETE FROM usuarios WHERE correo_verificado_en IS NULL AND creado_en < now() - interval '7 days' AND estado = 'activo'");

  // Inactive accounts: warning at 12 months.
  const warn = await run("avisos_inactividad", `UPDATE usuarios SET aviso_inactividad_en = now()
    WHERE estado = 'activo' AND aviso_inactividad_en IS NULL AND rol = 'usuario'
      AND COALESCE(ultimo_acceso_en, creado_en) < now() - interval '12 months'
    RETURNING correo`);
  for (const { correo } of warn) {
    await sendMail(correo, "Tu cuenta de Landing IA se eliminará por inactividad",
      `Hola:\n\nNo has usado tu cuenta en 12 meses. Si no inicias sesión en los próximos 30 días, la eliminaremos junto con tus proyectos.\n\nInicia sesión aquí: ${appUrl}/login\n\n— Landing IA`);
  }
  // …and deletion 30 days after the warning (anonymized now, purged 30 days later).
  await run("inactivas_eliminadas", `UPDATE usuarios SET estado = 'eliminado', eliminado_en = now(), nombre = 'Cuenta eliminada',
      correo = id || '@eliminado.invalid', totp_secreto_cifrado = NULL, totp_pendiente_cifrado = NULL
    WHERE estado = 'activo' AND aviso_inactividad_en < now() - interval '30 days'
      AND COALESCE(ultimo_acceso_en, creado_en) < aviso_inactividad_en`);
  await client.query("UPDATE proyectos SET eliminado_en = now() FROM usuarios u WHERE u.id = proyectos.usuario_id AND u.estado = 'eliminado' AND proyectos.eliminado_en IS NULL");

  // Accounts deleted more than 30 days ago: images (files too) and the account itself.
  const images = await run("imagenes", `DELETE FROM imagenes WHERE usuario_id IN (
      SELECT id FROM usuarios WHERE estado = 'eliminado' AND eliminado_en < now() - interval '30 days') RETURNING id, extension`);
  await removeImageFiles(images);
  await run("cuentas", "DELETE FROM usuarios WHERE estado = 'eliminado' AND eliminado_en < now() - interval '30 days'");

  // Audit trail: 12 months. The trigger only allows this inside this transaction.
  await client.query("BEGIN");
  await client.query("SET LOCAL landing_ia.purga_retencion = 'si'");
  await run("bitacora", "DELETE FROM bitacora_auditoria WHERE ocurrido_en < now() - interval '12 months'");
  await client.query("COMMIT");

  await client.query(
    "INSERT INTO bitacora_auditoria (actor_rol, accion, detalles) VALUES ('sistema', 'retencion_ejecutada', $1)",
    [JSON.stringify(counts)],
  );
  console.log(JSON.stringify({ ts: new Date().toISOString(), event: "retencion_ejecutada", ...counts }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", event: "retencion_fallida", message: error instanceof Error ? error.message : String(error) }));
  process.exitCode = 1;
} finally {
  await client.end();
}
