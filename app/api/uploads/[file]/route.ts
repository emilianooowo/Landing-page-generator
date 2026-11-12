import { readUpload } from "@/lib/uploads";

export const runtime = "nodejs";

/** Serves an uploaded photo. File names are random and never reused, so they cache forever. */
export async function GET(_request: Request, ctx: RouteContext<"/api/uploads/[file]">) {
  const { file } = await ctx.params;
  const upload = await readUpload(file);
  if (!upload) return new Response("No encontrada", { status: 404 });

  return new Response(upload.bytes as BodyInit, {
    headers: {
      "Content-Type": upload.contentType,
      "Content-Length": String(upload.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
    },
  });
}
