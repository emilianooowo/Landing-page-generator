/**
 * Prompt moderation, applied on the server before any text reaches the model.
 *
 * - Abuse (phishing or impersonation, malware, clearly illicit business,
 *   prompt injection) is rejected and counts as a strike for the sender.
 * - Secrets and card numbers are rejected without a strike: they are almost
 *   always a mistake, and the message teaches the rule.
 * - Contact data and identity numbers are replaced with placeholders, so the
 *   model only receives what it needs (data minimization). The brief has no
 *   contact fields; button links are set by the person in the editor.
 */
export type AbuseCategory = "phishing" | "malware" | "illicit" | "injection";
export type SecretCategory = "secret" | "card";

export type ModerationResult =
  | { ok: true; text: string; redactions: string[] }
  | { ok: false; category: AbuseCategory | SecretCategory; strike: boolean; message: string };

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const BRANDS = String.raw`(?:banco|bancaria|bbva|santander|banamex|banorte|hsbc|scotiabank|banco azteca|bancoppel|paypal|mercado ?pago|mercado ?libre|sat\b|imss|infonavit|cfe\b|gobierno|facebook|instagram|whatsapp|google|gmail|microsoft|outlook|apple|icloud|netflix|amazon|spotify|tiktok)`;
const CREDENTIALS = String.raw`(?:contrasenas?|passwords?|claves? de acceso|nip\b|pin\b|cvv|cvc|datos (?:de|bancarios de) (?:la |su |sus )?tarjetas?|numeros? de tarjetas?|credenciales|token(?:es)? (?:de|del) banco)`;

const ABUSE: { category: AbuseCategory; patterns: RegExp[]; message: string }[] = [
  {
    category: "injection",
    message: "La descripción intenta cambiar las reglas del generador. Describe solo tu emprendimiento.",
    patterns: [
      /\b(?:ignora|olvida|omite|descarta|salta(?:te)?)\b.{0,30}\b(?:instrucciones|reglas|indicaciones|restricciones|politicas)\b/,
      /\bignore\b.{0,30}\b(?:instructions|rules|prompt)\b/,
      /\b(?:system prompt|prompt del sistema|mensaje del sistema|instrucciones del sistema)\b/,
      /\b(?:jailbreak|modo desarrollador|developer mode|sin restricciones|without restrictions|do anything now)\b/,
      /<\/?\s*(?:system|assistant|instructions?)\s*>/,
      /\b(?:revela|muestra|imprime|repite)\b.{0,30}\b(?:tus instrucciones|tu prompt|el prompt|tus reglas)\b/,
    ],
  },
  {
    category: "phishing",
    message: "No podemos crear páginas que imiten a otra empresa o pidan contraseñas o datos de tarjetas.",
    patterns: [
      new RegExp(String.raw`\b(?:identic[ao]s?|igualita|clon(?:ar|a|e)|copia(?:r)? (?:de |exacta )?(?:la |el )?(?:pagina|sitio|web|login)|replica(?:r)? (?:de |exacta )?(?:la |el )?(?:pagina|sitio|web|login)|imit(?:ar|e|a)|suplant(?:ar|e|a)|hacer(?:me|nos)? pasar|haga pasar|que parezca)\b.{0,60}\b${BRANDS}`),
      new RegExp(String.raw`\b(?:ingres(?:en|ar|e)|captur(?:ar|e|en)|pedir(?:les)?|pida|robar|obtener|recolectar|recopilar)\b.{0,50}\b${CREDENTIALS}`),
      /\b(?:phishing|pagina falsa de (?:inicio de sesion|login)|login falso|inicio de sesion falso)\b/,
    ],
  },
  {
    category: "malware",
    message: "No podemos ayudar con software malicioso ni con el acceso a cuentas ajenas.",
    patterns: [
      /\b(?:malware|ransomware|keylogger|spyware|troyano|botnet|rootkit|stealer)\b/,
      /\b(?:crear|programar|hacer|distribuir|descargar|instalar)\b.{0,30}\b(?:virus informaticos?|un virus|exploits?)\b/,
      /\b(?:hackear|hackeo de|robar|vaciar|espiar)\b.{0,30}\b(?:cuentas?|whatsapp|facebook|instagram|celulares?|telefonos?|correos?|contrasenas?)\b/,
      /\b(?:ddos|denegacion de servicio)\b/,
    ],
  },
  {
    category: "illicit",
    message: "No podemos crear páginas para actividades ilícitas.",
    patterns: [
      /\b(?:venta|vendo|vendemos|distribucion|envio)\b.{0,40}\b(?:cocaina|heroina|metanfetaminas?|fentanilo|drogas ilegales)\b/,
      /\b(?:venta|vendo|vendemos)\b.{0,30}\barmas\b(?!.{0,20}\b(?:de juguete|de utileria|airsoft|deportivas con permiso)\b)/,
      /\b(?:documentos|identificaciones|ine|pasaportes|titulos|licencias|billetes|recetas)\s+(?:falsos|falsas|falsificad[oa]s|apocrif[oa]s|clonad[oa]s)\b/,
      /\b(?:lavado de dinero|blanqueo de capitales|esquema ponzi|esquema piramidal)\b/,
      /\b(?:pornografia infantil|explotacion sexual|trata de personas)\b/,
    ],
  },
];

const SECRETS: RegExp[] = [
  /\bgsk_[A-Za-z0-9]{20,}/,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_\-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_\-]{35}\b/,
  /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{22,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:contrase(?:ñ|n)a|password|passwd|pwd|clave de acceso|api[_ -]?key|access[_ -]?token|token de acceso|secret)\s*(?:es|is)?\s*[:=]\s*\S{4,}/i,
];

function luhn(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export function containsCardNumber(text: string): boolean {
  for (const match of text.matchAll(/(?:\d[ -]?){13,19}/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length >= 13 && digits.length <= 19 && !/^(\d)\1+$/.test(digits) && luhn(digits)) return true;
  }
  return false;
}

const REDACTIONS: { label: string; pattern: RegExp; replacement: string }[] = [
  { label: "correo", pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, replacement: "[correo]" },
  { label: "curp", pattern: /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d\b/gi, replacement: "[dato personal]" },
  { label: "rfc", pattern: /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}\b/gi, replacement: "[dato personal]" },
  { label: "telefono", pattern: /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)\d{3,4}[\s.-]?\d{4}\b/g, replacement: "[teléfono]" },
];

export function moderatePrompt(text: string): ModerationResult {
  if (SECRETS.some((pattern) => pattern.test(text))) {
    return {
      ok: false,
      category: "secret",
      strike: false,
      message: "Parece que escribiste una contraseña o una llave de acceso. Quítala: el generador nunca la necesita.",
    };
  }
  if (containsCardNumber(text)) {
    return {
      ok: false,
      category: "card",
      strike: false,
      message: "Parece que escribiste un número de tarjeta. Quítalo: el generador nunca lo necesita.",
    };
  }

  const plain = normalize(text);
  for (const rule of ABUSE) {
    if (rule.patterns.some((pattern) => pattern.test(plain))) {
      return { ok: false, category: rule.category, strike: true, message: rule.message };
    }
  }

  let clean = text;
  const redactions: string[] = [];
  for (const { label, pattern, replacement } of REDACTIONS) {
    const next = clean.replace(pattern, replacement);
    if (next !== clean) redactions.push(label);
    clean = next;
  }
  return { ok: true, text: clean, redactions };
}
