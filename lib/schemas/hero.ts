import { z } from "zod";
import {
  CtaLink,
  CuratedImage,
  SectionStatus,
  SectionStyle,
  requireSlots,
  text,
} from "./primitives";

/**
 * Variant ids are internal. The plain-language label shown on the thumbnail
 * ("Bold & floating") lives in the variant registry, never in the schema.
 */
export const HERO_VARIANTS = [
  "aurora-veil",          // centered statement with open space, no image
  "floating-glass-split", // full-bleed editorial photograph with overlaid copy
  "spotlight-monolith",   // high-contrast copy with supporting proof points
  "orbital-stack",        // headline paired with a vertical proof-point list
] as const;

export const HeroVariant = z.enum(HERO_VARIANTS);
export type HeroVariant = z.infer<typeof HeroVariant>;

export const HeroContent = z.object({
  headline: text(70),
  subheadline: text(160),
  primaryCta: CtaLink,
  secondaryCta: CtaLink.optional(),
  proofPoints: z
    .array(z.object({ value: text(12), label: text(28) }))
    .min(2)
    .max(3)
    .optional(),
  image: CuratedImage.optional(),
});
export type HeroContent = z.infer<typeof HeroContent>;

const HERO_REQUIRED_SLOTS = {
  "aurora-veil": [],
  "floating-glass-split": ["image"],
  "spotlight-monolith": [],
  "orbital-stack": ["proofPoints"],
} as const satisfies Record<HeroVariant, readonly (keyof HeroContent & string)[]>;

/**
 * Base is refinement-free so it can be converted to a Gemini responseSchema.
 * HeroGeneration is what actually validates the reply.
 */
export const HeroGenerationBase = z.object({ variant: HeroVariant, content: HeroContent });

/** What the model must return. Validated on every generate + every targeted edit. */
export const HeroGeneration = HeroGenerationBase.superRefine(requireSlots(HERO_REQUIRED_SLOTS));
export type HeroGeneration = z.infer<typeof HeroGeneration>;

/** What gets stored and rendered. Plain object so it can sit in a discriminated union. */
export const HeroSection = z.object({
  id: z.string(),
  type: z.literal("hero"),
  variant: HeroVariant,
  content: HeroContent,
  style: SectionStyle,
  status: SectionStatus,
});
export type HeroSection = z.infer<typeof HeroSection>;

export const HERO_FALLBACK_VARIANT: HeroVariant = "aurora-veil";
