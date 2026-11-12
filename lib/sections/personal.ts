import type { Section } from "@/lib/schemas/section";

/**
 * What the person set by hand on a section and the AI must never replace:
 * their own photo and where each button leads. Copied from the previous
 * version of a section onto a new one (after an AI edit or a regeneration).
 */
export function carryOver(previous: Section | undefined, next: Section): Section {
  if (!previous) return next;

  const style = previous.style.photo ? { ...next.style, photo: previous.style.photo } : next.style;

  const prevContent = previous.content as Record<string, unknown>;
  const content = { ...(next.content as Record<string, unknown>) };
  for (const key of ["primaryCta", "secondaryCta"] as const) {
    const before = prevContent[key] as { href?: string } | undefined;
    const after = content[key] as { label: string; href?: string } | undefined;
    if (before?.href && before.href !== "#" && after) content[key] = { ...after, href: before.href };
  }

  return { ...next, style, content } as Section;
}

/** Links on freshly generated copy are always empty: only the person sets them. */
export function withoutLinks(section: Section): Section {
  const content = { ...(section.content as Record<string, unknown>) };
  for (const key of ["primaryCta", "secondaryCta"] as const) {
    const cta = content[key] as { label: string; href?: string } | undefined;
    if (cta) content[key] = { ...cta, href: "#" };
  }
  return { ...section, content } as Section;
}
