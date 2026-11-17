"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { PrivateShell } from "@/components/app/PrivateShell";
import { AccountGate } from "@/components/app/AccountGate";
import styles from "@/app/account.module.css";

export function PublicShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const pathname = usePathname();
  // Opens by itself on /dashboard; a manual open/close applies only to the route where it happened.
  const [gateChoice, setGateChoice] = useState<{ path: string; open: boolean } | null>(null);
  const gateOpen = gateChoice?.path === pathname ? gateChoice.open : pathname === "/dashboard";
  const setGateOpen = (open: boolean) => setGateChoice({ path: pathname, open });

  if (!ready) return null;
  if (user) return <PrivateShell>{children}</PrivateShell>;

  return (
    <div className={styles.publicFrame}>
      <aside className={styles.publicSidebar}>
        <Link className={styles.headerBrand} href="/" aria-label="Landing IA, inicio">Landing IA</Link>
        <nav className={styles.publicNav} aria-label="Navegación principal">
          <Link className={styles.sidebarLink} href="/" title="Nuevo proyecto" aria-current={pathname === "/" ? "page" : undefined}><Plus aria-hidden="true" /><span>Nuevo proyecto</span></Link>
          <button className={styles.sidebarLink} type="button" title="Panel de proyectos" onClick={() => setGateOpen(true)}><Folder aria-hidden="true" /><span>Panel de proyectos</span></button>
        </nav>
        <Link className={styles.signInLink} href="/login" title="Iniciar sesión">
          <span>Iniciar sesión</span>
        </Link>
      </aside>
      <div className={styles.publicMain}>
        {children}
        {gateOpen && <AccountGate onClose={() => setGateOpen(false)} />}
      </div>
    </div>
  );
}
