import { describe, expect, it } from "vitest";
import type { ModelCall } from "@/lib/ai/client";
import { generateSection, parseBrief } from "@/lib/ai/generate";
import { buildSectionPrompt } from "@/lib/ai/prompts/section";
import type { BusinessBrief } from "@/lib/schemas/brief";
import { LANDING_STYLE_IDS } from "@/lib/schemas/primitives";
import { accentFor, LANDING_STYLES, recommendedStyle, themeFor } from "@/lib/styles/landingStyles";
import { pageScopeVars } from "@/lib/theme/typography";
import { VARIANT_CATALOG } from "@/lib/variants/catalog";

const brief: BusinessBrief = {
  businessName: "Test Bakery",
  hasBusinessName: true,
  whatTheyDo: "Bakes bread and cakes to order.",
  audience: "Neighbours",
  vibe: ["warm"],
  imageWorld: "food-drink",
  desiredAction: "Order a cake",
  keyPoints: ["Sourdough daily"],
  hasCustomers: true,
  sections: ["hero", "features", "cta"],
};

describe("landing styles catalog", () => {
  it("defines every style id and only uses layouts that exist", () => {
    for (const id of LANDING_STYLE_IDS) {
      const style = LANDING_STYLES[id];
      expect(style.id).toBe(id);
      for (const [type, variants] of Object.entries(style.variants)) {
        const known = VARIANT_CATALOG[type as keyof typeof VARIANT_CATALOG].map((v) => v.id);
        expect(variants.length).toBeGreaterThan(0);
        for (const v of variants) expect(known).toContain(v);
      }
    }
  });
});

describe("a picked style drives the look", () => {
  const elegant = { ...brief, style: "elegant" as const };

  it("uses the style's accent, theme and typeface unless the person gave a colour", () => {
    expect(accentFor(elegant)).toBe(LANDING_STYLES.elegant.accent);
    expect(accentFor({ ...elegant, brandColor: "#123456" })).toBe("#123456");
    expect(themeFor(elegant)).toBe("dark");
    expect(themeFor(brief)).toBeUndefined();
    expect(pageScopeVars(elegant, "subtle")["--font-display" as never]).toBe("var(--font-display-serif)");
  });

  it("offers the model only the style's layouts and its copy direction", () => {
    const prompt = buildSectionPrompt("hero", { ...brief, style: "tech" });
    expect(prompt).toContain("spotlight-monolith");
    expect(prompt).not.toContain("floating-glass-split");
    expect(prompt).toContain("Tecnológico");
  });

  it("applies the style's motion and decoration to generated sections", async () => {
    const model: ModelCall = async () => ({
      data: { variant: "aurora-veil", content: { headline: "Pan de cada día", subheadline: "Masa madre y pasteles por encargo.", primaryCta: { label: "Pide tu pastel", href: "#" } } },
      raw: "",
    });
    const r = await generateSection({ type: "hero", brief: { ...brief, style: "bold" }, projectId: "t", sectionId: "hero-0" }, { model });
    expect(r.section.style.motion).toBe("lively");
    expect(r.section.style.floatingShapes).toBe(LANDING_STYLES.bold.floatingShapes);
  });

  it("recommends a style from how the business was described", () => {
    expect(recommendedStyle({ vibe: ["premium"] })).toBe("elegant");
    expect(recommendedStyle({ vibe: ["warm"] })).toBe("warm");
  });
});

describe("the model never picks the style", () => {
  it("drops a style the model tried to set in the brief", async () => {
    const model: ModelCall = async () => ({ data: { brief: { ...brief, style: "bold" }, questions: [] }, raw: "" });
    const r = await parseBrief("Tengo una panadería de barrio, hacemos pan de masa madre todos los días y pasteles por encargo para fiestas.", { model });
    const result = r.status === "complete" ? r.brief : r.partial;
    expect(result.style).toBeUndefined();
  });
});

describe("fallback keeps the picked style", () => {
  it("uses a layout from the style when the model keeps failing", async () => {
    const model: ModelCall = async () => ({ data: { variant: "nope", content: {} }, raw: "" });
    const r = await generateSection({ type: "cta", brief: { ...brief, style: "playful" }, projectId: "t", sectionId: "cta-0" }, { model });
    expect(r.status).toBe("fallback");
    expect(LANDING_STYLES.playful.variants.cta).toContain(r.section.variant);
  });
});
