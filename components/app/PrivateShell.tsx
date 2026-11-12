"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, CircleUserRound, ExternalLink, FilePenLine, Folder, LogOut, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteProject, listProjects, saveProject, type StoredProject } from "@/lib/store";
import styles from "@/app/account.module.css";

export function PrivateShell({ children }: { children: ReactNode }) {
  const { user, ready, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceReady, setSidebarPreferenceReady] = useState(false);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [contextMenu, setContextMenu] = useState<{ projectId: string; left: number; top: number } | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

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

  useEffect(() => {
    if (!contextMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [contextMenu]);

  function projectTitle(project: StoredProject) {
    return project.name || (project.brief.hasBusinessName ? project.brief.businessName : project.brief.whatTheyDo);
  }

  function beginRename(project: StoredProject) {
    setRenamingProjectId(project.id);
    setNameDraft(projectTitle(project));
    setContextMenu(null);
  }

  function saveName(event: FormEvent, project: StoredProject) {
    event.preventDefault();
    saveProject({ ...project, name: nameDraft.trim() || undefined });
    setProjects(listProjects());
    setRenamingProjectId(null);
  }

  function removeProject(project: StoredProject) {
    if (!window.confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    deleteProject(project.id);
    setProjects(listProjects());
    setContextMenu(null);
    if (pathname === `/project/${project.id}`) router.replace("/dashboard");
  }

  const contextProject = contextMenu ? projects.find((project) => project.id === contextMenu.projectId) : null;

  if (!ready || !user) return null;

  return (
    <div className={styles.appFrame} onClick={() => setContextMenu(null)}>
      <aside className={`${styles.appSidebar} ${sidebarCollapsed ? styles.appSidebarCollapsed : ""}`}>
        <div className={styles.sidebarTop}>
          <Link className={styles.headerBrand} href="/" aria-label="LPG, nuevo proyecto" aria-hidden={sidebarCollapsed} tabIndex={sidebarCollapsed ? -1 : undefined}>LPG</Link>
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
              title="Panel de proyectos"
              aria-current={pathname === "/dashboard" || pathname.startsWith("/project/") ? "page" : undefined}
            >
              <Folder aria-hidden="true" />
              <span>Panel de proyectos</span>
            </Link>
            <div className={styles.sidebarProjectList} aria-label="Lista de proyectos">
              {projects.length ? projects.map((project) => {
                const title = projectTitle(project);
                return (
                  <div className={styles.sidebarProjectItem} key={project.id} onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({
                      projectId: project.id,
                      left: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)),
                      top: Math.max(8, Math.min(event.clientY, window.innerHeight - 194)),
                    });
                  }}>
                    {renamingProjectId === project.id ? (
                      <form className={styles.sidebarRenameForm} onSubmit={(event) => saveName(event, project)}>
                        <input className={styles.sidebarRenameInput} autoFocus aria-label="Nombre del proyecto" maxLength={60} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                        <button className={styles.sidebarAction} type="submit" aria-label="Guardar nombre" title="Guardar nombre"><Check size={15} /></button>
                        <button className={styles.sidebarAction} type="button" aria-label="Cancelar" title="Cancelar" onClick={() => setRenamingProjectId(null)}><X size={15} /></button>
                      </form>
                    ) : (
                      <Link className={styles.sidebarProjectLink} href={`/project/${project.id}`} title={`${title} · Clic derecho para opciones`} aria-current={pathname === `/project/${project.id}` ? "page" : undefined}>{title}</Link>
                    )}
                  </div>
                );
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
      {contextMenu && contextProject && (
        <div className={styles.projectContextMenu} style={{ left: contextMenu.left, top: contextMenu.top }} role="menu" aria-label={`Opciones de ${projectTitle(contextProject)}`} onClick={(event) => event.stopPropagation()}>
          <button className={styles.contextMenuItem} type="button" role="menuitem" onClick={() => beginRename(contextProject)}><Pencil aria-hidden="true" size={16} /><span>Renombrar</span></button>
          <Link className={styles.contextMenuItem} href={`/project/${contextProject.id}`} role="menuitem" onClick={() => setContextMenu(null)}><FilePenLine aria-hidden="true" size={16} /><span>Editar página</span></Link>
          <a className={styles.contextMenuItem} href={`/site/${contextProject.id}`} target="_blank" rel="noreferrer" role="menuitem" onClick={() => setContextMenu(null)}><ExternalLink aria-hidden="true" size={16} /><span>Ver vista previa</span></a>
          <button className={`${styles.contextMenuItem} ${styles.contextMenuDanger}`} type="button" role="menuitem" onClick={() => removeProject(contextProject)}><Trash2 aria-hidden="true" size={16} /><span>Eliminar</span></button>
        </div>
      )}
      <div className={styles.appMain}>{children}</div>
    </div>
  );
}
