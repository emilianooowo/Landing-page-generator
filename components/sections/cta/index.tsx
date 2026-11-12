"use client";

import { motion } from "framer-motion";
import type { CtaSection } from "@/lib/schemas/cta";
import { useLinkProps } from "@/components/sections/PageMode";
import { CursorGlow, CuratedImage, FloatingShapes, GlowButton, MeshGradient, ParallaxLayer, TiltCard } from "@/components/fx";
import { Container, Display, Lede, Muted, Reveal, SectionShell } from "@/components/sections/shared";

type Props = { section: CtaSection };

function Buttons({ section, center = false }: { section: CtaSection; center?: boolean }) {
  const { content } = section;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${center ? "justify-center" : ""}`}>
      <GlowButton label={content.primaryCta.label} href={content.primaryCta.href} tilt size="lg" />
      {content.secondaryCta && <GlowButton label={content.secondaryCta.label} href={content.secondaryCta.href} variant="ghost" size="lg" />}
    </div>
  );
}

/* ------------------------------------------------------------- glow-band */

export function CtaGlowBand({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell padded={false} className="px-6 py-10 @md:px-10">
      <Container>
        <Reveal motion={style.motion}>
          <div
            className="relative overflow-hidden px-8 py-14 text-center @md:px-14 @md:py-20"
            style={{
              borderRadius: "calc(var(--radius) * 1.4)",
              background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 88%, var(--page-bg)), color-mix(in srgb, var(--accent-alt) 75%, var(--page-bg)))",
              color: "var(--accent-ink)",
              boxShadow: "0 40px 90px -40px color-mix(in srgb, var(--accent) 70%, transparent)",
            }}
          >
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
              <FloatingShapes seed={style.seed + 31} count={3} kinds={["ring", "orb"]} />
            </div>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-1/2"
              style={{ background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.18), transparent 30%)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
            />
            <div className="relative">
              <Display size="lg">{content.headline}</Display>
              {content.subheadline && (
                <p className="mx-auto mt-4 max-w-[34rem] text-[1.05rem]" style={{ opacity: 0.85 }}>{content.subheadline}</p>
              )}
              <div className="mt-8 flex justify-center">
                <CtaInverse section={section} />
              </div>
              {content.reassurance && <p className="mt-5 text-sm" style={{ opacity: 0.75 }}>{content.reassurance}</p>}
            </div>
          </div>
        </Reveal>
      </Container>
    </SectionShell>
  );
}

/** On a filled band the primary button flips to the page surface so it still reads as the brightest thing. */
function CtaInverse({ section }: Props) {
  const { content } = section;
  const primaryLink = useLinkProps(content.primaryCta.href);
  const secondaryLink = useLinkProps(content.secondaryCta?.href ?? "#");
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <motion.a
        {...primaryLink}
        whileHover={{ scale: 1.035, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className="inline-flex items-center gap-2 rounded-full px-7 py-4 font-semibold"
        style={{ background: "var(--page-bg)", color: "var(--page-text)", boxShadow: "0 12px 30px -12px rgba(0,0,0,0.5)" }}
      >
        {content.primaryCta.label}
      </motion.a>
      {content.secondaryCta && (
        <a {...secondaryLink} className="rounded-full px-6 py-4 font-medium" style={{ border: "1px solid rgba(255,255,255,0.4)", color: "inherit" }}>
          {content.secondaryCta.label}
        </a>
      )}
    </div>
  );
}

/* --------------------------------------------------------- glass-monolith */

export function CtaGlassMonolith({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell className="min-h-[26rem] flex items-center">
      <MeshGradient seed={style.seed + 41} intensity={1.1} />
      <FloatingShapes seed={style.seed + 41} count={style.floatingShapes} kinds={["orb", "coin"]} />
      {style.cursorGlow && <CursorGlow />}
      <Container narrow>
        <Reveal motion={style.motion}>
          <TiltCard max={3} className="px-8 py-14 text-center @md:px-14 @md:py-18" style={{ borderRadius: "calc(var(--radius) * 1.3)" }}>
            <Display size="lg">{content.headline}</Display>
            {content.subheadline && <div className="mt-4 flex justify-center"><Lede className="text-center">{content.subheadline}</Lede></div>}
            <div className="mt-9"><Buttons section={section} center /></div>
            {content.reassurance && <Muted className="mt-5 text-sm">{content.reassurance}</Muted>}
          </TiltCard>
        </Reveal>
      </Container>
    </SectionShell>
  );
}

/* ---------------------------------------------------------- split-orbital */

export function CtaSplitOrbital({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 51} intensity={0.7} />
      {style.cursorGlow && <CursorGlow size={600} strength={0.18} />}
      <Container className="grid items-center gap-12 @3xl:grid-cols-[1fr_0.85fr]">
        <div>
          <Reveal motion={style.motion}><Display size="lg">{content.headline}</Display></Reveal>
          {content.subheadline && <Reveal index={1} motion={style.motion} className="mt-4"><Lede>{content.subheadline}</Lede></Reveal>}
          <Reveal index={2} motion={style.motion} className="mt-9"><Buttons section={section} /></Reveal>
          {content.reassurance && <Reveal index={3} motion={style.motion}><Muted className="mt-5 text-sm">{content.reassurance}</Muted></Reveal>}
        </div>
        <ParallaxLayer depth={0.6} className="relative mx-auto w-full max-w-[24rem]" style={{ perspective: "1000px" }}>
          <div aria-hidden className="absolute -inset-8 rounded-full" style={{ border: "1px dashed color-mix(in srgb, var(--accent) 40%, transparent)", animation: "orbit 60s linear infinite" }} />
          <motion.div
            initial={{ opacity: 0, rotateY: 18, y: 20 }}
            whileInView={{ opacity: 1, rotateY: 8, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <TiltCard max={6} className="overflow-hidden p-2" style={{ borderRadius: "calc(var(--radius) * 1.3)" }}>
              <div className="overflow-hidden" style={{ borderRadius: "calc(var(--radius) * 1.1)", aspectRatio: "1" }}>
                <CuratedImage image={content.image} photo={style.photo} seed={style.seed + 51} editable />
              </div>
            </TiltCard>
          </motion.div>
          <FloatingShapes seed={style.seed + 52} count={2} kinds={["coin", "ring"]} />
        </ParallaxLayer>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ aurora-wave */

export function CtaAuroraWave({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell padded={false} className="py-24">
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <MeshGradient seed={style.seed + 61} intensity={1.2} />
        <motion.svg
          viewBox="0 0 1200 300"
          preserveAspectRatio="none"
          className="absolute inset-x-0 bottom-0 h-[55%] w-full"
          style={{ opacity: 0.55 }}
        >
          <motion.path
            fill="color-mix(in srgb, var(--accent) 35%, transparent)"
            initial={{ d: "M0,160 C300,80 500,240 800,150 C1000,90 1100,180 1200,140 L1200,300 L0,300 Z" }}
            animate={{
              d: [
                "M0,160 C300,80 500,240 800,150 C1000,90 1100,180 1200,140 L1200,300 L0,300 Z",
                "M0,140 C250,220 550,60 800,170 C1000,240 1100,120 1200,160 L1200,300 L0,300 Z",
                "M0,160 C300,80 500,240 800,150 C1000,90 1100,180 1200,140 L1200,300 L0,300 Z",
              ],
            }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.path
            fill="color-mix(in srgb, var(--accent-alt) 40%, transparent)"
            animate={{
              d: [
                "M0,200 C200,140 450,260 700,190 C950,130 1050,230 1200,190 L1200,300 L0,300 Z",
                "M0,190 C250,250 500,150 750,210 C950,260 1100,170 1200,210 L1200,300 L0,300 Z",
                "M0,200 C200,140 450,260 700,190 C950,130 1050,230 1200,190 L1200,300 L0,300 Z",
              ],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.svg>
      </div>
      <Container narrow className="px-6 text-center @md:px-10">
        <Reveal motion={style.motion}><Display size="lg">{content.headline}</Display></Reveal>
        {content.subheadline && <Reveal index={1} motion={style.motion} className="mt-4 flex justify-center"><Lede className="text-center">{content.subheadline}</Lede></Reveal>}
        <Reveal index={2} motion={style.motion} className="mt-9"><Buttons section={section} center /></Reveal>
        {content.reassurance && <Reveal index={3} motion={style.motion}><Muted className="mt-5 text-sm">{content.reassurance}</Muted></Reveal>}
      </Container>
    </SectionShell>
  );
}
