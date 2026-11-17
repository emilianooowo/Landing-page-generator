import { audit } from "@/lib/server/audit";
import { one, query, transaction } from "@/lib/server/db";
import { mails, sendMail } from "@/lib/server/mail";
import { revokeAllSessions } from "@/lib/server/session";
import { findUserById, type UserRow } from "@/lib/server/users";

/**
 * Sanctions (security policy, "Sanciones"): warning, 7-day suspension,
 * permanent suspension. Every one is recorded with its reason and author,
 * mailed to the account holder and written to the audit trail.
 */
export type SanctionType = "advertencia" | "suspension_temporal" | "suspension_definitiva";
export const TEMPORARY_SUSPENSION_DAYS = 7;
/** Abuse rejections are counted over this window for the automatic escalation. */
const ABUSE_WINDOW_DAYS = 30;

type Context = { ip?: string; requestId?: string };

export async function applySanction(args: {
  user: UserRow;
  type: SanctionType;
  reason: string;
  days?: number;
  by: { id: string; role: string } | null;
  ctx?: Context;
}): Promise<void> {
  const { user, type, reason, by } = args;
  const days = type === "suspension_temporal" ? args.days ?? TEMPORARY_SUSPENSION_DAYS : null;
  await transaction(async (db) => {
    await db.query(
      `INSERT INTO sanciones (usuario_id, tipo, motivo, hasta, aplicada_por)
       VALUES ($1, $2, $3, CASE WHEN $4::int IS NULL THEN NULL ELSE now() + make_interval(days => $4::int) END, $5)`,
      [user.id, type, reason, days, by?.id ?? null],
    );
    if (type !== "advertencia") {
      await db.query(
        `UPDATE usuarios SET estado = 'suspendido',
           suspendido_hasta = CASE WHEN $2::int IS NULL THEN NULL ELSE now() + make_interval(days => $2::int) END
         WHERE id = $1`,
        [user.id, days],
      );
    }
  });
  if (type !== "advertencia") await revokeAllSessions(user.id, "suspendida");

  await audit({
    action: `sancion_${type}`, actorId: by?.id ?? null, actorRole: by?.role ?? "sistema",
    targetType: "usuario", targetId: user.id, ip: args.ctx?.ip, requestId: args.ctx?.requestId,
    details: { motivo: reason, dias: days },
  });

  const detail = type === "advertencia"
    ? `Registramos una advertencia en tu cuenta: ${reason}. Si se repite, la cuenta se suspenderá ${TEMPORARY_SUSPENSION_DAYS} días.`
    : type === "suspension_temporal"
      ? `Suspendimos tu cuenta durante ${days} días: ${reason}.`
      : `Suspendimos tu cuenta de forma definitiva: ${reason}.`;
  await sendMail(mails.sanction(user.correo, detail)).catch(() => undefined);
}

export async function liftSanctions(user: UserRow, by: { id: string; role: string }, ctx?: Context): Promise<void> {
  await query("UPDATE sanciones SET levantada_en = now(), levantada_por = $2 WHERE usuario_id = $1 AND levantada_en IS NULL AND tipo <> 'advertencia'", [user.id, by.id]);
  await query("UPDATE usuarios SET estado = 'activo', suspendido_hasta = NULL WHERE id = $1 AND estado = 'suspendido'", [user.id]);
  await audit({ action: "sancion_levantada", actorId: by.id, actorRole: by.role, targetType: "usuario", targetId: user.id, ip: ctx?.ip, requestId: ctx?.requestId });
}

/**
 * Automatic escalation for prompts rejected as abuse (the policy's example):
 * first time a recorded warning, the next one within 30 days a 7-day
 * suspension. Permanent suspension stays a human decision.
 */
export async function escalateAbuse(userId: string, category: string, ctx: Context): Promise<"advertencia" | "suspension_temporal" | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const recent = await one<{ total: string }>(
    `SELECT count(*) AS total FROM sanciones
      WHERE usuario_id = $1 AND motivo LIKE 'Solicitud rechazada por moderación%'
        AND creada_en > now() - make_interval(days => $2)`,
    [userId, ABUSE_WINDOW_DAYS],
  );
  const type = Number(recent?.total ?? 0) === 0 ? "advertencia" : "suspension_temporal";
  await applySanction({ user, type, reason: `Solicitud rechazada por moderación (${category})`, by: null, ctx });
  return type;
}
