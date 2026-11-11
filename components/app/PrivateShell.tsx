"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleUserRound, Folder, LogOut, PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { listProjects, type StoredProject } from "@/lib/store";
import styles from "@/app/account.module.css";

export function PrivateShell({ children }: { children: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const [projects, setProjects] = useState<StoredProject[]>([]);

  useEffect(() => {
    if (ready && !user) router.replace("/");
  }, [ready, user, router]);

  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem("lpg:sidebar-collapsed") === "true");
    setSidebarPreferenceReady(true);
  }, []);

  useEffect(() => {
    if (sidebarPreferenceReady) window.localStorage.setItem("lpg:sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed, sidebarPreferenceReady]);

  useEffect(() => {
    setProjects(listProjects());
  }, [pathname]);

  function projectTitle(project: StoredProject) {
    return project.name || (project.brief.hasBusinessName ? project.brief.businessName : project.brief.whatTheyDo);
  }

  if (!ready || !user) return null;

  return (
    <div className={styles.appFrame}>
      <aside className={`${styles.appSidebar} ${sidebarCollapsed ? styles.appSidebarCollapsed : ""}`}>
        <div className={styles.sidebarTop}>
          <Link className={styles.headerBrand} href="/dashboard" aria-label="LPG, panel principal" aria-hidden={sidebarCollapsed} tabIndex={sidebarCollapsed ? -1 : undefined}>LPG</Link>
          <button className={styles.sidebarCollapseButton} type="button" aria-label={sidebarCollapsed ? "Abrir barra lateral" : "Contraer barra lateral"} title={sidebarCollapsed ? "Abrir barra lateral" : "Contraer barra lateral"} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
            {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </button>
        </div>
        <nav className={styles.sidebarNav} aria-label="Navegación de la cuenta" aria-hidden={sidebarCollapsed} inert={sidebarCollapsed}>
          <Link className={styles.sidebarLink} href="/" aria-current={pathname === "/" ? "page" : undefined}><Plus aria-hidden="true" /><span>Nuevo proyecto</span></Link>
          <div className={styles.sidebarProjects}>
            <Link
              className={styles.sidebarLink}
              href="/dashboard"
              title="Proyectos"
              aria-current={pathname === "/dashboard" || pathname.startsWith("/project/") ? "page" : undefined}
            >
              <Folder aria-hidden="true" />
              <span>Proyectos</span>
            </Link>
            <div className={styles.sidebarProjectList} aria-label="Lista de proyectos">
              {projects.length ? projects.map((project) => {
                const title = projectTitle(project);
                return <Link className={styles.sidebarProjectLink} key={project.id} href={`/project/${project.id}`} title={title} aria-current={pathname === `/project/${project.id}` ? "page" : undefined}>{title}</Link>;
              }) : <span className={styles.sidebarProjectsEmpty}>Sin proyectos</span>}
            </div>
          </div>
        </nav>
        <div className={styles.sidebarBottom}>
          <Link className={styles.sidebarProfile} href="/profile" title="Perfil y cuenta" aria-current={pathname === "/profile" ? "page" : undefined}>
            <CircleUserRound aria-hidden="true" />
            <span>{user.name}</span>
          </Link>
          <button className={styles.sidebarLogout} type="button" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => { signOut(); router.replace("/"); }}>
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </aside>
      <div className={styles.appMain}>{children}</div>
    </div>
  );
}
