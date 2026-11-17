import { audit } from "@/lib/server/audit";
import { belongsToAnother, deleteProject, getProject, ProjectInput, saveProject } from "@/lib/server/projects";
import { begin, crash, fail, json } from "@/lib/server/route";
import { requireAuth, type Auth } from "@/lib/server/session";
import type { GuardContext } from "@/lib/security/guard";

export const runtime = "nodejs";

const MAX_BYTES = 256 * 1024;
const NOT_FOUND = "No encontramos este proyecto en tu cuenta.";

/**
 * Someone else's project answers exactly like a missing one (404), and the
 * attempt goes to the audit trail: that is how an IDOR probe shows up.
 */
async function notFound(ctx: GuardContext, auth: Auth, id: string, operation: string) {
  if (await belongsToAnother(auth.user.id, id)) {
    await audit({ action: "acceso_denegado_proyecto", result: "denegado", actorId: auth.user.id, actorRole: auth.user.rol, targetType: "proyecto", targetId: id, ip: ctx.ip, requestId: ctx.requestId, details: { operacion: operation } });
  }
  return fail(ctx, 404, NOT_FOUND, "not_found");
}

export async function GET(request: Request, context: RouteContext<"/api/projects/[id]">) {
  const start = await begin(request, "projects/id", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    const project = await getProject(auth.auth.user.id, id);
    return project ? json(ctx, { project }) : notFound(ctx, auth.auth, id, "leer");
  } catch (error) {
    return crash(ctx, error);
  }
}

export async function PUT(request: Request, context: RouteContext<"/api/projects/[id]">) {
  const start = await begin(request, "projects/id", ProjectInput, MAX_BYTES);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (body.id !== id) return fail(ctx, 400, "La solicitud no es válida.");
    if (!(await getProject(auth.auth.user.id, id))) return notFound(ctx, auth.auth, id, "modificar");
    if (!(await saveProject(auth.auth.user.id, body))) return notFound(ctx, auth.auth, id, "modificar");
    return json(ctx, { status: "saved" });
  } catch (error) {
    return crash(ctx, error);
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/projects/[id]">) {
  const start = await begin(request, "projects/id", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (!(await deleteProject(auth.auth.user.id, id))) return notFound(ctx, auth.auth, id, "eliminar");
    await audit({ action: "proyecto_eliminado", actorId: auth.auth.user.id, actorRole: auth.auth.user.rol, targetType: "proyecto", targetId: id, ip: ctx.ip, requestId: ctx.requestId });
    return json(ctx, { status: "deleted" });
  } catch (error) {
    return crash(ctx, error);
  }
}
