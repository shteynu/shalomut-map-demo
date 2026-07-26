import { createHash } from "node:crypto";
import type {
  SurveyDefinitionHash,
  SurveyDefinitionQuestion,
} from "@/lib/types/backend";

type SurveyDefinitionHashProjection = {
  questionId: string;
  dimensionId: SurveyDefinitionQuestion["dimensionId"];
  questionText: string;
};

function compareUnicodeCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);

  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) {
      return leftPoints[index] - rightPoints[index];
    }
  }

  return leftPoints.length - rightPoints.length;
}

export function createSurveyDefinitionHash(
  questions: Pick<
    SurveyDefinitionQuestion,
    "id" | "dimensionId" | "text" | "enabled"
  >[],
): SurveyDefinitionHash {
  const projection: SurveyDefinitionHashProjection[] = questions
    .filter((question) => question.enabled)
    .map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      questionText: question.text,
    }))
    .sort((left, right) =>
      compareUnicodeCodePoints(left.questionId, right.questionId),
    );
  const serialized = JSON.stringify(projection);

  return `sha256:${createHash("sha256").update(serialized, "utf8").digest("hex")}`;
}
