import { surveyInstrument } from "@/lib/shalomut-source";
import type {
  SurveyDefinition,
  SurveyDefinitionQuestion,
} from "@/lib/types/backend";

/**
 * Respondents a round needs before anything below the round total is shown.
 *
 * Ten is a product requirement, not a suggestion: below it a published average
 * stops hiding the individual who produced it, and a reading drawn from fewer
 * answers describes those people rather than the school. It is the minimum a
 * round may be configured with and the value a new round starts at.
 */
export const MINIMUM_PRIVACY_THRESHOLD = 10;

/** Threshold a new round starts with when the manager configures nothing. */
export const DEFAULT_PRIVACY_THRESHOLD = MINIMUM_PRIVACY_THRESHOLD;

/**
 * Rounds configured before the threshold became mandatory are still readable —
 * they are raised to the minimum rather than rejected. Below this number the
 * manager surfaces say plainly that the round promised no anonymity at all.
 */
export const LOW_PRIVACY_THRESHOLD_WARNING = 5;

/**
 * The threshold a round is actually read at.
 *
 * Rounds persisted before ten became mandatory still carry their old number in
 * the database, and that column is what every lock decision reads. Passing it
 * through here is what makes the requirement true of existing rounds too,
 * rather than only of the ones created from now on.
 */
export function effectivePrivacyThreshold(
  storedThreshold: number | undefined | null,
): number {
  if (typeof storedThreshold !== "number" || !Number.isFinite(storedThreshold)) {
    return MINIMUM_PRIVACY_THRESHOLD;
  }

  return Math.max(storedThreshold, MINIMUM_PRIVACY_THRESHOLD);
}

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
    minimumResponses < 1
  ) {
    return {
      ok: false,
      error: "Privacy threshold must be a positive whole number.",
    };
  }

  // A definition persisted before the threshold became mandatory is raised to
  // it, never refused: refusing would take the round's own answer screen down
  // with it, and the safe direction here is upward.
  const enforcedMinimumResponses = Math.max(
    minimumResponses,
    MINIMUM_PRIVACY_THRESHOLD,
  );

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
      minimumResponses: enforcedMinimumResponses,
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
 * Whether two definitions are the same document.
 *
 * Stricter than `hasSameQuestionSnapshot`, which asks the narrower question the
 * response guard needs: whether the questions themselves still match. This one
 * also counts the surrounding copy, the audience and the threshold, because the
 * version history records saves that changed anything a manager typed — a
 * rewritten intro is a change worth being able to undo.
 */
export function isSameSurveyDefinition(
  current: SurveyDefinition,
  next: SurveyDefinition,
): boolean {
  return (
    current.title === next.title &&
    current.audience === next.audience &&
    current.estimatedMinutes === next.estimatedMinutes &&
    current.minimumResponses === next.minimumResponses &&
    current.introText === next.introText &&
    current.anonymityText === next.anonymityText &&
    hasSameQuestionSnapshot(current, next)
  );
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

/**
 * Ten seconds an item. The three scale anchors are the same three sentences on
 * every question, so they are read once and recognised thereafter, and the
 * answer is a single tap that advances by itself.
 */
const SECONDS_PER_QUESTION = 10;

/**
 * How long the questionnaire takes, derived from the only thing that governs
 * it: how many questions it has.
 *
 * This was a hardcoded 15, and it is the last thing a respondent reads before
 * deciding whether to start — «24 שאלות, כ־15 דקות» for twenty-four single-tap
 * items. A teacher glancing at the link between lessons decides on that one
 * integer, and it was several times too high.
 */
export function estimateMinutesForQuestions(questionCount: number): number {
  return Math.max(1, Math.ceil((questionCount * SECONDS_PER_QUESTION) / 60));
}

export function createCanonicalSurveyDefinition(
  title: string,
  minimumResponses: number,
): SurveyDefinition {
  return {
    title,
    audience: "כלל צוות ההוראה",
    estimatedMinutes: estimateMinutesForQuestions(
      surveyInstrument.questions.length,
    ),
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
