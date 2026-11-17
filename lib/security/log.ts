/**
 * Structured security log: one JSON line per event on stdout, ready for any
 * collector (journald, Docker logs, Loki, CloudWatch). Every line carries the
 * request id that is also returned to the browser in `x-request-id`, so a
 * report from a user can be matched to the server side.
 *
 * Personal data never reaches the log: emails, phone numbers, tokens and card
 * numbers are masked, and IPs are truncated.
 */
export type LogLevel = "info" | "warn" | "error";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const TOKEN = /\b(?:gsk_|sk-|ghp_|github_pat_|xox[abprs]-|AKIA|AIza)[A-Za-z0-9_\-]{8,}/g;
// Phone-like runs of 10+ digits; not inside hex ids such as UUIDs.
const LONG_DIGITS = /(?<![\w-])\+?\d(?:[\s-]?\d){9,}(?![\w-])/g;
/** Fields we write ourselves; they never carry personal data. */
const TRUSTED = new Set(["requestId", "route", "event", "status", "file", "category", "kind"]);

export function maskText(value: string): string {
  return value
    .replace(TOKEN, "[secreto]")
    .replace(EMAIL, "[correo]")
    .replace(LONG_DIGITS, "[número]");
}

/** 203.0.113.42 → 203.0.113.0 · 2001:db8:1:2::5 → 2001:db8:1::  */
export function maskIp(ip: string): string {
  if (ip === "::1" || ip === "127.0.0.1" || ip === "local") return "local";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return ip.replace(/\.\d{1,3}$/, ".0");
  if (ip.includes(":")) return `${ip.split(":").slice(0, 3).join(":")}::`;
  return ip;
}

function clean(value: unknown): unknown {
  if (typeof value === "string") return maskText(value).slice(0, 300);
  if (Array.isArray(value)) return value.slice(0, 20).map(clean);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, clean(inner)]));
  }
  return value;
}

export function securityLog(level: LogLevel, event: string, fields: Record<string, unknown> = {}): void {
  const { ip, ...rest } = fields;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(typeof ip === "string" ? { ip: maskIp(ip) } : {}),
    ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, TRUSTED.has(key) ? value : clean(value)])),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
