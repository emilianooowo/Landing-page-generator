"use client";

import { SectionRenderer } from "@/components/sections/SectionRenderer";
import { VARIANT_CATALOG } from "@/lib/variants/catalog";
import type { Section } from "@/lib/schemas/section";
import type { PageTheme } from "@/components/preview/ThemeToggle";

const THUMB_W = 1100;
const SCALE = 0.2;

/**
 * Each thumbnail is the actual variant component rendered with the section's
 * real content inside its own page scope, scaled down. So the looping motion,
 * the glass and the glow are all genuinely what the person will get. No
 * separate thumbnail art to keep in sync.
 */
export function VariantThumbnail({
  section,
  variant,
  theme,
  selected,
  onPick,
}: {
  section: Section;
  variant: string;
  theme: PageTheme;
  selected: boolean;
  onPick: () => void;
}) {
  const meta = VARIANT_CATALOG[section.type].find((v) => v.id === variant);
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className="group text-left"
      style={{ display: "grid", gap: "0.4rem" }}
    >
      <div
        className="relative overflow-hidden rounded-lg transition-transform duration-200 group-hover:scale-[1.02]"
        style={{
          width: THUMB_W * SCALE,
          height: 150,
          border: selected ? "2px solid var(--tool-accent)" : "1px solid var(--tool-border)",
          background: "var(--tool-panel)",
        }}
      >
        <div
          className="page-scope pointer-events-none absolute left-0 top-0 origin-top-left"
          data-theme={theme}
          style={{ width: THUMB_W, transform: `scale(${SCALE})`, fontFamily: "var(--font-body)" }}
          aria-hidden
        >
          <SectionRenderer section={section} variantOverride={variant} />
        </div>
      </div>
      <span className="text-xs" style={{ color: selected ? "var(--tool-text)" : "var(--tool-muted)" }}>{meta?.label ?? "Otro diseño"}</span>
    </button>
  );
}
