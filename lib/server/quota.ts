import { ipHash } from "@/lib/server/crypto";
import { one, query } from "@/lib/server/db";

/**
 * Daily quota of new landings (security policy, "Uso de recursos"): 3 per
 * account, or per IP for guests. Stored in the database, so it survives
 * restarts. `AI_DAILY_GENERATIONS` overrides it (0 = no limit); development
 * has no limit by default.
 */
export function dailyLimit(): number {
  const value = Number.parseInt(process.env.AI_DAILY_GENERATIONS ?? "", 10);
  if (Number.isFinite(value) && value >= 0) return value;
  return process.env.NODE_ENV === "production" ? 3 : 0;
}

export const quotaKey = (userId: string | null, ip: string) => (userId ? `u:${userId}` : `ip:${ipHash(ip)}`);

/** Records one generation. Returns false (without recording) when the quota is used up. */
export async function takeGeneration(key: string): Promise<boolean> {
  const limit = dailyLimit();
  if (limit === 0) return true;
  const row = await one<{ total: string }>(
    "SELECT count(*) AS total FROM uso_generaciones WHERE clave = $1 AND creado_en > now() - interval '24 hours'",
    [key],
  );
  if (Number(row?.total ?? 0) >= limit) return false;
  await query("INSERT INTO uso_generaciones (clave) VALUES ($1)", [key]);
  return true;
}
