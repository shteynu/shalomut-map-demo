import { surveyInstrument } from "@/lib/shalomut-source";
import type {
  SurveyDefinition,
  SurveyDefinitionQuestion,
} from "@/lib/types/backend";

/** Lowest privacy threshold a round may be configured with. */
export const MINIMUM_PRIVACY_THRESHOLD = 1;

/** Threshold a new round starts with when the manager configures nothing. */
export const DEFAULT_PRIVACY_THRESHOLD = 1;

/**
 * Below this the published average stops hiding the individual respondent, so
 * the manager surfaces warn instead of silently promising anonymity.
 */
export const LOW_PRIVACY_THRESHOLD_WARNING = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSurveyDefinition(
  value: unknown,
  options?: { allowIncomplete?: boolean },
):
  | { ok: true; value: SurveyDefinition }
  | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: "Survey definition is required." };
  }

  const {
    title,
    audience,
    estimatedMinutes,
    minimumResponses,
    introText,
    anonymityText,
    questions,
  } = value;

  if (
    !isNonEmptyString(title) ||
    !isNonEmptyString(audience) ||
    !isNonEmptyString(introText) ||
    !isNonEmptyString(anonymityText)
  ) {
    return { ok: false, error: "Survey text fields must not be empty." };
  }

  if (
    typeof estimatedMinutes !== "number" ||
    !Number.isFinite(estimatedMinutes) ||
    estimatedMinutes < 1
  ) {
    return { ok: false, error: "Estimated minutes must be at least 1." };
  }

  if (
    typeof minimumResponses !== "number" ||
    !Number.isInteger(minimumResponses) ||
    minimumResponses < MINIMUM_PRIVACY_THRESHOLD
  ) {
    return {
      ok: false,
      error: `Privacy threshold must be at least ${MINIMUM_PRIVACY_THRESHOLD}.`,
    };
  }

  if (!Array.isArray(questions)) {
    return { ok: false, error: "Survey questions are required." };
  }

  const validDimensionIds = new Set(
    surveyInstrument.dimensions.map((dimension) => dimension.id),
  );
  const parsedQuestions: SurveyDefinitionQuestion[] = [];
  const seenQuestionIds = new Set<string>();

  for (const question of questions) {
    if (
      !isRecord(question) ||
      !isNonEmptyString(question.id) ||
      !isNonEmptyString(question.text) ||
      !isNonEmptyString(question.dimensionId) ||
      !validDimensionIds.has(
        question.dimensionId as SurveyDefinitionQuestion["dimensionId"],
      ) ||
      typeof question.required !== "boolean" ||
      typeof question.enabled !== "boolean" ||
      !isNonEmptyString(question.answerMode)
    ) {
      return { ok: false, error: "Survey contains an invalid question." };
    }

    if (seenQuestionIds.has(question.id)) {
      return { ok: false, error: "Survey question IDs must be unique." };
    }
    seenQuestionIds.add(question.id);

    parsedQuestions.push({
      id: question.id,
      text: question.text,
      dimensionId:
        question.dimensionId as SurveyDefinitionQuestion["dimensionId"],
      required: question.required,
      enabled: question.enabled,
      answerMode: question.answerMode,
    });
  }

  if (!options?.allowIncomplete) {
    const enabledDimensionIds = new Set(
      parsedQuestions
        .filter((question) => question.enabled)
        .map((question) => question.dimensionId),
    );
    for (const dimensionId of validDimensionIds) {
      if (!enabledDimensionIds.has(dimensionId)) {
        return {
          ok: false,
          error:
            "Enabled survey questions must cover all eight dimensions before activation.",
        };
      }
    }
  }

  return {
    ok: true,
    value: {
      title: title.trim(),
      audience: audience.trim(),
      estimatedMinutes,
      minimumResponses,
      introText: introText.trim(),
      anonymityText: anonymityText.trim(),
      questions: parsedQuestions,
    },
  };
}

export function hasSameQuestionSnapshot(
  current: SurveyDefinition,
  next: SurveyDefinition,
): boolean {
  if (current.questions.length !== next.questions.length) return false;

  return current.questions.every((question, index) => {
    const candidate = next.questions[index];
    return (
      candidate !== undefined &&
      question.id === candidate.id &&
      question.text === candidate.text &&
      question.dimensionId === candidate.dimensionId &&
      question.required === candidate.required &&
      question.enabled === candidate.enabled &&
      question.answerMode === candidate.answerMode
    );
  });
}

/**
 * A questionnaire may only go live once every dashboard dimension has at least
 * one enabled question, so this is the single activation gate shared by round
 * creation, saving and the respondent route.
 */
export function isActivatableSurveyDefinition(
  definition: SurveyDefinition,
): boolean {
  const enabledDimensionIds = new Set(
    definition.questions
      .filter((question) => question.enabled)
      .map((question) => question.dimensionId),
  );

  return surveyInstrument.dimensions.every((dimension) =>
    enabledDimensionIds.has(dimension.id),
  );
}

/**
 * The starting point for a new round: the manager writes their own questions or
 * loads the canonical template explicitly. Nothing is pre-filled, so nobody
 * distributes a questionnaire they never read.
 */
export function createEmptyDraftSurveyDefinition(
  title: string,
  minimumResponses: number,
): SurveyDefinition {
  return {
    ...createCanonicalSurveyDefinition(title, minimumResponses),
    questions: [],
  };
}

export function createCanonicalSurveyDefinition(
  title: string,
  minimumResponses: number,
): SurveyDefinition {
  return {
    title,
    audience: "כלל צוות ההוראה",
    estimatedMinutes: 15,
    minimumResponses,
    introText:
      "השאלון נשלח כקישור אנונימי לצוות. התוצאות מוצגות רק ברמה מצרפית אחרי הגעה לסף פרטיות.",
    anonymityText:
      "לא נאספים שם, כתובת מייל או פרטים מזהים. רק הנהלת בית הספר רואה תמונת מצב מצרפית.",
    questions: surveyInstrument.questions.map((question) => ({
      ...question,
      enabled: true,
      answerMode: "סקאלת צבעים",
    })),
  };
}
