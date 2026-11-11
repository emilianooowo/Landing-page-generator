import type { BusinessBrief } from "@/lib/schemas/brief";
import type { Section, SectionType } from "@/lib/schemas/section";
import { describeVariants } from "@/lib/variants/catalog";

/** Instrucciones editoriales para generar y editar el texto de cada sección. */
export const SECTION_SYSTEM = `Redacta el contenido de una sección de una página web y elige el diseño que mejor le quede.

No escribas código. Devuelve únicamente el contenido y el identificador interno del diseño.

Reglas de redacción:
- Escribe todo el contenido editorial en español de México. Usa expresiones naturales y cotidianas de México; conserva sin traducir nombres propios y marcas.
- Escribe como hablaría este negocio y aprovecha los detalles del resumen. Si una frase pudiera servirle a cualquier negocio del mismo giro, hazla más específica.
- Di a qué se dedica el negocio. Evita vender con adjetivos vacíos.
- Evita comienzos genéricos como "Te damos la bienvenida", "Nos apasiona", "Tu mejor opción", "Lleva tu negocio al siguiente nivel", "Innovador", "Sin complicaciones" o "De primer nivel".
- Usa mayúsculas y minúsculas de forma normal. No escribas todo en mayúsculas.
- Los botones deben decir qué pasará al presionarlos; por ejemplo, "Agenda una asesoría" en vez de "Más información" o "Enviar".
- Puedes mencionar actividades comunes del giro, pero no inventes precios, años de experiencia, cantidad de clientes, premios ni horarios que no aparezcan en la información.
- Respeta los límites de longitud. Un título que se recorte cuenta como una generación fallida.

Devuelve únicamente JSON.`;

function briefBlock(brief: BusinessBrief): string {
  return `Emprendimiento: ${brief.businessName}
A qué se dedica: ${brief.whatTheyDo}
Para quién: ${brief.audience}
Tono: ${brief.vibe.join(", ")}
Qué se busca que haga la visita: ${brief.desiredAction}
Puntos importantes: ${brief.keyPoints.length ? brief.keyPoints.join("; ") : "no se especificaron"}
Ya está vendiendo: ${brief.hasCustomers ? "sí" : "no"}
Estilo de imagen: ${brief.imageWorld}`;
}

const SECTION_TASK: Record<SectionType, string> = {
  hero: "Redacta la sección principal, lo primero que verá quien visite la página. El título no debe repetir el nombre del negocio y su giro; por ejemplo, no escribas \"Pastelería Lupita hace pasteles\". Expresa algo que le importe a la clientela con palabras concretas del giro. El texto de apoyo debe aportar otra idea y luego presentar la acción principal.",
  features:
    "Explica los productos o servicios del negocio. Cada elemento debe describir algo concreto que la clientela pueda imaginar, no un eslogan; por ejemplo, \"Pasteles personalizados con tres días de anticipación\" en vez de \"Calidad garantizada\". Usa los puntos importantes del resumen. Si dos se parecen, combínalos en vez de alargar la lista sin necesidad.",
  testimonials:
    "Redacta la sección de opiniones de clientes. Deben sonar como algo que escribiría una persona real: específicas, espontáneas y sencillas. Si no hay datos de clientes reales, deja una sola opinión breve con el nombre \"Cliente de ejemplo\" para que sea claro que hay que reemplazarla.",
  cta: "Redacta el cierre de la página. Incluye una frase que haga sencilla la acción y el texto del botón que la realiza. No repitas el título de la sección principal.",
};

export function buildSectionPrompt(type: SectionType, brief: BusinessBrief): string {
  return `${briefBlock(brief)}

Tarea: ${SECTION_TASK[type]}

Diseños disponibles. Elige el que le quede a este emprendimiento y completa todos los campos obligatorios del diseño:
${describeVariants(type)}`;
}

/** Edita la sección solicitada y conserva intacto el resto de su contenido. */
export function buildEditPrompt(
  section: Section,
  brief: BusinessBrief,
  request: string,
  allowVariantChange: boolean,
): string {
  return `${briefBlock(brief)}

Esta sección actualmente dice:
${JSON.stringify({ variant: section.variant, content: section.content }, null, 2)}

La persona pidió este cambio con sus propias palabras:
"""
${request.trim()}
"""

Aplica solo el cambio solicitado y escribe el contenido en español de México. Conserva exactamente igual los demás campos: mismas palabras, elementos y orden. ${
    allowVariantChange
      ? `Puedes cambiar el diseño si la petición trata sobre su apariencia:\n${describeVariants(section.type)}`
      : `Conserva sin cambios el identificador de diseño "${section.variant}".`
  }`;
}

/** Proporciona observaciones de validación cuando la primera respuesta no sirve. */
export function buildRepairPrompt(previous: string, problems: string[]): string {
  return `${previous}

La respuesta anterior no pasó la validación:
${problems.map((p) => `- ${p}`).join("\n")}

Devuelve el JSON corregido en español de México. Cambia únicamente lo que no pasó la validación.`;
}
