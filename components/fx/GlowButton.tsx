"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import type { MouseEvent } from "react";
import { useLinkProps } from "@/components/sections/PageMode";

type Props = {
  label: string;
  href?: string;
  variant?: "primary" | "ghost";
  tilt?: boolean;
  pulse?: boolean;
  size?: "md" | "lg";
};

/**
 * Primary: filled with the accent, pulsing glow, glow intensifies and lifts on
 * hover, presses to 0.97. Ghost: glass surface with the same motion and no
 * fill. Tilt adds a small 3D rotation toward the pointer.
 */
export function GlowButton({ label, href = "#", variant = "primary", tilt = false, pulse = true, size = "md" }: Props) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 18 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 220, damping: 18 });

  function onMove(e: MouseEvent<HTMLAnchorElement>) {
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onLeave() {
    mx.set(0);
    my.set(0);
  }

  const primary = variant === "primary";
  const link = useLinkProps(href);

  return (
    <motion.a
      {...link}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{ scale: 1.035, y: -1 }}
      whileTap={{ scale: 0.97, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      style={{
        rotateX: tilt ? rx : 0,
        rotateY: tilt ? ry : 0,
        transformStyle: "preserve-3d",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: size === "lg" ? "1rem 1.6rem" : "0.8rem 1.3rem",
        borderRadius: "999px",
        fontWeight: 600,
        fontSize: size === "lg" ? "1.02rem" : "0.95rem",
        letterSpacing: "-0.01em",
        textDecoration: "none",
        cursor: "pointer",
        color: primary ? "var(--accent-ink)" : "var(--page-text)",
        background: primary
          ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, var(--accent-alt)))"
          : "var(--page-glass)",
        border: primary ? "1px solid color-mix(in srgb, var(--accent) 60%, white)" : "1px solid var(--page-glass-border)",
        backdropFilter: primary ? undefined : "blur(14px)",
        animation: primary && pulse ? "glow-pulse 3.2s ease-in-out infinite" : undefined,
        boxShadow: primary ? undefined : "var(--page-glass-shadow)",
      }}
      className="glow-button group"
    >
      <span style={{ transform: "translateZ(12px)" }}>{label}</span>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: primary ? "var(--accent-ink)" : "var(--accent)",
          opacity: 0.7,
          transform: "translateZ(12px)",
        }}
        className="transition-transform duration-200 group-hover:translate-x-1"
      />
    </motion.a>
  );
}
