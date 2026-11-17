import { one } from "@/lib/server/db";
import { begin, crash, json } from "@/lib/server/route";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

/**
 * Security indicators for the daily review (security policy, "Analista"):
 * the same thresholds the incident policy uses for alerts.
 */
export async function GET(request: Request) {
  const start = await begin(request, "admin/metrics", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { roles: ["administrador", "analista"] });
    if (!auth.ok) return auth.response;
    const metrics = await one(
      `SELECT
         (SELECT count(*) FROM usuarios WHERE estado = 'activo')::int AS cuentas_activas,
         (SELECT count(*) FROM usuarios WHERE estado = 'suspendido')::int AS cuentas_suspendidas,
         (SELECT count(*) FROM usuarios WHERE rol <> 'usuario' AND totp_activado_en IS NULL AND estado = 'activo')::int AS personal_sin_dos_pasos,
         (SELECT count(*) FROM sesiones WHERE revocada_en IS NULL AND expira_en > now())::int AS sesiones_activas,
         (SELECT count(*) FROM bitacora_auditoria WHERE accion = 'inicio_sesion' AND resultado = 'fallo' AND ocurrido_en > now() - interval '24 hours')::int AS inicios_fallidos_24h,
         (SELECT count(*) FROM bitacora_auditoria WHERE accion = 'inicio_sesion' AND resultado = 'fallo' AND ocurrido_en > now() - interval '5 minutes')::int AS inicios_fallidos_5min,
         (SELECT count(*) FROM bitacora_auditoria WHERE accion = 'cuenta_bloqueada' AND ocurrido_en > now() - interval '10 minutes')::int AS bloqueos_10min,
         (SELECT count(*) FROM bloqueos_cuenta WHERE requiere_admin OR requiere_restablecer OR bloqueado_hasta > now())::int AS cuentas_bloqueadas,
         (SELECT count(*) FROM bloqueos_ip WHERE hasta > now())::int AS ips_bloqueadas,
         (SELECT count(*) FROM bitacora_auditoria WHERE accion = 'prompt_rechazado' AND ocurrido_en > now() - interval '24 hours')::int AS prompts_rechazados_24h,
         (SELECT count(*) FROM bitacora_auditoria WHERE resultado = 'denegado' AND accion LIKE 'acceso_denegado%' AND ocurrido_en > now() - interval '24 hours')::int AS accesos_denegados_24h,
         (SELECT count(*) FROM bitacora_auditoria WHERE accion = 'reuso_token_renovacion' AND ocurrido_en > now() - interval '7 days')::int AS reuso_tokens_7d,
         (SELECT count(*) FROM proyectos WHERE eliminado_en IS NULL)::int AS proyectos`,
    );
    const alerts: string[] = [];
    if (metrics) {
      if (metrics.inicios_fallidos_5min > 10) alerts.push("Más de 10 inicios de sesión fallidos en los últimos 5 minutos.");
      if (metrics.bloqueos_10min >= 5) alerts.push("5 o más cuentas bloqueadas en los últimos 10 minutos.");
      if (metrics.reuso_tokens_7d > 0) alerts.push("Se detectó reutilización de un token de renovación (posible robo de sesión).");
      if (metrics.personal_sin_dos_pasos > 0) alerts.push("Hay personal sin verificación en dos pasos.");
    }
    return json(ctx, { metrics, alerts });
  } catch (error) {
    return crash(ctx, error);
  }
}
