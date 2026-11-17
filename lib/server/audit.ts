import { maskIp, securityLog } from "@/lib/security/log";
import { query } from "@/lib/server/db";

/**
 * Audit trail (security policy, "Aplicación"): who did what, when, from where.
 * Written to the append-only table and mirrored to the structured log, which
 * is what alerting reads. Never include passwords, tokens or prompt text.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AuditEntry = {
  action: string;
  result?: "exito" | "fallo" | "denegado";
  actorId?: string | null;
  actorRole?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string;
  requestId?: string;
  details?: Record<string, unknown>;
};

export async function audit(entry: AuditEntry): Promise<void> {
  const result = entry.result ?? "exito";
  securityLog(result === "exito" ? "info" : "warn", `audit.${entry.action}`, {
    requestId: entry.requestId, ip: entry.ip, actor: entry.actorId ?? null, result,
    target: entry.targetId ?? null, ...entry.details,
  });
  try {
    await query(
      `INSERT INTO bitacora_auditoria (actor_id, actor_rol, accion, resultado, objetivo_tipo, objetivo_id, ip_enmascarada, id_solicitud, detalles)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [entry.actorId ?? null, entry.actorRole ?? null, entry.action, result, entry.targetType ?? null, entry.targetId ?? null,
        entry.ip ? maskIp(entry.ip) : null, UUID.test(entry.requestId ?? "") ? entry.requestId : null, JSON.stringify(entry.details ?? {})],
    );
  } catch (error) {
    // The request must not fail because of the audit write, but it must be visible.
    securityLog("error", "audit_write_failed", { action: entry.action, message: error instanceof Error ? error.message : "unknown" });
  }
}
