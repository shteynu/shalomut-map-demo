import { createHash } from "node:crypto";
import {
  isAnalyticQuestion,
  type AnalyticSurveyQuestion,
  type SurveyDefinitionHash,
  type SurveyDefinitionQuestion,
} from "@/lib/types/backend";

type SurveyDefinitionHashProjection = {
  questionId: string;
  dimensionId: AnalyticSurveyQuestion["dimensionId"];
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

/**
 * Identity of the exact question snapshot the AI is shown.
 *
 * Background questions are excluded rather than projected with an empty
 * dimension. The contract defines this projection as the AI-visible snapshot,
 * and a demographic question is never sent — including it would change the
 * hash of a round whose analysed questions did not move, which is the one
 * thing this value exists to detect. Every definition written before
 * background questions existed is analytic throughout, so no persisted hash
 * changes.
 */
export function createSurveyDefinitionHash(
  questions: readonly SurveyDefinitionQuestion[],
): SurveyDefinitionHash {
  const projection: SurveyDefinitionHashProjection[] = questions
    .filter((question) => question.enabled)
    .filter(isAnalyticQuestion)
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
