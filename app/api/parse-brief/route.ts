import { NextResponse } from "next/server";
import { z } from "zod";
import { completeBrief, parseBrief } from "@/lib/ai/generate";
import { BusinessBrief, FollowUpQuestion } from "@/lib/schemas/brief";

export const runtime = "nodejs";

/**
 * One schema, not a union. A zod union tries members in order and object schemas
 * strip unknown keys, so a "description only" member matches a payload that also
 * carries answers, silently discarding them: the follow-up round trip then
 * re-parsed the original text and returned questions again instead of a brief.
 */
const Body = z.object({
  description: z.string().min(1),
  partial: BusinessBrief.partial().optional(),
  answers: z
    .array(z.object({ question: FollowUpQuestion, answer: z.string().min(1) }))
    .min(1)
    .optional(),
});

export async function POST(request: Request) {
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }

  try {
    const { description, partial, answers } = body.data;

    if (answers?.length) {
      const brief = await completeBrief({ description, partial: partial ?? {}, answers });
      return NextResponse.json({ status: "complete", brief });
    }

    return NextResponse.json(await parseBrief(description));
  } catch {
    // Transport failure after retries. The caller shows a retry affordance;
    // it never silently proceeds with an empty brief.
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de IA. Inténtalo de nuevo." },
      { status: 502 },
    );
  }
}
