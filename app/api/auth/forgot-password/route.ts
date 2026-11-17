import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { issueEmailToken, recentlySent } from "@/lib/server/emailTokens";
import { linkFor, mails, sendMail } from "@/lib/server/mail";
import { begin, crash, json } from "@/lib/server/route";
import { findUserByEmail } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().trim().max(254).email() });

/** Sends a 30-minute, single-use reset link. Same answer whatever the email. */
export async function POST(request: Request) {
  const start = await begin(request, "auth/forgot-password", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const user = await findUserByEmail(body.email);
    if (user && !(await recentlySent(user.id, "restablecer"))) {
      await sendMail(mails.reset(user.correo, linkFor("restablecer", await issueEmailToken(user.id, "restablecer", user.correo))));
      await audit({ action: "restablecimiento_solicitado", targetType: "usuario", targetId: user.id, ip: ctx.ip, requestId: ctx.requestId });
    }
    return json(ctx, { status: "check_email" }, 202);
  } catch (error) {
    return crash(ctx, error);
  }
}
