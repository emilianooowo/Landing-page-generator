import type { Vibe } from "@/lib/schemas/brief";
import type { SectionType } from "@/lib/schemas/primitives";

/**
 * Metadata only — no components yet. The prompt builder uses `guidance` so the
 * model can pick a layout; the thumbnail chooser uses `label`. Variant ids never
 * reach the user's screen.
 *
 * When the variant library lands, registry.ts maps id → component and imports
 * this file for the labels, so there's one source of truth for what exists.
 */
export type VariantMeta = {
  id: string;
  /** Shown under the animated thumbnail. Plain language, sentence case. */
  label: string;
  /** One line telling the model when this layout is the right call. */
  guidance: string;
  vibes: Vibe[];
  /** Content slots this layout needs — mirrors the zod refinements, for the prompt. */
  needs?: string[];
};

export const VARIANT_CATALOG: Record<SectionType, VariantMeta[]> = {
  hero: [
    {
      id: "aurora-veil",
      label: "Propuesta centrada",
      guidance: "Mensaje principal centrado y con espacio amplio. Úsalo cuando la oferta se entiende mejor con una frase breve y no necesita imagen protagonista.",
      vibes: ["calm", "premium", "minimal"],
    },
    {
      id: "floating-glass-split",
      label: "Portada fotográfica",
      guidance: "Hero editorial de altura amplia con fotografía a sangre, titular y acción sobre una capa de contraste para mantener legibilidad. Úsalo cuando una imagen del producto, espacio o servicio sea parte central de la primera impresión.",
      vibes: ["bold", "warm", "playful"],
      needs: ["image"],
    },
    {
      id: "spotlight-monolith",
      label: "Mensaje de alto contraste",
      guidance: "Composición de texto compacta con fondo contrastante y datos de confianza al pie. Úsalo cuando el argumento y la credibilidad sean más importantes que una fotografía.",
      vibes: ["technical", "premium", "minimal"],
    },
    {
      id: "orbital-stack",
      label: "Pruebas a un lado",
      guidance: "Propuesta a la izquierda y lista breve de datos a la derecha. Úsalo solo si hay cifras o hechos comprobables que respalden la oferta.",
      vibes: ["bold", "technical"],
      needs: ["proofPoints"],
    },
  ],
  features: [
    {
      id: "glass-grid",
      label: "Lista clara",
      guidance: "Beneficios en dos columnas abiertas, con títulos, descripciones y numeración discreta. Úsalo cuando todos los puntos tengan una importancia similar.",
      vibes: ["calm", "minimal", "technical"],
    },
    {
      id: "depth-bento",
      label: "Un beneficio destacado",
      guidance: "Fotografía junto al beneficio principal y una lista breve de los demás. Úsalo cuando un producto o servicio central merezca más atención.",
      vibes: ["bold", "premium"],
      needs: ["image"],
    },
    {
      id: "floating-column",
      label: "Columna de beneficios",
      guidance: "Título en una columna y beneficios descritos en filas verticales. Úsala cuando haya varios detalles que convenga leer uno por uno.",
      vibes: ["warm", "calm"],
    },
    {
      id: "orbit-ring",
      label: "Resumen por columnas",
      guidance: "Encabezado junto a un resumen en columnas, con una línea visual que guía la lectura. Úsalo para presentar una oferta diversa de un vistazo.",
      vibes: ["playful", "warm"],
    },
  ],
  testimonials: [
    {
      id: "glass-carousel",
      label: "Una opinión a la vez",
      guidance: "Presenta una opinión legible con controles anterior y siguiente; no avanza sola. Úsalo cuando haya varias opiniones reales y se quiera destacar una por turno.",
      vibes: ["calm", "premium", "technical"],
    },
    {
      id: "floating-cards",
      label: "Opiniones en paralelo",
      guidance: "Varias opiniones en una lista abierta de dos columnas, sin tarjetas decorativas. Úsalo para comparar experiencias de clientes reales.",
      vibes: ["playful", "warm", "bold"],
    },
    {
      id: "single-spotlight",
      label: "Una cita destacada",
      guidance: "Una opinión ocupa el espacio principal con su autoría visible. Úsala cuando solo haya una opinión real que valga la pena mostrar.",
      vibes: ["premium", "minimal", "calm"],
    },
    {
      id: "depth-marquee",
      label: "Una opinión y otras voces",
      guidance: "Una opinión principal acompañada de otras citas más breves, todas quietas y legibles. Úsalo cuando haya varias opiniones reales que apoyen el mismo punto.",
      vibes: ["bold", "playful"],
    },
  ],
  cta: [
    {
      id: "glow-band",
      label: "Acción junto al mensaje",
      guidance: "Mensaje alineado con la acción y una separación de color sencilla. Úsalo para cerrar una página con un siguiente paso claro.",
      vibes: ["bold", "playful"],
    },
    {
      id: "glass-monolith",
      label: "Cierre compacto",
      guidance: "Mensaje y acción en dos columnas separadas por una regla. Úsalo cuando la persona necesite una última aclaración antes de actuar.",
      vibes: ["premium", "calm", "minimal"],
    },
    {
      id: "split-orbital",
      label: "Texto e imagen",
      guidance: "Invitación junto a una fotografía amplia y relevante. Úsalo cuando ver el producto o espacio ayude a concretar la acción.",
      vibes: ["warm", "bold"],
      needs: ["image"],
    },
    {
      id: "aurora-wave",
      label: "Invitación centrada",
      guidance: "Texto centrado sobre un fondo suavemente teñido con el color de marca. Úsala para un cierre breve con una sola idea y una acción.",
      vibes: ["calm", "warm", "technical"],
      needs: ["subheadline"],
    },
  ],
};

/**
 * Compact list for prompts: `id — guidance (needs: x)`. With `only`, lists just
 * those ids (in that order) — used to keep a picked landing style coherent.
 */
export function describeVariants(type: SectionType, only?: string[]): string {
  const all = VARIANT_CATALOG[type];
  const picked = only?.length
    ? only.map((id) => all.find((v) => v.id === id)).filter((v): v is VariantMeta => Boolean(v))
    : all;
  return (picked.length ? picked : all)
    .map((v) => `- ${v.id} — ${v.guidance}${v.needs ? ` (requiere: ${v.needs.join(", ")})` : ""}`)
    .join("\n");
}
