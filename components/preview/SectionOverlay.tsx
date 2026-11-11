"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { SectionChooser } from "@/components/chooser/SectionChooser";
import type { Section } from "@/lib/schemas/section";
import type { PageTheme } from "./ThemeToggle";

const PART_NAME: Record<Section["type"], string> = {
  hero: "la sección principal",
  features: "tus productos y servicios",
  testimonials: "las opiniones de tus clientes",
  cta: "el cierre de la página",
};

const SUGGESTIONS: Record<Section["type"], string[]> = {
  hero: ["Haz el título más corto", "Dale un tono más cercano", "Hazlo más convincente", "Cambia el texto del botón"],
  features: ["Detalla mejor cada punto", "Agrega otro punto", "Usa un tono menos vendedor"],
  testimonials: ["Acorta las opiniones", "Dales un tono más casual"],
  cta: ["Hazlo más relajado", "Cambia el texto del botón", "Agrega una frase que dé confianza"],
};

/**
 * Sits over a rendered section. On hover, shows one button. Clicking opens a
 * panel with a free-text box and a few suggestions, plus the layout chooser.
 * No section names, no variant ids; everything is phrased as the part of the
 * page the person is looking at.
 */
export function SectionOverlay({
  section,
  theme,
  busy,
  onEdit,
  onTextChange,
  onVariant,
}: {
  section: Section;
  theme: PageTheme;
  busy: boolean;
  onEdit: (request: string) => void;
  onTextChange: (section: Section) => void;
  onVariant: (variant: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"text" | "ai">("text");

  function submit(request: string) {
    if (!request.trim()) return;
    setOpen(false);
    setText("");
    onEdit(request.trim());
  }

  return (
    <>
      <div className="group pointer-events-none absolute inset-0 z-40">
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--tool-accent) 60%, transparent)" }}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className="tool-button pointer-events-auto absolute right-3 top-3 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100"
          style={{ background: "var(--tool-bg)" }}
        >
          Editar {PART_NAME[section.type]}
        </button>
      </div>

      {busy && (
        <div
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center"
          style={{ background: "color-mix(in srgb, var(--page-bg) 70%, transparent)", backdropFilter: "blur(4px)" }}
        >
          <div className="glass px-4 py-2 text-sm" style={{ color: "var(--page-muted)" }}>Actualizando {PART_NAME[section.type]}…</div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-x-3 top-3 z-50 @2xl:left-auto @2xl:w-[26rem]"
            style={{ maxHeight: "calc(100% - 1.5rem)", overflowY: "auto", background: "var(--page-surface)", border: "1px solid var(--page-border)", borderRadius: "0.9rem", color: "var(--page-text)", padding: "1rem", boxShadow: "0 18px 44px -28px rgba(29, 19, 23, 0.42)" }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">Editar {PART_NAME[section.type]}</span>
              <button type="button" className="tool-button" onClick={() => setOpen(false)} aria-label="Cerrar">×</button>
            </div>
            <div className="mb-3 flex gap-2">
              <button type="button" className="tool-button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Texto</button>
              <button type="button" className="tool-button" aria-pressed={mode === "ai"} onClick={() => setMode("ai")}>Con IA</button>
            </div>

            {mode === "text" ? (
              <SectionTextFields section={section} onChange={onTextChange} />
            ) : (
              <>
                <p className="mb-2 text-xs" style={{ color: "var(--page-muted)" }}>¿Qué te gustaría cambiar de {PART_NAME[section.type]}?</p>
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Descríbelo con tus palabras…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(text);
                    }
                  }}
                  style={{ width: "100%", resize: "vertical", border: "1px solid var(--page-border)", borderRadius: "0.75rem", padding: "0.75rem", outlineColor: "var(--accent)", background: "var(--page-bg)", color: "var(--page-text)" }}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS[section.type].map((s) => (
                    <button key={s} type="button" className="tool-button" onClick={() => submit(s)}>{s}</button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" className="tool-button primary" onClick={() => submit(text)} disabled={!text.trim() || busy}>Actualizar con IA</button>
                </div>
              </>
            )}

            <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--tool-border)" }}>
              <div className="mb-2 text-sm" style={{ color: "var(--tool-muted)" }}>O elige otro diseño</div>
              <SectionChooser section={section} theme={theme} onPick={(v) => { setOpen(false); onVariant(v); }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

type TextEntry = { label: string; path: string; maxLength: number; value: string };
type ContentRecord = Record<string, unknown>;

function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

function textEntries(section: Section): TextEntry[] {
  const content = section.content as unknown as ContentRecord;
  const entries: { label: string; path: string; maxLength: number }[] = [];
  const add = (label: string, path: string, maxLength: number) => {
    if (typeof readPath(content, path) === "string") entries.push({ label, path, maxLength });
  };
  add("Título", "headline", section.type === "hero" ? 70 : 60);
  add("Descripción", "subheadline", section.type === "cta" ? 140 : 160);

  if (section.type === "hero" || section.type === "cta") {
    add("Texto del botón", "primaryCta.label", 28);
    add("Texto del segundo botón", "secondaryCta.label", 28);
  }
  if (section.type === "hero") {
    add("Texto breve superior", "kicker", 40);
    const proofPoints = content.proofPoints as { value: string; label: string }[] | undefined;
    proofPoints?.forEach((_, index) => {
      add(`Dato ${index + 1}`, `proofPoints.${index}.value`, 12);
      add(`Descripción del dato ${index + 1}`, `proofPoints.${index}.label`, 28);
    });
  }
  if (section.type === "cta") add("Frase de confianza", "reassurance", 48);

  if (section.type === "features") {
    (content.items as { title: string; body: string }[]).forEach((_, index) => {
      add(`Producto o servicio ${index + 1}`, `items.${index}.title`, 40);
      add(`Descripción ${index + 1}`, `items.${index}.body`, 140);
    });
  }
  if (section.type === "testimonials") {
    (content.items as { quote: string; name: string; role?: string }[]).forEach((_, index) => {
      add(`Opinión ${index + 1}`, `items.${index}.quote`, 220);
      add(`Nombre ${index + 1}`, `items.${index}.name`, 40);
      add(`Contexto ${index + 1}`, `items.${index}.role`, 60);
    });
  }

  return entries.map((entry) => ({ ...entry, value: readPath(content, entry.path) as string }));
}

function updatePath(source: ContentRecord, path: string, nextValue: string): ContentRecord {
  const parts = path.split(".");
  const update = (node: unknown, index: number): unknown => {
    const key = parts[index];
    const clone = Array.isArray(node) ? [...node] : { ...(node as ContentRecord) };
    const record = clone as Record<string, unknown>;
    if (index === parts.length - 1) record[key] = nextValue;
    else record[key] = update(record[key], index + 1);
    return clone;
  };
  return update(source, 0) as ContentRecord;
}

function SectionTextFields({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const content = section.content as unknown as ContentRecord;
  const entries = textEntries(section);

  return (
    <div className="grid max-h-[52vh] gap-3 overflow-y-auto pr-1">
      {entries.map((entry) => {
        const value = drafts[entry.path] ?? entry.value;
        return (
          <label className="grid gap-1 text-xs" key={entry.path} style={{ color: "var(--page-muted)" }}>
            {entry.label}
            <textarea
              rows={value.length > 62 ? 3 : 1}
              maxLength={entry.maxLength}
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDrafts((current) => ({ ...current, [entry.path]: nextValue }));
                if (nextValue.trim()) onChange({ ...section, content: updatePath(content, entry.path, nextValue) } as Section);
              }}
              onBlur={() => {
                if (!value.trim()) setDrafts((current) => {
                  const next = { ...current };
                  delete next[entry.path];
                  return next;
                });
              }}
              style={{ width: "100%", resize: "vertical", border: "1px solid var(--page-border)", borderRadius: "0.65rem", padding: "0.6rem 0.7rem", outlineColor: "var(--accent)", background: "var(--page-bg)", color: "var(--page-text)", fontSize: "0.85rem" }}
            />
          </label>
        );
      })}
      <p className="text-[0.7rem]" style={{ color: "var(--page-muted)" }}>Los cambios se guardan automáticamente.</p>
    </div>
  );
}
