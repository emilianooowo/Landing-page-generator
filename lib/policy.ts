/**
 * Product scope: this app only builds landing pages. Generated pages never
 * sell online — no online store, cart, checkout or payment buttons. Visitors
 * are sent to a contact action instead (WhatsApp, call, book, ask for a quote…).
 *
 * The prompts say this, and this module enforces it on whatever the model
 * returns, because prompts alone are not a guarantee.
 */

const SALE_WORD = "(?:compr\\w*|vend\\w*|venta\\w*|tienda\\w*|pag\\w*|pedid\\w*|orden\\w*|cat[aá]logo)";
const ONLINE = "(?:en\\s+l[ií]nea|online|por\\s+internet|en\\s+la\\s+(?:web|p[aá]gina))";

const ONLINE_SALES = new RegExp(
  [
    `${SALE_WORD}(?:\\s+\\S+){0,2}?\\s+${ONLINE}`, // "comprar en línea", "haz tu pedido en línea"
    `${ONLINE}\\s+${SALE_WORD}`, // "tienda online", "venta en línea" variants
    "e-?commerce",
    "carrito",
    "checkout",
    "pasarela\\s+de\\s+pago",
    "tienda\\s+(?:virtual|digital)",
    "pag(?:a|ar|o|os)\\s+(?:con\\s+tarjeta|ahora|aqu[ií]|ya)",
    "compr(?:a|ar|e)\\s+(?:ahora|ya|aqu[ií])",
  ].join("|"),
  "i",
);

/** True when the text proposes selling or paying online. */
export function isOnlineSales(text: string): boolean {
  return ONLINE_SALES.test(text);
}

/** Used when a brief's desired action had to be discarded for being an online sale. */
export const DEFAULT_CONTACT_ACTION = "Escríbenos por WhatsApp";

/** Shared wording for prompts. */
export const LANDING_ONLY_RULE =
  "La página es una landing informativa: no vende en línea. No propongas ni escribas acciones de compra o pago en línea (\"Comprar en línea\", \"Compra ahora\", \"Tienda en línea\", \"Agregar al carrito\", \"Pagar con tarjeta\"). Las acciones deben llevar a contactar al negocio: escribir por WhatsApp, llamar, agendar una cita, pedir una cotización, hacer un pedido por mensaje o visitar el local.";
