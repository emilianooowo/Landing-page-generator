/**
 * Throwaway harness. Run the whole content pipeline from a plain description
 * and watch what the validator does, with no UI in the way.
 *
 *   npx tsx scripts/try-generate.ts "I run a small bakery in Lahore..."
 *   npx tsx scripts/try-generate.ts --fake "..."                 # no API key, no quota
 *   npx tsx scripts/try-generate.ts --fake --break=variant "..." # repairs on attempt 2
 *   npx tsx scripts/try-generate.ts --fake --break=always "..."  # proves fallback fires
 *
 * The --break modes are the integration test from the spec, run by hand. The
 * same fake model gets reused in tests/ later.
 */
import { generateSection, parseBrief, type AttemptLog } from "@/lib/ai/generate";
import { ModelError, type ModelCall } from "@/lib/ai/client";
import type { BusinessBrief } from "@/lib/schemas/brief";
import type { SectionType } from "@/lib/schemas/primitives";

type BreakMode = "none" | "json" | "variant" | "items" | "always";

const args = process.argv.slice(2);
const useFake = args.includes("--fake");
const breakMode = (args.find((a) => a.startsWith("--break="))?.split("=")[1] ??
  "none") as BreakMode;
const description = args.filter((a) => !a.startsWith("--")).join(" ");

if (!description) {
  console.error("Give me a business description in quotes.");
  process.exit(1);
}

/* ------------------------------------------------------------ fake model */

const FAKE_BRIEF: BusinessBrief = {
  businessName: "Sample Business",
  hasBusinessName: true,
  whatTheyDo: "A small local business described by the person using the tool.",
  audience: "People nearby who need what they offer",
  vibe: ["warm"],
  imageWorld: "workspace",
  desiredAction: "Get in touch",
  keyPoints: ["Made to order", "Open six days a week", "Family run since day one"],
  hasCustomers: true,
  sections: ["hero", "features", "testimonials", "cta"],
};

const GOOD: Record<SectionType, unknown> = {
  hero: {
    variant: "aurora-veil",
    content: {
      headline: "Bread baked the morning you buy it",
      subheadline: "A small bakery working from one oven, one recipe book and a short list of suppliers.",
      primaryCta: { label: "See today's bakes", href: "#" },
    },
  },
  features: {
    variant: "glass-grid",
    content: {
      headline: "What comes out of the oven",
      items: [
        { title: "Sourdough", body: "Two days of fermentation, baked dark.", icon: "star" },
        { title: "Pastry", body: "Laminated by hand each morning.", icon: "coffee" },
        { title: "Custom orders", body: "Cakes and trays with three days' notice.", icon: "heart" },
      ],
    },
  },
  testimonials: {
    variant: "single-spotlight",
    content: {
      headline: "What customers say",
      items: [{ quote: "The rye is the only one I buy now.", name: "Sample customer" }],
    },
  },
  cta: {
    variant: "glass-monolith",
    content: {
      headline: "Come by before noon",
      primaryCta: { label: "Get in touch", href: "#" },
    },
  },
};

/** Deliberately wrong replies, one per failure mode we want to see handled. */
function broken(type: SectionType, mode: BreakMode): unknown {
  switch (mode) {
    case "variant":
      return { variant: "cosmic-mega-hero", content: (GOOD[type] as any).content };
    case "items":
      if (type !== "features") return { variant: "cosmic-mega-hero", content: (GOOD[type] as any).content };
      return {
        variant: "orbit-ring",
        content: {
          headline: "Too many things",
          items: Array.from({ length: 6 }, (_, i) => ({
            title: `Item ${i + 1}`,
            body: "Six items in a layout that tops out at five.",
            icon: "check",
          })),
        },
      };
    default:
      return { nonsense: true };
  }
}

/**
 * One fake model per section, built with the type it is answering for. The old
 * version guessed the type by string-matching the prompt, which silently
 * returned hero content for the features slot — a bug in the harness that looked
 * exactly like a bug in the pipeline.
 */
function makeFakeModel(type: SectionType): ModelCall {
  return async (request) => {
    if (breakMode === "json") throw new ModelError("not JSON", "bad-json");
    if (breakMode === "always") return { data: broken(type, "variant"), raw: "" };

    // Fail the first attempt, then behave: this path should end "valid" after two
    // attempts, not in a fallback.
    const isRepair = request.user.includes("Your previous answer was rejected");
    if (breakMode !== "none" && !isRepair) return { data: broken(type, breakMode), raw: "" };
    return { data: GOOD[type], raw: "" };
  };
}

const briefModel: ModelCall = async () => ({
  data: { brief: FAKE_BRIEF, questions: [] },
  raw: "",
});

/* ---------------------------------------------------------------- runner */

async function main() {
  const projectId = `cli-${Date.now()}`;

  const outcome = await parseBrief(description, useFake ? { model: briefModel } : {});
  if (outcome.status === "needs-input") {
    console.log("Brief is incomplete. The tool would ask:");
    for (const q of outcome.questions) {
      console.log(`  • ${q.question}  [${q.suggestions.join(" / ")}]`);
    }
    if (outcome.questions.length === 0) console.log("  (model returned nothing usable)");
    return;
  }

  const brief = outcome.brief;
  console.log(`\n${brief.businessName} — ${brief.vibe.join(", ")}`);
  console.log(`Sections: ${brief.sections.join(", ")}\n`);

  for (const type of brief.sections) {
    const logs: AttemptLog[] = [];
    const result = await generateSection(
      { type, brief, projectId, sectionId: `${type}-1` },
      {
        ...(useFake ? { model: makeFakeModel(type) } : {}),
        onAttempt: (l) => logs.push(l),
      },
    );

    const trail = logs.map((l) => `${l.attemptNumber}:${l.outcome}`).join(" → ");
    console.log(`${type.padEnd(13)} ${result.status.padEnd(9)} ${result.section.variant.padEnd(22)} ${trail}`);
    for (const log of logs) {
      if (log.error) console.log(`${" ".repeat(15)}↳ ${log.error}`);
    }
    console.log(`${" ".repeat(15)}${JSON.stringify(result.section.content).slice(0, 120)}…\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
