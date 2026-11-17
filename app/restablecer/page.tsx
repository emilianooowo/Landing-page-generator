"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard, takeFragmentToken } from "@/components/auth/AuthCard";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { api } from "@/lib/api";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH_2FA } from "@/lib/auth/passwordRules";
import styles from "../account.module.css";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Read once on mount: the fragment is removed from the address bar right away.
  const taken = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    // Effects can run twice in development: the fragment is only readable the first time.
    if (taken.current === undefined) taken.current = takeFragmentToken();
    const value = taken.current;
    void Promise.resolve().then(() => setToken(value));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/reset-password", { body: { token, password } });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Nueva contraseña">
      {token === undefined ? null : !token ? (
        <div className={styles.form}>
          <p className={styles.error} role="alert">El enlace está incompleto. Ábrelo de nuevo desde el correo o pide uno nuevo.</p>
          <Link className={styles.textLink} href="/recuperar">Pedir otro enlace</Link>
        </div>
      ) : done ? (
        <div className={styles.form}>
          <p className={styles.success} role="status">Tu contraseña cambió y cerramos todas tus sesiones abiertas.</p>
          <Link className={`${styles.primaryButton} ${styles.authButton}`} href="/login">Iniciar sesión</Link>
        </div>
      ) : (
        <form className={styles.authForm} onSubmit={submit}>
          <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Nueva contraseña" minLength={PASSWORD_MIN_LENGTH_2FA} maxLength={PASSWORD_MAX_LENGTH} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <PasswordStrength password={password} />
          <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Confirmar contraseña" placeholder="Confirmar contraseña" maxLength={PASSWORD_MAX_LENGTH} required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar contraseña"}</button>
        </form>
      )}
    </AuthCard>
  );
}
