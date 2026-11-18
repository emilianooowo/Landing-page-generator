"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordRules";
import styles from "../account.module.css";

export default function RegisterPage() {
  const { user, ready, register } = useAuth();
  const router = useRouter();
  const redirected = useRef(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sent, setSent] = useState(false);
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
      await register(name, email, password, termsAccepted);
      setSent(true);
      setPassword("");
      setConfirmPassword("");
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
          <p className={styles.authBrand}><img src="/web-app-manifest-512x512.png" alt="Landing IA" /></p>
          <div className={styles.authHeading}>
            <h1>Crear una cuenta</h1>
          </div>
          {sent ? (
            <div className={styles.form}>
              <p className={styles.info} role="status">Te enviamos un enlace a <strong>{email}</strong> para confirmar tu correo. Ábrelo para activar tu cuenta; vence en 24 horas.</p>
              <p className={styles.note}>Si no lo ves, revisa la carpeta de spam. Puedes pedir otro desde la página de inicio de sesión.</p>
              <Link className={`${styles.primaryButton} ${styles.authButton}`} href="/login">Ir a iniciar sesión<ArrowRight aria-hidden="true" size={17} /></Link>
            </div>
          ) : (
          <form className={styles.authForm} onSubmit={submit}>
            <input className={styles.lineInput} autoComplete="name" aria-label="Nombre" placeholder="Nombre" required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
            <input className={styles.lineInput} type="email" autoComplete="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
            <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Contraseña" placeholder="Contraseña" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <PasswordStrength password={password} email={email} name={name} />
            <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Confirmar contraseña" placeholder="Confirmar contraseña" minLength={PASSWORD_MIN_LENGTH} maxLength={PASSWORD_MAX_LENGTH} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            <label className={styles.checkboxLine}>
              <input type="checkbox" required checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} />
              <span>Acepto los <Link href="/terminos" target="_blank">términos de uso</Link>. No compartiré mi cuenta ni escribiré contraseñas o datos personales de otras personas en las descripciones.</span>
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={`${styles.primaryButton} ${styles.authButton}`} type="submit" disabled={busy}>
              {busy ? "Revisando y creando la cuenta…" : "Crear cuenta"}<ArrowRight aria-hidden="true" size={17} />
            </button>
          </form>
          )}
          <p className={styles.registerLine}>¿Ya tienes una cuenta?<Link href="/login">Inicia sesión</Link></p>
        </div>
      </section>
      <div className={styles.authVisual}>
        <Image src="/login-visual.svg" alt="Ilustración de una persona creando la página de su emprendimiento" fill priority sizes="50vw" />
      </div>
    </main>
  );
}
