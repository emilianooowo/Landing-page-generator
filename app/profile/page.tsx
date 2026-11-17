"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import { PrivateShell } from "@/components/app/PrivateShell";
import { useAuth, type User } from "@/components/auth/AuthProvider";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { TwoFactorSection } from "@/components/auth/TwoFactorSection";
import { api } from "@/lib/api";
import { minimumLength, PASSWORD_MAX_LENGTH } from "@/lib/auth/passwordRules";
import styles from "../account.module.css";

type ModalMode = "password" | "delete" | null;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [chosenModal, setModal] = useState<ModalMode>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [deleteCode, setDeleteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mustChange = Boolean(user?.mustChangePassword);
  const mustSetup = Boolean(user?.mustSetupTwoFactor);
  // A password that must be replaced keeps the change form open until it is.
  const modal: ModalMode = mustChange && !mustSetup ? "password" : chosenModal;
  const editing = nameDraft !== null;

  useEffect(() => {
    if (!modal) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !mustChange) setModal(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modal, mustChange]);

  function startEditing() {
    if (!user) return;
    setError(null);
    setNameDraft(user.name);
    setEmailDraft(user.email);
    setEmailPassword("");
  }

  async function saveData(event: FormEvent) {
    event.preventDefault();
    if (!user || nameDraft === null) return;
    setError(null);
    setBusy(true);
    try {
      const emailChanged = emailDraft.trim().toLowerCase() !== user.email;
      const result = await api<{ user: User; pendingEmail: string | null }>("/api/auth/me", {
        method: "PATCH",
        body: { name: nameDraft, ...(emailChanged ? { email: emailDraft, currentPassword: emailPassword } : {}) },
      });
      setUser(result.user);
      setPendingEmail(result.pendingEmail);
      setNameDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar tus datos.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await api<{ user: User }>("/api/auth/change-password", { body: { currentPassword, newPassword: nextPassword } });
      setUser(result.user);
      setCurrentPassword("");
      setNextPassword("");
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/auth/me", { method: "DELETE", body: { password: currentPassword, ...(user?.twoFactor ? { code: deleteCode } : {}) } });
      setUser(null);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la cuenta.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PrivateShell>
      <main className={styles.content}>
        <header className={styles.contentHeader}>
          <div><h1 className={styles.contentTitle}>Perfil</h1></div>
        </header>

        {user && mustSetup && (
          <p className={styles.notice} role="alert">Tu cuenta es de personal ({user.role}). Antes de continuar activa la verificación en dos pasos.</p>
        )}

        {user && <div className={styles.profileGrid}>
          {!mustSetup && <section className={styles.profileSection}>
            <div className={styles.profileSectionHeader}>
              <h2 className={styles.sectionTitle}>Datos de cuenta</h2>
              {!editing && <button className={styles.iconButton} type="button" aria-label="Modificar datos de cuenta" title="Modificar datos" onClick={startEditing}><Pencil size={16} /></button>}
            </div>
            {editing ? (
              <form className={styles.form} onSubmit={saveData}>
                <input className={styles.lineInput} aria-label="Nombre" placeholder="Nombre" maxLength={60} required value={nameDraft ?? ""} onChange={(event) => setNameDraft(event.target.value)} />
                <input className={styles.lineInput} type="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required maxLength={254} value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} />
                {emailDraft.trim().toLowerCase() !== user.email && (
                  <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña actual" placeholder="Tu contraseña actual (para cambiar el correo)" maxLength={128} required value={emailPassword} onChange={(event) => setEmailPassword(event.target.value)} />
                )}
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.formActions}>
                  <button className={styles.plainButton} type="button" onClick={() => setNameDraft(null)}>Cancelar</button>
                  <button className={styles.primaryButton} type="submit" disabled={busy}>Guardar cambios</button>
                </div>
              </form>
            ) : (
              <dl className={styles.profileDetails}>
                <div><dt>Nombre</dt><dd>{user.name}</dd></div>
                <div><dt>Correo electrónico</dt><dd>{user.email}</dd></div>
                {user.role !== "usuario" && <div><dt>Rol</dt><dd>{user.role}</dd></div>}
              </dl>
            )}
            {pendingEmail && <p className={styles.info} role="status">Te enviamos un enlace a {pendingEmail}. El correo cambiará cuando lo confirmes.</p>}
          </section>}

          <TwoFactorSection />

          {!mustSetup && <section className={styles.profileSection}>
            <div>
              <h2 className={styles.sectionTitle}>Contraseña</h2>
              <p className={styles.note}>No necesitas cambiarla periódicamente; solo si crees que alguien más la conoce. Al cambiarla cerramos tus otras sesiones.</p>
            </div>
            <button className={styles.dangerButton} type="button" onClick={() => { setError(null); setModal("password"); }}>Cambiar contraseña</button>
          </section>}

          {!mustSetup && <section className={styles.profileSection}>
            <div>
              <h2 className={styles.sectionTitle}>Eliminar cuenta</h2>
              <p className={styles.note}>Tus datos personales se borran al momento. Tus proyectos se conservan 30 días por si fue un error y después se eliminan.</p>
            </div>
            <button className={styles.dangerButton} type="button" onClick={() => { setError(null); setCurrentPassword(""); setModal("delete"); }}>Eliminar cuenta</button>
          </section>}
        </div>}
      </main>

      {modal && user && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !mustChange) setModal(null); }}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
          <div className={styles.modalHeader}>
            <h2 id="account-modal-title" className={styles.sectionTitle}>{modal === "password" ? "Cambiar contraseña" : "Eliminar cuenta"}</h2>
            {!(modal === "password" && mustChange) && <button className={styles.iconButton} type="button" aria-label="Cerrar ventana" title="Cerrar" onClick={() => setModal(null)}><X size={17} /></button>}
          </div>
          {modal === "password" ? (
            <form className={styles.form} onSubmit={savePassword}>
              {mustChange && <p className={styles.notice}>Por seguridad necesitas una contraseña nueva antes de continuar: la actual apareció en filtraciones de datos conocidas, o un administrador pidió cambiarla.</p>}
              <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña actual" placeholder="Contraseña actual" maxLength={PASSWORD_MAX_LENGTH} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Nueva contraseña" minLength={minimumLength({ twoFactor: user.twoFactor })} maxLength={PASSWORD_MAX_LENGTH} required value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
              <PasswordStrength password={nextPassword} email={user.email} name={user.name} twoFactor={user.twoFactor} />
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.primaryButton} type="submit" disabled={busy}>{busy ? "Revisando…" : "Guardar cambios"}</button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={removeAccount}>
              <p className={styles.muted}>Se cerrarán tus sesiones y se borrarán tus datos personales. Para confirmar escribe tu contraseña.</p>
              <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña" placeholder="Contraseña" maxLength={PASSWORD_MAX_LENGTH} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              {user.twoFactor && <input className={styles.lineInput} inputMode="numeric" aria-label="Código de verificación" placeholder="Código de 6 dígitos" pattern="\d{6}" maxLength={6} required value={deleteCode} onChange={(event) => setDeleteCode(event.target.value.replace(/\D/g, ""))} />}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.formActions}>
                <button className={styles.plainButton} type="button" onClick={() => setModal(null)}>Cancelar</button>
                <button className={styles.dangerButton} type="submit" disabled={busy}>Eliminar cuenta</button>
              </div>
            </form>
          )}
        </section>
      </div>}
    </PrivateShell>
  );
}
