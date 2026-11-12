import type { BusinessBrief, Vibe } from "@/lib/schemas/brief";
import type { SectionStyle } from "@/lib/schemas/primitives";
import { styleOf, type DisplayFace } from "@/lib/styles/landingStyles";

/**
 * Two page-level decisions that come from the vibe rather than the section:
 * which display face the headlines use, and how the whole page moves.
 * Both land as CSS variables on .page-scope so every variant inherits them.
 */

const FACE_BY_VIBE: Record<Vibe, DisplayFace> = {
  premium: "serif",
  warm: "serif",
  calm: "serif",
  technical: "grotesk",
  bold: "grotesk",
  minimal: "grotesk",
  playful: "round",
};

const FACE_VAR: Record<DisplayFace, string> = {
  serif: "var(--font-display-serif)",
  grotesk: "var(--font-display-grotesk)",
  round: "var(--font-display-round)",
};

/** Motion personality per the brief's energy. Durations in ms. */
const PERSONALITY: Record<SectionStyle["motion"], { quick: number; standard: number; slow: number; ease: string }> = {
  subtle: { quick: 180, standard: 420, slow: 800, ease: "cubic-bezier(0.4, 0, 0.2, 1)" },
  balanced: { quick: 160, standard: 320, slow: 640, ease: "cubic-bezier(0.2, 0, 0, 1)" },
  lively: { quick: 120, standard: 240, slow: 520, ease: "cubic-bezier(0.175, 0.885, 0.32, 1.275)" },
};

export function pageScopeVars(brief: BusinessBrief, motion: SectionStyle["motion"]): React.CSSProperties {
  const face = styleOf(brief)?.face ?? FACE_BY_VIBE[brief.vibe[0]] ?? "grotesk";
  const p = PERSONALITY[motion];
  return {
    "--font-display": FACE_VAR[face],
    "--dur-quick": `${p.quick}ms`,
    "--dur-standard": `${p.standard}ms`,
    "--dur-slow": `${p.slow}ms`,
    "--ease": p.ease,
    "--radius": face === "round" ? "1.75rem" : face === "serif" ? "1.1rem" : "0.9rem",
  } as React.CSSProperties;
}

/** Framer Motion reads numbers, not CSS variables, so the same table in seconds. */
export function motionSeconds(motion: SectionStyle["motion"]) {
  const p = PERSONALITY[motion];
  return { quick: p.quick / 1000, standard: p.standard / 1000, slow: p.slow / 1000 };
}
