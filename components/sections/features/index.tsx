"use client";

import { motion } from "framer-motion";
import type { FeaturesSection, FeatureItem } from "@/lib/schemas/features";
import {
  CursorGlow,
  CuratedImage,
  FloatingShapes,
  IconBadge,
  MeshGradient,
  ParallaxLayer,
  TiltCard,
} from "@/components/fx";
import { Container, Display, Lede, Muted, Reveal, SectionShell } from "@/components/sections/shared";

type Props = { section: FeaturesSection };

function Heading({ section, center = false }: { section: FeaturesSection; center?: boolean }) {
  const { content, style } = section;
  return (
    <div className={`mb-12 ${center ? "mx-auto text-center" : ""}`} style={{ maxWidth: "40rem" }}>
      <Reveal motion={style.motion}>
        <Display size="lg">{content.headline}</Display>
      </Reveal>
      {content.subheadline && (
        <Reveal index={1} motion={style.motion} className={`mt-4 ${center ? "flex justify-center" : ""}`}>
          <Lede className={center ? "text-center" : ""}>{content.subheadline}</Lede>
        </Reveal>
      )}
    </div>
  );
}

function Card({
  item,
  index,
  section,
  big = false,
  className = "",
}: {
  item: FeatureItem;
  index: number;
  section: FeaturesSection;
  big?: boolean;
  className?: string;
}) {
  return (
    <Reveal as="li" index={index + 1} motion={section.style.motion} className={`h-full ${className}`}>
      <TiltCard max={4} className={`flex h-full flex-col gap-4 ${big ? "p-8 @md:p-10" : "p-6 @md:p-7"}`}>
        <IconBadge name={item.icon} />
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: big ? "1.7rem" : "1.2rem", letterSpacing: "-0.015em" }}>{item.title}</h3>
        <Muted>{item.body}</Muted>
      </TiltCard>
    </Reveal>
  );
}

/* ------------------------------------------------------------ glass-grid */

