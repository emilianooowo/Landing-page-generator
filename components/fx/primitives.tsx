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
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { usePageMode, type ImageSlotControls } from "@/components/sections/PageMode";
import { rngFrom } from "@/lib/seed";
import type { CuratedImage as CuratedImageData, UploadedPhoto } from "@/lib/schemas/primitives";

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
  // In the editor the cards hold still: a card that tilts and lifts under the
  // pointer makes its image slot a moving target that's hard to click.
  const still = Boolean(usePageMode().image);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    if (still) return;
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
      whileHover={still ? undefined : { y: -4 }}
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
 * Renders the person's own photo when the section has one, else a curated
 * photo if one exists at the resolved path, else a generative tile in the
 * page's accent. A broken image tag never appears.
 *
 * With `editable` (a section's main image), inside the editor the slot itself
 * is the upload control: click an empty slot to upload, × to remove a photo.
 */
export function CuratedImage({
  image,
  photo,
  seed,
  editable = false,
  className = "",
  style,
}: {
  image?: CuratedImageData;
  photo?: UploadedPhoto;
  seed: number;
  editable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const src = photo?.url ?? (image ? resolveImageSrc(image, seed) : undefined);
  // Keyed by src so a new photo gets a fresh attempt after an earlier one failed.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const controls = usePageMode().image;

  const picture = !src || failedSrc === src
    ? <GenerativeTile seed={seed} className={className} style={style} />
    : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={photo?.alt ?? image?.alt ?? ""}
        onError={() => setFailedSrc(src)}
        className={className}
        style={{ objectFit: "cover", width: "100%", height: "100%", display: "block", ...style }}
      />
    );

  if (!editable || !controls) return picture;
  return <EditableImageSlot controls={controls}>{picture}</EditableImageSlot>;
}

/**
 * The whole image box is one button: empty box → upload, box with the
 * person's photo → remove it. The picture sits inside the button, so a click
 * anywhere on it works; the hover layer is decoration only.
 */
function EditableImageSlot({ controls, children }: { controls: ImageSlotControls; children: ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPhoto = Boolean(controls.photo);
  const label = hasPhoto ? "Quitar imagen" : "Subir imagen";

  return (
    <>
      <button
        type="button"
        disabled={controls.busy}
        onClick={() => (hasPhoto ? controls.onRemove() : inputRef.current?.click())}
        className="group/image relative block h-full w-full cursor-pointer p-0 text-left disabled:cursor-progress"
        style={{ border: 0, background: "transparent", font: "inherit", color: "inherit" }}
        aria-label={hasPhoto ? "Quitar esta imagen" : "Subir una imagen para este recuadro"}
        title={label}
      >
        {children}
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 grid place-items-center transition-opacity duration-150 ${
            controls.busy ? "opacity-100" : "opacity-0 group-hover/image:opacity-100 group-focus-visible/image:opacity-100 [@media(hover:none)]:opacity-100"
          }`}
          style={{
            background: hasPhoto && !controls.busy
              ? "rgba(20, 16, 18, 0.55)"
              : "color-mix(in srgb, var(--page-bg) 55%, transparent)",
            boxShadow: "inset 0 0 0 2px color-mix(in srgb, var(--accent) 70%, transparent)",
            borderRadius: "inherit",
          }}
        >
          <span
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg"
            style={hasPhoto && !controls.busy
              ? { background: "#ffffff", color: "#1d1416" }
              : { background: "var(--page-surface)", color: "var(--page-text)", border: "1px solid var(--page-border)" }}
          >
            {controls.busy ? (
              <><LoaderCircle size={17} className="animate-spin" /> Subiendo imagen…</>
            ) : hasPhoto ? (
              <><Trash2 size={17} /> Quitar imagen</>
            ) : (
              <><ImagePlus size={17} /> Subir imagen</>
            )}
          </span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) controls.onUpload(file);
          event.target.value = "";
        }}
      />
    </>
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
