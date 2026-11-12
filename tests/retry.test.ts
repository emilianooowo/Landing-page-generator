import { describe, expect, it } from "vitest";
import { ModelError, type ModelCall } from "@/lib/ai/client";
import { editSection, generateSection } from "@/lib/ai/generate";
import type { BusinessBrief } from "@/lib/schemas/brief";

const brief: BusinessBrief = {
  businessName: "Test Bakery",
  hasBusinessName: true,
  whatTheyDo: "Bakes bread and cakes to order.",
  audience: "Neighbours",
  vibe: ["warm"],
  imageWorld: "food-drink",
  desiredAction: "Order a cake",
  keyPoints: ["Sourdough daily", "Custom cakes", "Open six days"],
  hasCustomers: true,
  sections: ["hero", "features", "testimonials", "cta"],
};

const good = {
  variant: "aurora-veil",
  content: {
    headline: "Bread baked this morning",
    subheadline: "Sourdough, pastry and cakes to order.",
    primaryCta: { label: "Order a cake", href: "#" },
  },
};

const bad = { variant: "not-a-layout", content: good.content };

function sequence(replies: Array<unknown | Error>): { model: ModelCall; calls: () => number } {
  let n = 0;
  const model: ModelCall = async () => {
    const r = replies[Math.min(n, replies.length - 1)];
    n += 1;
    if (r instanceof Error) throw r;
    return { data: r, raw: JSON.stringify(r) };
  };
  return { model, calls: () => n };
}

const args = { type: "hero" as const, brief, projectId: "t", sectionId: "hero-0" };

describe("generateSection", () => {
  it("returns valid on the first attempt", async () => {
    const { model, calls } = sequence([good]);
    const r = await generateSection(args, { model });
    expect(r.status).toBe("valid");
    expect(calls()).toBe(1);
  });

  it("repairs on the second attempt and feeds the zod error back", async () => {
    const prompts: string[] = [];
    let n = 0;
    const model: ModelCall = async (req) => {
      prompts.push(req.user);
      return { data: n++ === 0 ? bad : good, raw: "" };
    };
    const r = await generateSection(args, { model });
    expect(r.status).toBe("valid");
    expect(r.attempts.map((a) => a.outcome)).toEqual(["schema-error", "valid"]);
    expect(prompts[1]).toContain("La respuesta anterior no pasó la validación");
    expect(prompts[1]).toContain("variant");
  });

  it("falls back after two schema failures, never throws", async () => {
    const { model, calls } = sequence([bad]);
    const r = await generateSection(args, { model });
    expect(r.status).toBe("fallback");
    expect(r.section.variant).toBe("aurora-veil");
    expect(r.section.content.headline).toBe("Test Bakery");
    expect(calls()).toBe(2);
  });

  it("treats malformed JSON as a schema attempt and repairs", async () => {
    const { model } = sequence([new ModelError("bad", "bad-json"), good]);
    const r = await generateSection(args, { model });
    expect(r.status).toBe("valid");
    expect(r.attempts[0].outcome).toBe("schema-error");
  });

  it("retries transport errors without spending schema attempts", async () => {
    const { model, calls } = sequence([new ModelError("429", "rate-limit"), good]);
    const r = await generateSection(args, { model });
    expect(r.status).toBe("valid");
    expect(calls()).toBe(2);
    expect(r.attempts.map((a) => a.outcome)).toEqual(["valid"]);
  });
});

describe("editSection", () => {
  it("returns the original untouched when every attempt fails", async () => {
    const first = await generateSection(args, { model: sequence([good]).model });
    const r = await editSection({ section: first.section, brief, projectId: "t", request: "shorter" }, { model: sequence([bad]).model });
    expect(r.status).toBe("unchanged");
    expect(r.section).toEqual(first.section);
  });
});

describe("landing-only policy", () => {
  it("asks the model to repair a buy-online button instead of accepting it", async () => {
    const prompts: string[] = [];
    let n = 0;
    const model: ModelCall = async (req) => {
      prompts.push(req.user);
      const reply = n++ === 0
        ? { ...good, content: { ...good.content, primaryCta: { label: "Comprar en línea", href: "#" } } }
        : good;
      return { data: reply, raw: "" };
    };
    const r = await generateSection(args, { model });
    expect(r.status).toBe("valid");
    expect(r.section.content).toMatchObject({ primaryCta: { label: "Order a cake" } });
    expect(prompts[1]).toContain("primaryCta.label");
  });
});

describe("editSection on a single element", () => {
  it("changes only the targeted element and keeps the layout", async () => {
    const first = await generateSection(args, { model: sequence([good]).model });
    const requests: Parameters<ModelCall>[0][] = [];
    const model: ModelCall = async (req) => {
      requests.push(req);
      return { data: { value: "Pan recién hecho cada mañana" }, raw: "" };
    };
    const r = await editSection(
      { section: first.section, brief, projectId: "t", request: "Dame otra opción", target: "headline" },
      { model },
    );
    expect(r.status).toBe("valid");
    expect(r.section.content.headline).toBe("Pan recién hecho cada mañana");
    expect(r.section.content.subheadline).toBe(first.section.content.subheadline);
    expect(r.section.content).toMatchObject({ primaryCta: good.content.primaryCta });
    expect(r.section.variant).toBe(first.section.variant);
    expect(requests[0].user).toContain("Título");
  });

  it("repairs an element that is too long, then gives up without touching the section", async () => {
    const first = await generateSection(args, { model: sequence([good]).model });
    const tooLong = { value: "x".repeat(200) };
    const r = await editSection(
      { section: first.section, brief, projectId: "t", request: "Más largo", target: "headline" },
      { model: sequence([tooLong]).model },
    );
    expect(r.status).toBe("unchanged");
    expect(r.attempts.map((a) => a.outcome)).toEqual(["schema-error", "schema-error"]);
    expect(r.section).toEqual(first.section);
  });

  it("returns unchanged for an element that does not exist", async () => {
    const first = await generateSection(args, { model: sequence([good]).model });
    const { model, calls } = sequence([{ value: "Hola" }]);
    const r = await editSection(
      { section: first.section, brief, projectId: "t", request: "x", target: "items.9.title" },
      { model },
    );
    expect(r.status).toBe("unchanged");
    expect(calls()).toBe(0);
  });
});
