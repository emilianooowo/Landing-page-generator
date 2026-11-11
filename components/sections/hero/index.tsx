"use client";

import { motion } from "framer-motion";
import type { HeroSection } from "@/lib/schemas/hero";
import {
  CursorGlow,
  CuratedImage,
  FloatingShapes,
  GlowButton,
  MeshGradient,
  ParallaxLayer,
  TiltCard,
} from "@/components/fx";
import { Container, Display, Kicker, Lede, Reveal, SectionShell } from "@/components/sections/shared";

type Props = { section: HeroSection };

function Ctas({ section, size = "lg" }: { section: HeroSection; size?: "md" | "lg" }) {
  const { content } = section;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <GlowButton label={content.primaryCta.label} href={content.primaryCta.href} tilt size={size} />
      {content.secondaryCta && (
        <GlowButton label={content.secondaryCta.label} href={content.secondaryCta.href} variant="ghost" size={size} />
      )}
    </div>
  );
}

function ProofPoints({ section }: { section: HeroSection }) {
  const points = section.content.proofPoints;
  if (!points?.length) return null;
  return (
    <ul className="mt-10 flex flex-wrap gap-x-10 gap-y-4">
      {points.map((p, i) => (
        <Reveal key={p.label} as="li" index={i + 3} motion={section.style.motion}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", letterSpacing: "-0.02em" }}>{p.value}</div>
          <div className="text-sm" style={{ color: "var(--page-muted)" }}>{p.label}</div>
        </Reveal>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------- aurora-veil */

export function HeroAuroraVeil({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell className="min-h-[34rem] @3xl:min-h-[40rem] flex items-center">
      <MeshGradient seed={style.seed} intensity={1.15} />
      <FloatingShapes seed={style.seed} count={style.floatingShapes} kinds={["orb", "ring"]} />
      {style.cursorGlow && <CursorGlow />}
      <Container narrow className="text-center">
        <div className="glass mx-auto px-7 py-12 @md:px-12 @md:py-16" style={{ borderRadius: "calc(var(--radius) * 1.4)" }}>
          {content.kicker && (
            <Reveal motion={style.motion}>
              <Kicker>{content.kicker}</Kicker>
            </Reveal>
          )}
          <Reveal index={1} motion={style.motion}>
            <Display as="h1" size="xl">{content.headline}</Display>
          </Reveal>
          <Reveal index={2} motion={style.motion} className="mt-6 flex justify-center">
            <Lede className="text-center">{content.subheadline}</Lede>
          </Reveal>
          <Reveal index={3} motion={style.motion} className="mt-9 flex justify-center">
            <Ctas section={section} />
          </Reveal>
          <div className="flex justify-center"><ProofPoints section={section} /></div>
        </div>
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------- floating-glass-split */

export function HeroFloatingGlassSplit({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell className="min-h-[34rem] flex items-center">
      <MeshGradient seed={style.seed} />
      <FloatingShapes seed={style.seed + 7} count={Math.max(2, style.floatingShapes - 1)} kinds={["ring", "coin", "slab"]} />
      {style.cursorGlow && <CursorGlow />}
      <Container className="grid items-center gap-12 @3xl:grid-cols-[1.05fr_0.95fr] @3xl:gap-16">
        <div>
          {content.kicker && (
            <Reveal motion={style.motion}><Kicker>{content.kicker}</Kicker></Reveal>
          )}
          <Reveal index={1} motion={style.motion}>
            <Display as="h1" size="xl">{content.headline}</Display>
          </Reveal>
          <Reveal index={2} motion={style.motion} className="mt-6">
            <Lede>{content.subheadline}</Lede>
          </Reveal>
          <Reveal index={3} motion={style.motion} className="mt-9">
            <Ctas section={section} />
          </Reveal>
          <ProofPoints section={section} />
        </div>
        <ParallaxLayer depth={0.7} className="relative">
          <motion.div
            initial={{ opacity: 0, y: 30, rotateY: -14 }}
            whileInView={{ opacity: 1, y: 0, rotateY: -8 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <TiltCard max={5} className="overflow-hidden p-2" style={{ borderRadius: "calc(var(--radius) * 1.3)" }}>
              <div className="overflow-hidden" style={{ borderRadius: "calc(var(--radius) * 1.1)", aspectRatio: "4 / 3" }}>
                <CuratedImage image={content.image} seed={style.seed} />
              </div>
            </TiltCard>
          </motion.div>
          <motion.div
            aria-hidden
            className="absolute -bottom-6 -left-6 hidden @md:block"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.35, duration: 0.6, ease: [0.2, 0, 0, 1] }}
          >
            <motion.div
              className="glass px-5 py-4"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="text-xs" style={{ color: "var(--page-muted)" }}>Ahora</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>{content.primaryCta.label}</div>
            </motion.div>
          </motion.div>
        </ParallaxLayer>
      </Container>
    </SectionShell>
  );
}

/* ---------------------------------------------------- spotlight-monolith */

export function HeroSpotlightMonolith({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell className="min-h-[36rem] flex items-center" style={{ background: "color-mix(in srgb, var(--page-bg) 92%, var(--accent))" }}>
      <MeshGradient seed={style.seed} intensity={0.6} />
      <CursorGlow size={720} strength={0.32} />
      <Container narrow>
        <div
          className="glass relative overflow-hidden px-8 py-14 @md:px-14 @md:py-20"
          style={{ borderRadius: "calc(var(--radius) * 1.2)", border: "1px solid color-mix(in srgb, var(--accent) 35%, var(--page-glass-border))" }}
        >
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, var(--accent), transparent)" }}
          />
          {content.kicker && (
            <Reveal motion={style.motion}><Kicker>{content.kicker}</Kicker></Reveal>
          )}
          <Reveal index={1} motion={style.motion}>
            <Display as="h1" size="xl">{content.headline}</Display>
          </Reveal>
          <Reveal index={2} motion={style.motion} className="mt-7">
            <Lede>{content.subheadline}</Lede>
          </Reveal>
          <Reveal index={3} motion={style.motion} className="mt-10">
            <Ctas section={section} />
          </Reveal>
          <ProofPoints section={section} />
        </div>
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------------- orbital-stack */

export function HeroOrbitalStack({ section }: Props) {
  const { content, style } = section;
  const points = content.proofPoints ?? [];
  return (
    <SectionShell className="min-h-[36rem] flex items-center">
      <MeshGradient seed={style.seed} />
      <FloatingShapes seed={style.seed + 3} count={2} kinds={["ring"]} />
      {style.cursorGlow && <CursorGlow />}
      <Container className="grid items-center gap-12 @3xl:grid-cols-[1fr_0.9fr]">
        <div>
          {content.kicker && (
            <Reveal motion={style.motion}><Kicker>{content.kicker}</Kicker></Reveal>
          )}
          <Reveal index={1} motion={style.motion}>
            <Display as="h1" size="xl">{content.headline}</Display>
          </Reveal>
          <Reveal index={2} motion={style.motion} className="mt-6">
            <Lede>{content.subheadline}</Lede>
          </Reveal>
          <Reveal index={3} motion={style.motion} className="mt-9">
            <Ctas section={section} />
          </Reveal>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-[26rem]" style={{ perspective: "1000px" }}>
          <div
            aria-hidden
            className="absolute inset-[18%] rounded-full"
            style={{
              background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 35%, transparent), transparent 70%)",
              filter: "blur(20px)",
            }}
          />
          {points.map((p, i) => {
            const angle = (i / Math.max(points.length, 1)) * 360 + 20;
            const r = 40;
            const x = 50 + r * Math.cos((angle * Math.PI) / 180);
            const y = 50 + r * Math.sin((angle * Math.PI) / 180);
            return (
              <motion.div
                key={p.label}
                className="absolute"
                style={{ left: `${x}%`, top: `${y}%`, translate: "-50% -50%" }}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: [0.2, 0, 0, 1] }}
              >
                <motion.div
                  className="glass px-5 py-4 text-center"
                  style={{ minWidth: "8rem" }}
                  animate={{ y: [0, -8 - i * 2, 0] }}
                  transition={{ duration: 7 + i, repeat: Infinity, ease: "easeInOut" }}
                >
                  <div style={{ fontFamily: "var(--font-display)", fontSize: "1.7rem", letterSpacing: "-0.02em" }}>{p.value}</div>
                  <div className="text-xs" style={{ color: "var(--page-muted)" }}>{p.label}</div>
                </motion.div>
              </motion.div>
            );
          })}
          <motion.div
            className="glass absolute left-1/2 top-1/2 grid h-28 w-28 place-items-center rounded-full"
            style={{ translate: "-50% -50%", background: "color-mix(in srgb, var(--accent) 18%, var(--page-glass))" }}
            animate={{ rotate: [0, 6, 0, -6, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          >
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>{content.primaryCta.label.split(" ")[0]}</span>
          </motion.div>
        </div>
      </Container>
    </SectionShell>
  );
}
