"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Testimonial, TestimonialsSection } from "@/lib/schemas/testimonials";
import { CursorGlow, CuratedImage, FloatingShapes, MeshGradient, ParallaxLayer, TiltCard } from "@/components/fx";
import { Container, Display, Lede, Reveal, SectionShell } from "@/components/sections/shared";

type Props = { section: TestimonialsSection };

function Stars({ n }: { n?: number }) {
  if (!n) return null;
  return (
    <div className="flex gap-1" aria-label={`${n} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < n ? "var(--accent)" : "var(--page-border)", fontSize: "0.9rem" }}>
          ★
        </span>
      ))}
    </div>
  );
}

function Attribution({ t, seed }: { t: Testimonial; seed: number }) {
  const sample = /sample/i.test(t.name);
  return (
    <footer className="mt-6 flex items-center gap-3">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full" style={{ border: "1px solid var(--page-glass-border)" }}>
        <CuratedImage image={t.avatar} seed={seed} />
      </div>
      <div>
        <div style={{ fontWeight: 600 }}>{t.name}</div>
        <div className="text-sm" style={{ color: "var(--page-muted)" }}>
          {t.role ?? (sample ? "Reemplaza este ejemplo con una opinión real" : "Cliente")}
        </div>
      </div>
    </footer>
  );
}

function Quote({ t, seed, size = "md" }: { t: Testimonial; seed: number; size?: "md" | "lg" }) {
  return (
    <>
      <Stars n={t.rating} />
      <blockquote
        className={`mt-4 ${size === "lg" ? "text-[1.5rem] leading-snug @md:text-[2rem]" : "text-[1.05rem] leading-relaxed"}`}
        style={{ fontFamily: size === "lg" ? "var(--font-display)" : undefined, textWrap: "pretty" }}
      >
        “{t.quote}”
      </blockquote>
      <Attribution t={t} seed={seed} />
    </>
  );
}

function Heading({ section }: Props) {
  const { content, style } = section;
  return (
    <div className="mx-auto mb-12 text-center" style={{ maxWidth: "36rem" }}>
      <Reveal motion={style.motion}><Display size="lg">{content.headline}</Display></Reveal>
      {content.subheadline && (
        <Reveal index={1} motion={style.motion} className="mt-4 flex justify-center">
          <Lede className="text-center">{content.subheadline}</Lede>
        </Reveal>
      )}
    </div>
  );
}

/* -------------------------------------------------------- glass-carousel */

export function TestimonialsGlassCarousel({ section }: Props) {
  const { content, style } = section;
  const [active, setActive] = useState(0);
  const n = content.items.length;

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => setActive((a) => (a + 1) % n), 6000);
    return () => clearInterval(id);
  }, [n]);

  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 21} intensity={0.6} />
      <Container narrow>
        <Heading section={section} />
        <div className="relative min-h-[16rem]" style={{ perspective: "1200px" }}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={active}
              className="glass p-8 @md:p-10"
              initial={{ opacity: 0, x: 40, rotateY: -8 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -40, rotateY: 8 }}
              transition={{ duration: 0.55, ease: [0.2, 0, 0, 1] }}
            >
              <Quote t={content.items[active]} seed={style.seed + active} size="lg" />
            </motion.div>
          </AnimatePresence>
        </div>
        {n > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {content.items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Mostrar opinión ${i + 1}`}
                onClick={() => setActive(i)}
                className="h-2 rounded-full transition-all"
                style={{ width: i === active ? 28 : 8, background: i === active ? "var(--accent)" : "var(--page-border)" }}
              />
            ))}
          </div>
        )}
      </Container>
    </SectionShell>
  );
}

/* -------------------------------------------------------- floating-cards */

export function TestimonialsFloatingCards({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 13} intensity={0.7} />
      <FloatingShapes seed={style.seed + 13} count={Math.max(2, style.floatingShapes - 1)} kinds={["orb", "ring"]} />
      {style.cursorGlow && <CursorGlow size={600} strength={0.16} />}
      <Container>
        <Heading section={section} />
        <ul className="grid gap-6 @2xl:grid-cols-2">
          {content.items.map((t, i) => (
            <ParallaxLayer key={t.name + i} depth={0.2 + (i % 2) * 0.35} className={i % 2 ? "@2xl:mt-12" : ""}>
              <Reveal as="li" index={i + 1} motion={style.motion}>
                <TiltCard max={5} className="p-7 @md:p-8" style={{ transform: `rotate(${(i % 2 ? 1 : -1) * 0.8}deg)` }}>
                  <Quote t={t} seed={style.seed + i} />
                </TiltCard>
              </Reveal>
            </ParallaxLayer>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------ single-spotlight */

export function TestimonialsSingleSpotlight({ section }: Props) {
  const { content, style } = section;
  const t = content.items[0];
  return (
    <SectionShell className="min-h-[28rem] flex items-center">
      <MeshGradient seed={style.seed + 4} intensity={0.9} />
      <CursorGlow size={700} strength={0.28} />
      <Container narrow className="text-center">
        <Reveal motion={style.motion}>
          <div className="mb-8 text-sm" style={{ color: "var(--accent)", fontWeight: 600 }}>{content.headline}</div>
        </Reveal>
        <Reveal index={1} motion={style.motion}>
          <blockquote
            className="text-[1.7rem] leading-tight @md:text-[2.4rem] @3xl:text-[3rem]"
            style={{ fontFamily: "var(--font-display)", letterSpacing: "-0.02em", textWrap: "balance" }}
          >
            “{t.quote}”
          </blockquote>
        </Reveal>
        <Reveal index={2} motion={style.motion} className="mt-8 flex justify-center">
          <div className="glass inline-flex items-center gap-3 px-4 py-3" style={{ borderRadius: "999px" }}>
            <div className="h-9 w-9 overflow-hidden rounded-full"><CuratedImage image={t.avatar} seed={style.seed} /></div>
            <div className="text-left">
              <div className="text-sm" style={{ fontWeight: 600 }}>{t.name}</div>
              {t.role && <div className="text-xs" style={{ color: "var(--page-muted)" }}>{t.role}</div>}
            </div>
            <Stars n={t.rating} />
          </div>
        </Reveal>
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------------- depth-marquee */

export function TestimonialsDepthMarquee({ section }: Props) {
  const { content, style } = section;
  const row = [...content.items, ...content.items];
  return (
    <SectionShell padded={false} className="py-20">
      <MeshGradient seed={style.seed + 17} intensity={0.5} />
      <Container className="px-6 @md:px-10">
        <Heading section={section} />
      </Container>
      {[0, 1].map((r) => (
        <div
          key={r}
          className="relative mt-5 overflow-hidden"
          style={{
            maskImage: "linear-gradient(90deg, transparent, black 10%, black 90%, transparent)",
            opacity: r === 0 ? 1 : 0.7,
            transform: r === 1 ? "scale(0.94)" : undefined,
          }}
        >
          <div
            className="flex w-max gap-5"
            style={{ animation: `marquee ${(r === 0 ? 48 : 64) + content.items.length * 6}s linear infinite`, animationDirection: r === 1 ? "reverse" : "normal" }}
          >
            {row.map((t, i) => (
              <div key={`${r}-${i}`} className="glass w-[22rem] shrink-0 p-6">
                <Quote t={t} seed={style.seed + i} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SectionShell>
  );
}
