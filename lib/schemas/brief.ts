import { z } from "zod";
import { hexColor, IMAGE_CATEGORIES, SectionType, text } from "./primitives";

/**
 * The internal structured brief. The user never sees any of these field names —
 * they type one paragraph and this is inferred from it.
 */

export const VIBES = [
  "bold",
  "calm",
  "playful",
  "premium",
  "technical",
  "warm",
  "minimal",
] as const;

export const Vibe = z.enum(VIBES);
export type Vibe = z.infer<typeof Vibe>;

export const BusinessBrief = z.object({
  businessName: text(60),
  /** True only when the person explicitly named the business in their description. */
  hasBusinessName: z.boolean().default(false),
  /** One sentence, in the business's own terms, not marketing language. */
  whatTheyDo: text(200),
  audience: text(120),
  vibe: z.array(Vibe).min(1).max(2),
  /** Only when the user actually mentioned a colour. Absent means derive one. */
  brandColor: hexColor.optional(),
  /** The visual world this business lives in — drives curated image selection. */
  imageWorld: z.enum(IMAGE_CATEGORIES),
  /** What the user wants a visitor to do, in plain words: "book a table", "get a quote". */
  desiredAction: text(40),
  /** Concrete things worth saying. Feeds the features section. */
  keyPoints: z.array(text(80)).max(6).default([]),
  /**
   * Whether the business plausibly has customers to quote. False for a business
   * that hasn't launched — the testimonials section is dropped rather than invented.
   */
  hasCustomers: z.boolean().default(false),
  /** Which sections this page gets, in render order. */
  sections: z.array(SectionType).min(2).max(4),
});
export type BusinessBrief = z.infer<typeof BusinessBrief>;

/* ------------------------------------------------------------ follow-ups */

export const FollowUpQuestion = z.object({
  /** Which brief field this answers — used to merge the reply back in. */
  field: z.enum(["whatTheyDo", "audience", "vibe", "desiredAction", "keyPoints"]),
  /** Plain language. No jargon, no field names, no "select your tone". */
  question: text(140),
  /** Tappable suggestions so the user rarely has to type again. */
  suggestions: z.array(text(32)).min(2).max(4),
});
export type FollowUpQuestion = z.infer<typeof FollowUpQuestion>;

/**
 * Flat on purpose: Gemini's responseSchema handles unions badly, so the model
 * returns a partial brief plus any questions, and completeness is decided here
 * by re-parsing `brief` against BusinessBrief rather than trusting a status flag.
 */
export const BriefParse = z.object({
  brief: BusinessBrief.partial(),
  questions: z.array(FollowUpQuestion).max(2).default([]),
});
export type BriefParse = z.infer<typeof BriefParse>;

export type BriefParseOutcome =
  | { status: "complete"; brief: BusinessBrief }
  | { status: "needs-input"; partial: Partial<BusinessBrief>; questions: FollowUpQuestion[] };

export function resolveBriefParse(parse: BriefParse): BriefParseOutcome {
  const complete = BusinessBrief.safeParse(parse.brief);
  if (complete.success && parse.questions.length === 0) {
    return { status: "complete", brief: complete.data };
  }
  return {
    status: "needs-input",
    partial: parse.brief,
    // If the brief is short of required fields but the model asked nothing,
    // we still need something to show — the caller fills this from the missing keys.
    questions: parse.questions,
  };
}
