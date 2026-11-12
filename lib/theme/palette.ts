import type { BusinessBrief, Vibe } from "@/lib/schemas/brief";
import { rngFrom, seedFrom } from "@/lib/seed";
import { styleOf } from "@/lib/styles/landingStyles";

/**
 * First pass. Produces the accent pair that drives gradients, glows and buttons.
 * Deliberately conservative on saturation: the "default AI page" look is largely
 * a fully-saturated purple→pink diagonal, so hues are spread and desaturated,
 * and lightness is clamped to a band that stays legible on both themes.
 *
 * Revisit during the theming pass — moving this to OKLCH would give more even
 * perceptual steps between accent and accentAlt.
 */

type Hsl = { h: number; s: number; l: number };

/** Hue ranges that read as the vibe, avoiding the 270–320 purple-pink default. */
const VIBE_HUES: Record<Vibe, [number, number]> = {
  bold: [8, 40],
  calm: [175, 215],
  playful: [330, 355],
  premium: [220, 255],
  technical: [190, 220],
  warm: [25, 55],
  minimal: [200, 230],
};

const SATURATION: Record<Vibe, number> = {
  bold: 72,
  calm: 42,
  playful: 68,
  premium: 48,
  technical: 55,
  warm: 60,
  minimal: 30,
};

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) =>
    lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (v: number) =>
    Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

export type AccentPair = { accent: string; accentAlt: string };

export function derivePalette(brief: BusinessBrief, projectId: string): AccentPair {
  const primaryVibe = styleOf(brief)?.vibe ?? brief.vibe[0];
  const rng = rngFrom(seedFrom(projectId, brief.businessName));
  // A picked style brings its own accent; the person's brand colour still wins.
  const fixedColor = brief.brandColor ?? styleOf(brief)?.accent;

  let base: Hsl;
  if (fixedColor) {
    const brand = hexToHsl(fixedColor);
    // Keep their hue; pull extremes back into a band that survives both themes.
    base = {
      h: brand.h,
      s: Math.min(Math.max(brand.s, 32), 78),
      l: Math.min(Math.max(brand.l, 42), 62),
    };
  } else {
    const [min, max] = VIBE_HUES[primaryVibe];
    base = {
      h: min + rng.next() * (max - min),
      s: SATURATION[primaryVibe],
      l: 52,
    };
  }

  // Second accent sits a deliberate distance away — enough for a gradient to
  // have movement, not so far that it reads as two unrelated brands.
  const shift = 26 + rng.next() * 22;
  const direction = rng.next() > 0.5 ? 1 : -1;
  const accentAlt: Hsl = {
    h: (base.h + shift * direction + 360) % 360,
    s: Math.max(base.s - 12, 24),
    l: Math.min(base.l + 9, 68),
  };

  return { accent: hslToHex(base), accentAlt: hslToHex(accentAlt) };
}
