import { NextResponse } from "next/server";
import { createRateLimiter, type RateLimiter } from "@/lib/security/rateLimit";
import { securityLog } from "@/lib/security/log";
import { moderatePrompt } from "@/lib/security/moderation";

/**
 * Shared front door for every API route. In order: request id, same-origin
 * check, abuse block, per-IP rate limit, daily quota and body size. Each
 * rejection is logged and answered with a generic Spanish message.
 *
 * Limits (security policy, "Uso de recursos"):
 * - 60 requests per minute per IP across the whole API (`API_RATE_LIMIT_PER_MINUTE`).
 * - The daily quota of new landings lives in the database (lib/server/quota.ts).
 * - 50 photo uploads per IP per day (`UPLOADS_PER_DAY`).
 * - 3 abuse rejections in 24 h block the IP from the AI routes for 24 h.
 */
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function envInt(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

type Limiters = { api: RateLimiter; uploads: RateLimiter; strikes: RateLimiter; blocked: Map<string, number> };

// Kept on globalThis so dev-mode module reloads don't reset the counters.
const store = globalThis as typeof globalThis & { __landingIaLimiters?: Limiters };

function limiters(): Limiters {
  store.__landingIaLimiters ??= {
    api: createRateLimiter({ limit: envInt("API_RATE_LIMIT_PER_MINUTE", 60), windowMs: MINUTE }),
    uploads: createRateLimiter({ limit: envInt("UPLOADS_PER_DAY", 50), windowMs: DAY }),
    strikes: createRateLimiter({ limit: 1_000, windowMs: DAY }),
    blocked: new Map(),
  };
  return store.__landingIaLimiters;
}

export const STRIKES_BEFORE_BLOCK = 3;

/** Rightmost X-Forwarded-For entry: the one appended by our own reverse proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return request.headers.get("x-real-ip")?.trim() || "local";
}

/**
 * Browsers always send Origin on POST, and Sec-Fetch-Site on modern engines.
 * A cross-site page can't forge either, so this stops cross-site request
 * forgery and other sites using our AI quota from their visitors' browsers.
 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return Boolean(host) && new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type GuardOptions = {
  route: string;
  /** Max request body in bytes. */
  maxBytes: number;
  /** Counts against the daily landing quota. */
  generation?: boolean;
  /** Counts against the daily upload quota. */
  upload?: boolean;
  /** Route that sends text to the model: subject to the abuse block. */
  ai?: boolean;
};

export type GuardContext = { requestId: string; ip: string; route: string };

type GuardResult = { ok: true; ctx: GuardContext } | { ok: false; response: NextResponse };

function reject(ctx: GuardContext, status: number, error: string, event: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): GuardResult {
  securityLog("warn", event, { requestId: ctx.requestId, ip: ctx.ip, route: ctx.route, status, ...extra });
  return {
    ok: false,
    response: NextResponse.json({ error }, { status, headers: { "x-request-id": ctx.requestId, ...headers } }),
  };
}

export function guardRequest(request: Request, options: GuardOptions): GuardResult {
  const ctx: GuardContext = { requestId: crypto.randomUUID(), ip: clientIp(request), route: options.route };
  const all = limiters();

  if (!isSameOrigin(request)) {
    return reject(ctx, 403, "Solicitud no permitida.", "origin_rejected", { origin: request.headers.get("origin") ?? "" });
  }

  if (options.ai) {
    const until = all.blocked.get(ctx.ip);
    if (until && until > Date.now()) {
      return reject(ctx, 403, "El acceso al generador está bloqueado temporalmente por solicitudes que infringen los términos de uso.", "blocked_ip_request", {}, {
        "retry-after": String(Math.ceil((until - Date.now()) / 1000)),
      });
    }
    if (until) all.blocked.delete(ctx.ip);
  }

  const rate = all.api.hit(ctx.ip);
  if (!rate.ok) {
    return reject(ctx, 429, "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.", "rate_limited", {}, {
      "retry-after": String(rate.retryAfterSeconds),
    });
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > options.maxBytes) {
    return reject(ctx, 413, "La solicitud es demasiado grande.", "payload_too_large", { bytes: declared });
  }

  if (options.upload) {
    const quota = all.uploads.hit(ctx.ip);
    if (!quota.ok) {
      return reject(ctx, 429, "Alcanzaste el límite diario de imágenes. Inténtalo mañana.", "upload_quota_exceeded", {}, {
        "retry-after": String(quota.retryAfterSeconds),
      });
    }
  }

  return { ok: true, ctx };
}

