import { begin, crash, fail, json } from "@/lib/server/route";
import { clearAuthCookies, rotateRefresh, setAuthCookies } from "@/lib/server/session";
import { publicUser } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * Exchanges the refresh token (rotated on every call) for a new pair. The
 * client calls it when the access token expires and while the person is
 * active, which also keeps the inactivity clock honest.
 */
export async function POST(request: Request) {
  const start = await begin(request, "auth/refresh", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const result = await rotateRefresh(request, ctx);
    if (result.status === "race") return fail(ctx, 409, "Otra pestaña acaba de renovar la sesión.", "refresh_race");
    if (result.status === "denied") {
      const message = result.reason === "inactividad"
        ? "Tu sesión se cerró por inactividad."
        : result.reason === "suspendida" ? "Tu cuenta está suspendida." : "Tu sesión terminó. Inicia sesión de nuevo.";
      return clearAuthCookies(fail(ctx, 401, message, result.reason === "inactividad" ? "session_idle" : "session_ended"));
    }
    return setAuthCookies(json(ctx, { user: publicUser(result.user, result.level) }), result.tokens);
  } catch (error) {
    return crash(ctx, error);
  }
}
