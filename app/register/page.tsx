"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "../account.module.css";

export default function RegisterPage() {
  const { user, ready, register } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user && !redirected.current) {
      redirected.current = true;
      router.replace("/");
    }
  }, [ready, user, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setBusy(false);
      return;
    }
    try {
      await register(name, email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la cuenta.");
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
            <h1>Crear una cuenta</h1>
          </div>
          <form className={styles.authForm} onSubmit={submit}>
            <input className={styles.lineInput} autoComplete="name" aria-label="Nombre" placeholder="Nombre" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
            <input className={styles.lineInput} type="email" autoComplete="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Contraseña" placeholder="Contraseña" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Confirmar contraseña" placeholder="Confirmar contraseña" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>
              {busy ? "Creando cuenta…" : "Crear cuenta"}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>
          <p className={styles.registerLine}>¿Ya tienes una cuenta?<Link href="/login">Inicia sesión</Link></p>
        </div>
      </section>
      <div className={styles.authVisual}>
        <img src="/login-visual.svg" alt="Ilustración de una persona creando la página de su emprendimiento" />
      </div>
    </main>
  );
}
