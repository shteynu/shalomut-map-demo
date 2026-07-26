import {
  surveyInstrument,
  type WellbeingDimensionId,
} from "@/lib/shalomut-source";
import type { SurveyDefinitionQuestion } from "@/lib/types/backend";

export type BuilderQuestion = SurveyDefinitionQuestion & {
  draftKey: string;
};

export type BuilderQuestionnaireValidation = {
  isValid: boolean;
  duplicateQuestionIds: string[];
  missingDimensionIds: WellbeingDimensionId[];
  invalidDraftKeys: string[];
  messages: string[];
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
  const messages: string[] = [];

  if (invalidDraftKeys.length > 0) {
    messages.push("יש למלא מזהה קבוע ללא רווחים בתחילתו או בסופו ונוסח מלא לכל שאלה בשאלון.");
  }

  if (duplicateQuestionIds.length > 0) {
    messages.push(
      `לכל שאלה חייב להיות מזהה קבוע וייחודי. המזהים הכפולים: ${duplicateQuestionIds.join(", ")}.`,
    );
  }

  if (missingDimensionIds.length > 0) {
    messages.push(
      `לפני שמירה והפעלה יש לכלול לפחות שאלה פעילה אחת בכל שמונת ממדי השלומות. חסרים: ${missingDimensionIds
        .map((dimensionId) => dimensionLabels[dimensionId])
        .join(", ")}.`,
    );
  }

  return {
    isValid: messages.length === 0,
    duplicateQuestionIds,
    missingDimensionIds,
    invalidDraftKeys,
    messages,
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
    return "סף הפרטיות חייב להיות מספר שלם של 10 משיבים לפחות.";
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
