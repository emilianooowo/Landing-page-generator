import type { Section } from "@/lib/schemas/section";

/**
 * The individually editable text elements of a section ("Título",
 * "Producto o servicio 2", …), addressed by a dot path into `content`
 * such as "items.1.title". Shared by the editor UI (manual edits, picking a
 * target for an AI edit) and the server (applying a single-element AI edit).
 */
export type SectionElement = { label: string; path: string; maxLength: number; value: string };

type ContentRecord = Record<string, unknown>;

export function readPath(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[key];
  }, source);
}

/** Returns a copy of `source` with the string at `path` replaced. */
export function updatePath<T>(source: T, path: string, nextValue: string): T {
  const parts = path.split(".");
  const update = (node: unknown, index: number): unknown => {
    const key = parts[index];
    const clone = Array.isArray(node) ? [...node] : { ...(node as ContentRecord) };
    const record = clone as Record<string, unknown>;
    if (index === parts.length - 1) record[key] = nextValue;
    else record[key] = update(record[key], index + 1);
    return clone;
  };
  return update(source, 0) as T;
}

export function sectionElements(section: Section): SectionElement[] {
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

export function findElement(section: Section, path: string): SectionElement | undefined {
  return sectionElements(section).find((element) => element.path === path);
}
