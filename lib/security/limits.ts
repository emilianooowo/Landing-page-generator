import type { BusinessBrief } from "@/lib/schemas/brief";

/** Shared by the form (maxLength) and the API (schema), so both agree. */
export const MAX_DESCRIPTION_LENGTH = 1500;
export const MAX_ANSWER_LENGTH = 300;

/** Free-text brief fields. The brief normally comes from parse-brief, but the client could forge one. */
export function briefTexts(brief: BusinessBrief): string {
  return [brief.businessName, brief.whatTheyDo, brief.audience, brief.desiredAction, ...brief.keyPoints].join("\n");
}
