"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/AuthCard";
import { api } from "@/lib/api";
import styles from "../account.module.css";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/forgot-password", { body: { email } });
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el enlace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Restablecer contraseña">
      {sent ? (
        <div className={styles.form}>
          <p className={styles.info} role="status">Si hay una cuenta con ese correo, te enviamos un enlace para elegir una contraseña nueva. Vence en 30 minutos y solo funciona una vez.</p>
          <Link className={styles.textLink} href="/login">Volver a iniciar sesión</Link>
        </div>
      ) : (
        <form className={styles.authForm} onSubmit={submit}>
          <p className={styles.note}>Escribe el correo de tu cuenta y te enviaremos un enlace. Nunca te pediremos tu contraseña por correo ni por teléfono.</p>
          <input className={styles.lineInput} type="email" autoComplete="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar enlace"}</button>
          <Link className={styles.textLink} href="/login">Volver a iniciar sesión</Link>
        </form>
      )}
    </AuthCard>
  );
}
