import { surveyInstrument } from "@/lib/shalomut-source";
import type {
  SurveyDefinition,
  SurveyDefinitionQuestion,
} from "@/lib/types/backend";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseSurveyDefinition(value: unknown):
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
    minimumResponses < 10
  ) {
    return { ok: false, error: "Privacy threshold must be at least 10." };
  }

  if (!Array.isArray(questions)) {
    return { ok: false, error: "Survey questions are required." };
  }

  const validDimensionIds = new Set(
    surveyInstrument.dimensions.map((dimension) => dimension.id),
  );
  const parsedQuestions: SurveyDefinitionQuestion[] = [];

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

  for (const canonicalQuestion of surveyInstrument.questions) {
    const matches = parsedQuestions.filter(
      (question) => question.id === canonicalQuestion.id,
    );

    if (
      matches.length !== 1 ||
      !matches[0].enabled ||
      !matches[0].required ||
      matches[0].dimensionId !== canonicalQuestion.dimensionId
    ) {
      return {
        ok: false,
        error:
          "The 24 canonical Shalomut questions must remain enabled, required, unique, and assigned to their canonical dimensions.",
      };
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
