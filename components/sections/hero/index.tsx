"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { HeroSection } from "@/lib/schemas/hero";
import { CuratedImage } from "@/components/fx/primitives";
import { Container, Display, Lede, SectionActions, SectionShell } from "@/components/sections/shared";

type Props = { section: HeroSection };

function ProofPoints({ section, className = "", inverse = false }: { section: HeroSection; className?: string; inverse?: boolean }) {
  const points = section.content.proofPoints;
  if (!points?.length) return null;
  return (
    <dl className={`flex flex-wrap gap-x-10 gap-y-5 ${className}`}>
      {points.map((point) => (
        <div key={point.label}>
          <dt className="text-sm" style={{ color: inverse ? "color-mix(in srgb, var(--page-bg) 72%, var(--page-text))" : "var(--page-muted)" }}>{point.label}</dt>
          <dd className="mt-1 text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{point.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ----------------------------------------------------------- aurora-veil */

export function HeroAuroraVeil({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell className="flex min-h-[31rem] items-center text-center @3xl:min-h-[35rem]" style={{ background: "color-mix(in srgb, var(--accent) 7%, var(--page-bg))" }}>
      <Container narrow>
        <Display as="h1" size="xl">{content.headline}</Display>
        <div className="mx-auto mt-5 flex justify-center"><Lede className="text-center">{content.subheadline}</Lede></div>
        <div className="mt-8 flex justify-center">
          <SectionActions primary={content.primaryCta} secondary={content.secondaryCta} align="center" />
        </div>
        <ProofPoints section={section} className="mt-10 justify-center text-left" />
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------- floating-glass-split */

export function HeroFloatingGlassSplit({ section }: Props) {
  const { content, style } = section;
  const reduceMotion = useReducedMotion();
  return (
    <SectionShell padded={false} className="isolate flex min-h-[36rem] items-end @3xl:min-h-[44rem]" style={{ color: "#fff", background: "#211b18" }}>
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <CuratedImage image={content.image} photo={style.photo} seed={style.seed} editable />
      </div>
      <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "linear-gradient(90deg, rgba(17, 15, 14, .76) 0%, rgba(17, 15, 14, .45) 48%, rgba(17, 15, 14, .08) 100%), linear-gradient(0deg, rgba(17, 15, 14, .52), transparent 60%)" }} />
      <motion.div
        className="relative z-[2] w-full px-6 pb-14 pt-28 @md:px-10 @md:pb-16 @3xl:px-16 @3xl:pb-20"
        initial={reduceMotion ? false : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <Container>
          <div className="max-w-[46rem]">
            <Display as="h1" size="xl" className="max-w-[13ch]">{content.headline}</Display>
            <p className="mt-5 max-w-[34rem] text-[1.05rem] leading-relaxed @md:text-[1.2rem]" style={{ color: "rgba(255,255,255,.82)", textWrap: "pretty" }}>{content.subheadline}</p>
            <div className="mt-8"><SectionActions primary={content.primaryCta} secondary={content.secondaryCta} tone="inverse" /></div>
            <ProofPoints section={section} className="mt-10 border-t border-white/25 pt-5" inverse />
          </div>
        </Container>
      </motion.div>
    </SectionShell>
  );
}

/* ---------------------------------------------------- spotlight-monolith */

export function HeroSpotlightMonolith({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell className="flex min-h-[32rem] items-center" style={{ background: "var(--page-text)", color: "var(--page-bg)" }}>
      <Container className="grid items-end gap-10 @3xl:grid-cols-[1.25fr_0.75fr]">
        <div>
          <Display as="h1" size="xl">{content.headline}</Display>
          <p className="mt-5 max-w-[36rem] text-[1.05rem] leading-relaxed @md:text-[1.15rem]" style={{ color: "color-mix(in srgb, var(--page-bg) 72%, var(--page-text))", textWrap: "pretty" }}>
            {content.subheadline}
          </p>
          <div className="mt-8"><SectionActions primary={content.primaryCta} secondary={content.secondaryCta} tone="inverse" /></div>
        </div>
        <ProofPoints section={section} inverse className="border-l border-current/20 pl-6 @3xl:flex-col @3xl:gap-7" />
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------------- orbital-stack */

export function HeroOrbitalStack({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell>
      <Container className="grid items-center gap-12 @3xl:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Display as="h1" size="xl">{content.headline}</Display>
          <Lede className="mt-5">{content.subheadline}</Lede>
          <div className="mt-8"><SectionActions primary={content.primaryCta} secondary={content.secondaryCta} /></div>
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--page-border)" }}>
          {content.proofPoints?.map((point, index) => (
            <li key={point.label} className="grid grid-cols-[3rem_1fr] items-baseline gap-4 py-5 first:pt-0 last:pb-0">
              <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--accent)" }}>0{index + 1}</span>
              <div>
                <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{point.value}</p>
                <p className="mt-1 text-sm" style={{ color: "var(--page-muted)" }}>{point.label}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}
