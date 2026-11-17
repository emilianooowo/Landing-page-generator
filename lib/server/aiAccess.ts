import { NextResponse } from "next/server";
import { moderate, type GuardContext } from "@/lib/security/guard";
import { securityLog } from "@/lib/security/log";
import { audit } from "@/lib/server/audit";
import { quotaKey, takeGeneration } from "@/lib/server/quota";
import { escalateAbuse } from "@/lib/server/sanctions";
import type { UserRow } from "@/lib/server/users";

/**
 * AI-route checks that need the database: the daily quota (per account, or per
 * IP for guests) and, for signed-in people, the sanction escalation when a
 * prompt is rejected as abuse.
 */
export async function chargeGeneration(ctx: GuardContext, user: UserRow | null): Promise<NextResponse | null> {
  if (await takeGeneration(quotaKey(user?.id ?? null, ctx.ip))) return null;
  securityLog("warn", "generation_quota_exceeded", { requestId: ctx.requestId, ip: ctx.ip, route: ctx.route, account: Boolean(user) });
  return NextResponse.json(
    { error: "Alcanzaste el límite de páginas nuevas por hoy. Puedes seguir editando las que ya tienes." },
    { status: 429, headers: { "x-request-id": ctx.requestId, "retry-after": "3600" } },
  );
}

export async function moderateFor(ctx: GuardContext, texts: string[], user: UserRow | null) {
  const outcome = moderate(ctx, texts);
  if (outcome.ok) return outcome;

  await audit({
    action: "prompt_rechazado", result: "denegado", actorId: user?.id ?? null, actorRole: user?.rol ?? null,
    ip: ctx.ip, requestId: ctx.requestId, details: { categoria: outcome.category, ip_bloqueada: outcome.blocked },
  });
  if (!user || !outcome.strike) return outcome;

  const sanction = await escalateAbuse(user.id, outcome.category, ctx);
  if (sanction !== "suspension_temporal") return outcome;
  return {
    ...outcome,
    response: NextResponse.json(
      { error: "Por solicitudes repetidas que infringen los términos de uso, tu cuenta quedó suspendida 7 días. Te enviamos los detalles por correo.", code: "account_suspended" },
      { status: 403, headers: { "x-request-id": ctx.requestId } },
    ),
  };
}
