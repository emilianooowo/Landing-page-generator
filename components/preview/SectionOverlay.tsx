"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { SectionChooser } from "@/components/chooser/SectionChooser";
import type { Section } from "@/lib/schemas/section";
import { buildHref, LINK_KINDS, parseHref, type LinkKind } from "@/lib/links";
import { sectionElements, updatePath, type SectionElement } from "@/lib/sections/elements";
import type { PageTheme } from "./ThemeToggle";

const PART_NAME: Record<Section["type"], string> = {
  hero: "la sección principal",
  features: "tus productos y servicios",
  testimonials: "las opiniones de tus clientes",
  cta: "el cierre de la página",
};

const SECTION_SUGGESTIONS: Record<Section["type"], string[]> = {
  hero: ["Haz el título más corto", "Dale un tono más cercano", "Hazlo más convincente", "Cambia el texto del botón"],
  features: ["Detalla mejor cada punto", "Agrega otro punto", "Usa un tono menos vendedor"],
  testimonials: ["Acorta las opiniones", "Dales un tono más casual"],
  cta: ["Hazlo más relajado", "Cambia el texto del botón", "Agrega una frase que dé confianza"],
};

/** For a single element, the most useful request is simply "another take". */
const ELEMENT_SUGGESTIONS = ["Dame otra opción", "Hazlo más corto", "Más cercano", "Más formal"];

const WHOLE_SECTION = "";

const fieldStyle = {
  width: "100%",
  resize: "vertical",
  border: "1px solid var(--page-border)",
  borderRadius: "0.75rem",
  padding: "0.75rem",
  outlineColor: "var(--accent)",
  background: "var(--page-bg)",
  color: "var(--page-text)",
} as const;

function preview(value: string, max = 34): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

/**
 * Sits over a rendered section. On hover, shows one button. Clicking opens a
 * panel to edit the text by hand or with AI — for the whole section or for one
 * element of it (a title, a button, the second product…) — plus the layout
 * chooser. No section names, no variant ids; everything is phrased as the part
 * of the page the person is looking at.
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
  onEdit: (request: string, target?: string) => void;
  onTextChange: (section: Section) => void;
  onVariant: (variant: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"text" | "ai">("text");
  const [target, setTarget] = useState(WHOLE_SECTION);

  const elements = sectionElements(section);
  // A whole-section edit can remove the element that was selected (e.g. a product).
  const activeElement = elements.find((element) => element.path === target);

  function submit(request: string) {
    if (!request.trim() || busy) return;
    setText("");
    if (activeElement) {
      // Stay open: iterating on one element means asking again and comparing.
      onEdit(request.trim(), activeElement.path);
    } else {
      setOpen(false);
      onEdit(request.trim());
    }
  }

  function askAiFor(element: SectionElement) {
    setTarget(element.path);
    setMode("ai");
  }

  const busyLabel = activeElement ? `“${activeElement.label}”` : PART_NAME[section.type];

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-40">
        <div
          className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{ boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--tool-accent) 60%, transparent)" }}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={busy}
          className="tool-button pointer-events-auto absolute right-3 top-3 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
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
          <div className="glass px-4 py-2 text-sm" style={{ color: "var(--page-muted)" }}>Actualizando {busyLabel}…</div>
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
              <SectionTextFields section={section} elements={elements} onChange={onTextChange} onAskAi={askAiFor} />
            ) : (
              <>
                <label className="mb-3 grid gap-1 text-xs" style={{ color: "var(--page-muted)" }}>
                  ¿Qué quieres cambiar?
                  <select
                    value={activeElement ? activeElement.path : WHOLE_SECTION}
                    onChange={(event) => setTarget(event.target.value)}
                    disabled={busy}
                    style={{ ...fieldStyle, padding: "0.55rem 0.7rem", fontSize: "0.85rem" }}
                  >
                    <option value={WHOLE_SECTION}>Toda la sección</option>
                    {elements.map((element) => (
                      <option key={element.path} value={element.path}>
                        {element.label}: {preview(element.value)}
                      </option>
                    ))}
                  </select>
                </label>

                {activeElement && (
                  <div className="mb-3 grid gap-1 text-xs" style={{ color: "var(--page-muted)" }}>
                    Texto actual
                    <p
                      aria-live="polite"
                      style={{ border: "1px dashed var(--page-border)", borderRadius: "0.65rem", padding: "0.6rem 0.7rem", color: "var(--page-text)", fontSize: "0.85rem", opacity: busy ? 0.5 : 1 }}
                    >
                      {activeElement.value}
                    </p>
                  </div>
                )}

                <p className="mb-2 text-xs" style={{ color: "var(--page-muted)" }}>
                  {activeElement
                    ? `¿Cómo quieres cambiar “${activeElement.label}”?`
                    : `¿Qué te gustaría cambiar de ${PART_NAME[section.type]}?`}
                </p>
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
                  style={fieldStyle}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {(activeElement ? ELEMENT_SUGGESTIONS : SECTION_SUGGESTIONS[section.type]).map((s) => (
                    <button key={s} type="button" className="tool-button" disabled={busy} onClick={() => submit(s)}>{s}</button>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button type="button" className="tool-button primary" onClick={() => submit(text)} disabled={!text.trim() || busy}>
                    {busy ? "Actualizando…" : "Actualizar con IA"}
                  </button>
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

function SectionTextFields({
  section,
  elements,
  onChange,
  onAskAi,
}: {
  section: Section;
  elements: SectionElement[];
  onChange: (section: Section) => void;
  onAskAi: (element: SectionElement) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  return (
    <div className="grid max-h-[52vh] gap-3 overflow-y-auto pr-1">
      {elements.map((entry) => {
        const value = drafts[entry.path] ?? entry.value;
        return (
          <div className="grid gap-1 text-xs" key={entry.path} style={{ color: "var(--page-muted)" }}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={`${section.id}-${entry.path}`}>{entry.label}</label>
              <button
                type="button"
                className="tool-button"
                style={{ padding: "0.15rem 0.5rem", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                title={`Cambiar “${entry.label}” con IA`}
                aria-label={`Cambiar “${entry.label}” con IA`}
                onClick={() => onAskAi(entry)}
              >
                <Sparkles size={12} aria-hidden="true" /> IA
              </button>
            </div>
            <textarea
              id={`${section.id}-${entry.path}`}
              rows={value.length > 62 ? 3 : 1}
              maxLength={entry.maxLength}
              value={value}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDrafts((current) => ({ ...current, [entry.path]: nextValue }));
                if (nextValue.trim()) onChange({ ...section, content: updatePath(section.content, entry.path, nextValue) } as Section);
              }}
              onBlur={() => {
                if (!value.trim()) setDrafts((current) => {
                  const next = { ...current };
                  delete next[entry.path];
                  return next;
                });
              }}
              style={{ ...fieldStyle, borderRadius: "0.65rem", padding: "0.6rem 0.7rem", fontSize: "0.85rem" }}
            />
            {(entry.path === "primaryCta.label" || entry.path === "secondaryCta.label") && (
              <LinkField section={section} ctaKey={entry.path === "primaryCta.label" ? "primaryCta" : "secondaryCta"} onChange={onChange} />
            )}
          </div>
        );
      })}
      <p className="text-[0.7rem]" style={{ color: "var(--page-muted)" }}>Los cambios se guardan automáticamente.</p>
    </div>
  );
}

const LINK_HINT: Record<LinkKind, string> = {
  none: "El botón no lleva a ningún lado todavía.",
  whatsapp: "Abrirá un chat de WhatsApp con ese número. Si tiene 10 dígitos, se agrega +52.",
  phone: "En el celular, iniciará una llamada a ese número. Si tiene 10 dígitos, se agrega +52.",
  email: "Abrirá el correo de la visita para escribirte.",
  url: "Abrirá esa página en una pestaña nueva.",
};

const LINK_ERROR: Record<LinkKind, string> = {
  none: "",
  whatsapp: "Escribe un número de al menos 10 dígitos.",
  phone: "Escribe un número de al menos 10 dígitos.",
  email: "Escribe un correo válido, por ejemplo nombre@ejemplo.com.",
  url: "Escribe una dirección válida, por ejemplo www.tusitio.com.",
};

/**
 * Where a button leads. Saved as soon as the value is valid; an invalid or
 * empty value keeps the previous link until it's fixed.
 */