export function FeaturesGlassGrid({ section }: Props) {
  const { content, style } = section;
  const cols = content.items.length <= 4 ? "@2xl:grid-cols-2" : "@2xl:grid-cols-2 @4xl:grid-cols-3";
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 11} intensity={0.55} />
      {style.cursorGlow && <CursorGlow size={640} strength={0.16} />}
      <Container>
        <Heading section={section} center />
        <ul className={`grid gap-5 ${cols}`}>
          {content.items.map((item, i) => (
            <Card key={item.title} item={item} index={i} section={section} />
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

/* ----------------------------------------------------------- depth-bento */

export function FeaturesDepthBento({ section }: Props) {
  const { content, style } = section;
  const [lead, ...rest] = content.items;
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 5} intensity={0.7} />
      <FloatingShapes seed={style.seed + 5} count={2} kinds={["coin", "ring"]} />
      <Container>
        <Heading section={section} />
        <ul className="grid gap-5 @2xl:grid-cols-6" style={{ perspective: "1400px" }}>
          <motion.li
            className="@2xl:col-span-4"
            initial={{ opacity: 0, y: 26, z: -40 }}
            whileInView={{ opacity: 1, y: 0, z: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: [0.2, 0, 0, 1] }}
            style={{ transformStyle: "preserve-3d" }}
          >
            <TiltCard max={3} className="grid h-full gap-6 overflow-hidden p-2 @2xl:grid-cols-[1fr_1fr]" style={{ borderRadius: "calc(var(--radius) * 1.3)" }}>
              <div className="flex flex-col justify-center gap-4 p-6 @md:p-8">
                <IconBadge name={lead.icon} />
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.9rem", letterSpacing: "-0.02em" }}>{lead.title}</h3>
                <Muted>{lead.body}</Muted>
              </div>
              <div className="min-h-[14rem] overflow-hidden" style={{ borderRadius: "calc(var(--radius) * 1.1)" }}>
                <CuratedImage image={content.image} photo={style.photo} seed={style.seed} editable />
              </div>
            </TiltCard>
          </motion.li>
          {rest.map((item, i) => (
            <Card
              key={item.title}
              item={item}
              index={i + 1}
              section={section}
              className={i === 0 ? "@2xl:col-span-2" : "@2xl:col-span-3"}
            />
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------- floating-column */

export function FeaturesFloatingColumn({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 9} intensity={0.6} />
      <FloatingShapes seed={style.seed + 9} count={style.floatingShapes} kinds={["orb", "slab"]} />
      <Container className="grid gap-12 @3xl:grid-cols-[0.8fr_1.2fr]">
        <div className="@3xl:sticky @3xl:top-24 @3xl:self-start">
          <Heading section={section} />
        </div>
        <ol className="relative flex flex-col gap-5">
          <div aria-hidden className="absolute left-[1.35rem] top-6 bottom-6 w-px" style={{ background: "linear-gradient(180deg, transparent, var(--accent), transparent)" }} />
          {content.items.map((item, i) => (
            <ParallaxLayer key={item.title} depth={0.15 + (i % 3) * 0.2}>
              <Reveal as="li" index={i + 1} motion={style.motion}>
                <TiltCard max={3} className="grid grid-cols-[2.75rem_1fr] gap-5 p-6 @md:p-7" style={{ marginLeft: i % 2 ? "2rem" : 0 }}>
                  <span
                    className="grid h-11 w-11 place-items-center rounded-full text-sm"
                    style={{ background: "var(--accent)", color: "var(--accent-ink)", fontFamily: "var(--font-display)" }}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.25rem", letterSpacing: "-0.015em" }}>{item.title}</h3>
                    </div>
                    <Muted>{item.body}</Muted>
                  </div>
                </TiltCard>
              </Reveal>
            </ParallaxLayer>
          ))}
        </ol>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ orbit-ring */

export function FeaturesOrbitRing({ section }: Props) {
  const { content, style } = section;
  const n = content.items.length;
  return (
    <SectionShell>
      <MeshGradient seed={style.seed + 2} intensity={0.8} />
      {style.cursorGlow && <CursorGlow />}
      <Container>
        <Heading section={section} center />
        {/* Wide: cards orbit a glowing centre. Narrow: the same cards stack. */}
        <div className="relative mx-auto hidden aspect-square w-full max-w-[44rem] @3xl:block">
          <div
            aria-hidden
            className="absolute inset-[30%] rounded-full"
            style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent), transparent 70%)", filter: "blur(24px)" }}
          />
          <div aria-hidden className="absolute inset-[12%] rounded-full" style={{ border: "1px dashed color-mix(in srgb, var(--accent) 40%, transparent)", animation: "orbit 90s linear infinite" }} />
          <div className="glass absolute left-1/2 top-1/2 grid h-32 w-32 place-items-center rounded-full text-center" style={{ translate: "-50% -50%" }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "1rem", padding: "0 1rem" }}>{content.headline.split(" ").slice(0, 2).join(" ")}</span>
          </div>
          {content.items.map((item, i) => {
            const angle = (i / n) * 360 - 90;
            const x = 50 + 38 * Math.cos((angle * Math.PI) / 180);
            const y = 50 + 38 * Math.sin((angle * Math.PI) / 180);
            return (
              <motion.div
                key={item.title}
                className="absolute w-[15rem]"
                style={{ left: `${x}%`, top: `${y}%`, translate: "-50% -50%" }}
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 + i * 0.08, duration: 0.6, ease: [0.2, 0, 0, 1] }}
              >
                <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 6 + i, repeat: Infinity, ease: "easeInOut" }}>
                  <TiltCard max={6} className="flex flex-col gap-3 p-5">
                    <IconBadge name={item.icon} />
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: "1.1rem" }}>{item.title}</h3>
                    <Muted className="text-sm">{item.body}</Muted>
                  </TiltCard>
                </motion.div>
              </motion.div>
            );
          })}
        </div>
        <ul className="grid gap-5 @3xl:hidden">
          {content.items.map((item, i) => (
            <Card key={item.title} item={item} index={i} section={section} />
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}
