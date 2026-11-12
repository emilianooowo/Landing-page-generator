import { describe, expect, it } from "vitest";
import type { ModelCall } from "@/lib/ai/client";
import { generateSection } from "@/lib/ai/generate";
import { toGeminiSchema } from "@/lib/ai/schema";
import { buildHref, isSafeHref, parseHref } from "@/lib/links";
import { CtaLink } from "@/lib/schemas/primitives";
import { GENERATION_BASE_SCHEMAS } from "@/lib/schemas/section";

describe("button links", () => {
  it("builds links from what the person types", () => {
    expect(buildHref("whatsapp", "55 1234 5678")).toBe("https://wa.me/525512345678");
    expect(buildHref("whatsapp", "+1 (415) 555-0100")).toBe("https://wa.me/14155550100");
    expect(buildHref("phone", "55-1234-5678")).toBe("tel:+525512345678");
    expect(buildHref("email", "hola@cacahuates.mx")).toBe("mailto:hola@cacahuates.mx");
    expect(buildHref("url", "www.cacahuates.mx")).toBe("https://www.cacahuates.mx");
    expect(buildHref("none", "")).toBe("#");
  });

  it("rejects values that aren't valid for the kind", () => {
    expect(buildHref("whatsapp", "123")).toBeNull();
    expect(buildHref("email", "hola")).toBeNull();
    expect(buildHref("url", "javascript:alert(1)")).toBeNull();
    expect(buildHref("url", "nada")).toBeNull();
  });

  it("round-trips stored links back into the editor fields", () => {
    for (const href of ["https://wa.me/525512345678", "tel:+525512345678", "mailto:a@b.co", "https://x.mx/menu", "#"]) {
      const { kind, value } = parseHref(href);
      expect(buildHref(kind, value)).toBe(href);
    }
  });

  it("never lets an unsafe href onto a page", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,hi")).toBe(false);
    expect(CtaLink.parse({ label: "Hola", href: "javascript:alert(1)" }).href).toBe("#");
    expect(CtaLink.parse({ label: "Hola" }).href).toBe("#");
    expect(CtaLink.parse({ label: "Hola", href: "tel:+525512345678" }).href).toBe("tel:+525512345678");
  });

  it("still converts the section schemas for the model", () => {
    expect(() => toGeminiSchema(GENERATION_BASE_SCHEMAS.hero)).not.toThrow();
  });

  it("drops any link the model invents on generated sections", async () => {
    const model: ModelCall = async () => ({
      data: { variant: "aurora-veil", content: { headline: "Pan de cada día", subheadline: "Masa madre.", primaryCta: { label: "Escríbenos", href: "https://wa.me/525500000000" } } },
      raw: "",
    });
    const brief = { businessName: "B", hasBusinessName: true, whatTheyDo: "Pan.", audience: "Vecinos", vibe: ["warm" as const], imageWorld: "food-drink" as const, desiredAction: "Escríbenos", keyPoints: [], hasCustomers: false, sections: ["hero" as const, "cta" as const] };
    const r = await generateSection({ type: "hero", brief, projectId: "t", sectionId: "hero-0" }, { model });
    expect(r.section.content).toMatchObject({ primaryCta: { href: "#" } });
  });
});
