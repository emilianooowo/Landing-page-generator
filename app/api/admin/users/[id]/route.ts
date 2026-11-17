import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { query } from "@/lib/server/db";
import { begin, crash, fail, json } from "@/lib/server/route";
import { applySanction, liftSanctions } from "@/lib/server/sanctions";
import { requireAuth, revokeAllSessions } from "@/lib/server/session";
import { findUserById } from "@/lib/server/users";

export const runtime = "nodejs";

/** Detail of one account: sanctions, recent activity and recoverable projects. */
export async function GET(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  const start = await begin(request, "admin/users/id", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { roles: ["administrador"] });
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const user = await findUserById(id);
    if (!user) return fail(ctx, 404, "No existe esa cuenta.");
    const [sanctions, activity, deleted, lock] = await Promise.all([
      query("SELECT id, tipo, motivo, hasta, aplicada_por, creada_en, levantada_en FROM sanciones WHERE usuario_id = $1 ORDER BY creada_en DESC LIMIT 50", [id]),
      query("SELECT ocurrido_en, accion, resultado, ip_enmascarada, detalles FROM bitacora_auditoria WHERE actor_id = $1 OR objetivo_id = $1 ORDER BY ocurrido_en DESC LIMIT 50", [id]),
      query("SELECT id, nombre, eliminado_en FROM proyectos WHERE usuario_id = $1 AND eliminado_en > now() - interval '30 days' ORDER BY eliminado_en DESC", [id]),
      query("SELECT fallos_totales, bloqueado_hasta, requiere_restablecer, requiere_admin FROM bloqueos_cuenta WHERE correo = $1", [user.correo]),
    ]);
    await audit({ action: "admin_consulta_cuenta", actorId: auth.auth.user.id, actorRole: auth.auth.user.rol, targetType: "usuario", targetId: id, ip: ctx.ip, requestId: ctx.requestId });
    return json(ctx, {
      user: { id: user.id, nombre: user.nombre, correo: user.correo, rol: user.rol, estado: user.estado, suspendido_hasta: user.suspendido_hasta, dos_pasos: Boolean(user.totp_activado_en), creado_en: user.creado_en, ultimo_acceso_en: user.ultimo_acceso_en },
      lock: lock[0] ?? null,
      sanctions,
      activity,
      deletedProjects: deleted,
    });
  } catch (error) {
    return crash(ctx, error);
  }
}

const reason = z.string().trim().min(5).max(500);
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rol"), rol: z.enum(["usuario", "analista", "administrador"]), motivo: reason }),
  z.object({ action: z.literal("advertencia"), motivo: reason }),
  z.object({ action: z.literal("suspender"), dias: z.number().int().min(1).max(365), motivo: reason }),
  z.object({ action: z.literal("suspender_definitivo"), motivo: reason }),
  z.object({ action: z.literal("levantar_sancion") }),
  z.object({ action: z.literal("desbloquear") }),
  z.object({ action: z.literal("revocar_sesiones") }),
  z.object({ action: z.literal("forzar_cambio_contrasena") }),
  z.object({ action: z.literal("restaurar_proyecto"), proyectoId: z.string().regex(/^p_[a-z0-9]{4,36}$/) }),
]);

/**
 * Administrative actions. Each one is audited with its author and reason.
 * An administrator can't act on their own account (role, sanctions, locks):
 * that needs another administrator (security policy, "Administrador").
 */
export async function POST(request: Request, context: RouteContext<"/api/admin/users/[id]">) {
  const start = await begin(request, "admin/users/id", Action);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx, { roles: ["administrador"] });
    if (!auth.ok) return auth.response;
    const admin = { id: auth.auth.user.id, role: auth.auth.user.rol };
    const { id } = await context.params;
    if (id === admin.id) return fail(ctx, 403, "Otro administrador debe hacer los cambios sobre tu propia cuenta.", "self_action");
    const target = await findUserById(id);
    if (!target) return fail(ctx, 404, "No existe esa cuenta.");
    const base = { actorId: admin.id, actorRole: admin.role, targetType: "usuario", targetId: id, ip: ctx.ip, requestId: ctx.requestId };

    switch (body.action) {
      case "rol": {
        if (target.rol === "administrador" && body.rol !== "administrador") {
          const others = await query("SELECT 1 FROM usuarios WHERE rol = 'administrador' AND estado = 'activo' AND id <> $1 LIMIT 1", [id]);
          if (!others.length) return fail(ctx, 409, "Debe quedar al menos un administrador.");
        }
        await query("UPDATE usuarios SET rol = $2 WHERE id = $1", [id, body.rol]);
        await revokeAllSessions(id, "cambio_rol");
        await audit({ ...base, action: "rol_cambiado", details: { de: target.rol, a: body.rol, motivo: body.motivo } });
        break;
      }
      case "advertencia":
        await applySanction({ user: target, type: "advertencia", reason: body.motivo, by: admin, ctx });
        break;
      case "suspender":
        await applySanction({ user: target, type: "suspension_temporal", reason: body.motivo, days: body.dias, by: admin, ctx });
        break;
      case "suspender_definitivo":
        await applySanction({ user: target, type: "suspension_definitiva", reason: body.motivo, by: admin, ctx });
        break;
      case "levantar_sancion":
        await liftSanctions(target, admin, ctx);
        break;
      case "desbloquear":
        await query("DELETE FROM bloqueos_cuenta WHERE correo = $1", [target.correo]);
        await audit({ ...base, action: "cuenta_desbloqueada" });
        break;
      case "revocar_sesiones": {
        const closed = await revokeAllSessions(id, "revocada_por_admin");
        await audit({ ...base, action: "sesiones_revocadas", details: { sesiones: closed } });
        break;
      }
      case "forzar_cambio_contrasena":
        await query("UPDATE usuarios SET cambio_obligatorio = TRUE WHERE id = $1", [id]);
        await revokeAllSessions(id, "cambio_obligatorio");
        await audit({ ...base, action: "cambio_contrasena_forzado" });
        break;
      case "restaurar_proyecto": {
        const restored = await query(
          "UPDATE proyectos SET eliminado_en = NULL WHERE id = $1 AND usuario_id = $2 AND eliminado_en > now() - interval '30 days' RETURNING id",
          [body.proyectoId, id],
        );
        if (!restored.length) return fail(ctx, 404, "Ese proyecto ya no se puede recuperar.");
        await audit({ ...base, action: "proyecto_restaurado", targetType: "proyecto", targetId: body.proyectoId, details: { usuario: id } });
        break;
      }
    }
    return json(ctx, { status: "done" });
  } catch (error) {
    return crash(ctx, error);
  }
}
