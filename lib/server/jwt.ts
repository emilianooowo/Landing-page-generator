import { errors, jwtVerify, SignJWT } from "jose";
import { config } from "@/lib/server/config";

/**
 * Access token: JWT HS256, 15 minutes, signed role inside (security policy,
 * "Roles"). The server still checks the session row on every request, so a
 * revoked session stops working immediately, not 15 minutes later.
 */
export const ACCESS_TTL_SECONDS = 15 * 60;
const ISSUER = "landing-ia";
const AUDIENCE = "landing-ia-app";

export type Role = "usuario" | "analista" | "administrador";
export type SessionLevel = "completo" | "configurar_2fa";
export type AccessClaims = { sub: string; sid: string; rol: Role; lvl: SessionLevel };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid, rol: claims.rol, lvl: claims.lvl })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SECONDS}s`)
    .sign(key(config.authSecrets()[0]));
}

export type VerifyResult = { ok: true; claims: AccessClaims } | { ok: false; reason: "expired" | "invalid" };

export async function verifyAccessToken(token: string): Promise<VerifyResult> {
  for (const secret of config.authSecrets()) {
    try {
      const { payload } = await jwtVerify(token, key(secret), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
      const { sub, sid, rol, lvl } = payload as Record<string, unknown>;
      if (typeof sub !== "string" || typeof sid !== "string" || typeof rol !== "string" || typeof lvl !== "string") {
        return { ok: false, reason: "invalid" };
      }
      return { ok: true, claims: { sub, sid, rol: rol as Role, lvl: lvl as SessionLevel } };
    } catch (error) {
      if (error instanceof errors.JWTExpired) return { ok: false, reason: "expired" };
      // Signature mismatch: try the previous secret (rotation window).
    }
  }
  return { ok: false, reason: "invalid" };
}
