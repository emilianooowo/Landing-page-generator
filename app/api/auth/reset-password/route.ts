import { z } from "zod";
import { PasswordRejected, setNewPassword } from "@/lib/server/accounts";
import { audit } from "@/lib/server/audit";
import { sha256 } from "@/lib/server/crypto";
import { query } from "@/lib/server/db";
import { consumeEmailToken } from "@/lib/server/emailTokens";
import { mails, sendMail } from "@/lib/server/mail";
import { begin, crash, fail, json } from "@/lib/server/route";
import { revokeAllSessions } from "@/lib/server/session";
import { findUserById } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(1).max(100),
  password: z.string().min(1).max(128),
});

/**
 * Sets a new password from the emailed link. It also proves the email,
 * clears a user lock (not a staff lock, which only an administrator lifts)
 * and closes every open session.
 */
export async function POST(request: Request) {
  const start = await begin(request, "auth/reset-password", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    // Validate the password before spending the single-use token.
    const peek = await query<{ usuario_id: string }>(
      "SELECT usuario_id FROM tokens_correo WHERE hash_token = $1 AND tipo = 'restablecer' AND usado_en IS NULL AND expira_en > now()",
      [sha256(body.token)],
    );
    const candidate = peek[0] ? await findUserById(peek[0].usuario_id) : null;
    if (!candidate) return fail(ctx, 400, "El enlace no es válido o ya venció. Pide uno nuevo.", "invalid_token");
    try {
      await setNewPassword(candidate, body.password);
    } catch (error) {
      if (error instanceof PasswordRejected) return fail(ctx, 422, error.message, "weak_password");
      throw error;
    }
    const token = await consumeEmailToken(body.token, "restablecer");
    if (!token) return fail(ctx, 400, "El enlace no es válido o ya venció. Pide uno nuevo.", "invalid_token");

    await query("UPDATE usuarios SET correo_verificado_en = COALESCE(correo_verificado_en, now()) WHERE id = $1", [candidate.id]);
    await query("DELETE FROM bloqueos_cuenta WHERE correo = $1 AND requiere_admin = FALSE", [candidate.correo]);
    const closed = await revokeAllSessions(candidate.id, "restablecimiento");
    await audit({ action: "contrasena_restablecida", actorId: candidate.id, actorRole: candidate.rol, targetType: "usuario", targetId: candidate.id, ip: ctx.ip, requestId: ctx.requestId, details: { sesiones_cerradas: closed } });
    await sendMail(mails.passwordChanged(candidate.correo)).catch(() => undefined);
    return json(ctx, { status: "reset" });
  } catch (error) {
    return crash(ctx, error);
  }
}
