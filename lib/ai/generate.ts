import { z } from "zod";
import { geminiJson, groqJson, ModelError, type ModelCall } from "./client";

import {
  BRIEF_SYSTEM,
  buildBriefFollowUpPrompt,
  buildBriefPrompt,
  isSparse,
} from "./prompts/brief";

import {
  buildEditPrompt,
  buildRepairPrompt,
  buildSectionPrompt,
  SECTION_SYSTEM,
} from "./prompts/section";

import { fallbackFor, fallbackQuestions } from "@/lib/fallbacks";

import {
  BriefParse,
  BusinessBrief,
  resolveBriefParse,
  VIBES,
  type BriefParseOutcome,
  type FollowUpQuestion,
} from "@/lib/schemas/brief";

import {
  IMAGE_CATEGORIES,
  SECTION_TYPES,
  SectionStyle,
  type SectionStatus,
  type SectionType,
} from "@/lib/schemas/primitives";

import {
  GENERATION_BASE_SCHEMAS,
  GENERATION_SCHEMAS,
  Section,
} from "@/lib/schemas/section";

import { seedFrom } from "@/lib/seed";
import { derivePalette } from "@/lib/theme/palette";

/**
 * Maximum number of model/schema attempts.
 *
 * Attempt 1 = normal generation
 * Attempt 2 = repair generation
 *
 * After that we use the deterministic fallback.
 */
const MAX_SCHEMA_ATTEMPTS = 2;

/**
 * Transport errors get their own retry budget.
 *
 * This means a temporary 429/5xx/network failure does not immediately consume
 * the schema-repair budget.
 */
const MAX_TRANSPORT_RETRIES = 2;

export type AttemptLog = {
  sectionType: SectionType;
  attemptNumber: number;
  outcome:
  | "valid"
  | "schema-error"
  | "api-error"
  | "fallback";
  error?: string;
};

export type SectionResult = {
  section: Section;
  status: Extract<SectionStatus, "valid" | "fallback">;
  attempts: AttemptLog[];
};

type Deps = {
  model?: ModelCall;
  onAttempt?: (log: AttemptLog) => void;
};

/* ------------------------------------------------------------- utilities */

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path
      ? `${path}: ${issue.message}`
      : issue.message;
  });
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retry only transport-related failures.
 *
 * bad-json is intentionally NOT retried here because malformed model output
 * belongs to the schema/repair loop.
 *
 * Client errors such as 400/401/403 are also not retried because retrying
 * them cannot fix the request.
 */
async function callWithTransportRetries(
  model: ModelCall,
  request: Parameters<ModelCall>[0],
): Promise<unknown> {
  let lastError: ModelError | undefined;

  for (
    let retry = 0;
    retry <= MAX_TRANSPORT_RETRIES;
    retry++
  ) {
    try {
      const { data } = await model(request);
      return data;
    } catch (error) {
      if (!(error instanceof ModelError)) {
        throw error;
      }

      if (
        error.kind === "bad-json" ||
        error.kind === "client"
      ) {
        throw error;
      }

      lastError = error;

      /**
       * Don't sleep after the final attempt.
       */
      if (retry < MAX_TRANSPORT_RETRIES) {
        await sleep(400 * 2 ** retry);
      }
    }
  }

  throw (
    lastError ??
    new ModelError(
      "No se pudo completar la solicitud al modelo de IA.",
      "network",
    )
  );
}

function buildStyle(
  brief: BusinessBrief,
  projectId: string,
  sectionId: string,
): z.infer<typeof SectionStyle> {
  const { accent, accentAlt } = derivePalette(
    brief,
    projectId,
  );

  const lively =
    brief.vibe.includes("bold") ||
    brief.vibe.includes("playful");

  const quiet =
    brief.vibe.includes("minimal") ||
    brief.vibe.includes("calm");

  return SectionStyle.parse({
    accent,
    accentAlt,
    seed: seedFrom(projectId, sectionId),
    motion: lively
      ? "lively"
      : quiet
        ? "subtle"
        : "balanced",
    floatingShapes: quiet
      ? 2
      : lively
        ? 5
        : 3,
    cursorGlow: !quiet,
  });
}

/**
 * Thrown only when our own deterministic fallback is invalid.
 */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

type AssembleArgs = {
  id: string;
  type: SectionType;
  variant: string;
  content: unknown;
  brief: BusinessBrief;
  projectId: string;
  status: "valid" | "fallback";
};

