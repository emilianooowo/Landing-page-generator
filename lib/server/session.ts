import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { maskIp } from "@/lib/security/log";
import type { GuardContext } from "@/lib/security/guard";
import { audit } from "@/lib/server/audit";
import { config, isProduction } from "@/lib/server/config";
import { randomToken, sha256 } from "@/lib/server/crypto";
import { one, query, type Db } from "@/lib/server/db";
import { ACCESS_TTL_SECONDS, signAccessToken, verifyAccessToken, type Role, type SessionLevel } from "@/lib/server/jwt";
import { findUserById, isStaff, suspension, type UserRow } from "@/lib/server/users";

/**
 * Sessions (security policy, "Reglas de acceso" and "Restricción"):
 * - access token: JWT, 15 minutes, HttpOnly cookie;
 * - refresh token: random, 7 days, rotated on every use, only its hash stored,
 *   HttpOnly cookie scoped to /api/auth;
 * - inactivity: 30 minutes for users, 15 for staff;
 * - every request re-checks the session row and the account state.
 */
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60_000;
export const idleLimitMs = (role: Role) => (isStaff(role) ? 15 : 30) * 60_000;
/** A refresh token rotated this recently is a parallel tab, not a theft. */
const ROTATION_GRACE_MS = 20_000;
const ACTIVITY_WRITE_MS = 60_000;

const accessCookie = () => (isProduction() ? "__Host-lia_at" : "lia_at");
const refreshCookie = () => (isProduction() ? "__Secure-lia_rt" : "lia_rt");

