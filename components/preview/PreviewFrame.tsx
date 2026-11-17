"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { SectionOverlay } from "./SectionOverlay";
import { SectionSkeleton, type PageTheme } from "./ThemeToggle";
import { VIEWPORTS, type ViewportKey } from "./ViewportToggle";
import { PageModeProvider } from "@/components/sections/PageMode";
import { SectionRenderer } from "@/components/sections/SectionRenderer";
import type { BusinessBrief } from "@/lib/schemas/brief";
import type { SectionType } from "@/lib/schemas/primitives";
import type { Section } from "@/lib/schemas/section";
import { themeFor } from "@/lib/styles/landingStyles";
import { pageScopeVars } from "@/lib/theme/typography";
import styles from "@/app/project/workspace.module.css";

export type PreviewSlot =
  | { type: SectionType; state: "pending" }
  | { type: SectionType; state: "done"; section: Section; busy?: boolean; photoBusy?: boolean };

export type PreviewControls = {
  theme: PageTheme;
  viewport: ViewportKey;
  setViewport: (viewport: ViewportKey) => void;
  switchTheme: (theme: PageTheme, origin: { x: number; y: number }) => void;
};

/**
 * The frame sets an explicit width and is a CSS container, so sections respond
 * to the frame, not the browser. Variants use @container utilities only.
 * Theme lives on data-theme here; the tool chrome is untouched by it.
 */
export function PreviewFrame({
  brief,
  slots,
  accentColor,
  onEdit,
  onTextChange,
  onVariant,
  onPhotoUpload,
  onPhotoRemove,
  renderToolbar,
}: {
  brief: BusinessBrief;
  slots: PreviewSlot[];
  accentColor: string;
  onEdit: (index: number, request: string, target?: string) => void;
  onTextChange: (index: number, section: Section) => void;
  onVariant: (index: number, variant: string) => void;
  onPhotoUpload: (index: number, file: File) => void;
  onPhotoRemove: (index: number) => void;
  renderToolbar: (controls: PreviewControls) => ReactNode;
}) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  // A picked landing style decides light or dark; otherwise follow the device.
  const styleTheme = themeFor(brief);
  const [theme, setTheme] = useState<PageTheme>(styleTheme ?? "light");
  const [themeSelectedManually, setThemeSelectedManually] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const scopeId = useId();

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    const updateFromDevice = () => {
      if (!themeSelectedManually && !styleTheme) setTheme(preference.matches ? "dark" : "light");
    };
    updateFromDevice();
    preference.addEventListener("change", updateFromDevice);
    return () => preference.removeEventListener("change", updateFromDevice);
  }, [themeSelectedManually, styleTheme]);

  const first = slots.find((s): s is Extract<PreviewSlot, { state: "done" }> => s.state === "done");
  const motion = first?.section.style.motion ?? "balanced";

  function switchTheme(next: PageTheme, origin: { x: number; y: number }) {
    const el = document.getElementById(scopeId);
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sweep-x", `${((origin.x - r.left) / r.width) * 100}%`);
      el.style.setProperty("--sweep-y", `${((origin.y - r.top) / r.height) * 100}%`);
    }
    setSweeping(true);
    setThemeSelectedManually(true);
    setTheme(next);
    window.setTimeout(() => setSweeping(false), 950);
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.editorHeader}>
        {renderToolbar({ theme, viewport, setViewport, switchTheme })}
      </header>

      <section className={styles.previewColumn} aria-label="Vista previa del sitio">
        <div className={styles.previewSurface}>
          <div
            id={scopeId}
            className="page-scope mx-auto overflow-hidden rounded-xl"
            data-theme={theme}
            data-sweeping={sweeping ? "true" : undefined}
            style={{ width: VIEWPORTS[viewport], maxWidth: "100%", transition: "width 320ms cubic-bezier(0.2,0,0,1)", "--accent": accentColor, ...pageScopeVars(brief, motion) } as React.CSSProperties}
          >
            {slots.map((slot, i) =>
              slot.state === "pending" ? (
                <SectionSkeleton key={`${slot.type}-${i}`} type={slot.type} />
              ) : (
                <div key={slot.section.id} className="group relative">
                  <PageModeProvider
                    value={{
                      editing: true,
                      image: {
                        photo: slot.section.style.photo,
                        busy: Boolean(slot.photoBusy),
                        onUpload: (file) => onPhotoUpload(i, file),
                        onRemove: () => onPhotoRemove(i),
                      },
                    }}
                  >
                    <SectionRenderer section={slot.section} accentOverride={accentColor} />
                  </PageModeProvider>
                  <SectionOverlay
                    section={slot.section}
                    theme={theme}
                    busy={Boolean(slot.busy)}
                    onEdit={(request, target) => onEdit(i, request, target)}
                    onTextChange={(section) => onTextChange(i, section)}
                    onVariant={(variant) => onVariant(i, variant)}
                  />
                </div>
              ),
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
