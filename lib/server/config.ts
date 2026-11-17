/**
 * Server configuration. Secrets come only from the environment (.env on the
 * server, never the repository) and are checked on first use.
 */
export class ConfigError extends Error {}

function secret(name: string, minLength = 32): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minLength) {
    throw new ConfigError(`Falta la variable ${name} (mínimo ${minLength} caracteres).`);
  }
  return value;
}

export const isProduction = () => process.env.NODE_ENV === "production";

export const config = {
  databaseUrl: () => secret("DATABASE_URL", 10),
  /** JWT signing key. AUTH_SECRET_PREVIOUS keeps tokens valid for 15 minutes after a rotation. */
  authSecrets: () => [secret("AUTH_SECRET"), process.env.AUTH_SECRET_PREVIOUS?.trim()].filter((value): value is string => Boolean(value && value.length >= 32)),
  /** Encrypts TOTP secrets at rest. */
  dataKey: () => secret("DATA_ENCRYPTION_KEY"),
  /** Optional pepper mixed into every password hash; lives outside the database. */
  pepper: () => process.env.PASSWORD_PEPPER?.trim() || "",
  appUrl: () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, ""),
  smtpUrl: () => process.env.SMTP_URL?.trim() || "",
  mailFrom: () => process.env.MAIL_FROM?.trim() || "Landing IA <no-responder@landing-ia.local>",
  /** Optional allowlist (comma separated) for the admin panel and APIs. */
  adminIps: () => (process.env.ADMIN_ALLOWED_IPS ?? "").split(",").map((ip) => ip.trim()).filter(Boolean),
};
