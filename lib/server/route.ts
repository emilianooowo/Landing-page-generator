import { NextResponse } from "next/server";
import type { z } from "zod";
import { guardRequest, invalidBody, readJson, type GuardContext } from "@/lib/security/guard";
import { securityLog } from "@/lib/security/log";
import { ConfigError } from "@/lib/server/config";

/**
 * Common start for account, project and admin routes: guard (origin, rate,
 * size), JSON body with a hard cap and schema validation.
 */
export async function begin<S extends z.ZodTypeAny>(
  request: Request,
  route: string,
  schema: S | null,
  maxBytes = 8 * 1024,
): Promise<{ ok: true; ctx: GuardContext; body: z.infer<S> } | { ok: false; response: NextResponse }> {
  const guard = guardRequest(request, { route, maxBytes });
  if (!guard.ok) return guard;
  const { ctx } = guard;
  if (!schema) return { ok: true, ctx, body: undefined as z.infer<S> };
  const raw = await readJson(request, maxBytes);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, response: invalidBody(ctx, raw) };
  return { ok: true, ctx, body: parsed.data };
}

export function json(ctx: GuardContext, data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "x-request-id": ctx.requestId, "cache-control": "no-store" } });
}

export function fail(ctx: GuardContext, status: number, error: string, code?: string): NextResponse {
  return json(ctx, code ? { error, code } : { error }, status);
}

/** Last-resort handler: logs the cause, answers without internal details. */
export function crash(ctx: GuardContext, error: unknown): NextResponse {
  securityLog("error", "route_error", {
    requestId: ctx.requestId, route: ctx.route,
    message: error instanceof ConfigError ? error.message : error instanceof Error ? error.message : "unknown",
  });
  return fail(ctx, 500, "Ocurrió un error interno. Inténtalo de nuevo en un momento.");
}
