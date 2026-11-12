"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import type { LandingStyleId } from "@/lib/schemas/primitives";
import { LANDING_STYLE_LIST, type DisplayFace } from "@/lib/styles/landingStyles";
import styles from "./StylePicker.module.css";

const FACE_VAR: Record<DisplayFace, string> = {
  serif: "var(--font-display-serif)",
  grotesk: "var(--font-display-grotesk)",
  round: "var(--font-display-round)",
};

const RADIUS: Record<DisplayFace, string> = {
  serif: "8px",
  grotesk: "6px",
  round: "99px",
};

/**
 * Creation step: pick the look of the landing. Each card is a tiny page in
 * that style (colours, typeface, button shape), so the choice is visual rather
 * than a list of adjectives. The style matching the description comes
 * preselected.
 */
export function StylePicker({
  recommended,
  businessLabel,
  busy,
  onBack,
  onConfirm,
}: {
  recommended: LandingStyleId;
  /** Shown as the headline of every preview, so the person sees their own page. */
  businessLabel: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: (style: LandingStyleId) => void;
}) {
  const [selected, setSelected] = useState<LandingStyleId>(recommended);

  return (
    <motion.div
      className={styles.picker}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
    >
      <p className={styles.lead}>Elige cómo se verá tu landing. Después puedes ajustar colores, textos y diseños.</p>

      <div className={styles.grid} role="radiogroup" aria-label="Estilo de la landing">
        {LANDING_STYLE_LIST.map((style) => (
          <button
            key={style.id}
            type="button"
            role="radio"
            aria-checked={selected === style.id}
            className={styles.card}
            onClick={() => setSelected(style.id)}
            onDoubleClick={() => onConfirm(style.id)}
          >
            <span
              className={styles.preview}
              aria-hidden="true"
              style={{
                "--p-bg": style.preview.bg,
                "--p-text": style.preview.text,
                "--p-muted": style.preview.muted,
                "--p-accent": style.accent,
                "--p-face": FACE_VAR[style.face],
                "--p-radius": RADIUS[style.face],
                "--p-glow": style.motion === "subtle" ? 0.35 : style.motion === "lively" ? 0.85 : 0.6,
              } as React.CSSProperties}
            >
              <span className={styles.previewHeadline}>{businessLabel}</span>
              <span className={styles.previewLine} />
              <span className={styles.previewLine} />
              <span className={styles.previewButton}>Contáctanos</span>
            </span>
            <span className={styles.name}>
              {style.name}
              {style.id === recommended && <span className={styles.badge}>Recomendado</span>}
            </span>
            <span className={styles.description}>{style.description}</span>
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.back} onClick={onBack} disabled={busy}>Volver</button>
        <button type="button" className={styles.create} onClick={() => onConfirm(selected)} disabled={busy}>
          Crear mi landing <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
