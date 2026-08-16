import { surveyInstrument } from "@/lib/shalomut-source";
import { isAnswerScaleId } from "@/lib/survey/answer-scales";
import { estimateMinutesForQuestionnaire } from "@/lib/survey/survey-duration";
import {
  isAnalyticQuestion,
  type AnalyticSurveyQuestion,
  type BackgroundAnswerMode,
  type SurveyDefinition,
  type SurveyDefinitionQuestion,
  type SurveyQuestionOption,
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

type QuestionCommon = {
  id: string;
  text: string;
  required: boolean;
  enabled: boolean;
  sectionId?: string;
};

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const BACKGROUND_ANSWER_MODES: BackgroundAnswerMode[] = [
  "single-choice",
  "number",
  "allocation-100",
];

function parseOptions(
  value: unknown,
): ParseResult<SurveyQuestionOption[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "Survey question options must not be empty." };
  }

  const parsed: SurveyQuestionOption[] = [];
  const seen = new Set<string>();

  for (const option of value) {
    if (
      !isRecord(option) ||
      !isNonEmptyString(option.value) ||
      !isNonEmptyString(option.label)
    ) {
      return { ok: false, error: "Survey question options must not be empty." };
    }
    if (seen.has(option.value)) {
      return {
        ok: false,
        error: "Survey question option values must be unique.",
      };
    }
    seen.add(option.value);
    parsed.push({ value: option.value, label: option.label });
  }

  return { ok: true, value: parsed };
}

/**
 * Reads one persisted question into its kind.
 *
 * **A question with no `kind` is analytic on the colour scale with positive
 * polarity, and this is the load-bearing line of the whole change.** Every
 * questionnaire in the database was written before these fields existed. If
 * they defaulted any other way — or if their absence were refused — a round
 * mid-collection would either change what its answers mean or stop rendering,
 * and neither is recoverable from once a staffroom has started answering.
 *
 * The old `answerMode` string is deliberately not read back. It was a label
 * shown on the builder card, hardcoded to `סקאלת צבעים` at all three sites
 * that produced one and editable at none of them, so nothing a manager typed
 * is lost by deriving the label from the scale instead.
 */
function parseQuestionKind(
  raw: Record<string, unknown>,
  common: QuestionCommon,
  validDimensionIds: Set<string>,
): ParseResult<SurveyDefinitionQuestion> {
  const kind = raw.kind === undefined ? "analytic" : raw.kind;

  if (kind === "background") {
    if (
      !isNonEmptyString(raw.answerMode) ||
      !BACKGROUND_ANSWER_MODES.includes(raw.answerMode as BackgroundAnswerMode)
    ) {
      return { ok: false, error: "Survey contains an invalid question." };
    }
    const answerMode = raw.answerMode as BackgroundAnswerMode;

    if (raw.dimensionId !== undefined) {
      return {
        ok: false,
        error: "A background question cannot carry a wellbeing dimension.",
      };
    }

    let options: SurveyQuestionOption[] | undefined;
    if (answerMode === "single-choice") {
      const parsedOptions = parseOptions(raw.options);
      if (!parsedOptions.ok) return parsedOptions;
      options = parsedOptions.value;
    } else if (raw.options !== undefined) {
      const parsedOptions = parseOptions(raw.options);
      if (!parsedOptions.ok) return parsedOptions;
      options = parsedOptions.value;
    }

    if (
      answerMode === "allocation-100" &&
      !isNonEmptyString(raw.allocationGroupId)
    ) {
      return {
        ok: false,
        error: "An allocation question must name the grid it belongs to.",
      };
    }
    if (
      answerMode !== "allocation-100" &&
      raw.allocationGroupId !== undefined
    ) {
      return {
        ok: false,
        error: "Only an allocation question may name a grid.",
      };
    }

    return {
      ok: true,
      value: {
        ...common,
        kind: "background",
        answerMode,
        ...(options ? { options } : {}),
        ...(answerMode === "allocation-100"
          ? { allocationGroupId: raw.allocationGroupId as string }
          : {}),
      },
    };
  }

  if (kind !== "analytic") {
    return { ok: false, error: "Survey contains an invalid question." };
  }

  if (
    !isNonEmptyString(raw.dimensionId) ||
    !validDimensionIds.has(raw.dimensionId)
  ) {
    return { ok: false, error: "Survey contains an invalid question." };
  }

  const scaleId = raw.scaleId === undefined ? "wellbeing-colour" : raw.scaleId;
  if (!isAnswerScaleId(scaleId)) {
    return { ok: false, error: "Survey contains an invalid question." };
  }

  const polarity = raw.polarity === undefined ? "positive" : raw.polarity;
  if (polarity !== "positive" && polarity !== "negative") {
    return { ok: false, error: "Survey contains an invalid question." };
  }

  if (raw.options !== undefined || raw.allocationGroupId !== undefined) {
    return {
      ok: false,
      error: "An analytic question is answered on a scale, not from options.",
    };
  }

  return {
    ok: true,
    value: {
      ...common,
      kind: "analytic",
      dimensionId: raw.dimensionId as AnalyticSurveyQuestion["dimensionId"],
      scaleId,
      polarity,
    },
  };
}

