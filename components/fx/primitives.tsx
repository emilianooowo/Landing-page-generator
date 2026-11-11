"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import { resolveImageSrc } from "@/lib/images";
import { rngFrom } from "@/lib/seed";
import type { CuratedImage as CuratedImageData } from "@/lib/schemas/primitives";

/* ------------------------------------------------------------- GlassPanel */

export function GlassPanel({
  children,
  className = "",
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  as?: "div" | "article" | "blockquote" | "li";
}) {
  return (
    <Tag className={`glass ${className}`} style={style}>
      {children}
    </Tag>
  );
}

/* --------------------------------------------------------------- TiltCard */

/** Pointer-driven 3D tilt with a light sheen that follows the pointer. */
export function TiltCard({
  children,
  className = "",
  max = 7,
  style,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  style?: React.CSSProperties;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [max, -max]), { stiffness: 180, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-max, max]), { stiffness: 180, damping: 20 });
  const sheenX = useTransform(mx, [-0.5, 0.5], ["20%", "80%"]);
  const sheenY = useTransform(my, [-0.5, 0.5], ["20%", "80%"]);
  const sheen = useMotionTemplate`radial-gradient(circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.18), transparent 55%)`;

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }

  return (
    <motion.div
      onMouseMove={onMove}
      onMouseLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d", position: "relative", ...style }}
      className={`glass ${className}`}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", background: sheen }}
      />
      <div style={{ transform: "translateZ(18px)", position: "relative" }}>{children}</div>
    </motion.div>
  );
}

/* ---------------------------------------------------------- ParallaxLayer */

/**
 * Moves its children against the scroll direction by an amount proportional
 * to `depth` (0 = pinned to the page, 1 = near foreground, negative = far
 * background). Uses window scroll, which is what the preview scrolls with.
 */
export function ParallaxLayer({
  children,
  depth = 0.5,
  className = "",
  style,
}: {
  children: ReactNode;
  depth?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [depth * 48, depth * -48]);
  return (
    <motion.div ref={ref} style={{ y: reduce ? 0 : y, ...style }} className={className}>
      {children}
    </motion.div>
  );
}

/* ----------------------------------------------------------- CuratedImage */

/**
 * Renders a curated photo if one exists at the resolved path; otherwise a
 * generative tile in the page's accent. A broken image tag never appears.
 */
export function CuratedImage({
  image,
  seed,
  className = "",
  style,
}: {
  image?: CuratedImageData;
  seed: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [failed, setFailed] = useState(!image);
  if (!image || failed) return <GenerativeTile seed={seed} className={className} style={style} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolveImageSrc(image, seed)}
      alt={image.alt}
      onError={() => setFailed(true)}
      className={className}
      style={{ objectFit: "cover", width: "100%", height: "100%", display: "block", ...style }}
    />
  );
}

export function GenerativeTile({ seed, className = "", style }: { seed: number; className?: string; style?: React.CSSProperties }) {
  const rng = rngFrom(seed);
  const circles = Array.from({ length: 5 }, () => ({
    cx: rng.int(10, 90),
    cy: rng.int(10, 90),
    r: rng.int(18, 46),
    o: 0.25 + rng.next() * 0.45,
    alt: rng.next() > 0.5,
  }));
  const angle = rng.int(0, 360);
  return (
    <div
      role="img"
        aria-label="Imagen decorativa de ejemplo"
      className={className}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: `linear-gradient(${angle}deg, color-mix(in srgb, var(--accent) 30%, var(--page-surface)), color-mix(in srgb, var(--accent-alt) 45%, var(--page-surface)))`,
        ...style,
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" style={{ display: "block" }}>
        <defs>
          <filter id={`blur-${seed}`}>
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        {circles.map((c, i) => (
          <circle
            key={i}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill={c.alt ? "var(--accent-alt)" : "var(--accent)"}
            opacity={c.o}
            filter={`url(#blur-${seed})`}
          />
        ))}
      </svg>
    </div>
  );
}
