import { query } from "@/lib/server/db";
import { begin, crash, json } from "@/lib/server/route";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

/** Account list for administrators (security policy, "Matriz de permisos"). */
export async function GET(request: Request) {
  const start = await begin(request, "admin/users", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { roles: ["administrador"] });
    if (!auth.ok) return auth.response;
    const search = new URL(request.url).searchParams.get("q")?.trim().toLowerCase().slice(0, 100) ?? "";
    const users = await query(
      `SELECT u.id, u.nombre, u.correo, u.rol, u.estado, u.suspendido_hasta, u.correo_verificado_en IS NOT NULL AS verificado,
              u.totp_activado_en IS NOT NULL AS dos_pasos, u.cambio_obligatorio, u.creado_en, u.ultimo_acceso_en,
              (b.requiere_admin OR b.requiere_restablecer OR b.bloqueado_hasta > now()) IS TRUE AS bloqueado,
              (SELECT count(*) FROM sesiones s WHERE s.usuario_id = u.id AND s.revocada_en IS NULL AND s.expira_en > now())::int AS sesiones,
              (SELECT count(*) FROM proyectos p WHERE p.usuario_id = u.id AND p.eliminado_en IS NULL)::int AS proyectos
         FROM usuarios u LEFT JOIN bloqueos_cuenta b ON b.correo = u.correo
        WHERE u.estado <> 'eliminado' AND ($1 = '' OR u.correo LIKE '%' || $1 || '%' OR lower(u.nombre) LIKE '%' || $1 || '%')
        ORDER BY u.creado_en DESC LIMIT 200`,
      [search],
    );
    return json(ctx, { users });
  } catch (error) {
    return crash(ctx, error);
  }
}
