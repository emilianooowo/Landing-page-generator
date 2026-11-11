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
      label: "Calmado y luminoso",
      guidance: "Texto centrado sobre un degradado que se mueve lentamente. Funciona con cualquier negocio; ideal cuando no hay una imagen protagonista.",
      vibes: ["calm", "premium", "minimal"],
    },
    {
      id: "floating-glass-split",
      label: "Enérgico y flotante",
      guidance: "Texto de un lado y una tarjeta de imagen flotante del otro. Úsalo con negocios visuales como comida, espacios o productos físicos.",
      vibes: ["bold", "warm", "playful"],
      needs: ["image"],
    },
    {
      id: "spotlight-monolith",
      label: "Directo y enfocado",
      guidance: "Un panel alto con una luz que sigue el cursor. Úsalo para servicios que destacan por la confianza y no por las imágenes.",
      vibes: ["technical", "premium", "minimal"],
    },
    {
      id: "orbital-stack",
      label: "Cifras al frente",
      guidance: "Un título con cifras alrededor. Úsalo solo cuando haya datos reales que valga la pena destacar.",
      vibes: ["bold", "technical"],
      needs: ["proofPoints"],
    },
  ],
  features: [
    {
      id: "glass-grid",
      label: "Ordenado y parejo",
      guidance: "Tarjetas del mismo tamaño en una cuadrícula. Una opción clara cuando todos los puntos tienen la misma importancia.",
      vibes: ["calm", "minimal", "technical"],
    },
    {
      id: "depth-bento",
      label: "Una idea principal",
      guidance: "Tarjetas de distintos tamaños con una al frente. Úsalo cuando un punto destaque sobre los demás.",
      vibes: ["bold", "premium"],
      needs: ["image"],
    },
    {
      id: "floating-column",
      label: "En orden",
      guidance: "Una columna vertical que se mueve al desplazarse. Úsala cuando los puntos formen pasos o una secuencia.",
      vibes: ["warm", "calm"],
    },
    {
      id: "orbit-ring",
      label: "Creativo y circular",
      guidance: "Tarjetas alrededor de un centro luminoso. Úsalo para negocios creativos, informales o de consumo.",
      vibes: ["playful", "warm"],
    },
  ],
  testimonials: [
    {
      id: "glass-carousel",
      label: "Desliza y descubre",
      guidance: "De dos a cuatro opiniones en tarjetas desenfocadas, con una al frente a la vez.",
      vibes: ["calm", "premium", "technical"],
    },
    {
      id: "floating-cards",
      label: "Espontáneo y dinámico",
      guidance: "Opiniones flotando a distintas profundidades. Úsalo para negocios cálidos e informales.",
      vibes: ["playful", "warm", "bold"],
    },
    {
      id: "single-spotlight",
      label: "Una opinión destacada",
      guidance: "Una sola opinión grande bajo un brillo sutil. Úsala cuando solo haya una opinión que valga la pena mostrar.",
      vibes: ["premium", "minimal", "calm"],
    },
    {
      id: "depth-marquee",
      label: "En movimiento",
      guidance: "Opiniones desplazándose en dos niveles. Úsalo cuando haya muchas opiniones positivas que mostrar.",
      vibes: ["bold", "playful"],
    },
  ],
  cta: [
    {
      id: "glow-band",
      label: "Directo y llamativo",
      guidance: "Una franja de lado a lado con un botón que pulsa. Ideal para una sola acción clara.",
      vibes: ["bold", "playful"],
    },
    {
      id: "glass-monolith",
      label: "Sutil y cuidado",
      guidance: "Un panel de vidrio flotante sobre colores en movimiento. Opción versátil para servicios de alto valor o que requieren pensarse.",
      vibes: ["premium", "calm", "minimal"],
    },
    {
      id: "split-orbital",
      label: "Muestra e invita",
      guidance: "Texto junto a una imagen con capas de profundidad. Úsalo cuando una imagen ayude a concretar la acción.",
      vibes: ["warm", "bold"],
      needs: ["image"],
    },
    {
      id: "aurora-wave",
      label: "Suave y fluido",
      guidance: "Una onda de color en movimiento que acompaña el texto. Úsala para servicios cercanos y tranquilos.",
      vibes: ["calm", "warm", "technical"],
      needs: ["subheadline"],
    },
  ],
};

/** Compact list for prompts: `id — guidance (needs: x)`. */
export function describeVariants(type: SectionType): string {
  return VARIANT_CATALOG[type]
    .map((v) => `- ${v.id} — ${v.guidance}${v.needs ? ` (requiere: ${v.needs.join(", ")})` : ""}`)
    .join("\n");
}
