"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { Testimonial, TestimonialsSection } from "@/lib/schemas/testimonials";
import { Container, Display, Lede, Muted, SectionShell } from "@/components/sections/shared";

type Props = { section: TestimonialsSection };

function Attribution({ testimonial }: { testimonial: Testimonial }) {
  const example = testimonial.name.trim().toLocaleLowerCase("es-MX") === "cliente de ejemplo";
  return (
    <footer className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-semibold">{testimonial.name}</span>
      {testimonial.role && <span className="text-sm" style={{ color: "var(--page-muted)" }}>{testimonial.role}</span>}
      {example && <span className="text-sm" style={{ color: "var(--page-muted)" }}>Texto de muestra; sustituir por una opinión real y autorizada.</span>}
      {testimonial.rating && <span className="text-sm" style={{ color: "var(--page-muted)" }}>Calificación: {testimonial.rating}/5</span>}
    </footer>
  );
}

function Quote({ testimonial, size = "regular" }: { testimonial: Testimonial; size?: "regular" | "large" }) {
  return (
    <>
      <blockquote
        className={size === "large" ? "text-[1.45rem] leading-snug @md:text-[1.9rem]" : "text-[1.05rem] leading-relaxed"}
        style={{ fontFamily: size === "large" ? "var(--font-display)" : undefined, textWrap: "pretty" }}
      >
        “{testimonial.quote}”
      </blockquote>
      <Attribution testimonial={testimonial} />
    </>
  );
}

function Heading({ section, align = "left" }: { section: TestimonialsSection; align?: "left" | "center" }) {
  const centered = align === "center";
  return (
    <header className={`mb-10 max-w-[42rem] ${centered ? "mx-auto text-center" : ""}`}>
      <Display size="lg">{section.content.headline}</Display>
      {section.content.subheadline && <Lede className={`mt-4 ${centered ? "mx-auto text-center" : ""}`}>{section.content.subheadline}</Lede>}
    </header>
  );
}

function CarouselControls({ count, active, onChange }: { count: number; active: number; onChange: (next: number) => void }) {
  if (count < 2) return null;
  return (
    <nav className="mt-8 flex items-center gap-3" aria-label="Controles de opiniones">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        style={{ borderColor: "var(--page-border)" }}
        onClick={() => onChange((active - 1 + count) % count)}
        aria-label="Mostrar opinión anterior"
      ><ChevronLeft size={17} aria-hidden="true" /><span>Anterior</span></button>
      <span className="min-w-16 text-center text-sm tabular-nums" style={{ color: "var(--page-muted)" }} aria-live="polite">{active + 1} / {count}</span>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        style={{ borderColor: "var(--page-border)" }}
        onClick={() => onChange((active + 1) % count)}
        aria-label="Mostrar opinión siguiente"
      ><span>Siguiente</span><ChevronRight size={17} aria-hidden="true" /></button>
    </nav>
  );
}

/* -------------------------------------------------------- glass-carousel */

export function TestimonialsGlassCarousel({ section }: Props) {
  const [active, setActive] = useState(0);
  const { content } = section;
  const testimonial = content.items[active];
  return (
    <SectionShell>
      <Container narrow>
        <Heading section={section} align="center" />
        <div className="border-y py-8 @md:py-10" style={{ borderColor: "var(--page-border)" }} aria-live="polite" aria-atomic="true">
          <Quote testimonial={testimonial} size="large" />
        </div>
        <CarouselControls count={content.items.length} active={active} onChange={setActive} />
      </Container>
    </SectionShell>
  );
}

/* -------------------------------------------------------- floating-cards */

export function TestimonialsFloatingCards({ section }: Props) {
  const { content } = section;
  return (
    <SectionShell>
      <Container>
        <Heading section={section} />
        <ul className="grid gap-x-12 @2xl:grid-cols-2">
          {content.items.map((testimonial, index) => (
            <li key={`${testimonial.name}-${index}`} className="border-t py-7" style={{ borderColor: "var(--page-border)" }}>
              <span className="mb-4 block text-xs font-semibold tabular-nums" style={{ color: "var(--accent)" }}>0{index + 1}</span>
              <Quote testimonial={testimonial} />
            </li>
          ))}
        </ul>
      </Container>
    </SectionShell>
  );
}

/* ------------------------------------------------------ single-spotlight */

export function TestimonialsSingleSpotlight({ section }: Props) {
  const testimonial = section.content.items[0];
  return (
    <SectionShell>
      <Container className="grid gap-8 @3xl:grid-cols-[0.35fr_1fr] @3xl:gap-16">
        <Display size="md">{section.content.headline}</Display>
        <div className="max-w-[54rem]">
          <Quote testimonial={testimonial} size="large" />
        </div>
      </Container>
    </SectionShell>
  );
}

/* --------------------------------------------------------- depth-marquee */

export function TestimonialsDepthMarquee({ section }: Props) {
  const { content } = section;
  const [featured, ...others] = content.items;
  return (
    <SectionShell>
      <Container className="grid gap-10 @3xl:grid-cols-[0.75fr_1.25fr] @3xl:gap-16">
        <Heading section={section} />
        <div>
          <div className="border-t-2 pt-6" style={{ borderColor: "var(--accent)" }}>
            <Quote testimonial={featured} size="large" />
          </div>
          {others.length > 0 && (
            <ul className="mt-9 grid gap-x-8 @2xl:grid-cols-2">
              {others.map((testimonial, index) => (
                <li key={`${testimonial.name}-${index}`} className="border-t py-5" style={{ borderColor: "var(--page-border)" }}>
                  <Quote testimonial={testimonial} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </SectionShell>
  );
}
