import { NextResponse } from "next/server";
import { z } from "zod";
import { editSection } from "@/lib/ai/generate";
import { BusinessBrief } from "@/lib/schemas/brief";
import { Section } from "@/lib/schemas/section";

export const runtime = "nodejs";

const Body = z.object({
  section: Section,
  brief: BusinessBrief,
  projectId: z.string().min(1),
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
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });

  try {
    const result = await editSection(body.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "No se pudo actualizar la sección. Inténtalo de nuevo." }, { status: 502 });
  }
}