/**
 * A grid's rows must be present together and must be answerable to 100.
 *
 * A group of one is refused rather than tolerated: a single row that has to
 * total 100 is not a grid, it is a question with exactly one possible answer,
 * and it almost certainly means the other rows were dropped.
 */
function validateAllocationGroups(
  questions: SurveyDefinitionQuestion[],
): string | undefined {
  const sizes = new Map<string, number>();

  for (const question of questions) {
    if (question.kind !== "background") continue;
    if (question.answerMode !== "allocation-100") continue;
    const groupId = question.allocationGroupId!;
    sizes.set(groupId, (sizes.get(groupId) ?? 0) + 1);
  }

  for (const [groupId, size] of sizes) {
    if (size < 2) {
      return `Allocation grid '${groupId}' needs at least two rows to total 100.`;
    }
  }

  return undefined;
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
    instrumentId,
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

  // Absent is the ordinary case and means "unknown provenance". Present but
  // unusable is refused rather than dropped: only the server writes this field,
  // so a number or an empty string here is a bug upstream, and a parser that
  // quietly discarded it would leave the round claiming a provenance it never
  // had. The cap is there because the column is opaque JSON with no width.
  let parsedInstrumentId: string | undefined;
  if (instrumentId !== undefined) {
    if (!isNonEmptyString(instrumentId) || instrumentId.trim().length > 200) {
      return { ok: false, error: "Survey instrument id is invalid." };
    }
    parsedInstrumentId = instrumentId.trim();
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
      typeof question.required !== "boolean" ||
      typeof question.enabled !== "boolean"
    ) {
      return { ok: false, error: "Survey contains an invalid question." };
    }

    if (seenQuestionIds.has(question.id)) {
      return { ok: false, error: "Survey question IDs must be unique." };
    }
    seenQuestionIds.add(question.id);

    if (question.sectionId !== undefined && !isNonEmptyString(question.sectionId)) {
      return { ok: false, error: "Survey contains an invalid question." };
    }
    const sectionId = isNonEmptyString(question.sectionId)
      ? question.sectionId
      : undefined;

    const parsed = parseQuestionKind(question, {
      id: question.id,
      text: question.text,
      required: question.required,
      enabled: question.enabled,
      sectionId,
    }, validDimensionIds);
    if (!parsed.ok) return parsed;

    parsedQuestions.push(parsed.value);
  }

  const allocationError = validateAllocationGroups(parsedQuestions);
  if (allocationError) {
    return { ok: false, error: allocationError };
  }

  if (!options?.allowIncomplete) {
    const enabledDimensionIds = new Set(
      parsedQuestions
        .filter((question) => question.enabled)
        .filter(isAnalyticQuestion)
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
      // This function rebuilds from a whitelist rather than spreading its
      // input, so a field it does not name is dropped — which is why
      // provenance had to be added here to survive a single database read,
      // not only to be written.
      ...(parsedInstrumentId === undefined
        ? {}
        : { instrumentId: parsedInstrumentId }),
    },
  };
}

/**
 * Provenance is carried, never edited.
 *
 * The builder posts a questionnaire it rebuilt from its own draft state — a
 * title, six fields and a question list — so anything the browser does not know
 * about is absent from every save. Reading the stamp back off the stored
 * definition, rather than off the request, is what keeps a manager's first edit
 * from erasing the record of what the round started from. It also means a
 * forged `instrumentId` in the request body has no effect: what a round was
 * built from is a fact about the past, and the browser is not a witness to it.
 */
