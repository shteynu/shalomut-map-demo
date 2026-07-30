import {
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";

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

export type AiSuggestionOutcome =
  | { ok: true; suggestion: QuestionSuggestion }
  | { ok: false; error: string };

/**
 * Ask the AI service, through Core, for one more item for one dimension.
 *
 * The failure path returns Hebrew a manager can read, and the caller falls back
 * to the template under the template's own label. It never relabels a failure
 * as a suggestion: that is the same rule the analysis follows, where a
 * deterministic sentence may not wear the model's label.
 */
export async function requestAiQuestionSuggestion(
  dimensionId: WellbeingDimensionId,
  existingTexts: string[] = [],
): Promise<AiSuggestionOutcome> {
  const response = await fetch("/api/manager/question-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimensionId, existingTexts }),
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
 * Which dimension a suggestion is for when the manager is looking at all of
 * them: the first one the questionnaire does not cover yet, since that is the
 * one blocking activation, and otherwise the first dimension.
 */
export function suggestionDimensionId(
  selectedDimensionId: string,
  missingDimensionIds: WellbeingDimensionId[],
): WellbeingDimensionId {
  if (selectedDimensionId !== "all") {
    return selectedDimensionId as WellbeingDimensionId;
  }
  return missingDimensionIds[0] ?? surveyInstrument.dimensions[0].id;
}
