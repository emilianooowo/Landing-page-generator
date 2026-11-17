"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, ExternalLink, FilePenLine, FilePlus2, Pencil, Trash2, X } from "lucide-react";
import { PrivateShell } from "@/components/app/PrivateShell";
import { PublicShell } from "@/components/app/PublicShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteProject, discardLegacyProjects, importLegacyProjects, legacyProjectCount, listProjects, saveProject, type StoredProject } from "@/lib/store";
import styles from "../account.module.css";

function projectTitle(project: StoredProject) {
  return project.name || (project.brief.hasBusinessName ? project.brief.businessName : project.brief.whatTheyDo);
}

export default function DashboardPage() {
  const { user, ready } = useAuth();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const [legacyCount, setLegacyCount] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const canList = Boolean(user && !user.mustSetupTwoFactor && !user.mustChangePassword);

  const refresh = useCallback(() => {
    if (!canList) return;
    listProjects()
      .then((list) => {
        setProjects(list);
        setLegacyCount(legacyProjectCount());
      })
      .catch((e: unknown) => setNotice(e instanceof Error ? e.message : "No se pudieron cargar tus proyectos."));
  }, [canList]);

  useEffect(() => refresh(), [refresh]);

  async function importLegacy() {
    const imported = await importLegacyProjects();
    setNotice(imported ? `Importamos ${imported} proyecto${imported === 1 ? "" : "s"} a tu cuenta.` : "No se pudo importar ningún proyecto.");
    refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("¿Eliminar este proyecto? Podrás pedir que se recupere durante 30 días.")) return;
    await deleteProject(id).catch(() => undefined);
    refresh();
  }

  function beginRename(project: StoredProject) {
    setRenaming(project.id);
    setNameDraft(projectTitle(project));
    setDescriptionDraft(project.brief.whatTheyDo);
  }

  function saveName(event: FormEvent, project: StoredProject) {
    event.preventDefault();
    const description = descriptionDraft.trim() || project.brief.whatTheyDo;
    const next = {
      ...project,
      name: nameDraft.trim() || undefined,
      description,
      brief: { ...project.brief, whatTheyDo: description },
    };
    setRenaming(null);
    void saveProject(next).catch(() => undefined).then(refresh);
  }

  if (ready && !user) {
    return (
      <PublicShell>
        <main className={styles.content}>
          <header className={styles.contentHeader}>
            <div>
              <h1 className={styles.contentTitle}>Tus proyectos</h1>
              <p className={styles.muted}>Inicia sesión para ver y organizar tus páginas.</p>
            </div>
          </header>
        </main>
      </PublicShell>
    );
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

        {notice && <p className={styles.info} role="status">{notice}</p>}
        {legacyCount > 0 && (
          <div className={styles.notice} role="status">
            <p style={{ margin: 0 }}>Este navegador tiene {legacyCount} proyecto{legacyCount === 1 ? "" : "s"} de la versión anterior, cuando las cuentas se guardaban en el navegador. ¿Son tuyos?</p>
            <div className={styles.formActions} style={{ marginTop: 10 }}>
              <button className={styles.plainButton} type="button" onClick={() => { discardLegacyProjects(); setLegacyCount(0); }}>Descartar</button>
              <button className={styles.primaryButton} type="button" onClick={() => void importLegacy()}>Importarlos a mi cuenta</button>
            </div>
          </div>
        )}

        {projects.length ? (
          <section className={styles.projectGrid} aria-label="Proyectos guardados">
            {projects.map((project) => (
              <article className={styles.projectCard} key={project.id}>
                {renaming !== project.id && <Link className={styles.projectCardLink} href={`/project/${project.id}`} aria-label={`Abrir ${projectTitle(project)}`} />}
                <div className={styles.cardTop}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    {renaming === project.id ? (
                      <form className={styles.inlineProjectEdit} onSubmit={(event) => saveName(event, project)}>
                        <input className={styles.inlineInput} autoFocus aria-label="Nombre del proyecto" maxLength={60} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} />
                        <textarea className={styles.inlineDescription} aria-label="Descripción del proyecto" maxLength={500} rows={3} value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} />
                        <div className={styles.inlineEditActions}>
                          <button className={styles.primaryButton} type="submit"><Check aria-hidden="true" size={15} />Guardar</button>
                          <button className={styles.plainButton} type="button" onClick={() => setRenaming(null)}><X aria-hidden="true" size={15} />Cancelar</button>
                        </div>
                      </form>
                    ) : (
                      <h2 className={styles.projectLink}>{projectTitle(project)}</h2>
                    )}
                    {renaming !== project.id && <p className={styles.projectDescription}>{project.brief.whatTheyDo}</p>}
                  </div>
                </div>
                <div className={styles.cardActions}>
                  <span className={styles.cardDate}>{new Date(project.createdAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <div className={styles.nav}>
                    <button className={styles.iconButton} type="button" aria-label="Editar nombre y descripción" title="Editar proyecto" onClick={() => beginRename(project)}><Pencil size={16} /></button>
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