/**
 * Reads the body with a hard cap, whatever Content-Length claims.
 * Returns undefined when it is too large and null when it is not JSON.
 */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function invalidBody(ctx: GuardContext, body: unknown): NextResponse {
  const tooLarge = body === undefined;
  securityLog("warn", tooLarge ? "payload_too_large" : "invalid_body", { requestId: ctx.requestId, ip: ctx.ip, route: ctx.route });
  return NextResponse.json(
    { error: tooLarge ? "La solicitud es demasiado grande." : "La solicitud no es válida." },
    { status: tooLarge ? 413 : 400, headers: { "x-request-id": ctx.requestId } },
  );
}

/**
 * Moderates every free-text field. On success returns the texts with contact
 * data replaced by placeholders; on rejection returns the response to send.
 */
export type ModerationOutcome =
  | { ok: true; texts: string[] }
  | { ok: false; response: NextResponse; category: string; strike: boolean; blocked: boolean };

export function moderate(ctx: GuardContext, texts: string[]): ModerationOutcome {
  const out: string[] = [];
  const redacted = new Set<string>();
  for (const text of texts) {
    const result = moderatePrompt(text);
    if (!result.ok) {
      let blocked = false;
      if (result.strike) {
        const all = limiters();
        all.strikes.hit(ctx.ip);
        if (all.strikes.peek(ctx.ip) >= STRIKES_BEFORE_BLOCK) {
          all.blocked.set(ctx.ip, Date.now() + DAY);
          all.strikes.reset(ctx.ip);
          blocked = true;
        }
      }
      securityLog("warn", "prompt_rejected", {
        requestId: ctx.requestId, ip: ctx.ip, route: ctx.route, category: result.category, strike: result.strike, blocked,
      });
      if (blocked) securityLog("warn", "ip_blocked", { requestId: ctx.requestId, ip: ctx.ip, hours: 24, reason: "abuse_strikes" });
      const message = blocked
        ? `${result.message} Por solicitudes repetidas que infringen los términos de uso, el generador quedó bloqueado durante 24 horas.`
        : result.strike
          ? `${result.message} Las solicitudes que infringen los términos de uso se registran.`
          : result.message;
      return {
        ok: false,
        category: result.category,
        strike: result.strike,
        blocked,
        response: NextResponse.json({ error: message, code: "prompt_rejected" }, { status: 422, headers: { "x-request-id": ctx.requestId } }),
      };
    }
    result.redactions.forEach((label) => redacted.add(label));
    out.push(result.text);
  }
  if (redacted.size) securityLog("info", "prompt_redacted", { requestId: ctx.requestId, route: ctx.route, kinds: [...redacted] });
  return { ok: true, texts: out };
}

export function withRequestId<T extends NextResponse>(response: T, ctx: GuardContext): T {
  response.headers.set("x-request-id", ctx.requestId);
  return response;
}

/** Test hook. */
export function resetLimiters(): void {
  delete store.__landingIaLimiters;
}

/** Model or network failure: logged with its kind, never with the prompt. */
export function logAiFailure(ctx: GuardContext, error: unknown): void {
  const kind = error && typeof error === "object" && "kind" in error ? String((error as { kind: unknown }).kind) : "unknown";
  securityLog("error", "ai_unavailable", {
    requestId: ctx.requestId, route: ctx.route, kind,
    message: error instanceof Error ? error.message : String(error),
  });
}
