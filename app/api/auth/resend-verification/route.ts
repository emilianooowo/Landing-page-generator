import { z } from "zod";
import { issueEmailToken, recentlySent } from "@/lib/server/emailTokens";
import { linkFor, mails, sendMail } from "@/lib/server/mail";
import { begin, crash, json } from "@/lib/server/route";
import { findUserByEmail } from "@/lib/server/users";

export const runtime = "nodejs";

const Body = z.object({ email: z.string().trim().max(254).email() });

/** Same answer whatever the email; at most one message per minute per account. */
export async function POST(request: Request) {
  const start = await begin(request, "auth/resend-verification", Body);
  if (!start.ok) return start.response;
  const { ctx, body } = start;
  try {
    const user = await findUserByEmail(body.email);
    if (user && !user.correo_verificado_en && !(await recentlySent(user.id, "verificacion"))) {
      await sendMail(mails.verify(user.correo, linkFor("verificar", await issueEmailToken(user.id, "verificacion", user.correo))));
    }
    return json(ctx, { status: "check_email" }, 202);
  } catch (error) {
    return crash(ctx, error);
  }
}
