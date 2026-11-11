"use client";

import { SectionErrorBoundary } from "./SectionErrorBoundary";
import { componentFor } from "@/lib/variants/registry";
import type { Section } from "@/lib/schemas/section";

/**
 * The only place the discriminated union becomes UI. Per-section style lands
 * here as CSS variables; variants read var(--accent) and nothing else.
 * `variantOverride` lets the chooser preview a different layout without
 * touching the stored section.
 */
export function SectionRenderer({ section, variantOverride, accentOverride }: { section: Section; variantOverride?: string; accentOverride?: string }) {
  const rendered = variantOverride ? ({ ...section, variant: variantOverride } as Section) : section;
  const Component = componentFor(rendered);

  return (
    <SectionErrorBoundary sectionType={section.type}>
      <div
        data-section-id={section.id}
        data-section-type={section.type}
        style={
          {
            "--accent": accentOverride ?? section.style.accent,
            "--accent-alt": accentOverride
              ? `color-mix(in srgb, ${accentOverride} 72%, white)`
              : section.style.accentAlt,
          } as React.CSSProperties
        }
      >
        <Component section={rendered} />
      </div>
    </SectionErrorBoundary>
  );
}
