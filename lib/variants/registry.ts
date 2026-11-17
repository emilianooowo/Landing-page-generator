import { createElement, type ComponentType, type ReactElement } from "react";
import { CtaAuroraWave, CtaGlassMonolith, CtaGlowBand, CtaSplitOrbital } from "@/components/sections/cta";
import { FeaturesDepthBento, FeaturesFloatingColumn, FeaturesGlassGrid, FeaturesOrbitRing } from "@/components/sections/features";
import { HeroAuroraVeil, HeroFloatingGlassSplit, HeroOrbitalStack, HeroSpotlightMonolith } from "@/components/sections/hero";
import {
  TestimonialsDepthMarquee,
  TestimonialsFloatingCards,
  TestimonialsGlassCarousel,
  TestimonialsSingleSpotlight,
} from "@/components/sections/testimonials";
import type { SectionType } from "@/lib/schemas/primitives";
import type { Section } from "@/lib/schemas/section";
import { FALLBACK_VARIANTS } from "@/lib/schemas/section";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SectionComponent = ComponentType<{ section: any }>;

/**
 * Keys are the ids in each section's zod enum. Adding a variant means adding
 * it to the enum, the catalog (label + guidance) and here. Nothing else.
 */
export const VARIANT_COMPONENTS: Record<SectionType, Record<string, SectionComponent>> = {
  hero: {
    "aurora-veil": HeroAuroraVeil,
    "floating-glass-split": HeroFloatingGlassSplit,
    "spotlight-monolith": HeroSpotlightMonolith,
    "orbital-stack": HeroOrbitalStack,
  },
  features: {
    "glass-grid": FeaturesGlassGrid,
    "depth-bento": FeaturesDepthBento,
    "floating-column": FeaturesFloatingColumn,
    "orbit-ring": FeaturesOrbitRing,
  },
  testimonials: {
    "glass-carousel": TestimonialsGlassCarousel,
    "floating-cards": TestimonialsFloatingCards,
    "single-spotlight": TestimonialsSingleSpotlight,
    "depth-marquee": TestimonialsDepthMarquee,
  },
  cta: {
    "glow-band": CtaGlowBand,
    "glass-monolith": CtaGlassMonolith,
    "split-orbital": CtaSplitOrbital,
    "aurora-wave": CtaAuroraWave,
  },
};

export function componentFor(section: Section): SectionComponent {
  return VARIANT_COMPONENTS[section.type][section.variant] ?? VARIANT_COMPONENTS[section.type][FALLBACK_VARIANTS[section.type]];
}

/**
 * Renders the section's variant. Components come from the static table above;
 * rendering them through this helper (instead of assigning one to a variable
 * inside a component) keeps their identity stable for React.
 */
export function renderVariant(section: Section): ReactElement {
  return createElement(componentFor(section), { section });
}
