import type { BusinessBrief, FollowUpQuestion } from "@/lib/schemas/brief";

export const BRIEF_SYSTEM = `Convierte la descripción de un emprendimiento en información estructurada para crear una página web.

La persona no es técnica. Nunca verá tu respuesta JSON ni términos como "hero", "CTA", "sección" o "variante". No uses esos términos en las preguntas que redactes.

Reglas:
- Responde todo el contenido editorial en español de México. Usa expresiones naturales y cotidianas de México; conserva sin traducir los nombres propios y las marcas.
- Deduce solo lo que permita afirmar la descripción. No inventes cifras, premios, precios ni promesas.
- businessName: conserva el nombre del negocio solo si la persona lo mencionó explícitamente; nunca inventes una marca. hasBusinessName: true únicamente cuando ese nombre aparezca explícitamente en la descripción; de lo contrario false.
- whatTheyDo: una oración sencilla que explique a qué se dedica el negocio, con palabras naturales.
- vibe: uno o dos valores que reflejen cómo se expresa la persona, no cómo lo anunciarías tú.
- brandColor: inclúyelo solo si se menciona un color. De lo contrario, déjalo vacío.
- hasCustomers: usa true solo si la descripción da a entender que el negocio ya vende. Si está por abrir, lanzarse o empezar, usa false.
- keyPoints: si la persona enumera productos o servicios, usa esos. Si no, incluye de tres a cinco opciones comunes para ese tipo de negocio; por ejemplo, una pastelería vende pan y acepta pedidos de pasteles. Son datos típicos de la categoría, no afirmaciones verificables. Nunca inventes precios, cifras, años de experiencia, premios, nombres ni horarios.
- sections: incluye siempre "hero", "features" y "cta". Incluye "testimonials" solo si hasCustomers es true, para no inventar opiniones de clientes.
- Si falta información esencial, haz como máximo dos preguntas conversacionales y cercanas en el campo questions, cada una con entre dos y cuatro sugerencias breves y concretas. Prioriza qué vende o qué incluye su servicio, y qué acción espera de quien visite la página. Adapta las sugerencias al emprendimiento; usa ejemplos cotidianos de México cuando apliquen. Pregunta sobre el negocio, nunca sobre el diseño.

Devuelve únicamente JSON.`;

/** Aproximadamente el límite por debajo del cual la descripción es insuficiente. */
const SPARSE_WORD_COUNT = 12;

export function isSparse(description: string): boolean {
  return description.trim().split(/\s+/).filter(Boolean).length < SPARSE_WORD_COUNT;
}

export function buildBriefPrompt(description: string): string {
  const base = `Descripción del emprendimiento:\n"""\n${description.trim()}\n"""`;
  if (!isSparse(description)) return base;

  return `${base}

La descripción es muy breve. Haz dos preguntas en español de México en lugar de adivinar: una sobre lo que vende o hace la persona y otra sobre lo que le gustaría que hiciera quien visite la página. Completa solo lo que puedas deducir y deja vacío lo demás.`;
}

/** Segunda vuelta: descripción original más las respuestas de seguimiento. */
export function buildBriefFollowUpPrompt(
  description: string,
  partial: Partial<BusinessBrief>,
  answers: { question: FollowUpQuestion; answer: string }[],
): string {
  const answered = answers
    .map((a) => `Pregunta: ${a.question.question}\nRespuesta: ${a.answer}`)
    .join("\n\n");

  return `Descripción del emprendimiento:
"""
${description.trim()}
"""

Lo que dedujiste anteriormente:
${JSON.stringify(partial, null, 2)}

La persona respondió estas preguntas:
${answered}

Completa la información del negocio en español de México. No hagas más preguntas; completa cualquier dato faltante con la interpretación más razonable de lo que compartió.`;
}
