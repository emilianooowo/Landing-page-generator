import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { editSection, generateSection } from "@/lib/ai/generate";
import { carryOver } from "@/lib/sections/personal";
import type { BusinessBrief } from "@/lib/schemas/brief";
import { UploadedPhoto } from "@/lib/schemas/primitives";
import { readUpload, saveUpload, sniffImage, UploadError } from "@/lib/uploads";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const HTML = new TextEncoder().encode("<script>alert(1)</script>");

const photo = (n: number) => ({ url: `/api/uploads/up_${String(n).repeat(24)}.webp`, alt: `Foto ${n}` });

const hero = {
  variant: "aurora-veil",
  content: {
    headline: "Pan de cada día",
    subheadline: "Masa madre y pasteles por encargo.",
    primaryCta: { label: "Pide tu pastel", href: "https://wa.me/529999999999" },
  },
};

const brief: BusinessBrief = {
  businessName: "Test Bakery",
  hasBusinessName: true,
  whatTheyDo: "Bakes bread and cakes to order.",
  audience: "Neighbours",
  vibe: ["warm"],
  imageWorld: "food-drink",
  desiredAction: "Order a cake",
  keyPoints: ["Sourdough daily"],
  hasCustomers: true,
  sections: ["hero", "features", "cta"],
};

describe("upload storage", () => {
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "lpg-uploads-"));
    process.env.DATA_DIR = dir;
  });
  afterAll(async () => {
    delete process.env.DATA_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it("detects formats from the bytes, not the name", () => {
    expect(sniffImage(JPEG)).toBe("jpg");
    expect(sniffImage(PNG)).toBe("png");
    expect(sniffImage(WEBP)).toBe("webp");
    expect(sniffImage(HTML)).toBeNull();
  });

  it("stores an image and serves it back with its type", async () => {
    const { url } = await saveUpload(WEBP);
    expect(UploadedPhoto.safeParse({ url, alt: "x" }).success).toBe(true);
    const read = await readUpload(url.split("/").pop()!);
    expect(read?.contentType).toBe("image/webp");
    expect(Array.from(read!.bytes)).toEqual(Array.from(WEBP));
  });

  it("rejects non-images and never reads outside the uploads folder", async () => {
    await expect(saveUpload(HTML)).rejects.toBeInstanceOf(UploadError);
    expect(await readUpload("../../package.json")).toBeNull();
    expect(await readUpload("up_000000000000000000000000.jpg")).toBeNull();
  });
});

describe("photos on the page", () => {
  it("only accepts photos uploaded through the app", () => {
    expect(UploadedPhoto.safeParse({ url: "https://evil.example/x.jpg", alt: "x" }).success).toBe(false);
    expect(UploadedPhoto.safeParse(photo(1)).success).toBe(true);
  });

  it("keeps the person's photo and links when the AI edits the section", async () => {
    const first = await generateSection({ type: "hero", brief, projectId: "t", sectionId: "hero-0" }, { model: async () => ({ data: hero, raw: "" }) });
    const mine = {
      ...first.section,
      style: { ...first.section.style, photo: photo(1) },
      content: { ...first.section.content, primaryCta: { label: "Pide tu pastel", href: "https://wa.me/525512345678" } },
    } as typeof first.section;
    const edited = await editSection(
      { section: mine, brief, projectId: "t", request: "Otro tono" },
      { model: async () => ({ data: { ...hero, content: { ...hero.content, headline: "Otro título", primaryCta: { label: "Escríbenos", href: "#" } } }, raw: "" }) },
    );
    expect(edited.status).toBe("valid");
    expect(edited.section.content.headline).toBe("Otro título");
    expect(edited.section.style.photo).toEqual(photo(1));
    expect(edited.section.content).toMatchObject({ primaryCta: { label: "Escríbenos", href: "https://wa.me/525512345678" } });
  });

  it("carries photos and links over to a regenerated section of the same type", () => {
    const before = { type: "hero", style: { photo: photo(2) }, content: { primaryCta: { label: "A", href: "mailto:a@b.co" } } } as never;
    const after = { type: "hero", style: { seed: 1 }, content: { primaryCta: { label: "B", href: "#" } } } as never;
    const merged = carryOver(before, after) as { style: { photo?: unknown }; content: { primaryCta: { label: string; href: string } } };
    expect(merged.style.photo).toEqual(photo(2));
    expect(merged.content.primaryCta).toEqual({ label: "B", href: "mailto:a@b.co" });
  });
});
