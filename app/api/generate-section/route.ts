import { NextResponse } from "next/server";
import { z } from "zod";
import { generateSection, PipelineError } from "@/lib/ai/generate";
import { BusinessBrief } from "@/lib/schemas/brief";
import { SectionType } from "@/lib/schemas/primitives";
import { guardRequest, logAiFailure, invalidBody, readJson, withRequestId } from "@/lib/security/guard";
import { moderateFor } from "@/lib/server/aiAccess";
import { optionalUser } from "@/lib/server/session";
import { securityLog } from "@/lib/security/log";
import { briefTexts } from "@/lib/security/limits";

export const runtime = "nodejs";

const MAX_BYTES = 32 * 1024;

/**
 * One section per request. That's what makes the preview progressive and what
 * makes a failure isolated — a section that falls back doesn't delay or affect
 * any other section.
 */
const Body = z.object({
  type: SectionType,
  brief: BusinessBrief,
  projectId: z.string().min(1).max(60),
  sectionId: z.string().min(1).max(60),
});

export async function POST(request: Request) {
  const guard = guardRequest(request, { route: "generate-section", maxBytes: MAX_BYTES, ai: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const raw = await readJson(request, MAX_BYTES);
  const body = Body.safeParse(raw);
  if (!body.success) return invalidBody(ctx, raw);

  const user = await optionalUser(request);
  const moderated = await moderateFor(ctx, [briefTexts(body.data.brief)], user);
  if (!moderated.ok) return moderated.response;

  try {
    const result = await generateSection(body.data);
    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    if (error instanceof PipelineError) {
      // Our own defaults are broken — a real bug, not a model failure.
      securityLog("error", "pipeline_error", { requestId: ctx.requestId, route: ctx.route, message: error.message });
      return withRequestId(NextResponse.json({ error: "Ocurrió un error interno al preparar esta sección." }, { status: 500 }), ctx);
    }
    logAiFailure(ctx, error);
    return withRequestId(NextResponse.json(
      { error: "No se pudo generar esta sección. Inténtalo de nuevo." },
      { status: 502 },
    ), ctx);
  }
}