function LinkField({
  section,
  ctaKey,
  onChange,
}: {
  section: Section;
  ctaKey: "primaryCta" | "secondaryCta";
  onChange: (section: Section) => void;
}) {
  const content = section.content as unknown as Record<string, { label: string; href: string }>;
  const cta = content[ctaKey];
  const initial = parseHref(cta?.href);
  const [kind, setKind] = useState<LinkKind>(initial.kind);
  const [value, setValue] = useState(initial.value);
  if (!cta) return null;

  const meta = LINK_KINDS.find((k) => k.kind === kind)!;
  const invalid = kind !== "none" && value.trim() !== "" && !buildHref(kind, value);

  function save(nextKind: LinkKind, nextValue: string) {
    const href = buildHref(nextKind, nextValue);
    if (!href || (nextKind !== "none" && !nextValue.trim())) return;
    onChange({ ...section, content: { ...content, [ctaKey]: { ...cta, href } } } as unknown as Section);
  }

  return (
    <div className="mt-1 grid gap-1.5 rounded-xl p-2" style={{ background: "color-mix(in srgb, var(--page-text) 4%, transparent)" }}>
      <span>Al pulsar el botón…</span>
      <div className="flex gap-2">
        <select
          value={kind}
          aria-label="Tipo de enlace del botón"
          onChange={(event) => {
            const next = event.target.value as LinkKind;
            setKind(next);
            if (next === "none") setValue("");
            save(next, next === "none" ? "" : value);
          }}
          style={{ ...fieldStyle, width: "auto", padding: "0.45rem 0.55rem", fontSize: "0.8rem", resize: undefined }}
        >
          {LINK_KINDS.map((option) => <option key={option.kind} value={option.kind}>{option.label}</option>)}
        </select>
        {kind !== "none" && (
          <input
            value={value}
            inputMode={kind === "whatsapp" || kind === "phone" ? "tel" : kind === "email" ? "email" : "url"}
            placeholder={meta.placeholder}
            aria-label={meta.label}
            aria-invalid={invalid}
            onChange={(event) => {
              setValue(event.target.value);
              save(kind, event.target.value);
            }}
            style={{ ...fieldStyle, minWidth: 0, flex: 1, padding: "0.45rem 0.6rem", fontSize: "0.8rem", borderColor: invalid ? "var(--app-danger, #a43349)" : undefined }}
          />
        )}
      </div>
      <span style={{ color: invalid ? "var(--app-danger, #a43349)" : undefined }}>{invalid ? LINK_ERROR[kind] : LINK_HINT[kind]}</span>
    </div>
  );
}
