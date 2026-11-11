import type { BusinessBrief } from "@/lib/schemas/brief";
import type { SectionType } from "@/lib/schemas/primitives";
// The per-section constants live in their own schema files and are NOT re-exported
// by section.ts; importing them from there yields undefined at runtime. Use the map.
import type { FollowUpQuestion } from "@/lib/schemas/brief";
import { FALLBACK_VARIANTS } from "@/lib/schemas/section";

/**
 * The last line of defence: no model call, no failure mode. Built from brief
 * fields the user themselves supplied, so a fallback section still reads as
 * their business rather than lorem ipsum — the user should not be able to tell
 * which section fell back except that it's plainer.
 *
 * Every value here must satisfy its section schema, including the length caps.
 */

const clamp = (value: string, max: number) =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

export function fallbackFor(type: SectionType, brief: BusinessBrief) {
  switch (type) {
    case "hero":
      return {
        variant: FALLBACK_VARIANTS.hero,
        content: {
          headline: clamp(brief.businessName, 70),
          subheadline: clamp(brief.whatTheyDo, 160),
          primaryCta: { label: clamp(brief.desiredAction, 28), href: "#" },
        },
      };

    case "features": {
      const points = brief.keyPoints.length
        ? brief.keyPoints
        : [brief.whatTheyDo, `Pensado para ${brief.audience}`, brief.desiredAction];
      const items = points.slice(0, 6).map((point, i) => ({
        title: clamp(point.split(/[.,–—]/)[0].trim() || point, 40),
        body: clamp(point, 140),
        icon: (["sparkles", "check", "star", "heart", "layers", "compass"] as const)[i % 6],
      }));
      // glass-grid needs at least three.
      while (items.length < 3) {
        items.push({
          title: clamp(brief.businessName, 40),
          body: clamp(brief.whatTheyDo, 140),
          icon: "check" as const,
        });
      }
      return {
        variant: FALLBACK_VARIANTS.features,
        content: { headline: "Lo que ofrecemos", items },
      };
    }

    case "testimonials":
      // Nothing here is a real quote, and the copy says so rather than pretending.
      return {
        variant: FALLBACK_VARIANTS.testimonials,
        content: {
          headline: "Lo que dicen nuestros clientes",
          items: [
            {
              quote: "Agrega aquí la opinión de un cliente real para reemplazar este ejemplo.",
              name: "Cliente de ejemplo",
            },
          ],
        },
      };

    case "cta":
      return {
        variant: FALLBACK_VARIANTS.cta,
        content: {
          headline: "Da el siguiente paso",
          primaryCta: { label: clamp(brief.desiredAction, 28), href: "#" },
        },
      };
  }
}

/**
 * Used only when the description is too short to build on AND the model returned
 * no questions of its own. Deliberately business-agnostic, because at this point
 * we know almost nothing — the model's own questions are always better when it
 * asks them.
 */
export function fallbackQuestions(): FollowUpQuestion[] {
  return [
    {
      field: "keyPoints",
      question: "Para entender mejor tu emprendimiento, ¿qué vendes o qué servicio das? Si puedes, cuéntame qué incluye.",
      suggestions: ["Productos que preparo", "Productos personalizados", "Asesorías o clases", "Otro servicio"],
    },
    {
      field: "desiredAction",
      question: "Cuando alguien vea tu página, ¿qué te gustaría que hiciera primero?",
      suggestions: ["Mandarme WhatsApp", "Hacer un pedido", "Agendar asesoría", "Ver mi catálogo"],
    },
  ];
}
