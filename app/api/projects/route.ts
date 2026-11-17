import { audit } from "@/lib/server/audit";
import { belongsToAnother, listProjects, ProjectInput, saveProject } from "@/lib/server/projects";
import { begin, crash, fail, json } from "@/lib/server/route";
import { requireAuth } from "@/lib/server/session";

export const runtime = "nodejs";

const MAX_BYTES = 256 * 1024;

export async function GET(request: Request) {
  const start = await begin(request, "projects", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    return json(ctx, { projects: await listProjects(auth.auth.user.id) });
  } catch (error) {
    return crash(ctx, error);
  }
}

/** Creates a project, or imports one made before signing in. */
export async function POST(request: Request) {
  const start = await begin(request, "projects", ProjectInput, MAX_BYTES);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { user } = auth.auth;
    if (!(await saveProject(user.id, body))) {
      if (await belongsToAnother(user.id, body.id)) {
        await audit({ action: "acceso_denegado_proyecto", result: "denegado", actorId: user.id, actorRole: user.rol, targetType: "proyecto", targetId: body.id, ip: ctx.ip, requestId: ctx.requestId, details: { operacion: "crear" } });
      }
      return fail(ctx, 409, "No se pudo guardar el proyecto. Recarga la página e inténtalo de nuevo.", "conflict");
    }
    await audit({ action: "proyecto_creado", actorId: user.id, actorRole: user.rol, targetType: "proyecto", targetId: body.id, ip: ctx.ip, requestId: ctx.requestId });
    return json(ctx, { status: "saved" }, 201);
  } catch (error) {
    return crash(ctx, error);
  }
}
