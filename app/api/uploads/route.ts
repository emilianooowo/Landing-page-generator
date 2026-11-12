import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES, saveUpload, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Receives one photo as multipart form data (field "file") and stores it.
 * The browser has already resized and re-encoded it; here we only trust the
 * bytes: size cap and format detected from the file signature.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "La imagen pesa demasiado. El máximo es 4 MB." }, { status: 413 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return NextResponse.json({ error: "La solicitud no es válida." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ninguna imagen." }, { status: 400 });
  }

  try {
    const saved = await saveUpload(new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return NextResponse.json({ error: "No se pudo guardar la imagen. Inténtalo de nuevo." }, { status: 500 });
  }
}
