"use client";

import { useEffect, useState } from "react";
import { minimumLength, passwordProblems, PASSWORD_MIN_SCORE } from "@/lib/auth/passwordRules";
import { estimateStrength, type Strength } from "@/lib/auth/strength";
import styles from "@/app/account.module.css";

const LABELS = ["Muy débil", "Débil", "Regular", "Fuerte", "Muy fuerte"];

/**
 * Live feedback while typing a new password: the policy rules plus the zxcvbn
 * estimate. The final check (including known breaches) runs on submit.
 */
export function PasswordStrength({ password, email, name, twoFactor }: { password: string; email?: string; name?: string; twoFactor?: boolean }) {
  const [strength, setStrength] = useState<{ for: string; value: Strength } | null>(null);

  useEffect(() => {
    if (!password) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      estimateStrength(password, [email ?? "", name ?? ""].filter(Boolean))
        .then((value) => { if (!cancelled) setStrength({ for: password, value }); })
        .catch(() => undefined);
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [password, email, name]);

  if (!password) {
    return <p className={styles.note}>Usa al menos {minimumLength({ twoFactor })} caracteres. Una frase de varias palabras es segura y fácil de recordar.</p>;
  }

  const problems = passwordProblems(password, { email, name, twoFactor });
  const current = strength?.for === password ? strength.value : null;
  const score = problems.length ? Math.min(current?.score ?? 0, 1) : current?.score ?? 0;
  const hint = problems[0]
    ?? (current && current.score < PASSWORD_MIN_SCORE ? current.warning ?? current.suggestions[0] ?? "Hazla más larga o menos predecible." : null);

  return (
    <div className={styles.strength} aria-live="polite">
      <div className={styles.strengthBar} aria-hidden="true">
        {[0, 1, 2, 3].map((step) => (
          <span key={step} className={styles.strengthStep} data-on={score > step ? String(score) : undefined} />
        ))}
      </div>
      <p className={styles.note}>
        <strong>{LABELS[score]}.</strong>{hint ? ` ${hint}` : " Cumple con la política de contraseñas."}
      </p>
    </div>
  );
}
