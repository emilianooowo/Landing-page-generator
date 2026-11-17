import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { securityLog } from "@/lib/security/log";
import { config, isProduction } from "@/lib/server/config";

/**
 * Transactional email. With SMTP_URL it sends through that server; without it
 * (development) each message is written to <DATA_DIR>/outbox/*.eml and, only
 * outside production, the link is printed to the console so the flow can be
 * tested. Tokens never go to the structured log.
 */
export type Mail = { to: string; subject: string; text: string };

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendMail(mail: Mail): Promise<void> {
  const smtp = config.smtpUrl();
  if (smtp) {
    transport ??= nodemailer.createTransport(smtp);
    await transport.sendMail({ from: config.mailFrom(), to: mail.to, subject: mail.subject, text: mail.text });
    securityLog("info", "mail_sent", { subject: mail.subject });
    return;
  }
  if (isProduction()) throw new Error("Falta SMTP_URL: no se pueden enviar correos en producción.");

  const dir = path.join(process.env.DATA_DIR ?? path.join(process.cwd(), "data"), "outbox");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.eml`);
  await writeFile(file, `From: ${config.mailFrom()}\nTo: ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`, "utf8");
  console.log(`\n[correo de desarrollo] ${mail.subject} → ${file}\n${mail.text}\n`);
}

const signature = "\n\n— Landing IA\nSi no reconoces esta acción, ignora este mensaje o cambia tu contraseña.";

export const mails = {
  verify: (to: string, link: string): Mail => ({
    to, subject: "Confirma tu correo en Landing IA",
    text: `Hola:\n\nConfirma tu correo para activar tu cuenta:\n${link}\n\nEl enlace vence en 24 horas.${signature}`,
  }),
  alreadyRegistered: (to: string, link: string): Mail => ({
    to, subject: "Ya tienes una cuenta en Landing IA",
    text: `Hola:\n\nAlguien intentó crear una cuenta con este correo, pero ya tienes una. Si olvidaste tu contraseña, puedes restablecerla aquí:\n${link}${signature}`,
  }),
  reset: (to: string, link: string): Mail => ({
    to, subject: "Restablece tu contraseña de Landing IA",
    text: `Hola:\n\nPara elegir una contraseña nueva abre este enlace:\n${link}\n\nVence en 30 minutos y solo se puede usar una vez. Al cambiarla se cerrarán tus sesiones abiertas.${signature}`,
  }),
  locked: (to: string, detail: string, link: string): Mail => ({
    to, subject: "Bloqueamos temporalmente el acceso a tu cuenta",
    text: `Hola:\n\nDetectamos varios intentos fallidos de inicio de sesión en tu cuenta. ${detail}\n\nSi no fuiste tú, cambia tu contraseña desde este enlace:\n${link}${signature}`,
  }),
  passwordChanged: (to: string): Mail => ({
    to, subject: "Tu contraseña de Landing IA cambió",
    text: `Hola:\n\nLa contraseña de tu cuenta se cambió y cerramos las demás sesiones abiertas.${signature}`,
  }),
  sanction: (to: string, detail: string): Mail => ({
    to, subject: "Aviso sobre tu cuenta de Landing IA",
    text: `Hola:\n\n${detail}\n\nPuedes pedir una aclaración respondiendo a este correo en un plazo de 5 días.\n\n— Landing IA`,
  }),
};

/** Links carry the token in the URL fragment, which browsers never send to servers or in Referer. */
export const linkFor = (page: "verificar" | "restablecer", token: string) => `${config.appUrl()}/${page}#t=${token}`;
export const forgotLink = () => `${config.appUrl()}/recuperar`;
