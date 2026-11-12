import type { BusinessBrief, Vibe } from "@/lib/schemas/brief";
import type { LandingStyleId, MotionIntensity, SectionType } from "@/lib/schemas/primitives";
import type { z } from "zod";

/**
 * The landing styles a person can pick while creating a page.
 *
 * A style is a complete visual direction: it decides the accent colour, the
 * display typeface, light or dark page, how much things move, which section
 * layouts fit, and the tone of the copy. Once picked it wins over whatever the
 * AI inferred from the description (brief.vibe), which then only informs copy.
 */

export type DisplayFace = "serif" | "grotesk" | "round";

export type LandingStyle = {
  id: LandingStyleId;
  /** Shown on the picker card. */
  name: string;
  /** One line under the name, in plain language. */
  description: string;
  /** Drives the derived secondary colour and stays compatible with vibe-based code. */
  vibe: Vibe;
  /** Default accent when the person didn't mention a brand colour. */
  accent: string;
  face: DisplayFace;
  theme: "light" | "dark";
  motion: z.infer<typeof MotionIntensity>;
  floatingShapes: number;
  cursorGlow: boolean;
  /** Layouts that fit this style, preferred first. Ids from lib/variants/catalog.ts. */
  variants: Record<SectionType, string[]>;
  /** Copy direction for the model. */
  copy: string;
  /** Colours for the picker's mini preview. */
  preview: { bg: string; surface: string; text: string; muted: string };
};