function cookieBase() {
  return { httpOnly: true, secure: isProduction(), sameSite: "strict" as const };
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

type Tokens = { access: string; refresh: string };

export function setAuthCookies<T extends NextResponse>(response: T, tokens: Tokens): T {
  response.cookies.set(accessCookie(), tokens.access, { ...cookieBase(), path: "/", maxAge: ACCESS_TTL_SECONDS });
  response.cookies.set(refreshCookie(), tokens.refresh, { ...cookieBase(), path: "/api/auth", maxAge: REFRESH_TTL_MS / 1000 });
  return response;
}

export function clearAuthCookies<T extends NextResponse>(response: T): T {
  response.cookies.set(accessCookie(), "", { ...cookieBase(), path: "/", maxAge: 0 });
  response.cookies.set(refreshCookie(), "", { ...cookieBase(), path: "/api/auth", maxAge: 0 });
  return response;
}

export function sessionLevelFor(user: UserRow): SessionLevel {
  return isStaff(user.rol) && !user.totp_activado_en ? "configurar_2fa" : "completo";
}

export async function createSession(
  user: UserRow,
  ctx: GuardContext,
  request: Request,
  options: { db?: Db; familyId?: string; level?: SessionLevel } = {},
): Promise<Tokens & { sessionId: string }> {
  const sessionId = randomUUID();
  const refresh = randomToken();
  const level = options.level ?? sessionLevelFor(user);
  const sql = `INSERT INTO sesiones (id, familia_id, usuario_id, hash_renovacion, nivel, expira_en, ip_enmascarada, agente)
               VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6), $7, $8)`;
  const values = [sessionId, options.familyId ?? randomUUID(), user.id, sha256(refresh), level, REFRESH_TTL_MS / 1000, maskIp(ctx.ip), (request.headers.get("user-agent") ?? "").slice(0, 200)];
  if (options.db) await options.db.query(sql, values);
  else await query(sql, values);
  const access = await signAccessToken({ sub: user.id, sid: sessionId, rol: user.rol, lvl: level });
  return { access, refresh, sessionId };
}

export async function revokeSession(id: string, reason: string): Promise<void> {
  await query("UPDATE sesiones SET revocada_en = now(), motivo_revocacion = $2 WHERE id = $1 AND revocada_en IS NULL", [id, reason]);
}

export async function revokeAllSessions(userId: string, reason: string, exceptId?: string): Promise<number> {
  const rows = await query(
    `UPDATE sesiones SET revocada_en = now(), motivo_revocacion = $2
      WHERE usuario_id = $1 AND revocada_en IS NULL AND ($3::uuid IS NULL OR id <> $3::uuid) RETURNING id`,
    [userId, reason, exceptId ?? null],
  );
  return rows.length;
}

type SessionRow = {
  id: string;
  familia_id: string;
  usuario_id: string;
  nivel: SessionLevel;
  expira_en: Date;
  ultima_actividad_en: Date;
  revocada_en: Date | null;
  motivo_revocacion: string | null;
};

export type Auth = { user: UserRow; sessionId: string; level: SessionLevel };
export type AuthResult = { status: "ok"; auth: Auth } | { status: "none" | "expired" | "invalid" | "revoked" };

/** Reads and fully checks the session. Never throws for a bad token. */
export async function getAuth(request: Request): Promise<AuthResult> {
  const token = readCookie(request, accessCookie());
  if (!token) return { status: "none" };
  const verified = await verifyAccessToken(token);
  if (!verified.ok) return { status: verified.reason };

  const session = await one<SessionRow>("SELECT * FROM sesiones WHERE id = $1", [verified.claims.sid]);
  if (!session || session.revocada_en || session.usuario_id !== verified.claims.sub || session.expira_en.getTime() <= Date.now()) {
    return { status: "revoked" };
  }
  const user = await findUserById(session.usuario_id);
  if (!user || (await suspension(user)).suspended) {
    await revokeSession(session.id, user ? "suspendida" : "cuenta_eliminada");
    return { status: "revoked" };
  }
  // The role in the token must still be the current one.
  if (user.rol !== verified.claims.rol) return { status: "revoked" };
  const idle = Date.now() - session.ultima_actividad_en.getTime();
  if (idle > idleLimitMs(user.rol)) {
    await revokeSession(session.id, "inactividad");
    return { status: "revoked" };
  }
  if (idle > ACTIVITY_WRITE_MS) {
    await query("UPDATE sesiones SET ultima_actividad_en = now() WHERE id = $1", [session.id]);
  }
  return { status: "ok", auth: { user, sessionId: session.id, level: session.nivel } };
}

/** For routes open to guests: the signed-in user if there is one, else null. */
export async function optionalUser(request: Request): Promise<UserRow | null> {
  const result = await getAuth(request);
  return result.status === "ok" && result.auth.level === "completo" ? result.auth.user : null;
}

export type RequireOptions = {
  roles?: Role[];
  /** Allows sessions that still have to set up two-factor (only the 2FA routes and "me"). */
  allowTwoFactorSetup?: boolean;
  /** Allows accounts that must change their password (only the change route and "me"). */
  allowPendingPasswordChange?: boolean;
};

function deny(ctx: GuardContext, status: number, error: string, code: string): NextResponse {
  return NextResponse.json({ error, code }, { status, headers: { "x-request-id": ctx.requestId } });
}

/** Deny by default: authenticated, active, in a full session and with an allowed role. */
export async function requireAuth(
  request: Request,
  ctx: GuardContext,
  options: RequireOptions = {},
): Promise<{ ok: true; auth: Auth } | { ok: false; response: NextResponse }> {
  const result = await getAuth(request);
  if (result.status !== "ok") {
    const expired = result.status === "expired";
    return {
      ok: false,
      response: deny(ctx, 401, expired ? "Tu sesión se está renovando." : "Inicia sesión para continuar.", expired ? "token_expired" : "unauthenticated"),
    };
  }
  const { auth } = result;
  if (auth.level === "configurar_2fa" && !options.allowTwoFactorSetup) {
    return { ok: false, response: deny(ctx, 403, "Activa la verificación en dos pasos para continuar.", "two_factor_setup_required") };
  }
  if (auth.user.cambio_obligatorio && !options.allowPendingPasswordChange) {
    return { ok: false, response: deny(ctx, 403, "Cambia tu contraseña para continuar.", "password_change_required") };
  }
  if (options.roles && !options.roles.includes(auth.user.rol)) {
    await audit({ action: "acceso_denegado", result: "denegado", actorId: auth.user.id, actorRole: auth.user.rol, ip: ctx.ip, requestId: ctx.requestId, details: { route: ctx.route } });
    return { ok: false, response: deny(ctx, 403, "No tienes permiso para esta acción.", "forbidden") };
  }
  if (options.roles && options.roles.every(isStaff)) {
    const allowed = config.adminIps();
    if (allowed.length && !allowed.includes(ctx.ip)) {
      await audit({ action: "acceso_denegado_ip", result: "denegado", actorId: auth.user.id, actorRole: auth.user.rol, ip: ctx.ip, requestId: ctx.requestId, details: { route: ctx.route } });
      return { ok: false, response: deny(ctx, 403, "El panel solo está disponible desde la red autorizada.", "forbidden_ip") };
    }
  }
  return { ok: true, auth };
}

export type RefreshResult =
  | { status: "ok"; user: UserRow; tokens: Tokens; level: SessionLevel }
  | { status: "race" }
  | { status: "denied"; reason: string };

/** Rotates the refresh token. Presenting an already-rotated token revokes the whole family. */
export async function rotateRefresh(request: Request, ctx: GuardContext): Promise<RefreshResult> {
  const token = readCookie(request, refreshCookie());
  if (!token) return { status: "denied", reason: "sin_token" };
  const session = await one<SessionRow>("SELECT * FROM sesiones WHERE hash_renovacion = $1", [sha256(token)]);
  if (!session) return { status: "denied", reason: "desconocido" };

  if (session.revocada_en) {
    if (session.motivo_revocacion === "rotada" && Date.now() - session.revocada_en.getTime() < ROTATION_GRACE_MS) {
      return { status: "race" };
    }
    if (session.motivo_revocacion === "rotada") {
      await query(
        "UPDATE sesiones SET revocada_en = now(), motivo_revocacion = 'reuso_detectado' WHERE familia_id = $1 AND revocada_en IS NULL",
        [session.familia_id],
      );
      await audit({ action: "reuso_token_renovacion", result: "denegado", actorId: session.usuario_id, targetType: "sesion", targetId: session.familia_id, ip: ctx.ip, requestId: ctx.requestId });
    }
    return { status: "denied", reason: "revocada" };
  }
  const user = await findUserById(session.usuario_id);
  if (!user || session.expira_en.getTime() <= Date.now()) {
    await revokeSession(session.id, "expirada");
    return { status: "denied", reason: "expirada" };
  }
  if ((await suspension(user)).suspended) {
    await revokeSession(session.id, "suspendida");
    return { status: "denied", reason: "suspendida" };
  }
  if (Date.now() - session.ultima_actividad_en.getTime() > idleLimitMs(user.rol)) {
    await revokeSession(session.id, "inactividad");
    return { status: "denied", reason: "inactividad" };
  }

  // Rotate: the old row is marked "rotada" and a new row continues the family.
  const updated = await query(
    "UPDATE sesiones SET revocada_en = now(), motivo_revocacion = 'rotada' WHERE id = $1 AND revocada_en IS NULL RETURNING id",
    [session.id],
  );
  if (!updated.length) return { status: "race" };
  const level = sessionLevelFor(user);
  const created = await createSession(user, ctx, request, { familyId: session.familia_id, level });
  return { status: "ok", user, tokens: created, level };
}

export async function sessionIdFromRefresh(request: Request): Promise<string | null> {
  const token = readCookie(request, refreshCookie());
  if (!token) return null;
  return (await one<{ id: string }>("SELECT id FROM sesiones WHERE hash_renovacion = $1", [sha256(token)]))?.id ?? null;
}
