"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { sessionEndedReason, useAuth, type User } from "@/components/auth/AuthProvider";
import { api, ApiError } from "@/lib/api";
import styles from "../account.module.css";

const ENDED_MESSAGES: Record<string, string> = {
  session_idle: "Tu sesión se cerró por inactividad. Inicia sesión de nuevo.",
  session_ended: "Tu sesión terminó. Inicia sesión de nuevo.",
};

function destination(user: User) {
  return user.mustSetupTwoFactor || user.mustChangePassword ? "/profile" : "/";
}

export default function SignInPage() {
  const { user, ready, signIn } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Rendered only after `ready`, which only happens in the browser.
  const ended = ready ? sessionEndedReason() : null;

  useEffect(() => {
    if (ready && user && !redirected.current) {
      redirected.current = true;
      router.replace(destination(user));
    }
  }, [ready, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    setUnverified(false);
    try {
      const next = await signIn(email, password, needsCode ? code : undefined);
      redirected.current = true;
      router.replace(destination(next));
    } catch (e) {
      if (e instanceof ApiError && e.code === "totp_required") {
        setNeedsCode(true);
        if (needsCode) setError(e.message);
      } else {
        if (e instanceof ApiError && e.code === "email_unverified") setUnverified(true);
        if (e instanceof ApiError && e.code === "totp_invalid") setCode("");
        setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    try {
      await api("/api/auth/resend-verification", { body: { email } });
      setInfo("Si la cuenta existe y falta confirmarla, te enviamos un enlace nuevo.");
      setUnverified(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el enlace.");
    }
  }

  if (!ready || user) return null;

  return (
    <main className={styles.authLayout}>
      <section className={styles.authFormSide}>
        <div className={styles.authContent}>
          <p className={styles.authBrand}>Landing IA</p>
          <div className={styles.authHeading}>
            <h1>Iniciar sesión</h1>
          </div>
          {ended && !error && <p className={styles.info} role="status">{ENDED_MESSAGES[ended] ?? ENDED_MESSAGES.session_ended}</p>}
          <form className={styles.authForm} onSubmit={submit}>
            {!needsCode ? (
              <>
                <input className={styles.lineInput} type="email" autoComplete="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
                <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
              </>
            ) : (
              <>
                <p className={styles.note}>Abre tu app de autenticación y escribe el código de 6 dígitos de Landing IA.</p>
                <input className={styles.lineInput} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de verificación" placeholder="Código de 6 dígitos" pattern="\d{6}" maxLength={6} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
              </>
            )}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {info && <p className={styles.info} role="status">{info}</p>}
            {unverified && <button className={styles.plainButton} type="button" onClick={resend}>Reenviar enlace de confirmación</button>}
            <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>
              {busy ? "Verificando…" : needsCode ? "Confirmar" : "Iniciar sesión"}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>
          <p className={styles.registerLine}><Link href="/recuperar">¿Olvidaste tu contraseña?</Link></p>
          <p className={styles.registerLine}>¿No tienes una cuenta?<Link href="/register">Regístrate</Link></p>
        </div>
      </section>
      <div className={styles.authVisual}>
        <Image src="/login-visual.svg" alt="Ilustración de una persona creando la página de su emprendimiento" fill priority sizes="50vw" />
      </div>
    </main>
  );
}
