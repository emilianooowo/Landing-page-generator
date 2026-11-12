import { describe, expect, it } from "vitest";
import { FeaturesGeneration } from "@/lib/schemas/features";
import { HeroGeneration } from "@/lib/schemas/hero";
import { TestimonialsGeneration } from "@/lib/schemas/testimonials";
import { GENERATION_SCHEMAS, Section } from "@/lib/schemas/section";
import { fallbackFor } from "@/lib/fallbacks";
import type { BusinessBrief } from "@/lib/schemas/brief";

const brief: BusinessBrief = {
  businessName: "Test Bakery",
  hasBusinessName: true,
  whatTheyDo: "Bakes bread and cakes to order.",
  audience: "Neighbours",
  vibe: ["warm"],
  imageWorld: "food-drink",
  desiredAction: "Order a cake",
  keyPoints: ["Sourdough daily", "Custom cakes", "Open six days"],
  hasCustomers: true,
  sections: ["hero", "features", "testimonials", "cta"],
};

const baseHero = {
  headline: "Bread baked this morning",
  subheadline: "Sourdough, pastry and cakes to order from a small oven in Johar Town.",
  primaryCta: { label: "Order a cake", href: "#" },
};

describe("variant slot requirements", () => {
  it("rejects a split hero without an image", () => {
    const r = HeroGeneration.safeParse({ variant: "floating-glass-split", content: baseHero });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["content", "image"]);
  });

  it("accepts a split hero with an image", () => {
    const r = HeroGeneration.safeParse({
      variant: "floating-glass-split",
      content: { ...baseHero, image: { category: "food-drink", alt: "Loaves on a rack" } },
    });
    expect(r.success).toBe(true);
  });

  it("rejects an unknown variant id", () => {
    const r = HeroGeneration.safeParse({ variant: "cosmic-mega-hero", content: baseHero });
    expect(r.success).toBe(false);
  });
});

describe("item count ranges", () => {
  const item = (n: number) => ({ title: `Item ${n}`, body: "Something concrete.", icon: "check" as const });

  it("rejects six items in the orbit layout", () => {
    const r = FeaturesGeneration.safeParse({
      variant: "orbit-ring",
      content: { headline: "What we do", items: [1, 2, 3, 4, 5, 6].map(item) },
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path.join(".") === "content.items")).toBe(true);
  });

  it("requires exactly one quote for single-spotlight", () => {
    const quote = { quote: "Lovely bread.", name: "A. Customer" };
    expect(TestimonialsGeneration.safeParse({ variant: "single-spotlight", content: { headline: "Quotes", items: [quote, quote] } }).success).toBe(false);
    expect(TestimonialsGeneration.safeParse({ variant: "single-spotlight", content: { headline: "Quotes", items: [quote] } }).success).toBe(true);
  });
});

describe("fallbacks satisfy their own schemas", () => {
  for (const type of ["hero", "features", "testimonials", "cta"] as const) {
    it(`fallback for ${type} passes generation and stored-section validation`, () => {
      const fb = fallbackFor(type, brief);
      expect(GENERATION_SCHEMAS[type].safeParse(fb).success).toBe(true);
      const stored = Section.safeParse({
        id: `${type}-0`,
        type,
        variant: fb.variant,
        content: fb.content,
        style: { accent: "#6b8f71", accentAlt: "#8fae86", seed: 1, motion: "balanced", floatingShapes: 3, cursorGlow: true },
        status: "fallback",
      });
      expect(stored.success).toBe(true);
    });
  }
});
