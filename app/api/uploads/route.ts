import { NextResponse } from "next/server";
import { guardRequest, withRequestId } from "@/lib/security/guard";
import { securityLog } from "@/lib/security/log";
import { query } from "@/lib/server/db";
import { optionalUser } from "@/lib/server/session";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError } from "@/lib/uploads";

const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export const runtime = "nodejs";

/**
 * Receives one photo as multipart form data (field "file") and stores it.
 * The browser has already resized and re-encoded it; here we only trust the
 * bytes: size cap and format detected from the file signature.
 */
export async function POST(request: Request) {
  const guard = guardRequest(request, { route: "uploads", maxBytes: MAX_UPLOAD_BYTES + 64 * 1024, upload: true });
  if (!guard.ok) {
    if (guard.response.status === 413) {
      return NextResponse.json({ error: "La imagen pesa demasiado. El máximo es 4 MB." }, { status: 413, headers: guard.response.headers });
    }
    return guard.response;
  }
  const { ctx } = guard;

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return withRequestId(NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 }), ctx);
  }
  if (!(file instanceof File)) {
    return withRequestId(NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 }), ctx);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    securityLog("warn", "payload_too_large", { requestId: ctx.requestId, ip: ctx.ip, route: ctx.route, bytes: file.size });
    return withRequestId(NextResponse.json({ error: "La imagen pesa demasiado. El máximo es 4 MB." }, { status: 413 }), ctx);
  }

  try {
    const user = await optionalUser(request);
    const saved = await saveUpload(new Uint8Array(await file.arrayBuffer()));
    // Ownership: guests' photos have no owner until a signed-in project references them.
    const [, id, ext] = /\/(up_[a-f0-9]{24})\.(jpg|png|webp)$/.exec(saved.url) ?? [];
    await query(
      "INSERT INTO imagenes (id, extension, tipo_mime, tamano_bytes, usuario_id) VALUES ($1, $2, $3, $4, $5)",
      [id, ext, MIME[ext as keyof typeof MIME], file.size, user?.id ?? null],
    );
    securityLog("info", "upload_saved", { requestId: ctx.requestId, ip: ctx.ip, file: saved.url, bytes: file.size });
    return withRequestId(NextResponse.json(saved, { status: 201 }), ctx);
  } catch (error) {
    if (error instanceof UploadError) {
      securityLog("warn", "upload_rejected", { requestId: ctx.requestId, ip: ctx.ip, reason: error.message });
      return withRequestId(NextResponse.json({ error: error.message }, { status: error.status }), ctx);
    }
    securityLog("error", "upload_failed", { requestId: ctx.requestId, message: error instanceof Error ? error.message : "unknown" });
    return withRequestId(NextResponse.json({ error: "No se pudo guardar la imagen. Inténtalo de nuevo." }, { status: 500 }), ctx);
  }
}
