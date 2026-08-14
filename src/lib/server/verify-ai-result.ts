import { isValidScoreDistribution, type StoneMapResult } from '@/lib/ai-contract';
import { getCapabilities } from '@/lib/contract-registry';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';
import { createSurveyDefinitionHash } from '@/lib/survey-definition-hash';
import {
  isAnalyticQuestion,
  type RoundAnalyticsV3Result,
  type SurveyRound,
} from '@/lib/types/backend';

/**
 * Core's own opinion about a Stone Map the AI service sent back: schema
 * validation says the result is well formed, this says it describes the round
 * we actually persisted. Every number here is one Core owns and recomputes, so
 * a result that drifted from the questionnaire snapshot, the privacy state or
 * the aggregates is refused instead of stored.
 *
 * Returns the refusal in English for the operator log, or `null` when the
 * result matches. Contract versions without dynamic questions have nothing to
 * compare and pass through.
 */
export function verifyAiResultAgainstRound(
  result: StoneMapResult,
  round: SurveyRound,
  analytics: RoundAnalyticsV3Result,
): string | null {
  const capabilities = getCapabilities(result.contractVersion);
  if (!capabilities.supportsDynamicQuestions) {
    return null;
  }

  const parsedDefinition = parseSurveyDefinition(
    round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold),
  );
  if (!parsedDefinition.ok) {
    return 'The persisted round questionnaire is invalid.';
  }

  // The hash is over the whole definition and excludes background questions
  // itself; the metric check below compares only the analytic ones, which are
  // the only questions an AI result may carry.
  const enabledQuestions = parsedDefinition.value.questions
    .filter((question) => question.enabled)
    .filter(isAnalyticQuestion);
  const expectedHash = createSurveyDefinitionHash(parsedDefinition.value.questions);
  if (
    result.surveyDefinitionHash !== expectedHash ||
    result.surveyDefinitionHash !== analytics.surveyDefinitionHash
  ) {
    return 'The AI result questionnaire snapshot does not match the persisted round.';
  }

  if (result.isLocked !== analytics.isLocked) {
    return 'The AI result privacy state does not match the Core analytics.';
  }

  if (analytics.isLocked) {
    return result.status === 'locked_error'
      ? null
      : 'A privacy-locked round must persist a locked result without details.';
  }

  if (result.status !== 'success' || !result.stones) {
    return null;
  }

  const expectedQuestions = new Map(
    enabledQuestions.map((question) => [question.id, question]),
  );
  const seenQuestionIds = new Set<string>();

  for (const [dimensionId, stone] of Object.entries(result.stones)) {
    const expectedDimension =
      analytics.dimensionScores[
        dimensionId as keyof typeof analytics.dimensionScores
      ];
    if (
      !expectedDimension ||
      stone.score !== expectedDimension.averageScore ||
      stone.status !== expectedDimension.computedStatus
    ) {
      return 'The AI result scores or statuses do not match the Core analytics.';
    }

    for (const metric of stone.metrics) {
      const questionId = metric.questionId;
      const expected = questionId
        ? expectedQuestions.get(questionId)
        : undefined;
      const expectedAggregate = questionId
        ? analytics.questionAggregates[questionId]
        : undefined;
      if (
        !expected ||
        !expectedAggregate ||
        expected.dimensionId !== dimensionId ||
        metric.label !== expected.text ||
        metric.averageScore !== expectedAggregate.averageScore ||
        metric.responseCount !== expectedAggregate.responseCount ||
        seenQuestionIds.has(expected.id)
      ) {
        return 'The AI result metrics do not match the persisted round questionnaire.';
      }

      // On 5.0 the distribution is a number Core owns as much as the average,
      // and it travelled to the AI service and back. Checking it against the
      // recomputed analytics is what keeps that ownership real.
      if (capabilities.supportsScoreDistribution) {
        const expectedDistribution = expectedAggregate.scoreDistribution;
        if (!expectedDistribution) {
          return 'The Core analytics carry no distribution to verify the AI result against.';
        }
        const distribution = metric.scoreDistribution;
        if (
          !isValidScoreDistribution(distribution, metric.responseCount) ||
          distribution.green !== expectedDistribution.green ||
          distribution.yellow !== expectedDistribution.yellow ||
          distribution.red !== expectedDistribution.red
        ) {
          return 'The AI result distributions do not match the Core analytics.';
        }
      }
      seenQuestionIds.add(expected.id);
    }
  }

  if (seenQuestionIds.size !== expectedQuestions.size) {
    return 'The AI result does not cover every persisted round question.';
  }

  return null;
}
