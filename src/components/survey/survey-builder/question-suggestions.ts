import {
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";
import type { BuilderQuestion } from "./types";

/**
 * Where a suggested item came from, and it is never decorative.
 *
 * A manager deciding whether to keep a line has to know whether a model wrote
 * it or whether it is the instrument's own wording. `ai` is only ever set when
 * the service answered with model-written copy; everything else is `template`.
 */
export type QuestionSuggestionSource = "ai" | "template";

export type QuestionSuggestion = {
  dimensionId: WellbeingDimensionId;
  text: string;
  source: QuestionSuggestionSource;
};

function normalize(text: string) {
  return text.replace(/\s+/gu, " ").trim().replace(/\.$/u, "").trim();
}

/**
 * The instrument's own item for a dimension that the draft does not hold yet.
 *
 * This is the template half of the flow, and it replaces the three hardcoded
 * questions the library used to cycle through: those covered three dimensions of
 * eight, so a manager building a round about the other five had nothing to start
 * from. The canonical questionnaire covers all eight by construction, and it is
 * already the source of truth for the taxonomy.
 */
export function templateSuggestionForDimension(
  dimensionId: WellbeingDimensionId,
  existingTexts: string[] = [],
): QuestionSuggestion | null {
  const used = new Set(existingTexts.map(normalize));
  const candidate = surveyInstrument.questions.find(
    (question) =>
      question.dimensionId === dimensionId && !used.has(normalize(question.text)),
  );

  return candidate
    ? { dimensionId, text: candidate.text, source: "template" }
    : null;
}

/**
 * The draft's own items in one dimension: what the model is shown as the style.
 *
 * A separate rule from the do-not-repeat list, and narrower than it on purpose.
 * A demographic item is not a wellbeing statement — "כמה שנים את/ה מלמד/ת?" is
 * a question with a factual answer, and offering it as the shape to imitate
 * teaches the model the one form the validator refuses. Another dimension's
 * items are about another subject.
 *
 * Named and exported rather than written inline at the call site, because it is
 * the rule this whole change exists to state: the suggestion follows the
 * questionnaire being written.
 */
export function styleTextsForDimension(
  questions: readonly BuilderQuestion[],
  dimensionId: WellbeingDimensionId,
): string[] {
  return questions
    .filter(
      (question) =>
        question.kind === "analytic" && question.dimensionId === dimensionId,
    )
    .map((question) => question.text)
    .filter((text) => text.trim().length > 0);
}

export type AiSuggestionOutcome =
  | { ok: true; suggestion: QuestionSuggestion }
  | { ok: false; error: string };

/**
 * Ask the AI service, through Core, for one more item for one dimension.
 *
 * Two lists travel, and they are not the same list. `existingTexts` is the whole
 * draft, so the model does not hand back a line the questionnaire already holds.
 * `styleTexts` is the draft's own analytic items *in this dimension*, and it is
 * what the model is shown as the style to match — which is why demographic items
 * and other dimensions are kept out of it.
 *
 * The service used to build that style list itself, from the frozen v2 contract,
 * and it had already drifted from the instrument Core ships. Sending it from
 * here is what makes the suggestion follow the questionnaire being written
 * rather than a published copy of an older one.
 *
 * The failure path returns Hebrew a manager can read, and the caller falls back
 * to the template under the template's own label. It never relabels a failure
 * as a suggestion: that is the same rule the analysis follows, where a
 * deterministic sentence may not wear the model's label.
 */
export async function requestAiQuestionSuggestion(
  dimensionId: WellbeingDimensionId,
  existingTexts: string[] = [],
  styleTexts: string[] = [],
): Promise<AiSuggestionOutcome> {
  const response = await fetch("/api/manager/question-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimensionId, existingTexts, styleTexts }),
  }).catch(() => null);

  if (!response) {
    return { ok: false, error: "לא ניתן היה לפנות לשירות הצעת השאלות." };
  }

  const body = await response.json().catch(() => null);

  if (!response.ok || !body || typeof body.questionText !== "string") {
    const message =
      body && typeof body.error === "string" && /[֐-׿]/u.test(body.error)
        ? body.error
        : "הצעת שאלה מהבינה המלאכותית אינה זמינה כרגע.";
    return { ok: false, error: message };
  }

  return {
    ok: true,
    suggestion: {
      dimensionId,
      text: body.questionText.trim(),
      source: "ai",
    },
  };
}

/**
 * Which dimension a suggestion is for when the tab in view names none of them:
 * the first one the questionnaire does not cover yet, since that is the one
 * blocking activation, and otherwise the first dimension.
 *
 * Two tabs name no dimension — "all", and the background tab. Both fall through
 * to the same answer, because a suggestion is always an analysed question:
 * nothing in this product suggests a demographic item, and the screen used to
 * offer "a suggestion for the `background` dimension", naming a filter id as if
 * it were one of the eight.
 */
export function suggestionDimensionId(
  selectedDimensionId: string,
  missingDimensionIds: WellbeingDimensionId[],
): WellbeingDimensionId {
  const namesADimension = surveyInstrument.dimensions.some(
    (dimension) => dimension.id === selectedDimensionId,
  );
  if (namesADimension) {
    return selectedDimensionId as WellbeingDimensionId;
  }
  return missingDimensionIds[0] ?? surveyInstrument.dimensions[0].id;
}
