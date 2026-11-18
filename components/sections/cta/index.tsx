"use client";

import type { CtaSection } from "@/lib/schemas/cta";
import { CuratedImage } from "@/components/fx/primitives";
import { Container, Display, Lede, Muted, SectionActions, SectionShell } from "@/components/sections/shared";

type Props = { section: CtaSection };

/* ------------------------------------------------------------- glow-band */

export function CtaGlowBand({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell padded={false} className="px-6 py-10 @md:px-10">
      <Container>
        <div className="grid gap-7 border-t-4 py-8 @3xl:grid-cols-[1fr_auto] @3xl:items-center @3xl:gap-12 @3xl:py-10" style={{ borderColor: "var(--accent)" }}>
          <div>
            <Display size="lg">{content.headline}</Display>
            {content.subheadline && <Lede className="mt-3">{content.subheadline}</Lede>}
            {content.reassurance && <Muted className="mt-3">{content.reassurance}</Muted>}
          </div>
          <SectionActions primary={content.primaryCta} secondary={content.secondaryCta} />
        </div>
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------------- glass-monolith */

export function CtaGlassMonolith({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell style={{ background: "var(--page-surface)" }}>
      <Container className="grid gap-8 @3xl:grid-cols-[1.1fr_0.9fr] @3xl:items-center @3xl:gap-16">
        <div>
          <Display size="lg">{content.headline}</Display>
          {content.subheadline && <Lede className="mt-4">{content.subheadline}</Lede>}
        </div>
        <div className="border-t pt-6 @3xl:border-l @3xl:border-t-0 @3xl:pl-10 @3xl:pt-0" style={{ borderColor: "var(--page-border)" }}>
          <SectionActions primary={content.primaryCta} secondary={content.secondaryCta} />
          {content.reassurance && <Muted className="mt-4">{content.reassurance}</Muted>}
        </div>
      </Container>
    </SectionShell>
  );
}

/* ---------------------------------------------------------- split-orbital */

export function CtaSplitOrbital({ section }: Props) {
  const { content, style } = section;
  return (
    <SectionShell>
      <Container className="grid items-center gap-9 @3xl:grid-cols-[1.05fr_0.95fr] @3xl:gap-16">
        <div>
          <Display size="lg">{content.headline}</Display>
          {content.subheadline && <Lede className="mt-4">{content.subheadline}</Lede>}
          <div className="mt-7"><SectionActions primary={content.primaryCta} secondary={content.secondaryCta} /></div>
          {content.reassurance && <Muted className="mt-4">{content.reassurance}</Muted>}
        </div>
        <div className="overflow-hidden rounded-[0.9rem]" style={{ aspectRatio: "4 / 3", background: "var(--page-surface)" }}>
          <CuratedImage image={content.image} photo={style.photo} seed={style.seed} editable />
        </div>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ aurora-wave */

export function CtaAuroraWave({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell className="text-center" style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--page-bg))" }}>
      <Container narrow>
        <Display size="lg">{content.headline}</Display>
        {content.subheadline && <Lede className="mx-auto mt-4 text-center">{content.subheadline}</Lede>}
        <div className="mt-7 flex justify-center"><SectionActions primary={content.primaryCta} secondary={content.secondaryCta} align="center" /></div>
        {content.reassurance && <Muted className="mt-4">{content.reassurance}</Muted>}
      </Container>
    </SectionShell>
  );
}
