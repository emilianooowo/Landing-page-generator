import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { consumeEmailToken } from "@/lib/server/emailTokens";
import { one } from "@/lib/server/db";
import { begin, crash, fail, json } from "@/lib/server/route";

export const runtime = "nodejs";

const Body = z.object({ token: z.string().min(1).max(100) });

/**
 * Confirms an address. Used both for new accounts and for an email change:
 * the token remembers which address it was sent to, and that one becomes the
 * account's email.
 */
export async function POST(request: Request) {
  const start = await begin(request, "auth/verify-email", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const token = await consumeEmailToken(body.token, "verificacion");
    if (!token) return fail(ctx, 400, "El enlace no es válido o ya venció. Pide uno nuevo desde el inicio de sesión.", "invalid_token");

    const updated = await one<{ id: string }>(
      `UPDATE usuarios SET correo = $2, correo_verificado_en = now()
        WHERE id = $1 AND estado <> 'eliminado'
          AND NOT EXISTS (SELECT 1 FROM usuarios other WHERE other.correo = $2 AND other.id <> $1)
        RETURNING id`,
      [token.userId, token.email],
    );
    if (!updated) return fail(ctx, 409, "Ese correo ya pertenece a otra cuenta.", "email_taken");
    await audit({ action: "correo_verificado", actorId: token.userId, targetType: "usuario", targetId: token.userId, ip: ctx.ip, requestId: ctx.requestId });
    return json(ctx, { status: "verified" });
  } catch (error) {
    return crash(ctx, error);
  }
}
