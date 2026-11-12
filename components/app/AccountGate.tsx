"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import styles from "@/app/account.module.css";

export function AccountGate({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.gateOverlay}>
      <section className={styles.gateCard} role="dialog" aria-modal="true" aria-labelledby="gate-title" aria-describedby="gate-description">
        <button className={styles.gateClose} type="button" aria-label="Cerrar aviso" onClick={onClose}><X aria-hidden="true" size={18} /></button>
        <span className={styles.gateEyebrow}>LPG</span>
        <h2 id="gate-title">Guarda y organiza tus proyectos</h2>
        <p id="gate-description">Crea una cuenta para ver tu dashboard y administrar tus páginas.</p>
        <Link className={`${styles.primaryButton} ${styles.gatePrimary}`} href="/register">Crear cuenta<ArrowRight aria-hidden="true" size={17} /></Link>
        <Link className={styles.gateSignIn} href="/login">Ya tengo una cuenta</Link>
      </section>
    </div>
  );
}
