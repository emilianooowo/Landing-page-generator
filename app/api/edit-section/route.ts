import { NextResponse } from "next/server";
import { z } from "zod";
import { editSection } from "@/lib/ai/generate";
import { BusinessBrief } from "@/lib/schemas/brief";
import { Section } from "@/lib/schemas/section";
import { guardRequest, logAiFailure, invalidBody, readJson, withRequestId } from "@/lib/security/guard";
import { moderateFor } from "@/lib/server/aiAccess";
import { optionalUser } from "@/lib/server/session";
import { briefTexts } from "@/lib/security/limits";

export const runtime = "nodejs";

const MAX_BYTES = 64 * 1024;

const Body = z.object({
  section: Section,
  brief: BusinessBrief,
  projectId: z.string().min(1).max(60),
  request: z.string().trim().min(1).max(400),
  allowVariantChange: z.boolean().optional(),
  /** Dot path of one text element (e.g. "items.1.title"); omit to edit the whole section. */
  target: z.string().regex(/^[A-Za-z]+(\.[A-Za-z0-9]+)*$/).max(60).optional(),
});

/**
 * Only this section is touched. On total failure the original comes back
 * with status "unchanged" and a 200, because that is a legitimate outcome the
 * client should render, not an error.
 */
export async function POST(request: Request) {
  const guard = guardRequest(request, { route: "edit-section", maxBytes: MAX_BYTES, ai: true });
  if (!guard.ok) return guard.response;
  const { ctx } = guard;

  const raw = await readJson(request, MAX_BYTES);
  const body = Body.safeParse(raw);
  if (!body.success) return invalidBody(ctx, raw);

  const user = await optionalUser(request);
  const moderated = await moderateFor(ctx, [
    body.data.request,
    briefTexts(body.data.brief),
  ], user);
  if (!moderated.ok) return moderated.response;

  try {
    const result = await editSection({ ...body.data, request: moderated.texts[0] });
    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    logAiFailure(ctx, error);
    return withRequestId(NextResponse.json({ error: "No se pudo actualizar la sección. Inténtalo de nuevo." }, { status: 502 }), ctx);
  }
}
