import { query } from "@/lib/server/db";
import { begin, crash, json } from "@/lib/server/route";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

/** Audit trail, read-only, for administrators and analysts. */
export async function GET(request: Request) {
  const start = await begin(request, "admin/audit", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { roles: ["administrador", "analista"] });
    if (!auth.ok) return auth.response;
    const params = new URL(request.url).searchParams;
    const action = params.get("accion")?.trim().slice(0, 60) ?? "";
    const result = params.get("resultado")?.trim() ?? "";
    const before = Number(params.get("antes") ?? 0);
    const rows = await query(
      `SELECT a.id, a.ocurrido_en, a.actor_id, u.correo AS actor_correo, a.actor_rol, a.accion, a.resultado,
              a.objetivo_tipo, a.objetivo_id, a.ip_enmascarada, a.id_solicitud, a.detalles
         FROM bitacora_auditoria a LEFT JOIN usuarios u ON u.id = a.actor_id
        WHERE ($1 = '' OR a.accion LIKE $1 || '%')
          AND ($2 = '' OR a.resultado = $2)
          AND ($3::bigint = 0 OR a.id < $3::bigint)
        ORDER BY a.id DESC LIMIT 100`,
      [action, ["exito", "fallo", "denegado"].includes(result) ? result : "", Number.isFinite(before) ? before : 0],
    );
    return json(ctx, { entries: rows });
  } catch (error) {
    return crash(ctx, error);
  }
}
