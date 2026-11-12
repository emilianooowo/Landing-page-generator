import { describe, expect, it } from "vitest";
import type { ModelCall } from "@/lib/ai/client";
import { parseBrief } from "@/lib/ai/generate";
import { isSparse } from "@/lib/ai/prompts/brief";
import { resolveBriefParse } from "@/lib/schemas/brief";

const fullBrief = {
  businessName: "Test Bakery",
  whatTheyDo: "Bakes bread and cakes to order.",
  audience: "Neighbours",
  vibe: ["warm"],
  imageWorld: "food-drink",
  desiredAction: "Order a cake",
  keyPoints: ["Sourdough daily"],
  hasCustomers: true,
  sections: ["hero", "features", "cta"],
};

const modelReturning =
  (data: unknown): ModelCall =>
  async () => ({ data, raw: "" });

describe("isSparse", () => {
  it("flags a one-line description", () => {
    expect(isSparse("I run a bakery in Johar Town")).toBe(true);
  });
  it("passes a fuller one", () => {
    expect(isSparse("I run a bakery in Johar Town. We do sourdough and custom cakes, mostly regulars from the neighbourhood.")).toBe(false);
  });
});

describe("resolveBriefParse", () => {
  it("is complete only when the brief validates and there are no questions", () => {
    expect(resolveBriefParse({ brief: fullBrief as never, questions: [] }).status).toBe("complete");
    expect(resolveBriefParse({ brief: { businessName: "X" }, questions: [] }).status).toBe("needs-input");
  });
});

describe("parseBrief", () => {
  it("always asks for a sparse description, even if the model returned a complete brief", async () => {
    const r = await parseBrief("bakery in johar town", { model: modelReturning({ brief: fullBrief, questions: [] }) });
    expect(r.status).toBe("needs-input");
    if (r.status === "needs-input") expect(r.questions.length).toBeGreaterThan(0);
  });

  it("uses the model's questions when it asks", async () => {
    const q = { field: "desiredAction", question: "What should visitors do?", suggestions: ["Order", "Visit"] };
    const r = await parseBrief("bakery in johar town", { model: modelReturning({ brief: { businessName: "B" }, questions: [q] }) });
    expect(r.status).toBe("needs-input");
    if (r.status === "needs-input") expect(r.questions[0].question).toBe(q.question);
  });

  it("supplies fallback questions when the model returns garbage", async () => {
    const r = await parseBrief("a long enough description of a bakery that sells bread and cakes to the neighbourhood", {
      model: modelReturning({ nonsense: true }),
    });
    expect(r.status).toBe("needs-input");
    if (r.status === "needs-input") expect(r.questions.length).toBe(2);
  });

  it("completes for a full description and a complete brief", async () => {
    const r = await parseBrief("I run a bakery in Johar Town. Sourdough and custom cakes, mostly regulars from the neighbourhood.", {
      model: modelReturning({ brief: fullBrief, questions: [] }),
    });
    expect(r.status).toBe("complete");
  });
});

describe("parseBrief with empty fields from the model", () => {
  it("keeps the usable fields and the model's own questions when some fields are empty strings", async () => {
    const questions = [
      { field: "whatTheyDo", question: "¿Qué tipo de cacahuates importas?", suggestions: ["Salados", "Con chile"] },
      { field: "desiredAction", question: "¿Qué quieres que haga la gente?", suggestions: ["Comprar", "WhatsApp"] },
    ];
    const r = await parseBrief("vendo cacahuates importados de japón", {
      model: modelReturning({
        brief: { businessName: "", hasBusinessName: false, whatTheyDo: "Vendo cacahuates importados de Japón.", audience: "" },
        questions,
      }),
    });
    expect(r.status).toBe("needs-input");
    if (r.status !== "needs-input") return;
    expect(r.partial).toMatchObject({ hasBusinessName: false, whatTheyDo: "Vendo cacahuates importados de Japón." });
    expect(r.questions).toEqual(questions);
  });
});

describe("parseBrief with over-long suggestions from the model", () => {
  it("drops only the bad suggestions, and only questions left without enough of them", async () => {
    const r = await parseBrief("vendo cacahuates importados de japón", {
      model: modelReturning({
        brief: { whatTheyDo: "Vendo cacahuates importados de Japón." },
        questions: [
          {
            field: "whatTheyDo",
            question: "¿Qué cacahuates ofreces?",
            suggestions: ["Salados", "Tipo de cacahuate (crudo, tostado, con piel)", "Con chile"],
          },
          {
            field: "desiredAction",
            question: "¿Qué quieres que haga la gente?",
            suggestions: ["Comprar", "Una sugerencia muchísimo más larga que treinta y dos caracteres"],
          },
        ],
      }),
    });
    expect(r.status).toBe("needs-input");
    if (r.status !== "needs-input") return;
    expect(r.partial).toMatchObject({ whatTheyDo: "Vendo cacahuates importados de Japón." });
    expect(r.questions).toEqual([
      { field: "whatTheyDo", question: "¿Qué cacahuates ofreces?", suggestions: ["Salados", "Con chile"] },
    ]);
  });
});

describe("parseBrief never proposes selling online", () => {
  it("drops an online-sale action and online-sale suggestions", async () => {
    const r = await parseBrief("vendo cacahuates importados de japón", {
      model: modelReturning({
        brief: { whatTheyDo: "Vendo cacahuates importados de Japón.", desiredAction: "Comprar en línea" },
        questions: [
          { field: "desiredAction", question: "¿Qué quieres que haga la gente?", suggestions: ["Comprar en línea", "Mandarme WhatsApp", "Agendar una cita"] },
        ],
      }),
    });
    expect(r.status).toBe("needs-input");
    if (r.status !== "needs-input") return;
    expect(r.partial.desiredAction).toBeUndefined();
    expect(r.questions[0].suggestions).toEqual(["Mandarme WhatsApp", "Agendar una cita"]);
  });
});
