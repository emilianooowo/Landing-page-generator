import { randomUUID } from "node:crypto";
import { z } from "zod";
import { assertAcceptablePassword } from "@/lib/auth/checkPassword";
import { TERMS_VERSION } from "@/lib/auth/terms";
import { audit } from "@/lib/server/audit";
import { issueEmailToken, recentlySent } from "@/lib/server/emailTokens";
import { query } from "@/lib/server/db";
import { forgotLink, linkFor, mails, sendMail } from "@/lib/server/mail";
import { hashPassword } from "@/lib/server/passwords";
import { begin, crash, fail, json } from "@/lib/server/route";
import { findUserByEmail, normalizeEmail } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().max(254).email(),
  password: z.string().min(1).max(128),
  termsAccepted: z.literal(true),
});

/**
 * Creates an unverified account and emails the verification link. The answer
 * is the same whether or not the email was already registered (that case
 * gets an email instead), so this form doesn't reveal who has an account.
 */
export async function POST(request: Request) {
  const start = await begin(request, "auth/register", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  const email = normalizeEmail(body.email);

  try {
    try {
      await assertAcceptablePassword(body.password, { email, name: body.name });
    } catch (error) {
      return fail(ctx, 422, error instanceof Error ? error.message : "La contraseña no es válida.", "weak_password");
    }

    // Hashed in both branches so the response time doesn't reveal existing accounts.
    const hash = await hashPassword(body.password);
    const existing = await findUserByEmail(email);
    if (existing) {
      if (!(await recentlySent(existing.id, existing.correo_verificado_en ? "restablecer" : "verificacion"))) {
        if (existing.correo_verificado_en) {
          await sendMail(mails.alreadyRegistered(email, forgotLink()));
        } else {
          await sendMail(mails.verify(email, linkFor("verificar", await issueEmailToken(existing.id, "verificacion", email))));
        }
      }
      await audit({ action: "registro_duplicado", result: "fallo", targetType: "usuario", targetId: existing.id, ip: ctx.ip, requestId: ctx.requestId });
      return json(ctx, { status: "check_email" }, 202);
    }

    const id = `u_${randomUUID()}`;
    await query(
      `INSERT INTO usuarios (id, nombre, correo, hash_contrasena, terminos_aceptados_en, terminos_version)
       VALUES ($1, $2, $3, $4, now(), $5)`,
      [id, body.name, email, hash, TERMS_VERSION],
    );
    await sendMail(mails.verify(email, linkFor("verificar", await issueEmailToken(id, "verificacion", email))));
    await audit({ action: "registro", actorId: id, actorRole: "usuario", targetType: "usuario", targetId: id, ip: ctx.ip, requestId: ctx.requestId, details: { terminos: TERMS_VERSION } });
    return json(ctx, { status: "check_email" }, 202);
  } catch (error) {
    return crash(ctx, error);
  }
}
