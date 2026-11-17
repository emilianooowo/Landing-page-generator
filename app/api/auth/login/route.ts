import { z } from "zod";
import { pwnedCount } from "@/lib/auth/pwned";
import { audit } from "@/lib/server/audit";
import { decrypt } from "@/lib/server/crypto";
import { query } from "@/lib/server/db";
import { issueEmailToken } from "@/lib/server/emailTokens";
import { linkFor, mails, sendMail } from "@/lib/server/mail";
import { applyFailure, clearLock, ipBlockedUntil, lockMessage, lockStatus, readLock, recordIpFailure, writeLock } from "@/lib/server/lockout";
import { burnVerification, hashPassword, needsRehash, verifyPassword } from "@/lib/server/passwords";
import { begin, crash, fail, json } from "@/lib/server/route";
import { createSession, setAuthCookies } from "@/lib/server/session";
import { verifyTotp } from "@/lib/server/totp";
import { findUserByEmail, isStaff, normalizeEmail, publicUser, suspension, suspensionMessage, type UserRow } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(128),
  code: z.string().trim().regex(/^\d{6}$/).optional(),
});

const GENERIC = "El correo o la contraseña no coinciden.";

export async function POST(request: Request) {
  const start = await begin(request, "auth/login", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  const email = normalizeEmail(body.email);

  try {
    if (await ipBlockedUntil(ctx.ip)) {
      return fail(ctx, 429, "Demasiados intentos fallidos desde tu red. Inténtalo de nuevo en 30 minutos.", "ip_blocked");
    }
    const lock = await readLock(email);
    const status = lockStatus(lock, Date.now());
    if (status.locked) return fail(ctx, 423, lockMessage(status), "locked");

    const user = await findUserByEmail(email);
    const passwordOk = user ? await verifyPassword(body.password, user.hash_contrasena) : (await burnVerification(body.password), false);

    // Two-factor: the code is asked for only after the password is right.
    let totpStep: number | null = null;
    if (user && passwordOk && user.totp_activado_en && user.totp_secreto_cifrado) {
      if (!body.code) return fail(ctx, 401, "Escribe el código de 6 dígitos de tu app de autenticación.", "totp_required");
      totpStep = verifyTotp(decrypt(user.totp_secreto_cifrado), body.code, user.totp_ultimo_paso === null ? null : Number(user.totp_ultimo_paso));
    }
    const ok = Boolean(user && passwordOk && (!user.totp_activado_en || totpStep !== null));

    if (!ok || !user) return await failure(email, user, lock, ctx, Boolean(user && passwordOk));

    if (!user.correo_verificado_en) {
      return fail(ctx, 403, "Confirma tu correo para entrar. Revisa tu bandeja o pide un enlace nuevo.", "email_unverified");
    }
    const suspended = await suspension(user);
    if (suspended.suspended) {
      await audit({ action: "inicio_sesion", result: "denegado", actorId: user.id, actorRole: user.rol, ip: ctx.ip, requestId: ctx.requestId, details: { motivo: "suspendida" } });
      return fail(ctx, 403, suspensionMessage(suspended.until), "account_suspended");
    }

    await clearLock(email);
    const patch: string[] = ["ultimo_acceso_en = now()", "aviso_inactividad_en = NULL"];
    const values: unknown[] = [user.id];
    if (needsRehash(user.hash_contrasena)) {
      values.push(await hashPassword(body.password));
      patch.push(`hash_contrasena = $${values.length}`);
    }
    if (totpStep !== null) {
      values.push(totpStep);
      patch.push(`totp_ultimo_paso = $${values.length}`);
    }
    // A password that shows up in a breach must be changed before going on.
    const breached = !user.cambio_obligatorio && Boolean(await pwnedCount(body.password));
    if (breached) patch.push("cambio_obligatorio = TRUE");
    await query(`UPDATE usuarios SET ${patch.join(", ")} WHERE id = $1`, values);

    const fresh: UserRow = { ...user, cambio_obligatorio: user.cambio_obligatorio || breached };
    const session = await createSession(fresh, ctx, request);
    await audit({
      action: "inicio_sesion", actorId: user.id, actorRole: user.rol, ip: ctx.ip, requestId: ctx.requestId,
      details: { dos_pasos: totpStep !== null, contrasena_filtrada: breached },
    });
    const level = isStaff(user.rol) && !user.totp_activado_en ? "configurar_2fa" : "completo";
    return setAuthCookies(json(ctx, { user: publicUser(fresh, level) }), session);
  } catch (error) {
    return crash(ctx, error);
  }
}

async function failure(
  email: string,
  user: UserRow | null,
  lock: Awaited<ReturnType<typeof readLock>>,
  ctx: { ip: string; requestId: string },
  passwordWasRight: boolean,
) {
  const staff = Boolean(user && isStaff(user.rol));
  const { state, event } = applyFailure(lock, Date.now(), staff);
  await writeLock(email, state);
  const ipBlocked = await recordIpFailure(ctx.ip);

  await audit({
    action: "inicio_sesion", result: "fallo", actorId: user?.id ?? null, actorRole: user?.rol ?? null, ip: ctx.ip, requestId: ctx.requestId,
    details: { motivo: passwordWasRight ? "codigo_2fa" : "credenciales", bloqueo: event, ip_bloqueada: ipBlocked },
  });
  if (ipBlocked) await audit({ action: "ip_bloqueada", result: "denegado", ip: ctx.ip, requestId: ctx.requestId, details: { motivo: "fallos_inicio_sesion", minutos: 30 } });

  if (event !== "none" && user) {
    const detail = event === "locked"
      ? "Bloqueamos el acceso por unos minutos."
      : event === "reset_required"
        ? "Para volver a entrar tendrás que restablecer tu contraseña."
        : "Un administrador debe desbloquear la cuenta.";
    const link = linkFor("restablecer", await issueEmailToken(user.id, "restablecer", user.correo));
    await sendMail(mails.locked(user.correo, detail, link)).catch(() => undefined);
    await audit({ action: "cuenta_bloqueada", result: "denegado", targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId, details: { tipo: event } });
  }

  const status = lockStatus(state, Date.now());
  const response = json(
    { requestId: ctx.requestId, ip: ctx.ip, route: "auth/login" },
    { error: status.locked ? lockMessage(status) : passwordWasRight ? "El código no es correcto o ya se usó." : GENERIC, code: status.locked ? "locked" : passwordWasRight ? "totp_invalid" : "invalid_credentials" },
    status.locked ? 423 : 401,
  );
  return response;
}
