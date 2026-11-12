"use client";

import { createContext, useContext, type MouseEvent } from "react";
import { opensNewTab } from "@/lib/links";
import type { UploadedPhoto } from "@/lib/schemas/primitives";

/**
 * Sections render the same in the editor and on the published page; this
 * context tells them which one they're in.
 *
 * - Published page (no provider): buttons follow their links.
 * - Editor: buttons never navigate away, and a section's main image slot can
 *   take an uploaded photo (`image` controls, per section).
 */
export type ImageSlotControls = {
  photo?: UploadedPhoto;
  busy: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
};

type PageMode = { editing: boolean; image?: ImageSlotControls };

const PageModeContext = createContext<PageMode>({ editing: false });

export const PageModeProvider = PageModeContext.Provider;

export function usePageMode(): PageMode {
  return useContext(PageModeContext);
}

/** Props for a button's <a>: real navigation on the published page, inert in the editor. */
export function useLinkProps(href: string) {
  const { editing } = usePageMode();
  const external = opensNewTab(href);
  return {
    href,
    target: external ? "_blank" : undefined,
    rel: external ? "noopener noreferrer" : undefined,
    onClick: (event: MouseEvent<HTMLAnchorElement>) => {
      // "#" means "no link yet": don't jump to the top of the page.
      if (editing || href === "#") event.preventDefault();
    },
  };
}
