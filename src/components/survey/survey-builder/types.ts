import {
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import type { AnswerPolarity } from "@/lib/survey/answer-scales";
import type {
  AnalyticSurveyQuestion,
  BackgroundAnswerMode,
  BackgroundSurveyQuestion,
  SurveyDefinitionQuestion,
  SurveyQuestionKind,
} from "@/lib/types/backend";

/**
 * The builder edits both kinds of question.
 *
 * This was narrowed to the analytic shape when the union was introduced,
 * because no control could edit the other kind and typing the builder as if one
 * could would have compiled every screen against fields none of them rendered.
 * It is the union now, and the compiler named the screens that had to change —
 * which is what the narrowing was for.
 */
export type BuilderAnalyticQuestion = AnalyticSurveyQuestion & {
  draftKey: string;
};

export type BuilderBackgroundQuestion = BackgroundSurveyQuestion & {
  draftKey: string;
};

export type BuilderQuestion =
  | BuilderAnalyticQuestion
  | BuilderBackgroundQuestion;

export function isBuilderAnalyticQuestion(
  question: BuilderQuestion,
): question is BuilderAnalyticQuestion {
  return question.kind === "analytic";
}

export function isBuilderBackgroundQuestion(
  question: BuilderQuestion,
): question is BuilderBackgroundQuestion {
  return question.kind === "background";
}

/**
 * The filter value for the tab that holds every question belonging to no
 * wellbeing dimension. Not a dimension id, and deliberately not `"all"`: a
 * background question is invisible under every dimension tab, so without a tab
 * of its own the only way to see one would be to clear the filter.
 */
export const BACKGROUND_FILTER_ID = "background";

/** How a manager chooses the kind of question they are writing. */
export const QUESTION_KIND_LABELS: Record<SurveyQuestionKind, string> = {
  analytic: "שאלה נמדדת (משויכת לממד שלומות)",
  background: "שאלת רקע (לא נמדדת)",
};

export const BACKGROUND_ANSWER_MODES: readonly BackgroundAnswerMode[] = [
  "single-choice",
  "number",
  "allocation-100",
];

export const BACKGROUND_ANSWER_MODE_LABELS: Record<BackgroundAnswerMode, string> =
  {
    "single-choice": "בחירה יחידה מתוך רשימה",
    number: "מספר",
    "allocation-100": "חלוקת 100 בין שורות",
  };

/**
 * Polarity in the manager's terms rather than the model's. "negative" is not a
 * judgement about the question; it says a high answer is worse for the
 * dimension, which is the only thing the scoring needs to know.
 *
 * "A high answer" rather than "agreeing": one of the four scales measures
 * frequency, and nobody agrees with how often they feel exhausted.
 *
 * The distinguishing word leads. These sit in a select in a two-column grid
 * inside a modal, which truncates from the end — and the first wording put the
 * whole difference between the two options in the word that got cut.
 */
export const POLARITY_LABELS: Record<AnswerPolarity, string> = {
  positive: "רגיל — מענה גבוה = שלומות גבוהה",
  negative: "הפוך — מענה גבוה = שלומות נמוכה",
};

export type BuilderQuestionnaireValidation = {
  isValid: boolean;
  isSaveable: boolean;
  duplicateQuestionIds: string[];
  missingDimensionIds: WellbeingDimensionId[];
  invalidDraftKeys: string[];
  /** Background questions whose answer type is not yet answerable. */
  incompleteBackgroundDraftKeys: string[];
  messages: string[];
  activationMessages: string[];
};

/**
 * What an allocation grid is: two or more rows a respondent splits 100 between.
 * A grid of one row is a question whose only valid answer is 100, which is not
 * a question, and `parseSurveyDefinition` refuses it — so the builder has to
 * say so while the manager can still fix it rather than at save time.
 */
const MINIMUM_ALLOCATION_ROWS = 2;
const MINIMUM_CHOICE_OPTIONS = 2;

const dimensionLabels = Object.fromEntries(
  surveyInstrument.dimensions.map((dimension) => [
    dimension.id,
    dimension.label,
  ]),
) as Record<WellbeingDimensionId, string>;

export function getBuilderQuestionnaireValidation(
  questions: BuilderQuestion[],
): BuilderQuestionnaireValidation {
  const idCounts = new Map<string, number>();
  const invalidDraftKeys: string[] = [];

  for (const question of questions) {
    const normalizedId = question.id.trim();
    const normalizedText = question.text.trim();

    if (!normalizedId || question.id !== normalizedId || !normalizedText) {
      invalidDraftKeys.push(question.draftKey);
    }

    if (normalizedId) {
      idCounts.set(normalizedId, (idCounts.get(normalizedId) ?? 0) + 1);
    }
  }

  const duplicateQuestionIds = [...idCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([questionId]) => questionId)
    .sort();
  // Coverage is a statement about analysed questions only. Counting background
  // ones here would be counting a question that belongs to no dimension against
  // a rule about all eight of them.
  const enabledDimensionIds = new Set(
    questions
      .filter(isBuilderAnalyticQuestion)
      .filter(
        (question) =>
          question.enabled && question.id.trim() && question.text.trim(),
      )
      .map((question) => question.dimensionId),
  );
  const missingDimensionIds = surveyInstrument.dimensions
    .map((dimension) => dimension.id)
    .filter((dimensionId) => !enabledDimensionIds.has(dimensionId));

  const structuralMessages: string[] = [];
  const activationMessages: string[] = [];

  const backgroundQuestions = questions.filter(isBuilderBackgroundQuestion);
  const incompleteBackgroundDraftKeys: string[] = [];

  // A choice with fewer than two options is a question with one answer, and the
  // respondent screen would render a list nobody can choose from.
  const shortChoiceIds = backgroundQuestions
    .filter(
      (question) =>
        question.answerMode === "single-choice" &&
        (question.options ?? []).filter(
          (option) => option.value.trim() && option.label.trim(),
        ).length < MINIMUM_CHOICE_OPTIONS,
    )
    .map((question) => {
      incompleteBackgroundDraftKeys.push(question.draftKey);
      return question.id.trim() || question.text.trim();
    });

  const allocationSizes = new Map<string, number>();
  for (const question of backgroundQuestions) {
    if (question.answerMode !== "allocation-100") continue;
    const groupId = question.allocationGroupId?.trim() ?? "";
    if (!groupId) {
      incompleteBackgroundDraftKeys.push(question.draftKey);
      continue;
    }
    allocationSizes.set(groupId, (allocationSizes.get(groupId) ?? 0) + 1);
  }
  const shortAllocationGroups = [...allocationSizes.entries()]
    .filter(([, size]) => size < MINIMUM_ALLOCATION_ROWS)
    .map(([groupId]) => groupId)
    .sort();
  for (const question of backgroundQuestions) {
    const groupId = question.allocationGroupId?.trim();
    if (groupId && shortAllocationGroups.includes(groupId)) {
      incompleteBackgroundDraftKeys.push(question.draftKey);
    }
  }

  if (invalidDraftKeys.length > 0) {
    structuralMessages.push("יש למלא מזהה קבוע ללא רווחים בתחילתו או בסופו ונוסח מלא לכל שאלה בשאלון.");
  }

  if (duplicateQuestionIds.length > 0) {
    structuralMessages.push(
      `לכל שאלה חייב להיות מזהה קבוע וייחודי. המזהים הכפולים: ${duplicateQuestionIds.join(", ")}.`,
    );
  }

  if (shortChoiceIds.length > 0) {
    structuralMessages.push(
      `לשאלת רקע מסוג בחירה יחידה נדרשות לפחות שתי אפשרויות תשובה. השאלות החסרות: ${shortChoiceIds.join(", ")}.`,
    );
  }

  if (shortAllocationGroups.length > 0) {
    structuralMessages.push(
      `בטבלת חלוקת 100 נדרשות לפחות שתי שורות. הטבלאות החסרות: ${shortAllocationGroups.join(", ")}.`,
    );
  }

  if (
    backgroundQuestions.some(
      (question) =>
        question.answerMode === "allocation-100" &&
        !question.allocationGroupId?.trim(),
    )
  ) {
    structuralMessages.push(
      "לכל שורה בטבלת חלוקת 100 יש לציין לאיזו טבלה היא שייכת.",
    );
  }

  if (missingDimensionIds.length > 0) {
    activationMessages.push(
      `כדי להפעיל את השאלון יש לכלול לפחות שאלה פעילה אחת בכל שמונת ממדי השלומות (${missingDimensionIds.length}/8 חסרים: ${missingDimensionIds
        .map((dimensionId) => dimensionLabels[dimensionId])
        .join(", ")}).`,
    );
  }

  const isSaveable = structuralMessages.length === 0;
  const isValid = isSaveable && missingDimensionIds.length === 0;

  return {
    isValid,
    isSaveable,
    duplicateQuestionIds,
    missingDimensionIds,
    invalidDraftKeys,
    incompleteBackgroundDraftKeys: [
      ...new Set(incompleteBackgroundDraftKeys),
    ],
    messages: [...structuralMessages, ...activationMessages],
    activationMessages,
  };
}

/**
 * A stored questionnaire as the builder holds it: every question, both kinds,
 * each given the draft key the list is addressed by.
 *
 * One function rather than a `.map` at each of the two sites that need it — the
 * initial state and restoring a saved version — because the thing worth getting
 * wrong is the same at both. It filtered to analytic while no control could
 * edit the other kind, and that filter was a silent deletion waiting for a
 * questionnaire to have a background question: dropped on load, gone on the
 * next save, with nothing on screen having said so. A shorter list is a valid
 * list, so no type could have caught it.
 */
export function toBuilderQuestions(
  questions: readonly SurveyDefinitionQuestion[],
  keyPrefix: (question: SurveyDefinitionQuestion, index: number) => string,
): BuilderQuestion[] {
  return questions.map((question, index) => ({
    ...question,
    draftKey: keyPrefix(question, index),
  }));
}

export function toSurveyDefinitionQuestion(
  question: BuilderQuestion,
): SurveyDefinitionQuestion {
  const common = {
    id: question.id,
    text: question.text,
    required: question.required,
    enabled: question.enabled,
    ...(question.sectionId ? { sectionId: question.sectionId } : {}),
  };

  if (question.kind === "background") {
    return {
      ...common,
      kind: "background",
      answerMode: question.answerMode,
      // Absent, not empty. `parseSurveyDefinition` refuses an empty option list
      // outright, so a `number` question carrying `options: []` would fail to
      // save with a message about options it never had.
      ...(question.options && question.options.length > 0
        ? { options: question.options }
        : {}),
      ...(question.answerMode === "allocation-100" && question.allocationGroupId
        ? { allocationGroupId: question.allocationGroupId }
        : {}),
    };
  }

  return {
    ...common,
    kind: "analytic",
    dimensionId: question.dimensionId,
    scaleId: question.scaleId,
    polarity: question.polarity,
  };
}

export function localizeSurveyDefinitionSaveError(
  error: string | undefined,
  status?: number,
): string {
  const normalized = error?.toLowerCase() ?? "";

  if (/[֐-׿]/u.test(error ?? "") && !/[a-z]/iu.test(error ?? "")) {
    return error!.trim();
  }

  if (normalized.includes("unique") || normalized.includes("duplicate")) {
    return "לא ניתן לשמור: לכל שאלה חייב להיות מזהה קבוע וייחודי.";
  }

  if (
    normalized.includes("cover all eight") ||
    normalized.includes("all eight dimensions")
  ) {
    return "לא ניתן לשמור ולהפעיל את השאלון עד שיש לפחות שאלה פעילה אחת בכל שמונת ממדי השלומות.";
  }

  if (
    status === 409 ||
    normalized.includes("response") ||
    normalized.includes("snapshot") ||
    normalized.includes("immutable")
  ) {
    return "לא ניתן לשנות מזהה, נוסח או ממד של שאלה לאחר שהתקבלה תשובה. יש לפתוח סבב או גרסה חדשה.";
  }

  if (normalized.includes("privacy threshold")) {
    return `סף הפרטיות חייב להיות מספר שלם של ${MINIMUM_PRIVACY_THRESHOLD} משיבים לפחות.`;
  }

  if (normalized.includes("invalid question")) {
    return "אחת השאלות אינה תקינה. בדקו מזהה קבוע, נוסח, ממד ואפשרות תשובה.";
  }

  if (status === 403) {
    return "אין הרשאה לשנות את השאלון בסבב הזה.";
  }

  if (status === 404) {
    return "הסבב המבוקש לא נמצא.";
  }

  if (status === 503) {
    return "שמירת השאלון אינה זמינה כרגע. נסו שוב מאוחר יותר.";
  }

  return "לא ניתן היה לשמור את טיוטת השאלון. בדקו את הפרטים ונסו שוב.";
}
