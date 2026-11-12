"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Laptop, Moon, RotateCw, Smartphone, Sun, Tablet } from "lucide-react";
import { PreviewFrame, type PreviewSlot } from "@/components/preview/PreviewFrame";
import type { PageTheme } from "@/components/preview/ThemeToggle";
import { VIEWPORTS, type ViewportKey } from "@/components/preview/ViewportToggle";
import type { Section } from "@/lib/schemas/section";
import { loadProject, saveProject, type StoredProject } from "@/lib/store";
import styles from "../workspace.module.css";

async function post(url: string, body: unknown) {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new Error("No se pudo conectar con el servicio. Inténtalo de nuevo.");
  }
  let data: { error?: string; section: Section };
  try {
    data = await response.json();
  } catch {
    throw new Error("El servicio respondió con información no válida.");
  }
  if (!response.ok) throw new Error(data.error ?? "Ocurrió un error. Inténtalo de nuevo.");
  return data;
}

function normalizeHexColor(color: string): string {
  const shortHex = /^#([0-9a-f]{3})$/i.exec(color);
  return shortHex ? `#${[...shortHex[1]].map((digit) => `${digit}${digit}`).join("")}` : color;
}

const VIEWPORT_ICON: Record<ViewportKey, typeof Smartphone> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Laptop,
};