export function carryInstrumentProvenance(
  current: SurveyDefinition,
  next: SurveyDefinition,
): SurveyDefinition {
  return current.instrumentId === undefined
    ? { ...next, instrumentId: undefined }
    : { ...next, instrumentId: current.instrumentId };
}

export function hasSameQuestionSnapshot(
  current: SurveyDefinition,
  next: SurveyDefinition,
): boolean {
  if (current.questions.length !== next.questions.length) return false;

  return current.questions.every((question, index) => {
    const candidate = next.questions[index];
    if (candidate === undefined) return false;

    if (
      question.id !== candidate.id ||
      question.text !== candidate.text ||
      question.required !== candidate.required ||
      question.enabled !== candidate.enabled ||
      question.kind !== candidate.kind ||
      question.sectionId !== candidate.sectionId
    ) {
      return false;
    }

    // Compared per kind rather than field by field: how an answer is given is
    // part of what the question asks, and a question that changed from a
    // five-point scale to a seven-point one is not the same question even
    // though its text is unchanged.
    if (question.kind === "analytic" && candidate.kind === "analytic") {
      return (
        question.dimensionId === candidate.dimensionId &&
        question.scaleId === candidate.scaleId &&
        question.polarity === candidate.polarity
      );
    }

    if (question.kind === "background" && candidate.kind === "background") {
      return (
        question.answerMode === candidate.answerMode &&
        question.allocationGroupId === candidate.allocationGroupId &&
        JSON.stringify(question.options ?? null) ===
          JSON.stringify(candidate.options ?? null)
      );
    }

    return false;
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
      .filter(isAnalyticQuestion)
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
    // Borrowed from the canonical factory for its wording and its estimate, but
    // not for its identity: a manager who starts from a blank page has taken
    // nothing from the instrument, and a stamp here would put its name on a
    // questionnaire it contributed no question to.
    instrumentId: undefined,
  };
}

/**
 * The canonical questionnaire's questions, as a round would persist them.
 *
 * The one construction of the default, and it is exported for that reason
 * rather than for convenience. There used to be three — this factory, the
 * builder's own `loadDefaultTemplate`, and `canonicalExpectedQuestions` in
 * `services/survey.service.ts` — each independently re-typing `scaleId` and
 * `polarity` next to the same `surveyInstrument.questions.map`. Three copies of
 * a default are three answers to "what does this product ask", and nothing in
 * the type system or the tests would have noticed them drifting apart: the
 * builder's copy is what a manager loads, the service's copy is what a
 * submission is checked against, and this one is what a new round is born with.
 *
 * `surveyInstrument` carries no scale and no polarity — see
 * `shalomut-source.ts` — so somebody has to supply them, and this is where.
 * When the instrument type grows those fields, this is the only place that has
 * to stop inventing them.
 */
export function canonicalSurveyQuestions(): AnalyticSurveyQuestion[] {
  return surveyInstrument.questions.map((question) => ({
    id: question.id,
    text: question.text,
    required: question.required,
    enabled: true,
    kind: "analytic" as const,
    dimensionId: question.dimensionId,
    scaleId: "wellbeing-colour" as const,
    polarity: "positive" as const,
  }));
}

export function createCanonicalSurveyDefinition(
  title: string,
  minimumResponses: number,
): SurveyDefinition {
  const questions: SurveyDefinitionQuestion[] = canonicalSurveyQuestions();

  return {
    title,
    audience: "כלל צוות ההוראה",
    estimatedMinutes: estimateMinutesForQuestionnaire(questions),
    minimumResponses,
    introText:
      "השאלון נשלח כקישור אנונימי לצוות. התוצאות מוצגות רק ברמה מצרפית אחרי הגעה לסף פרטיות.",
    anonymityText:
      "לא נאספים שם, כתובת מייל או פרטים מזהים. רק הנהלת בית הספר רואה תמונת מצב מצרפית.",
    questions,
    // The one place a round can honestly claim a provenance, because this is
    // the one place a questionnaire is actually built from the instrument.
    // `surveyInstrument.id` has been declared since the source file was written
    // and had no reader anywhere in the repository until this line.
    instrumentId: surveyInstrument.id,
  };
}
