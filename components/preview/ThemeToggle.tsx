"use client";

export type PageTheme = "light" | "dark";

/**
 * Switches the generated page's theme only. The tool chrome is unaffected.
 * Reports the click position so the sweep can start from the button.
 */
export function ThemeToggle({
  value,
  onChange,
}: {
  value: PageTheme;
  onChange: (next: PageTheme, origin: { x: number; y: number }) => void;
}) {
  const next: PageTheme = value === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="tool-button"
      onClick={(e) => onChange(next, { x: e.clientX, y: e.clientY })}
      aria-label={`Cambiar la vista previa al tema ${next === "dark" ? "oscuro" : "claro"}`}
    >
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: value === "dark" ? "#f1f2f5" : "#0b0c10", boxShadow: "0 0 0 1px var(--tool-border)" }}
        />
        {value === "dark" ? "Claro" : "Oscuro"}
      </span>
    </button>
  );
}

const HEIGHTS: Record<string, number> = { hero: 520, features: 460, testimonials: 340, cta: 300 };

export function SectionSkeleton({ type, label = "Preparando esta sección…" }: { type: string; label?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      style={{
        height: HEIGHTS[type] ?? 300,
        display: "grid",
        placeItems: "center",
        color: "var(--page-muted)",
        fontSize: "0.9rem",
        background:
          "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 10%, transparent), transparent)",
        backgroundSize: "200% 100%",
        animation: "skeleton-sweep 1.8s ease-in-out infinite",
      }}
    >
      {label}
    </div>
  );
}