export default function Workspace() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<StoredProject | null | undefined>(undefined);
  const [slots, setSlots] = useState<PreviewSlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateWarning, setShowRegenerateWarning] = useState(false);
  const started = useRef(false);

  // Load once, then either resume from stored sections or generate them.
  useEffect(() => {
    const p = loadProject(id);
    setProject(p ?? null);
    if (!p) return;
    if (p.sections.length) {
      setSlots(p.sections.map((section) => ({ type: section.type, state: "done", section })));
    } else if (!started.current) {
      started.current = true;
      void generateAll(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function persist(p: StoredProject, sections: Section[]) {
    const next = { ...p, sections };
    saveProject(next);
    setProject(next);
  }

  async function generateAll(p: StoredProject) {
    setSlots(p.brief.sections.map((type) => ({ type, state: "pending" })));
    const done: Section[] = [];
    for (const [index, type] of p.brief.sections.entries()) {
      try {
        const result = await post("/api/generate-section", { type, brief: p.brief, projectId: p.id, sectionId: `${type}-${index}` });
        done.push(result.section);
        setSlots((current) => current.map((slot, i) => (i === index ? { type, state: "done", section: result.section } : slot)));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }
    }
    persist(loadProject(p.id) ?? p, done);
  }

  async function edit(index: number, request: string) {
    if (!project) return;
    const slot = slots[index];
    if (slot.state !== "done") return;
    setSlots((current) => current.map((s, i) => (i === index && s.state === "done" ? { ...s, busy: true } : s)));
    try {
      const result = await post("/api/edit-section", { section: slot.section, brief: project.brief, projectId: project.id, request });
      const next = slots.map((s, i) => (i === index && s.state === "done" ? { ...s, section: result.section as Section, busy: false } : s));
      setSlots(next);
      persist(project, next.filter((s): s is Extract<PreviewSlot, { state: "done" }> => s.state === "done").map((s) => s.section));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSlots((current) => current.map((s, i) => (i === index && s.state === "done" ? { ...s, busy: false } : s)));
    }
  }

  function changeVariant(index: number, variant: string) {
    if (!project) return;
    const next = slots.map((s, i) => (i === index && s.state === "done" ? { ...s, section: { ...s.section, variant } as Section } : s));
    setSlots(next);
    persist(project, next.filter((s): s is Extract<PreviewSlot, { state: "done" }> => s.state === "done").map((s) => s.section));
  }

  function changeText(index: number, section: Section) {
    if (!project) return;
    const next = slots.map((slot, i) => i === index && slot.state === "done" ? { ...slot, section } : slot);
    setSlots(next);
    persist(project, next.filter((slot): slot is Extract<PreviewSlot, { state: "done" }> => slot.state === "done").map((slot) => slot.section));
  }

  function changeAccent(color: string) {
    if (!project) return;
    const next = { ...project, brief: { ...project.brief, brandColor: color } };
    saveProject(next);
    setProject(next);
  }

  function regenerate() {
    if (!project) return;
    started.current = true;
    setError(null);
    setShowRegenerateWarning(false);
    void generateAll(project);
  }

  if (project === undefined) return null;
  if (project === null) {
    return (
        <main className="mx-auto grid min-h-screen max-w-[40rem] content-center gap-4 px-6">
          <p>Este proyecto no está disponible en la cuenta activa.</p>
          <Link className="tool-button w-fit" href="/dashboard">Volver a tus proyectos</Link>
        </main>
    );
  }

  const businessName = project.name?.trim() || (project.brief.hasBusinessName && project.brief.businessName.trim()
    ? project.brief.businessName
    : "Tu emprendimiento");
  const accentColor = normalizeHexColor(project.brief.brandColor ?? "#315d88");

  return (
    <main className={styles.workspacePage}>
      <PreviewFrame
        brief={project.brief}
        description={project.description}
        slots={slots}
        accentColor={accentColor}
        onEdit={edit}
        onTextChange={changeText}
        onVariant={changeVariant}
        renderToolbar={({ theme, viewport, setViewport, switchTheme }) => (
          <>
            <div className={styles.headerIdentity}>
              <h1 className={styles.title}>{businessName}</h1>
              <p className={styles.businessDescription}>{project.brief.whatTheyDo}</p>
            </div>

            <div className={styles.headerControls}>
              <div className={styles.headerControlGroup}>
                <span className={styles.controlLabel}>Color acento</span>
                <label className={styles.colorControl}>
                  <span>{accentColor.toUpperCase()}</span>
                  <input
                    type="color"
                    value={accentColor}
                    aria-label="Elegir color de acento para la página"
                    onChange={(event) => changeAccent(event.target.value)}
                  />
                </label>
              </div>

              <div className={styles.headerControlGroup}>
                <span className={styles.controlLabel}>Pantalla</span>
                <div className={styles.iconGroup} role="group" aria-label="Tamaño de pantalla de la vista previa">
                  {(Object.keys(VIEWPORTS) as ViewportKey[]).map((size) => {
                    const Icon = VIEWPORT_ICON[size];
                    const label = size === "mobile" ? "Celular" : size === "tablet" ? "Tableta" : "Escritorio";
                    return <button
                      key={size}
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Vista de ${label.toLocaleLowerCase("es-MX")}`}
                      title={label}
                      aria-pressed={viewport === size}
                      onClick={() => setViewport(size)}
                    ><Icon aria-hidden="true" /></button>;
                  })}
                </div>
              </div>

              <div className={styles.headerControlGroup}>
                <span className={styles.controlLabel}>Apariencia</span>
                <div className={styles.iconGroup} role="group" aria-label="Apariencia de la página">
                  {(["light", "dark"] as PageTheme[]).map((mode) => {
                    const Icon = mode === "light" ? Sun : Moon;
                    return <button
                      key={mode}
                      type="button"
                      className={styles.iconButton}
                      aria-label={`Usar modo ${mode === "light" ? "claro" : "oscuro"}`}
                      title={`Modo ${mode === "light" ? "claro" : "oscuro"}`}
                      aria-pressed={theme === mode}
                      onClick={(event) => switchTheme(mode, { x: event.clientX, y: event.clientY })}
                    ><Icon aria-hidden="true" /></button>;
                  })}
                </div>
              </div>

              <div className={styles.headerActions}>
                <a className={styles.iconButton} href={`/site/${project.id}`} target="_blank" rel="noreferrer" aria-label="Abrir la página como sitio" title="Ver vista previa">
                  <ExternalLink aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.iconButtonPrimary}`}
                  aria-label="Volver a hacer la landing"
                  title="Volver a hacer"
                  onClick={() => setShowRegenerateWarning(true)}
                ><RotateCw aria-hidden="true" /></button>
              </div>
            </div>
            {error && <p className={styles.headerError} role="alert">{error}</p>}
          </>
        )}
      />
      {showRegenerateWarning && (
        <div className={styles.warningOverlay}>
          <section className={styles.warningModal} role="dialog" aria-modal="true" aria-labelledby="regenerate-title" aria-describedby="regenerate-description">
            <h2 id="regenerate-title">¿Volver a hacer la landing?</h2>
            <p id="regenerate-description">Se regenerarán todas las secciones con la información actual del proyecto. Los textos y diseños que hayas editado en la landing podrían reemplazarse.</p>
            <div className={styles.warningActions}>
              <button className={styles.cancelButton} type="button" onClick={() => setShowRegenerateWarning(false)}>Cancelar</button>
              <button className={styles.confirmButton} type="button" onClick={regenerate}><RotateCw aria-hidden="true" size={16} />Volver a hacer</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
