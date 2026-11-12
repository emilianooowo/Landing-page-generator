"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { loadProject, type StoredProject } from "@/lib/store";
import { accentFor, themeFor } from "@/lib/styles/landingStyles";
import { pageScopeVars } from "@/lib/theme/typography";
import styles from "./site.module.css";

export default function PublicSitePage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<StoredProject | null | undefined>(undefined);
  const scopeRef = useRef<HTMLDivElement>(null);
  const motion = project?.sections[0]?.style.motion ?? "balanced";
  const accent = project ? accentFor(project.brief) : "#315d88";

  useEffect(() => setProject(loadProject(id)), [id]);

  useEffect(() => {
    const element = scopeRef.current;
    if (!element) return;
    const updateTitle = () => {
      if (!project) return;
      document.title = project.brief.hasBusinessName && project.brief.businessName
        ? `${project.brief.businessName} | Landing IA`
        : `${project.brief.whatTheyDo} | Landing IA`;
    };
    updateTitle();
    return () => { document.title = "Landing IA"; };
  }, [project]);

  if (project === undefined) return <main className={styles.loading} aria-busy="true" />;
  if (!project) return <main className={styles.missing}>No encontramos esta página en la cuenta activa de este navegador.</main>;

  return (
    <main className="page-scope" data-theme={themeFor(project.brief) ?? "light"} ref={scopeRef} style={{ width: "100%", "--accent": accent, ...pageScopeVars(project.brief, motion) } as React.CSSProperties}>
      {project.sections.map((section) => (
        <SectionRenderer key={section.id} section={section} accentOverride={accent} />
      ))}
    </main>
  );
}
