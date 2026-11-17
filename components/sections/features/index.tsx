"use client";

import type { FeaturesSection } from "@/lib/schemas/features";
import { Icon } from "@/components/fx/Icon";
import { CuratedImage } from "@/components/fx/primitives";
import { Container, Display, Lede, Muted, SectionShell } from "@/components/sections/shared";

type Props = { section: FeaturesSection };

function Heading({ section, align = "left" }: { section: FeaturesSection; align?: "left" | "center" }) {
  const centered = align === "center";
  return (
    <header className={`mb-10 max-w-[42rem] ${centered ? "mx-auto text-center" : ""}`}>
      <Display size="lg">{section.content.headline}</Display>
      {section.content.subheadline && (
        <Lede className={`mt-4 ${centered ? "mx-auto text-center" : ""}`}>{section.content.subheadline}</Lede>
      )}
    </header>
  );
}

/* ------------------------------------------------------------ glass-grid */

export function FeaturesGlassGrid({ section }: Props) {
  const { content } = section;
  const cols = content.items.length > 4 ? "@4xl:grid-cols-3" : "@2xl:grid-cols-2";
  return (
    <SectionShell>
      <Container>
        <Heading section={section} />
        <ul className={`grid gap-x-12 ${cols}`}>
          {content.items.map((item, index) => (
            <li key={item.title} className="grid grid-cols-[2rem_1fr] gap-x-4 border-t py-6" style={{ borderColor: "var(--page-border)" }}>
              <span className="pt-1 text-sm font-semibold tabular-nums" style={{ color: "var(--accent)" }}>0{index + 1}</span>
              <div className="grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2">
                <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                <Icon name={item.icon} size={19} />
                <Muted className="col-span-2">{item.body}</Muted>
              </div>
            </li>
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
      <Container className="grid items-start gap-10 @3xl:grid-cols-[0.95fr_1.05fr] @3xl:gap-16">
        <div>
          <Heading section={section} />
          <div className="border-t pt-6" style={{ borderColor: "var(--page-border)" }}>
            <h3 className="flex items-center gap-3 text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}><Icon name={lead.icon} size={21} /><span>{lead.title}</span></h3>
            <Muted className="mt-3">{lead.body}</Muted>
          </div>
          <ul className="mt-7 divide-y" style={{ borderColor: "var(--page-border)" }}>
            {rest.map((item) => (
              <li key={item.title} className="grid grid-cols-[1.5rem_1fr] gap-3 py-4 first:pt-0 last:pb-0">
                <Icon name={item.icon} size={18} className="mt-1" />
                <div><h4 className="font-semibold">{item.title}</h4><Muted className="mt-1">{item.body}</Muted></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="overflow-hidden rounded-[0.9rem]" style={{ aspectRatio: "4 / 3", background: "var(--page-surface)" }}>
          <CuratedImage image={content.image} photo={style.photo} seed={style.seed} editable />
        </div>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------- floating-column */

export function FeaturesFloatingColumn({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell>
      <Container className="grid gap-10 @3xl:grid-cols-[0.85fr_1.15fr] @3xl:gap-20">
        <div className="@3xl:sticky @3xl:top-20 @3xl:self-start">
          <Heading section={section} />
        </div>
        <ol>
          {content.items.map((item, index) => (
            <li key={item.title} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t py-6 first:pt-0 last:pb-0" style={{ borderColor: "var(--page-border)" }}>
              <span className="pt-1 text-sm font-semibold tabular-nums" style={{ color: "var(--accent)" }}>0{index + 1}</span>
              <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
                <Icon name={item.icon} size={19} />
                <Muted className="col-span-2 max-w-[38rem]">{item.body}</Muted>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------------ orbit-ring */

export function FeaturesOrbitRing({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell style={{ background: "color-mix(in srgb, var(--accent) 5%, var(--page-bg))" }}>
      <Container>
        <div className="grid gap-8 @3xl:grid-cols-[0.7fr_1.3fr] @3xl:items-end @3xl:gap-16">
          <Display size="lg">{content.headline}</Display>
          {content.subheadline && <Lede>{content.subheadline}</Lede>}
        </div>
        <ul className="mt-10 grid gap-x-8 gap-y-8 @2xl:grid-cols-2 @4xl:grid-cols-4">
          {content.items.map((item, index) => (
            <li key={item.title} className="border-t-2 pt-5" style={{ borderColor: index === 0 ? "var(--accent)" : "var(--page-border)" }}>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--page-muted)" }}>0{index + 1}</span>
                <Icon name={item.icon} size={19} />
              </div>
              <h3 className="mt-7 text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>{item.title}</h3>
              <Muted className="mt-2">{item.body}</Muted>
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}
