import { createHash } from "node:crypto";
import {
  isAnalyticQuestion,
  type AnalyticSurveyQuestion,
  type MeasurementSnapshotHash,
  type SurveyDefinitionHash,
  type SurveyDefinitionQuestion,
} from "@/lib/types/backend";

type SurveyDefinitionHashProjection = {
  questionId: string;
  dimensionId: AnalyticSurveyQuestion["dimensionId"];
  questionText: string;
};

type MeasurementSnapshotProjection = SurveyDefinitionHashProjection & {
  scaleId: AnalyticSurveyQuestion["scaleId"];
  polarity: AnalyticSurveyQuestion["polarity"];
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
 *
 * **This is deliberately not an answer to "are these two rounds the same
 * questionnaire".** It omits `scaleId` and `polarity` because the AI is shown
 * neither, and widening it would change every round's identity and break a
 * recomputation Python performs from a payload that carries neither field.
 * What a round measured — the same questions plus how they are answered — is
 * `createMeasurementSnapshotHash` below, and cross-round comparison uses that.
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

/**
 * Identity of what a round measured: the same questions, plus how each one is
 * answered.
 *
 * Two rounds can ask word-for-word the same questions and still not be
 * measuring the same thing. `scaleId` decides which values an answer can take
 * and what each is worth — three colours score 100/60/0, a seven-point
 * frequency scale scores 0/17/33/50/67/83/100 — so a delta across a scale
 * change subtracts one instrument's mean from another's. `polarity` decides
 * which end is good, so a question flipped between rounds moves the score in
 * the opposite direction with nothing having happened to the school. Neither
 * field appears in the AI-visible hash, so before this existed a scale change
 * and a polarity flip were both invisible to the one flag that exists to warn
 * the reader.
 *
 * Everything the AI-visible projection covers is covered here too, so this is
 * strictly harder to collide with: it never calls two rounds the same when
 * that one calls them different.
 *
 * `enabled` filters rather than projects, and background questions are left
 * out, for the same reason as above — neither produces a score, so neither can
 * move a delta.
 */
export function createMeasurementSnapshotHash(
  questions: readonly SurveyDefinitionQuestion[],
): MeasurementSnapshotHash {
  const projection: MeasurementSnapshotProjection[] = questions
    .filter((question) => question.enabled)
    .filter(isAnalyticQuestion)
    .map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      questionText: question.text,
      scaleId: question.scaleId,
      polarity: question.polarity,
    }))
    .sort((left, right) =>
      compareUnicodeCodePoints(left.questionId, right.questionId),
    );
  const serialized = JSON.stringify(projection);

  return `sha256:${createHash("sha256").update(serialized, "utf8").digest("hex")}`;
}
