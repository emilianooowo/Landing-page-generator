import { passwordProblems, PASSWORD_MIN_SCORE, type PasswordContext } from "@/lib/auth/passwordRules";
import { pwnedCount } from "@/lib/auth/pwned";
import { estimateStrength } from "@/lib/auth/strength";

/**
 * Full check for a new password: rules, strength estimate and known breaches.
 * Throws with a message for the form; resolves when the password is accepted.
 */
export async function assertAcceptablePassword(password: string, context: PasswordContext): Promise<void> {
  const problems = passwordProblems(password, context);
  if (problems.length) throw new Error(problems[0]);

  const strength = await estimateStrength(password, [context.email ?? "", context.name ?? ""].filter(Boolean));
  if (strength.score < PASSWORD_MIN_SCORE) {
    throw new Error(strength.warning
      ? `Esta contraseña es fácil de adivinar: ${strength.warning}`
      : "Esta contraseña es fácil de adivinar. Prueba con una frase de varias palabras poco relacionadas.");
  }

  const breaches = await pwnedCount(password);
  if (breaches) {
    throw new Error("Esta contraseña aparece en filtraciones de datos conocidas. Elige una que no hayas usado en otro sitio.");
  }
}
