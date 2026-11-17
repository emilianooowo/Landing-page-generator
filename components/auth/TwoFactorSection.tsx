"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useAuth, type User } from "@/components/auth/AuthProvider";
import { api } from "@/lib/api";
import styles from "@/app/account.module.css";

type Setup = { secret: string; qr: string };

/**
 * Two-factor authentication with an authenticator app. Mandatory for staff,
 * optional for users (it lowers their minimum password length to 12).
 */
export function TwoFactorSection() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;
  const staff = user.role !== "usuario";

  async function start() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await api<Setup>("/api/auth/totp", { method: "POST" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo iniciar la configuración.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user: next } = await api<{ user: User }>("/api/auth/totp", { method: "PUT", body: { code } });
      setUser(next);
      setSetup(null);
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user: next } = await api<{ user: User }>("/api/auth/totp", { method: "DELETE", body: { password, code } });
      setUser(next);
      setDisabling(false);
      setPassword("");
      setCode("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.profileSection}>
      <div>
        <h2 className={styles.sectionTitle}>Verificación en dos pasos</h2>
        <p className={styles.note}>
          {user.twoFactor
            ? "Activa. Al iniciar sesión te pediremos un código de tu app de autenticación."
            : staff
              ? "Obligatoria para el personal. Actívala para usar tu cuenta."
              : "Opcional. Protege tu cuenta aunque alguien conozca tu contraseña."}
        </p>
      </div>

      {setup ? (
        <form className={styles.form} onSubmit={confirm}>
          <p className={styles.note}>1. Escanea el código con Google Authenticator, Microsoft Authenticator u otra app compatible.</p>
          <Image src={setup.qr} alt="Código QR para tu app de autenticación" width={180} height={180} unoptimized />
          <p className={styles.note}>¿No puedes escanearlo? Escribe esta clave en la app: <code>{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</code></p>
          <p className={styles.note}>2. Escribe el código de 6 dígitos que muestra la app.</p>
          <input className={styles.lineInput} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de verificación" placeholder="Código de 6 dígitos" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.formActions}>
            <button className={styles.plainButton} type="button" onClick={() => { setSetup(null); setError(null); }}>Cancelar</button>
            <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Verificando…" : "Activar"}</button>
          </div>
        </form>
      ) : disabling ? (
        <form className={styles.form} onSubmit={disable}>
          <p className={styles.note}>Sin verificación en dos pasos tu contraseña debe tener al menos 15 caracteres; si es más corta te pediremos cambiarla.</p>
          <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} />
          <input className={styles.lineInput} inputMode="numeric" autoComplete="one-time-code" aria-label="Código de verificación" placeholder="Código de 6 dígitos" pattern="\d{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.formActions}>
            <button className={styles.plainButton} type="button" onClick={() => { setDisabling(false); setError(null); }}>Cancelar</button>
            <button className={styles.dangerButton} type="submit" disabled={busy}>Desactivar</button>
          </div>
        </form>
      ) : (
        <>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {!user.twoFactor && <button className={styles.primaryButton} type="button" disabled={busy} onClick={start}>Activar verificación en dos pasos</button>}
          {user.twoFactor && !staff && <button className={styles.dangerButton} type="button" onClick={() => { setError(null); setDisabling(true); }}>Desactivar</button>}
        </>
      )}
    </section>
  );
}