export const LANDING_STYLES: Record<LandingStyleId, LandingStyle> = {
  minimal: {
    id: "minimal",
    name: "Minimalista",
    description: "Limpio, con mucho espacio y pocos elementos. Tu mensaje al centro.",
    vibe: "minimal",
    accent: "#3d5a73",
    face: "grotesk",
    theme: "light",
    motion: "subtle",
    floatingShapes: 1,
    cursorGlow: false,
    variants: {
      hero: ["aurora-veil", "spotlight-monolith"],
      features: ["glass-grid", "floating-column"],
      testimonials: ["single-spotlight", "glass-carousel"],
      cta: ["glass-monolith", "aurora-wave"],
    },
    copy: "Frases cortas y claras, sin adornos ni exclamaciones. Di lo esencial con pocas palabras.",
    preview: { bg: "#f7f6f2", surface: "#ffffff", text: "#1f2933", muted: "#7b8794" },
  },
  elegant: {
    id: "elegant",
    name: "Elegante",
    description: "Oscuro, sobrio y con tipografía con serifa. Ideal para algo especial o de alto valor.",
    vibe: "premium",
    accent: "#a8834a",
    face: "serif",
    theme: "dark",
    motion: "subtle",
    floatingShapes: 2,
    cursorGlow: true,
    variants: {
      hero: ["spotlight-monolith", "aurora-veil"],
      features: ["depth-bento", "glass-grid"],
      testimonials: ["single-spotlight", "glass-carousel"],
      cta: ["glass-monolith", "aurora-wave"],
    },
    copy: "Tono sobrio y cuidado, con vocabulario refinado y frases breves. Sin exclamaciones ni expresiones coloquiales.",
    preview: { bg: "#121214", surface: "#1d1c20", text: "#f3eee6", muted: "#a49d92" },
  },
  warm: {
    id: "warm",
    name: "Cálido y cercano",
    description: "Colores tierra y un tono amable, como platicar con tu clientela de siempre.",
    vibe: "warm",
    accent: "#c2603a",
    face: "serif",
    theme: "light",
    motion: "balanced",
    floatingShapes: 3,
    cursorGlow: true,
    variants: {
      hero: ["floating-glass-split", "aurora-veil"],
      features: ["floating-column", "orbit-ring"],
      testimonials: ["floating-cards", "glass-carousel"],
      cta: ["split-orbital", "aurora-wave"],
    },
    copy: "Tono cercano y amable, hablándole de tú a la persona, como lo haría alguien del barrio que conoce a su clientela.",
    preview: { bg: "#fbf3ea", surface: "#fffaf4", text: "#3b2a20", muted: "#8c7464" },
  },
  bold: {
    id: "bold",
    name: "Audaz",
    description: "Contraste fuerte, colores intensos y mucho movimiento. Para no pasar desapercibido.",
    vibe: "bold",
    accent: "#e0442f",
    face: "grotesk",
    theme: "dark",
    motion: "lively",
    floatingShapes: 5,
    cursorGlow: true,
    variants: {
      hero: ["floating-glass-split", "orbital-stack"],
      features: ["depth-bento", "glass-grid"],
      testimonials: ["depth-marquee", "floating-cards"],
      cta: ["glow-band", "split-orbital"],
    },
    copy: "Frases contundentes y directas, con verbos de acción. Títulos cortos y con fuerza.",
    preview: { bg: "#0f1013", surface: "#1b1c21", text: "#ffffff", muted: "#a3a6b0" },
  },
  playful: {
    id: "playful",
    name: "Divertido",
    description: "Formas redondeadas, colores alegres y un tono desenfadado.",
    vibe: "playful",
    accent: "#d94f8a",
    face: "round",
    theme: "light",
    motion: "lively",
    floatingShapes: 5,
    cursorGlow: true,
    variants: {
      hero: ["floating-glass-split", "aurora-veil"],
      features: ["orbit-ring", "glass-grid"],
      testimonials: ["floating-cards", "depth-marquee"],
      cta: ["glow-band", "split-orbital"],
    },
    copy: "Tono divertido y desenfadado, con algún juego de palabras ligero, sin perder claridad sobre qué ofrece el negocio.",
    preview: { bg: "#fff5f8", surface: "#ffffff", text: "#2d1b2e", muted: "#8a6f86" },
  },
  tech: {
    id: "tech",
    name: "Tecnológico",
    description: "Oscuro, preciso y moderno. Para servicios profesionales, digitales o técnicos.",
    vibe: "technical",
    accent: "#2a7fd4",
    face: "grotesk",
    theme: "dark",
    motion: "balanced",
    floatingShapes: 3,
    cursorGlow: true,
    variants: {
      hero: ["spotlight-monolith", "orbital-stack"],
      features: ["glass-grid", "depth-bento"],
      testimonials: ["glass-carousel", "single-spotlight"],
      cta: ["aurora-wave", "glass-monolith"],
    },
    copy: "Tono preciso y profesional. Concreto, enfocado en qué se obtiene y cómo funciona, sin tecnicismos innecesarios.",
    preview: { bg: "#0b1220", surface: "#131d30", text: "#e6eefb", muted: "#8ea0bd" },
  },
};

export const LANDING_STYLE_LIST: LandingStyle[] = Object.values(LANDING_STYLES);

/** The style that best matches how the person described their business. */
const STYLE_FOR_VIBE: Record<Vibe, LandingStyleId> = {
  minimal: "minimal",
  calm: "minimal",
  premium: "elegant",
  warm: "warm",
  bold: "bold",
  playful: "playful",
  technical: "tech",
};

export function recommendedStyle(brief: Pick<BusinessBrief, "vibe">): LandingStyleId {
  return STYLE_FOR_VIBE[brief.vibe[0]] ?? "minimal";
}

export function styleOf(brief: Pick<BusinessBrief, "style">): LandingStyle | undefined {
  return brief.style ? LANDING_STYLES[brief.style] : undefined;
}

/** Accent shown on the page: the person's colour, else the style's, else the app default. */
export function accentFor(brief: Pick<BusinessBrief, "brandColor" | "style">): string {
  return brief.brandColor ?? styleOf(brief)?.accent ?? "#315d88";
}

/** Light or dark page for a project; undefined means "follow the device". */
export function themeFor(brief: Pick<BusinessBrief, "style">): "light" | "dark" | undefined {
  return styleOf(brief)?.theme;
}
