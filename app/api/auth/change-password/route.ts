import { z } from "zod";
import { PasswordRejected, setNewPassword } from "@/lib/server/accounts";
import { audit } from "@/lib/server/audit";
import { mails, sendMail } from "@/lib/server/mail";
import { verifyPassword } from "@/lib/server/passwords";
import { begin, crash, fail, json } from "@/lib/server/route";
import { requireAuth, revokeAllSessions } from "@/lib/server/session";
import { findUserById, publicUser } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
});

/** Changes the password and closes every other session. */
export async function POST(request: Request) {
  const start = await begin(request, "auth/change-password", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx, { allowPendingPasswordChange: true });
    if (!auth.ok) return auth.response;
    const { user, sessionId } = auth.auth;

    if (!(await verifyPassword(body.currentPassword, user.hash_contrasena))) {
      await audit({ action: "cambio_contrasena", result: "fallo", actorId: user.id, actorRole: user.rol, ip: ctx.ip, requestId: ctx.requestId, details: { motivo: "actual_incorrecta" } });
      return fail(ctx, 403, "La contraseña actual no coincide.", "invalid_password");
    }
    try {
      await setNewPassword(user, body.newPassword);
    } catch (error) {
      if (error instanceof PasswordRejected) return fail(ctx, 422, error.message, "weak_password");
      throw error;
    }
    const closed = await revokeAllSessions(user.id, "cambio_contrasena", sessionId);
    await audit({ action: "cambio_contrasena", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId, details: { sesiones_cerradas: closed } });
    await sendMail(mails.passwordChanged(user.correo)).catch(() => undefined);
    const fresh = await findUserById(user.id);
    return json(ctx, { user: fresh ? publicUser(fresh, auth.auth.level) : null });
  } catch (error) {
    return crash(ctx, error);
  }
}
