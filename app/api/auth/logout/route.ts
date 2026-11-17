import { audit } from "@/lib/server/audit";
import { begin, crash, json } from "@/lib/server/route";
import { clearAuthCookies, getAuth, revokeSession, sessionIdFromRefresh } from "@/lib/server/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const start = await begin(request, "auth/logout", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await getAuth(request);
    const sessionId = auth.status === "ok" ? auth.auth.sessionId : await sessionIdFromRefresh(request);
    if (sessionId) await revokeSession(sessionId, "cierre_sesion");
    if (auth.status === "ok") {
      await audit({ action: "cierre_sesion", actorId: auth.auth.user.id, actorRole: auth.auth.user.rol, ip: ctx.ip, requestId: ctx.requestId });
    }
    return clearAuthCookies(json(ctx, { status: "signed_out" }));
  } catch (error) {
    return crash(ctx, error);
  }
}
