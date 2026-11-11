"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Pencil, X } from "lucide-react";
import { PrivateShell } from "@/components/app/PrivateShell";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "../account.module.css";

type ModalMode = "password" | "delete" | null;

export default function ProfilePage() {
  const { user, updateProfile, changePassword, deleteAccount } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editingData, setEditingData] = useState(false);
  const [modal, setModal] = useState<ModalMode>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
  }, [user]);

  useEffect(() => {
    if (!modal) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [modal]);

  function saveData(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      updateProfile(name, email);
      setEditingData(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar tus datos.");
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await changePassword(currentPassword, nextPassword);
      setCurrentPassword("");
      setNextPassword("");
      setModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la contraseña.");
    }
  }

  function removeAccount() {
    deleteAccount();
    window.location.assign("/");
  }

  return (
    <PrivateShell>
      <main className={styles.content}>
        <header className={styles.contentHeader}>
          <div><h1 className={styles.contentTitle}>Perfil</h1></div>
        </header>

        {user && <div className={styles.profileGrid}>
          <section className={styles.profileSection}>
            <div className={styles.profileSectionHeader}>
              <h2 className={styles.sectionTitle}>Datos de cuenta</h2>
              {!editingData && <button className={styles.iconButton} type="button" aria-label="Modificar datos de cuenta" title="Modificar datos" onClick={() => { setError(null); setEditingData(true); }}><Pencil size={16} /></button>}
            </div>
            {editingData ? (
              <form className={styles.form} onSubmit={saveData}>
                <input className={styles.lineInput} aria-label="Nombre" placeholder="Nombre" maxLength={60} required value={name} onChange={(event) => setName(event.target.value)} />
                <input className={styles.lineInput} type="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required value={email} onChange={(event) => setEmail(event.target.value)} />
                {error && <p className={styles.error} role="alert">{error}</p>}
                <div className={styles.formActions}>
                  <button className={styles.plainButton} type="button" onClick={() => { setName(user.name); setEmail(user.email); setEditingData(false); }}>Cancelar</button>
                  <button className={styles.primaryButton} type="submit">Guardar cambios</button>
                </div>
              </form>
            ) : (
              <dl className={styles.profileDetails}>
                <div><dt>Nombre</dt><dd>{user.name}</dd></div>
                <div><dt>Correo electrónico</dt><dd>{user.email}</dd></div>
              </dl>
            )}
          </section>

          <section className={styles.profileSection}>
            <div>
              <h2 className={styles.sectionTitle}>Contraseña</h2>
              <p className={styles.note}>Actualiza la contraseña de esta cuenta local.</p>
            </div>
            <button className={styles.dangerButton} type="button" onClick={() => { setError(null); setModal("password"); }}>Cambiar contraseña</button>
          </section>

          <section className={styles.profileSection}>
            <div>
              <h2 className={styles.sectionTitle}>Eliminar cuenta</h2>
              <p className={styles.note}>También se eliminarán los proyectos guardados en este navegador.</p>
            </div>
            <button className={styles.dangerButton} type="button" onClick={() => { setError(null); setModal("delete"); }}>Eliminar cuenta</button>
          </section>
        </div>}
      </main>

      {modal && <div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
          <div className={styles.modalHeader}>
            <h2 id="account-modal-title" className={styles.sectionTitle}>{modal === "password" ? "Cambiar contraseña" : "Eliminar cuenta"}</h2>
            <button className={styles.iconButton} type="button" aria-label="Cerrar ventana" title="Cerrar" onClick={() => setModal(null)}><X size={17} /></button>
          </div>
          {modal === "password" ? (
            <form className={styles.form} onSubmit={savePassword}>
              <input className={styles.lineInput} type="password" autoComplete="current-password" aria-label="Contraseña actual" placeholder="Contraseña actual" minLength={8} required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <input className={styles.lineInput} type="password" autoComplete="new-password" aria-label="Nueva contraseña" placeholder="Nueva contraseña" minLength={8} required value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.primaryButton} type="submit">Guardar cambios</button>
            </form>
          ) : (
            <div className={styles.form}>
              <p className={styles.muted}>Se borrarán tu cuenta y todos sus proyectos de este navegador. Esta acción no se puede deshacer.</p>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <div className={styles.formActions}>
                <button className={styles.plainButton} type="button" onClick={() => setModal(null)}>Cancelar</button>
                <button className={styles.dangerButton} type="button" onClick={removeAccount}>Eliminar cuenta</button>
              </div>
            </div>
          )}
        </section>
      </div>}
    </PrivateShell>
  );
}
