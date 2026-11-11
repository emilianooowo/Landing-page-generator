"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Check, ExternalLink, FilePenLine, FilePlus2, Pencil, Trash2, X } from "lucide-react";
import { PrivateShell } from "@/components/app/PrivateShell";
import { deleteProject, listProjects, saveProject, type StoredProject } from "@/lib/store";
import styles from "../account.module.css";

function projectTitle(project: StoredProject) {
  return project.name || (project.brief.hasBusinessName ? project.brief.businessName : project.brief.whatTheyDo);
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => setProjects(listProjects()), []);

  function remove(id: string) {
    if (!window.confirm("¿Eliminar este proyecto? Esta acción no se puede deshacer.")) return;
    deleteProject(id);
    setProjects(listProjects());
  }

  function beginRename(project: StoredProject) {
    setRenaming(project.id);
    setNameDraft(projectTitle(project));
  }

  function saveName(event: FormEvent, project: StoredProject) {
    event.preventDefault();
    const next = { ...project, name: nameDraft.trim() || undefined };
    saveProject(next);
    setProjects(listProjects());
    setRenaming(null);
  }

  return (
    <PrivateShell>
      <main className={styles.content}>
        <header className={styles.contentHeader}>
          <div>
            <h1 className={styles.contentTitle}>Tus proyectos</h1>
            <p className={styles.muted}>{projects.length ? `${projects.length} página${projects.length === 1 ? "" : "s"}` : "Tus páginas, en un solo lugar."}</p>
          </div>
          <Link className={styles.primaryButton} href="/"><FilePlus2 aria-hidden="true" size={17} />Nueva página</Link>
        </header>

        {projects.length ? (
          <section className={styles.projectGrid} aria-label="Proyectos guardados">
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.id}>
                <div className={styles.cardTop}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {renaming === project.id ? (
                      <form className={styles.inlineForm} onSubmit={(event) => saveName(event, project)}>
                        <input className={styles.inlineInput} autoFocus aria-label="Nombre del proyecto" maxLength={60} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                        <button className={styles.iconButton} type="submit" title="Guardar nombre" aria-label="Guardar nombre"><Check size={16} /></button>
                        <button className={styles.iconButton} type="button" title="Cancelar" aria-label="Cancelar" onClick={() => setRenaming(null)}><X size={16} /></button>
                      </form>
                    ) : (
                      <Link className={styles.projectLink} href={`/project/${project.id}`}>{projectTitle(project)}</Link>
                    )}
                    <p className={styles.projectDescription}>{project.brief.whatTheyDo}</p>
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <span className={styles.cardDate}>{new Date(project.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <div className={styles.nav}>
                    <button className={styles.iconButton} type="button" aria-label="Cambiar nombre" title="Cambiar nombre" onClick={() => beginRename(project)}><Pencil size={16} /></button>
                    <Link className={styles.iconLink} href={`/project/${project.id}`} aria-label="Editar página" title="Editar página"><FilePenLine size={16} /></Link>
                    <a className={styles.iconLink} href={`/site/${project.id}`} target="_blank" rel="noreferrer" aria-label="Ver página en otra pestaña" title="Ver página"><ExternalLink size={16} /></a>
                    <button className={styles.iconButton} type="button" aria-label="Eliminar proyecto" title="Eliminar proyecto" onClick={() => remove(project.id)}><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className={styles.emptyState}>
            <p>Aún no tienes proyectos guardados.</p>
            <Link className={styles.primaryButton} href="/"><FilePlus2 aria-hidden="true" size={17} />Crear mi primera página</Link>
          </section>
        )}
      </main>
    </PrivateShell>
  );
}