function assemble(
  args: AssembleArgs,
):
  | { ok: true; section: Section }
  | { ok: false; problems: string[] } {
  const parsed = Section.safeParse({
    id: args.id,
    type: args.type,
    variant: args.variant,
    content: args.content,
    style: buildStyle(
      args.brief,
      args.projectId,
      args.id,
    ),
    status: args.status,
  });

  return parsed.success
    ? {
      ok: true,
      section: parsed.data,
    }
    : {
      ok: false,
      problems: formatIssues(parsed.error),
    };
}

/* ------------------------------------------------------ section generation */

type GenerateArgs = {
  type: SectionType;
  brief: BusinessBrief;
  projectId: string;
  sectionId: string;
};

export async function generateSection(
  {
    type,
    brief,
    projectId,
    sectionId,
  }: GenerateArgs,
  deps: Deps = {},
): Promise<SectionResult> {
  const model = deps.model ?? (process.env.GROQ_API_KEY ? groqJson : geminiJson);

  const attempts: AttemptLog[] = [];

  const record = (log: AttemptLog) => {
    attempts.push(log);
    deps.onAttempt?.(log);
  };

  let user = buildSectionPrompt(
    type,
    brief,
  );

  for (
    let attempt = 1;
    attempt <= MAX_SCHEMA_ATTEMPTS;
    attempt++
  ) {
    let raw: unknown;

    try {
      raw = await callWithTransportRetries(
        model,
        {
          system: SECTION_SYSTEM,
          user,
          responseSchema:
            GENERATION_BASE_SCHEMAS[type],
          temperature: 0.95,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const isBadJson =
        error instanceof ModelError &&
        error.kind === "bad-json";

      record({
        sectionType: type,
        attemptNumber: attempt,
        outcome: isBadJson
          ? "schema-error"
          : "api-error",
        error: message,
      });

      /**
       * Malformed JSON should get the repair turn.
       *
       * Actual transport/API failures go directly to fallback after their
       * independent retry budget has been exhausted.
       */
      if (!isBadJson) {
        break;
      }

      user = buildRepairPrompt(
        user,
        ["La respuesta no contiene JSON válido."],
      );

      continue;
    }

    const parsed =
      GENERATION_SCHEMAS[type].safeParse(raw);

    if (parsed.success) {
      const built = assemble({
        id: sectionId,
        type,
        variant: parsed.data.variant,
        content: parsed.data.content,
        brief,
        projectId,
        status: "valid",
      });

      if (built.ok) {
        record({
          sectionType: type,
          attemptNumber: attempt,
          outcome: "valid",
        });

        return {
          section: built.section,
          status: "valid",
          attempts,
        };
      }

      /**
       * If generation passed but stored-section validation failed,
       * the schemas have drifted. A model repair cannot reliably fix
       * a mismatch between our own schemas.
       */
      record({
        sectionType: type,
        attemptNumber: attempt,
        outcome: "schema-error",
        error:
          `assembly rejected: ${built.problems.join("; ")}`,
      });

      break;
    }

    const problems = formatIssues(
      parsed.error,
    );

    record({
      sectionType: type,
      attemptNumber: attempt,
      outcome: "schema-error",
      error: problems.join("; "),
    });

    /**
     * Give Gemini the exact Zod validation problems so the second
     * generation has a targeted repair instruction.
     */
    user = buildRepairPrompt(
      user,
      problems,
    );
  }

  const safe = fallbackFor(
    type,
    brief,
  );

  const built = assemble({
    id: sectionId,
    type,
    variant: safe.variant,
    content: safe.content,
    brief,
    projectId,
    status: "fallback",
  });

  if (!built.ok) {
    throw new PipelineError(
      `The fallback for "${type}" is itself invalid: ` +
      `${built.problems.join("; ")}. ` +
      `Corrige lib/fallbacks.ts: no hay más opciones de respaldo disponibles.`,
    );
  }

  record({
    sectionType: type,
    attemptNumber: MAX_SCHEMA_ATTEMPTS,
    outcome: "fallback",
  });

  return {
    section: built.section,
    status: "fallback",
    attempts,
  };
}

/* ----------------------------------------------------------------- edits */

/**
 * Edit an existing section.
 *
 * Important behavior:
 *
 * - API/network errors -> unchanged
 * - malformed JSON -> repair attempt
 * - schema failure -> repair attempt
 * - successful edit -> replace original
 * - total failure -> return original untouched
 *
 * We NEVER replace a good existing section with a generic fallback.
 */
export async function editSection(
  args: {
    section: Section;
    brief: BusinessBrief;
    projectId: string;
    request: string;
    allowVariantChange?: boolean;
  },
  deps: Deps = {},
): Promise<{
  section: Section;
  status: "valid" | "unchanged";
  attempts: AttemptLog[];
}> {
  const model = deps.model ?? (process.env.GROQ_API_KEY ? groqJson : geminiJson);

  const type = args.section.type;

  const attempts: AttemptLog[] = [];

  const record = (log: AttemptLog) => {
    attempts.push(log);
    deps.onAttempt?.(log);
  };

  let user = buildEditPrompt(
    args.section,
    args.brief,
    args.request,
    args.allowVariantChange ?? true,
  );

  for (
    let attempt = 1;
    attempt <= MAX_SCHEMA_ATTEMPTS;
    attempt++
  ) {
    let raw: unknown;

    try {
      raw = await callWithTransportRetries(
        model,
        {
          system: SECTION_SYSTEM,
          user,
          responseSchema:
            GENERATION_BASE_SCHEMAS[type],

          /**
           * Edits should be conservative.
           */
          temperature: 0.6,
        },
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const isBadJson =
        error instanceof ModelError &&
        error.kind === "bad-json";

      record({
        sectionType: type,
        attemptNumber: attempt,
        outcome: isBadJson
          ? "schema-error"
          : "api-error",
        error: message,
      });

      /**
       * Unlike the previous implementation, malformed JSON gets
       * the second repair attempt instead of immediately abandoning
       * the edit.
       */
      if (!isBadJson) {
        break;
      }

      user = buildRepairPrompt(
        user,
        ["La respuesta no contiene JSON válido."],
      );

      continue;
    }

    const parsed =
      GENERATION_SCHEMAS[type].safeParse(raw);

    if (parsed.success) {
      const built = assemble({
        id: args.section.id,
        type,

        /**
         * If variant changes are disabled, preserve the existing
         * variant regardless of what the model returns.
         */
        variant:
          args.allowVariantChange === false
            ? args.section.variant
            : parsed.data.variant,

        content: parsed.data.content,
        brief: args.brief,
        projectId: args.projectId,
        status: "valid",
      });

      if (built.ok) {
        record({
          sectionType: type,
          attemptNumber: attempt,
          outcome: "valid",
        });

        return {
          section: built.section,
          status: "valid",
          attempts,
        };
      }

      record({
        sectionType: type,
        attemptNumber: attempt,
        outcome: "schema-error",
        error:
          `assembly rejected: ${built.problems.join("; ")}`,
      });

      /**
       * The assembly schema is our own schema mismatch.
       * Retrying the model is unlikely to fix it.
       */
      break;
    }

    const problems = formatIssues(
      parsed.error,
    );

    record({
      sectionType: type,
      attemptNumber: attempt,
      outcome: "schema-error",
      error: problems.join("; "),
    });

    user = buildRepairPrompt(
      user,
      problems,
    );
  }

  /**
   * Never destroy a working section because an edit failed.
   */
  return {
    section: args.section,
    status: "unchanged",
    attempts,
  };
}

/* ---------------------------------------------------------- brief parsing */

export async function parseBrief(
  description: string,
  deps: Deps = {},
): Promise<BriefParseOutcome> {
  const model = deps.model ?? (process.env.GROQ_API_KEY ? groqJson : geminiJson);

  const raw = await callWithTransportRetries(
    model,
    {
      system: BRIEF_SYSTEM,
      user: buildBriefPrompt(description),
      responseSchema: BriefParse,
      temperature: 0.3,
    },
  );

  const parsed = BriefParse.safeParse(raw);

  if (!parsed.success) {
    /**
     * Do not silently invent business requirements.
     * The UI should ask the user for clarification.
     */
    return {
      status: "needs-input",
      partial: {},
      questions: fallbackQuestions(),
    };
  }

  const outcome =
    resolveBriefParse(parsed.data);

  /**
   * Very short descriptions can technically pass validation while
   * containing almost no useful business information.
   */
  if (
    outcome.status === "complete" &&
    isSparse(description)
  ) {
    return {
      status: "needs-input",
      partial: outcome.brief,
      questions:
        parsed.data.questions.length
          ? parsed.data.questions
          : fallbackQuestions(),
    };
  }

  if (
    outcome.status === "needs-input" &&
    outcome.questions.length === 0
  ) {
    return {
      ...outcome,
      questions: fallbackQuestions(),
    };
  }

  return outcome;
}

export async function completeBrief(
  args: {
    description: string;
    partial: Partial<BusinessBrief>;
    answers: {
      question: FollowUpQuestion;
      answer: string;
    }[];
  },
  deps: Deps = {},
): Promise<BusinessBrief> {
  const model = deps.model ?? (process.env.GROQ_API_KEY ? groqJson : geminiJson);

  const raw = await callWithTransportRetries(
    model,
    {
      system: BRIEF_SYSTEM,
      user: buildBriefFollowUpPrompt(
        args.description,
        args.partial,
        args.answers,
      ),
      responseSchema: BriefParse,
      temperature: 0.3,
    },
  );

  const parsed = BriefParse.safeParse(raw);

  const briefCandidate = parsed.success
    ? parsed.data.brief
    : typeof raw === "object" && raw !== null && "brief" in raw
    ? (raw as Record<string, unknown>).brief
    : typeof raw === "object" && raw !== null
    ? raw
    : {};

  const answerFallbacks: Partial<BusinessBrief> = {};
  const keyPointAnswers: string[] = [];
  const vibeAnswer = args.answers
    .filter((answer) => answer.question.field === "vibe")
    .map((answer) => answer.answer.toLowerCase())
    .join(" ");

  for (const { question, answer } of args.answers) {
    const value = answer.trim();
    if (!value) continue;

    switch (question.field) {
      case "whatTheyDo":
        answerFallbacks.whatTheyDo = value;
        break;
      case "audience":
        answerFallbacks.audience = value;
        break;
      case "desiredAction":
        answerFallbacks.desiredAction = value;
        break;
      case "keyPoints":
        keyPointAnswers.push(value);
        break;
    }
  }

  if (keyPointAnswers.length) answerFallbacks.keyPoints = keyPointAnswers;
  if (vibeAnswer) {
    const spanishVibes: Record<(typeof VIBES)[number], RegExp> = {
      bold: /atrevid|audaz|enérgic|llamativ/,
      calm: /calm|tranquil|relajad/,
      playful: /divertid|juguet|creativ/,
      premium: /premium|sofistic|luj/,
      technical: /técnic|profesional|modern/,
      warm: /cálid|cercan|amig/,
      minimal: /minimal|sencill/,
    };
    const matchedVibes = VIBES.filter((vibe) => spanishVibes[vibe].test(vibeAnswer));
    if (matchedVibes.length) answerFallbacks.vibe = matchedVibes.slice(0, 2);
  }

  const briefObj = {
    ...(typeof briefCandidate === "object" && briefCandidate !== null ? briefCandidate : {}),
    ...args.partial,
    ...answerFallbacks,
  };

  const directBrief = BusinessBrief.safeParse(briefObj);
  if (directBrief.success) {
    return directBrief.data;
  }

  const cleanText = (value: unknown, fallback: string, max: number) => {
    const candidate = typeof value === "string" ? value.trim() : "";
    return (candidate || fallback).slice(0, max).trim() || fallback.slice(0, max);
  };
  const originalDescription = args.description.trim() || "Mi emprendimiento";

  const vibe = Array.isArray(briefObj.vibe)
    ? briefObj.vibe.filter(
        (value): value is (typeof VIBES)[number] =>
          typeof value === "string" && VIBES.includes(value as (typeof VIBES)[number]),
      ).slice(0, 2)
    : [];
  const sections = Array.isArray(briefObj.sections)
    ? briefObj.sections.filter(
        (value): value is (typeof SECTION_TYPES)[number] =>
          typeof value === "string" && SECTION_TYPES.includes(value as (typeof SECTION_TYPES)[number]),
      ).slice(0, 4)
    : [];
  const keyPoints = Array.isArray(briefObj.keyPoints)
    ? briefObj.keyPoints
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .map((value) => value.trim().slice(0, 80))
        .slice(0, 6)
    : [];
  const validBrandColor =
    typeof briefObj.brandColor === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(briefObj.brandColor)
      ? briefObj.brandColor
      : undefined;

  const fallbackBrief: BusinessBrief = {
    businessName: cleanText(briefObj.businessName, originalDescription, 60),
    hasBusinessName: typeof briefObj.hasBusinessName === "boolean" ? briefObj.hasBusinessName : false,
    whatTheyDo: cleanText(briefObj.whatTheyDo, originalDescription, 200),
    audience: cleanText(briefObj.audience, "Público general", 120),
    vibe: vibe.length ? vibe : ["warm"],
    brandColor: validBrandColor,
    imageWorld:
      typeof briefObj.imageWorld === "string" && IMAGE_CATEGORIES.includes(briefObj.imageWorld as (typeof IMAGE_CATEGORIES)[number])
        ? briefObj.imageWorld as (typeof IMAGE_CATEGORIES)[number]
        : "product-object",
    desiredAction: cleanText(briefObj.desiredAction, "Contáctanos", 40),
    keyPoints,
    hasCustomers: typeof briefObj.hasCustomers === "boolean" ? briefObj.hasCustomers : false,
    sections: sections.length >= 2 ? sections : ["hero", "features", "cta"],
  };

  return BusinessBrief.parse(fallbackBrief);
}
