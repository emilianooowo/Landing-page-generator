import { describe, expect, it } from "vitest";
import { isOnlineSales } from "@/lib/policy";

describe("isOnlineSales", () => {
  it.each([
    "Comprar en línea",
    "Compra ahora",
    "Tienda en línea",
    "Agregar al carrito",
    "Pagar con tarjeta",
    "Haz tu pedido en línea",
    "Comprar online",
    "Venta en línea",
    "Tienda online",
    "Vender en línea",
    "Compra en la página",
  ])("flags %s", (text) => {
    expect(isOnlineSales(text)).toBe(true);
  });

  it.each([
    "Mandarme WhatsApp",
    "Hacer un pedido",
    "Agendar asesoría",
    "Ver mi catálogo",
    "Agenda en línea",
    "Llámanos",
    "Pide tu cotización",
    "Vendo cacahuates importados de Japón.",
    "Contactarte por WhatsApp",
    "Suscribirse al boletín",
    "Clases en línea de matemáticas",
  ])("allows %s", (text) => {
    expect(isOnlineSales(text)).toBe(false);
  });
});
