import {
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";
import { MINIMUM_PRIVACY_THRESHOLD } from "@/lib/survey-definition";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";

export type BuilderQuestion = SurveyDefinitionQuestion & {
  draftKey: string;
};

export type BuilderQuestionnaireValidation = {
  isValid: boolean;
  isSaveable: boolean;
  duplicateQuestionIds: string[];
  missingDimensionIds: WellbeingDimensionId[];
  invalidDraftKeys: string[];
  messages: string[];
  activationMessages: string[];
};

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
  const enabledDimensionIds = new Set(
    questions
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

  if (invalidDraftKeys.length > 0) {
    structuralMessages.push("יש למלא מזהה קבוע ללא רווחים בתחילתו או בסופו ונוסח מלא לכל שאלה בשאלון.");
  }

  if (duplicateQuestionIds.length > 0) {
    structuralMessages.push(
      `לכל שאלה חייב להיות מזהה קבוע וייחודי. המזהים הכפולים: ${duplicateQuestionIds.join(", ")}.`,
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
    messages: [...structuralMessages, ...activationMessages],
    activationMessages,
  };
}

export function toSurveyDefinitionQuestion(
  question: BuilderQuestion,
): SurveyDefinitionQuestion {
  return {
    id: question.id,
    text: question.text,
    dimensionId: question.dimensionId,
    required: question.required,
    enabled: question.enabled,
    answerMode: question.answerMode,
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
