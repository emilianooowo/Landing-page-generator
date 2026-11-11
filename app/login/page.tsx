"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "../account.module.css";
import { consumePendingProject } from "@/lib/store";

export default function SignInPage() {
  const { user, ready, signIn } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user && !redirected.current) {
      redirected.current = true;
      const pendingProjectId = consumePendingProject();
      router.replace(pendingProjectId ? `/project/${pendingProjectId}` : "/dashboard");
    }
  }, [ready, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || user) return null;

  return (
    <main className={styles.authLayout}>
      <section className={styles.authFormSide}>
        <div className={styles.authContent}>
          <p className={styles.authBrand}>LPG</p>
          <div className={styles.authHeading}>
            <h1>Iniciar sesión</h1>
          </div>
          <form className={styles.authForm} onSubmit={submit}>
            <input className={styles.lineInput} type="email" autoComplete="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" required value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>
              {busy ? "Iniciando sesión…" : "Iniciar sesión"}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>
          <p className={styles.registerLine}>¿No tienes una cuenta?<Link href="/register">Regístrate</Link></p>
          <p className={styles.authNote}>Demo local: tu cuenta solo está disponible en este navegador.</p>
        </div>
      </section>
      <div className={styles.authVisual}>
        <img src="/login-visual.svg" alt="Ilustración de una persona creando la página de su emprendimiento" />
      </div>
    </main>
  );
}
