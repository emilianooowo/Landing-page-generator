"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLinkProps } from "@/components/sections/PageMode";

/* ---------------------------------------------------------- SectionShell */

export function SectionShell({
  children,
  className = "",
  padded = true,
  style,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  style?: React.CSSProperties;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      className={`relative overflow-hidden ${padded ? "px-6 py-16 @md:px-10 @3xl:px-16 @3xl:py-20" : ""} ${className}`}
      style={style}
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.section>
  );
}

export function Container({ children, className = "", narrow = false }: { children: ReactNode; className?: string; narrow?: boolean }) {
  return (
    <div className={`relative mx-auto w-full ${narrow ? "max-w-[52rem]" : "max-w-[74rem]"} ${className}`}>
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- Typography */

export function Display({
  children,
  size = "lg",
  className = "",
  as: Tag = "h2",
}: {
  children: ReactNode;
  size?: "xl" | "lg" | "md";
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  const sizes = {
    xl: "text-[2.35rem] leading-[1.06] @md:text-[3rem] @3xl:text-[3.65rem]",
    lg: "text-[1.85rem] leading-[1.12] @md:text-[2.25rem] @3xl:text-[2.7rem]",
    md: "text-[1.35rem] leading-[1.2] @md:text-[1.65rem]",
  };
  return (
    <Tag
      className={`${sizes[size]} ${className}`}
      style={{ fontFamily: "var(--font-display)", fontWeight: 600, letterSpacing: "-0.018em", textWrap: "balance" }}
    >
      {children}
    </Tag>
  );
}

export function Lede({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[1.05rem] leading-relaxed @md:text-[1.15rem] ${className}`} style={{ color: "var(--page-muted)", maxWidth: "36rem", textWrap: "pretty" }}>
      {children}
    </p>
  );
}

export function Muted({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[0.95rem] leading-relaxed ${className}`} style={{ color: "var(--page-muted)" }}>
      {children}
    </p>
  );
}

/* -------------------------------------------------------------- Actions */

export function SectionAction({
  link,
  kind = "primary",
  tone = "default",
}: {
  link: { label: string; href: string };
  kind?: "primary" | "secondary";
  tone?: "default" | "inverse";
}) {
  const linkProps = useLinkProps(link.href);
  const primary = kind === "primary";
  return (
    <a
      {...linkProps}
      className="inline-flex min-h-12 items-center justify-center rounded-[0.65rem] px-5 py-3 text-[0.95rem] font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[var(--accent)]"
      style={{
        background: primary ? "var(--accent)" : "transparent",
        color: primary ? "var(--accent-ink)" : tone === "inverse" ? "var(--page-bg)" : "var(--page-text)",
        border: primary ? "1px solid transparent" : tone === "inverse" ? "1px solid color-mix(in srgb, var(--page-bg) 35%, transparent)" : "1px solid var(--page-border)",
        textDecoration: "none",
      }}
    >
      {link.label}
    </a>
  );
}

export function SectionActions({
  primary,
  secondary,
  align = "start",
  tone = "default",
}: {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  align?: "start" | "center";
  tone?: "default" | "inverse";
}) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${align === "center" ? "justify-center" : ""}`}>
      <SectionAction link={primary} tone={tone} />
      {secondary && <SectionAction link={secondary} kind="secondary" tone={tone} />}
    </div>
  );
}
