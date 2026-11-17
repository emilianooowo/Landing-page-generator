import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { one, query } from "@/lib/server/db";
import { signAccessToken, ACCESS_TTL_SECONDS } from "@/lib/server/jwt";
import { verifyPassword } from "@/lib/server/passwords";
import { begin, crash, fail, json } from "@/lib/server/route";
import { requireAuth } from "@/lib/server/session";
import { newTotpSecret, otpauthUri, verifyTotp } from "@/lib/server/totp";
import { findUserById, isStaff, publicUser } from "@/lib/server/users";
import { isProduction } from "@/lib/server/config";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordRules";

export const runtime = "nodejs";

/**
 * Two-factor authentication with an authenticator app (TOTP).
 * Mandatory for staff (analista, administrador), optional for users; with it
 * the minimum password length drops from 15 to 12 characters.
 *
 * POST: starts the setup (new secret, QR). PUT: confirms it with a code.
 * DELETE: turns it off (users only, with password and code).
 */
export async function POST(request: Request) {
  const start = await begin(request, "auth/totp", null);
  if (!start.ok) return start.response;
  const { ctx } = start;
  try {
    const auth = await requireAuth(request, ctx, { allowTwoFactorSetup: true });
    if (!auth.ok) return auth.response;
    const { user } = auth.auth;
    if (user.totp_activado_en) return fail(ctx, 409, "La verificación en dos pasos ya está activa.", "already_enabled");

    const secret = newTotpSecret();
    await query("UPDATE usuarios SET totp_pendiente_cifrado = $2 WHERE id = $1", [user.id, encrypt(secret)]);
    const uri = otpauthUri(secret, user.correo);
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220, errorCorrectionLevel: "M" });
    return json(ctx, { secret, uri, qr });
  } catch (error) {
    return crash(ctx, error);
  }
}

const Enable = z.object({ code: z.string().trim().regex(/^\d{6}$/) });

export async function PUT(request: Request) {
  const start = await begin(request, "auth/totp", Enable);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx, { allowTwoFactorSetup: true });
    if (!auth.ok) return auth.response;
    const { user, sessionId } = auth.auth;
    const row = await one<{ totp_pendiente_cifrado: string | null }>("SELECT totp_pendiente_cifrado FROM usuarios WHERE id = $1", [user.id]);
    if (!row?.totp_pendiente_cifrado) return fail(ctx, 400, "Primero genera el código QR.", "no_pending_setup");

    const step = verifyTotp(decrypt(row.totp_pendiente_cifrado), body.code, null);
    if (step === null) return fail(ctx, 400, "El código no es correcto. Revisa que la hora de tu teléfono sea la correcta.", "totp_invalid");

    await query(
      `UPDATE usuarios SET totp_secreto_cifrado = totp_pendiente_cifrado, totp_pendiente_cifrado = NULL,
         totp_activado_en = now(), totp_ultimo_paso = $2 WHERE id = $1`,
      [user.id, step],
    );
    await query("UPDATE sesiones SET nivel = 'completo' WHERE id = $1", [sessionId]);
    await audit({ action: "dos_pasos_activado", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId });

    const fresh = await findUserById(user.id);
    const response: NextResponse = json(ctx, { user: fresh ? publicUser(fresh) : null });
    // The session is now complete: issue an access token that says so.
    const access = await signAccessToken({ sub: user.id, sid: sessionId, rol: user.rol, lvl: "completo" });
    response.cookies.set(isProduction() ? "__Host-lia_at" : "lia_at", access, {
      httpOnly: true, secure: isProduction(), sameSite: "strict", path: "/", maxAge: ACCESS_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return crash(ctx, error);
  }
}

const Disable = z.object({ password: z.string().min(1).max(128), code: z.string().trim().regex(/^\d{6}$/) });

export async function DELETE(request: Request) {
  const start = await begin(request, "auth/totp", Disable);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const auth = await requireAuth(request, ctx);
    if (!auth.ok) return auth.response;
    const { user } = auth.auth;
    if (isStaff(user.rol)) return fail(ctx, 403, "El personal debe mantener activa la verificación en dos pasos.", "required_for_staff");
    if (!user.totp_secreto_cifrado) return fail(ctx, 409, "La verificación en dos pasos no está activa.", "not_enabled");
    if (!(await verifyPassword(body.password, user.hash_contrasena))) return fail(ctx, 403, "La contraseña no coincide.", "invalid_password");
    if (verifyTotp(decrypt(user.totp_secreto_cifrado), body.code, null) === null) return fail(ctx, 403, "El código no es correcto.", "totp_invalid");

    // Without two-factor the minimum is 15 characters: a shorter password has to be changed.
    const tooShort = [...body.password].length < PASSWORD_MIN_LENGTH;
    await query(
      `UPDATE usuarios SET totp_secreto_cifrado = NULL, totp_pendiente_cifrado = NULL, totp_activado_en = NULL, totp_ultimo_paso = NULL,
         cambio_obligatorio = cambio_obligatorio OR $2 WHERE id = $1`,
      [user.id, tooShort],
    );
    await audit({ action: "dos_pasos_desactivado", actorId: user.id, actorRole: user.rol, targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId });
    const fresh = await findUserById(user.id);
    return json(ctx, { user: fresh ? publicUser(fresh) : null });
  } catch (error) {
    return crash(ctx, error);
  }
}
