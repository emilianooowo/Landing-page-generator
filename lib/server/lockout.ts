import { ipHash } from "@/lib/server/crypto";
import { one, query } from "@/lib/server/db";

/**
 * Sign-in lockout (security policy, "Bloqueo"):
 * - users: 5 failures in 15 min lock 15 min, then 30, then 60;
 * - 10 failures in total (since the last success) require a password reset;
 * - staff (analista, administrador): 3 failures lock the account until another
 *   administrator unlocks it;
 * - an IP with more than 10 failures in 5 minutes is blocked for 30 minutes.
 * Records are per email whether or not the account exists.
 */
export const WINDOW_MS = 15 * 60_000;
export const LOCK_STEPS_MS = [15 * 60_000, 30 * 60_000, 60 * 60_000];
export const USER_THRESHOLD = 5;
export const STAFF_THRESHOLD = 3;
export const RESET_THRESHOLD = 10;
export const IP_WINDOW_MS = 5 * 60_000;
export const IP_THRESHOLD = 10;
export const IP_BLOCK_MS = 30 * 60_000;

export type LockState = {
  fallos_ventana: number;
  ventana_inicio: Date | null;
  fallos_totales: number;
  nivel: number;
  bloqueado_hasta: Date | null;
  requiere_restablecer: boolean;
  requiere_admin: boolean;
};

export const emptyLock = (): LockState => ({
  fallos_ventana: 0, ventana_inicio: null, fallos_totales: 0, nivel: 0,
  bloqueado_hasta: null, requiere_restablecer: false, requiere_admin: false,
});

export type LockEvent = "none" | "locked" | "reset_required" | "admin_required";

export function applyFailure(state: LockState, now: number, staff: boolean): { state: LockState; event: LockEvent } {
  const fresh = !state.ventana_inicio || now - state.ventana_inicio.getTime() > WINDOW_MS;
  const next: LockState = {
    ...state,
    fallos_ventana: (fresh ? 0 : state.fallos_ventana) + 1,
    ventana_inicio: fresh ? new Date(now) : state.ventana_inicio,
    fallos_totales: state.fallos_totales + 1,
  };
  if (staff && next.fallos_ventana >= STAFF_THRESHOLD) {
    return { state: { ...next, requiere_admin: true }, event: "admin_required" };
  }
  if (next.fallos_totales >= RESET_THRESHOLD) {
    return { state: { ...next, requiere_restablecer: true }, event: "reset_required" };
  }
  if (next.fallos_ventana >= USER_THRESHOLD) {
    const nivel = state.nivel + 1;
    const duration = LOCK_STEPS_MS[Math.min(nivel, LOCK_STEPS_MS.length) - 1];
    return {
      state: { ...next, nivel, bloqueado_hasta: new Date(now + duration), fallos_ventana: 0, ventana_inicio: null },
      event: "locked",
    };
  }
  return { state: next, event: "none" };
}

export type LockStatus =
  | { locked: false }
  | { locked: true; kind: "temporary"; remainingMs: number }
  | { locked: true; kind: "reset_required" | "admin_required" };

export function lockStatus(state: LockState, now: number): LockStatus {
  if (state.requiere_admin) return { locked: true, kind: "admin_required" };
  if (state.requiere_restablecer) return { locked: true, kind: "reset_required" };
  const until = state.bloqueado_hasta?.getTime() ?? 0;
  return until > now ? { locked: true, kind: "temporary", remainingMs: until - now } : { locked: false };
}

export function lockMessage(status: LockStatus): string {
  if (!status.locked) return "";
  if (status.kind === "admin_required") return "La cuenta está bloqueada por seguridad. Un administrador debe desbloquearla.";
  if (status.kind === "reset_required") return "Por seguridad, restablece tu contraseña con «¿Olvidaste tu contraseña?» para volver a entrar.";
  const minutes = Math.max(1, Math.ceil(("remainingMs" in status ? status.remainingMs : 0) / 60_000));
  return `Demasiados intentos fallidos. Por seguridad, espera ${minutes} ${minutes === 1 ? "minuto" : "minutos"} antes de volver a intentarlo.`;
}

/* ------------------------------------------------------------------ storage */

export async function readLock(email: string): Promise<LockState> {
  return (await one<LockState>(
    `SELECT fallos_ventana, ventana_inicio, fallos_totales, nivel, bloqueado_hasta, requiere_restablecer, requiere_admin
       FROM bloqueos_cuenta WHERE correo = $1`, [email])) ?? emptyLock();
}

export async function writeLock(email: string, state: LockState): Promise<void> {
  await query(
    `INSERT INTO bloqueos_cuenta (correo, fallos_ventana, ventana_inicio, fallos_totales, nivel, bloqueado_hasta, requiere_restablecer, requiere_admin, actualizado_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
     ON CONFLICT (correo) DO UPDATE SET fallos_ventana = $2, ventana_inicio = $3, fallos_totales = $4, nivel = $5,
       bloqueado_hasta = $6, requiere_restablecer = $7, requiere_admin = $8, actualizado_en = now()`,
    [email, state.fallos_ventana, state.ventana_inicio, state.fallos_totales, state.nivel, state.bloqueado_hasta, state.requiere_restablecer, state.requiere_admin],
  );
}

export async function clearLock(email: string): Promise<void> {
  await query("DELETE FROM bloqueos_cuenta WHERE correo = $1", [email]);
}

export async function ipBlockedUntil(ip: string): Promise<Date | null> {
  const row = await one<{ hasta: Date }>("SELECT hasta FROM bloqueos_ip WHERE ip_hash = $1 AND hasta > now()", [ipHash(ip)]);
  return row?.hasta ?? null;
}

/** Records a failed attempt from this IP. Returns true when it just got blocked. */
export async function recordIpFailure(ip: string): Promise<boolean> {
  const hash = ipHash(ip);
  await query("INSERT INTO fallos_ip (ip_hash) VALUES ($1)", [hash]);
  const row = await one<{ total: string }>(
    "SELECT count(*) AS total FROM fallos_ip WHERE ip_hash = $1 AND creado_en > now() - make_interval(secs => $2)",
    [hash, IP_WINDOW_MS / 1000],
  );
  if (Number(row?.total ?? 0) <= IP_THRESHOLD) return false;
  await query(
    `INSERT INTO bloqueos_ip (ip_hash, hasta, motivo) VALUES ($1, now() + make_interval(secs => $2), 'fallos_inicio_sesion')
     ON CONFLICT (ip_hash) DO UPDATE SET hasta = EXCLUDED.hasta, motivo = EXCLUDED.motivo, creado_en = now()`,
    [hash, IP_BLOCK_MS / 1000],
  );
  return true;
}
