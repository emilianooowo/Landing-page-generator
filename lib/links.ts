/**
 * Where a page button leads. The person picks a kind and types a value in the
 * editor; we turn that into an href. Only these schemes ever reach a page, so a
 * button can't run script ("javascript:…") or point anywhere unexpected.
 */

export type LinkKind = "none" | "whatsapp" | "phone" | "email" | "url";

export const LINK_KINDS: { kind: LinkKind; label: string; placeholder: string }[] = [
  { kind: "none", label: "Sin enlace", placeholder: "" },
  { kind: "whatsapp", label: "WhatsApp", placeholder: "Número, p. ej. 55 1234 5678" },
  { kind: "phone", label: "Llamada", placeholder: "Número, p. ej. 55 1234 5678" },
  { kind: "email", label: "Correo", placeholder: "tucorreo@ejemplo.com" },
  { kind: "url", label: "Página web", placeholder: "www.tusitio.com" },
];

const EMAIL = /^[^\s@<>()"]+@[^\s@<>()"]+\.[^\s@<>()"]{2,}$/;
const HTTP_URL = /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i;

/** A Mexican 10-digit number gets the country code; anything else is used as typed. */
function phoneDigits(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 ? `52${digits}` : digits;
}

/** Returns the href, or null when the value isn't valid for that kind. */
export function buildHref(kind: LinkKind, value: string): string | null {
  const v = value.trim();
  switch (kind) {
    case "none":
      return "#";
    case "whatsapp": {
      const digits = phoneDigits(v);
      return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
    }
    case "phone": {
      const digits = phoneDigits(v);
      return digits.length >= 10 && digits.length <= 15 ? `tel:+${digits}` : null;
    }
    case "email":
      return EMAIL.test(v) ? `mailto:${v}` : null;
    case "url": {
      const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
      return HTTP_URL.test(url) ? url : null;
    }
  }
}

/** The reverse of buildHref, to fill the editor fields from a stored href. */
export function parseHref(href: string | undefined): { kind: LinkKind; value: string } {
  if (!href || href === "#") return { kind: "none", value: "" };
  const wa = /^https:\/\/wa\.me\/(\d+)$/.exec(href);
  if (wa) return { kind: "whatsapp", value: `+${wa[1]}` };
  if (href.startsWith("tel:")) return { kind: "phone", value: href.slice(4) };
  if (href.startsWith("mailto:")) return { kind: "email", value: href.slice(7) };
  if (/^https?:\/\//i.test(href)) return { kind: "url", value: href };
  return { kind: "none", value: "" };
}

/** Accepts only what buildHref can produce (plus "#" for "no link yet"). */
export function isSafeHref(href: string): boolean {
  if (href === "#") return true;
  const { kind, value } = parseHref(href);
  return kind !== "none" && buildHref(kind, value) === href;
}

/** Links that leave the page open in a new tab; calls and emails hand off to the device. */
export function opensNewTab(href: string): boolean {
  return /^https?:\/\//i.test(href);
}
