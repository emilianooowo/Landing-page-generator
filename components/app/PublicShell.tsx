"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PrivateShell } from "@/components/app/PrivateShell";
import styles from "@/app/account.module.css";

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();

  if (!ready) return null;
  if (user) return <PrivateShell>{children}</PrivateShell>;

  return (
    <div className={styles.publicFrame}>
      <aside className={styles.publicSidebar}>
        <Link className={styles.headerBrand} href="/" aria-label="LPG, inicio">LPG</Link>
        <Link className={styles.signInLink} href="/login" title="Iniciar sesión">
          <LogIn aria-hidden="true" size={17} />
          <span>Iniciar sesión</span>
        </Link>
      </aside>
      <div className={styles.publicMain}>{children}</div>
    </div>
  );
}
