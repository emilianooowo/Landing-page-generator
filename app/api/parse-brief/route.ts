import { NextResponse } from "next/server";
import { z } from "zod";
import { completeBrief, parseBrief } from "@/lib/ai/generate";
import { BusinessBrief, FollowUpQuestion } from "@/lib/schemas/brief";
import { guardRequest, logAiFailure, invalidBody, readJson, withRequestId } from "@/lib/security/guard";
import { chargeGeneration, moderateFor } from "@/lib/server/aiAccess";
import { optionalUser } from "@/lib/server/session";
import { MAX_ANSWER_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/security/limits";

export const runtime = "nodejs";

const MAX_BYTES = 16 * 1024;

/**
 * One schema, not a union. A zod union tries members in order and object schemas
 * strip unknown keys, so a "description only" member matches a payload that also
 * carries answers, silently discarding them: the follow-up round trip then
 * re-parsed the original text and returned questions again instead of a brief.
 */
const Body = z.object({
  description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
  partial: BusinessBrief.partial().optional(),
  answers: z
    .array(z.object({ question: FollowUpQuestion, answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH) }))
    .min(1)
    .max(8)
    .optional(),
});

export async function POST(request: Request) {
  const guard = guardRequest(request, { route: "parse-brief", maxBytes: MAX_BYTES, ai: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const raw = await readJson(request, MAX_BYTES);
  const body = Body.safeParse(raw);
  if (!body.success) return invalidBody(ctx, raw);

  const { partial, answers } = body.data;
  const user = await optionalUser(request);
  const moderated = await moderateFor(ctx, [body.data.description, ...(answers ?? []).map((item) => item.answer)], user);
  if (!moderated.ok) return moderated.response;
  const [description, ...answerTexts] = moderated.texts;

  try {
    if (answers?.length) {
      const brief = await completeBrief({
        description,
        partial: partial ?? {},
        answers: answers.map((item, i) => ({ ...item, answer: answerTexts[i] })),
      });
      return withRequestId(NextResponse.json({ status: "complete", brief }), ctx);
    }

    // A new landing starts here: this is what the daily quota counts.
    const overQuota = await chargeGeneration(ctx, user);
    if (overQuota) return overQuota;
    return withRequestId(NextResponse.json(await parseBrief(description)), ctx);
  } catch (error) {
    // Transport failure after retries. The caller shows a retry affordance;
    // it never silently proceeds with an empty brief.
    logAiFailure(ctx, error);
    return withRequestId(NextResponse.json(
      { error: "No se pudo conectar con el servicio de IA. Inténtalo de nuevo." },
      { status: 502 },
    ), ctx);
  }
}
