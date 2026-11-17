import Image from "next/image";
import type { ReactNode } from "react";
import styles from "@/app/account.module.css";

/** Layout shared by the account pages (sign-in, verification, reset). */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className={styles.authLayout}>
      <section className={styles.authFormSide}>
        <div className={styles.authContent}>
          <p className={styles.authBrand}>Landing IA</p>
          <div className={styles.authHeading}>
            <h1>{title}</h1>
          </div>
          {children}
        </div>
      </section>
      <div className={styles.authVisual}>
        <Image src="/login-visual.svg" alt="Ilustración de una persona creando la página de su emprendimiento" fill priority sizes="50vw" />
      </div>
    </main>
  );
}

/**
 * Reads the token from the URL fragment (#t=…) and removes it from the address
 * bar. Fragments never reach the server or the Referer header.
 */
export function takeFragmentToken(): string | null {
  const match = /(?:^|[#&])t=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (match) window.history.replaceState(null, "", window.location.pathname);
  return match?.[1] ?? null;
}
