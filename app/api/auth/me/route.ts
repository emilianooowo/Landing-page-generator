import { z } from "zod";
import { deleteAccount } from "@/lib/server/accounts";
import { audit } from "@/lib/server/audit";
import { decrypt } from "@/lib/server/crypto";
import { query } from "@/lib/server/db";
import { issueEmailToken } from "@/lib/server/emailTokens";
import { linkFor, mails, sendMail } from "@/lib/server/mail";
import { verifyPassword } from "@/lib/server/passwords";
import { begin, crash, fail, json } from "@/lib/server/route";
import { clearAuthCookies, requireAuth } from "@/lib/server/session";
import { verifyTotp } from "@/lib/server/totp";
import { findUserByEmail, normalizeEmail, publicUser, type UserRow } from "@/lib/server/users";

export const runtime = "nodejs";

/** Current account. Open to sessions that still must set up 2FA or change the password. */
export async function GET(request: Request) {
  const start = await begin(request, "auth/me", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { allowTwoFactorSetup: true, allowPendingPasswordChange: true });
    if (!auth.ok) return auth.response;
    return json(ctx, { user: publicUser(auth.auth.user, auth.auth.level) });
  } catch (error) {
    return crash(ctx, error);
  }
}

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  email: z.string().trim().max(254).email().optional(),
  /** Required to change the email. */
  currentPassword: z.string().max(128).optional(),
});

/** Name changes apply at once; a new email only after it is confirmed. */
export async function PATCH(request: Request) {
  const start = await begin(request, "auth/me", Patch);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { user } = auth.auth;

    if (body.name && body.name !== user.nombre) {
      await query("UPDATE usuarios SET nombre = $2 WHERE id = $1", [user.id, body.name]);
      await audit({ action: "perfil_actualizado", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId, details: { campo: "nombre" } });
    }

    let pendingEmail: string | null = null;
    const email = body.email ? normalizeEmail(body.email) : null;
    if (email && email !== user.correo) {
      if (!body.currentPassword || !(await verifyPassword(body.currentPassword, user.hash_contrasena))) {
        return fail(ctx, 403, "Para cambiar el correo escribe tu contraseña actual.", "password_required");
      }
      if (await findUserByEmail(email)) return fail(ctx, 409, "Ese correo ya pertenece a otra cuenta.", "email_taken");
      await sendMail(mails.verify(email, linkFor("verificar", await issueEmailToken(user.id, "verificacion", email))));
      await audit({ action: "cambio_correo_solicitado", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId });
      pendingEmail = email;
    }

    const fresh: UserRow = { ...user, nombre: body.name ?? user.nombre };
    return json(ctx, { user: publicUser(fresh), pendingEmail });
  } catch (error) {
    return crash(ctx, error);
  }
}

const Delete = z.object({
  password: z.string().min(1).max(128),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
});

/** Deletes the account at its owner's request (password and, if enabled, the 2FA code). */
export async function DELETE(request: Request) {
  const start = await begin(request, "auth/me", Delete);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx, { allowPendingPasswordChange: true });
    if (!auth.ok) return auth.response;
    const { user } = auth.auth;
    if (!(await verifyPassword(body.password, user.hash_contrasena))) return fail(ctx, 403, "La contraseña no coincide.", "invalid_password");
    if (user.totp_activado_en && user.totp_secreto_cifrado) {
      if (!body.code || verifyTotp(decrypt(user.totp_secreto_cifrado), body.code, null) === null) {
        return fail(ctx, 403, "Escribe un código válido de tu app de autenticación.", "totp_required");
      }
    }
    if (user.rol === "administrador") {
      const others = await query("SELECT 1 FROM usuarios WHERE rol = 'administrador' AND estado = 'activo' AND id <> $1 LIMIT 1", [user.id]);
      if (!others.length) return fail(ctx, 409, "Eres el único administrador: asigna otro antes de eliminar tu cuenta.", "last_admin");
    }
    await deleteAccount(user);
    await audit({ action: "cuenta_eliminada", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId });
    return clearAuthCookies(json(ctx, { status: "deleted" }));
  } catch (error) {
    return crash(ctx, error);
  }
}
