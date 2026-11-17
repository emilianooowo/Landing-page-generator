/**
 * Password rules from the security policy (NIST SP 800-63B-4 and OWASP):
 * length over composition, no forced character classes, reject what is
 * predictable or tied to the account.
 *
 * 12 characters with two-factor authentication, 15 without it.
 */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MIN_LENGTH_2FA = 12;
export const PASSWORD_MAX_LENGTH = 128;
/** zxcvbn score (0–4) a new password needs. */
export const PASSWORD_MIN_SCORE = 3;

const PLATFORM_WORDS = ["landingia", "landing", "lpg"];

export function compact(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s._\-]+/g, "");
}

function isSequence(value: string): boolean {
  if (value.length < 4) return false;
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let i = 2; i < value.length; i++) {
    const diff = value.charCodeAt(i) - value.charCodeAt(i - 1);
    // Digits wrap: 7890123…
    if (diff !== step && !(/\d/.test(value[i]) && Math.abs(diff) === 9)) return false;
  }
  return true;
}

export type PasswordContext = { email?: string; name?: string; twoFactor?: boolean };

export const minimumLength = (context: PasswordContext = {}) => context.twoFactor ? PASSWORD_MIN_LENGTH_2FA : PASSWORD_MIN_LENGTH;

/** Fast, synchronous checks. Returns Spanish messages; empty means it passes. */
export function passwordProblems(password: string, context: PasswordContext = {}): string[] {
  const problems: string[] = [];
  const length = [...password].length;
  const min = minimumLength(context);
  if (length < min) problems.push(`Usa al menos ${min} caracteres. Una frase de varias palabras es fácil de recordar.`);
  if (length > PASSWORD_MAX_LENGTH) problems.push(`Usa como máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  if (!password.trim()) return problems;

  const plain = compact(password);
  if (/^(.{1,4})\1+$/.test(plain)) problems.push("No uses caracteres o grupos repetidos.");
  else if (isSequence(plain)) problems.push("No uses secuencias como 123456… o abcdef…");

  // Short pieces (3 letters, like "Ana") only count as a whole word: "naranja" is fine.
  const words = password.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9ñ]+/);
  const appears = (part: string) => (part.length >= 4 ? plain.includes(part) : words.includes(part));

  const email = context.email?.trim().toLowerCase() ?? "";
  const local = compact(email.split("@")[0] ?? "");
  if (email && (plain.includes(compact(email)) || (local.length >= 3 && appears(local)))) {
    problems.push("No incluyas tu correo.");
  }
  const nameParts = (context.name ?? "").split(/\s+/).map(compact).filter((part) => part.length >= 3);
  if (nameParts.some(appears)) problems.push("No incluyas tu nombre.");
  if (PLATFORM_WORDS.some((word) => plain.includes(word))) problems.push("No incluyas el nombre de la plataforma.");

  return problems;
}
