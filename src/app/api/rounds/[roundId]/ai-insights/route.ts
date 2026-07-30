import { NextResponse } from 'next/server';
import {
  AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
  AI_ANALYTICS_V4_CONTRACT_VERSION,
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  isValidScoreDistribution,
  type StoneMapResult,
  validateStoneMapResult,
} from '@/lib/ai-contract';
import { getRepositories } from '@/lib/repositories';
import { AnalyticsService } from '@/lib/services/analytics.service';
import {
  createCanonicalSurveyDefinition,
  parseSurveyDefinition,
} from '@/lib/survey-definition';
import { createSurveyDefinitionHash } from '@/lib/survey-definition-hash';
import { isValidLeaseToken } from '@/lib/server/ai-analysis-worker';
import {
  recordAiJobCompleted,
  recordContractValidation,
  recordValidMapSample,
} from '@/lib/server/ai-operational-metrics';
import { getDurableWriteGuardResponse } from '@/lib/server/durable-write-guard';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';
import { authorizeManagerRound } from '@/lib/server/manager-scope';
import type {
  RoundAnalyticsV3Result,
  SurveyRound,
} from '@/lib/types/backend';

interface RouteParams {
  params: Promise<{
    roundId: string;
  }>;
}

function callbackContractVersion(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const value = (payload as { contractVersion?: unknown }).contractVersion;
  return typeof value === 'string' ? value : undefined;
}

function validateDynamicResultAgainstRound(
  result: StoneMapResult,
  round: SurveyRound,
  analytics: RoundAnalyticsV3Result,
): string | null {
  if (
    ![
      AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
      AI_ANALYTICS_V4_CONTRACT_VERSION,
      AI_ANALYTICS_V5_CONTRACT_VERSION,
    ].includes(result.contractVersion)
  ) {
    return null;
  }

  const parsedDefinition = parseSurveyDefinition(
    round.surveyDefinition ??
      createCanonicalSurveyDefinition(round.title, round.privacyThreshold),
  );
  if (!parsedDefinition.ok) {
    return 'The persisted round questionnaire is invalid.';
  }

  const enabledQuestions = parsedDefinition.value.questions.filter(
    (question) => question.enabled,
  );
  const expectedHash = createSurveyDefinitionHash(enabledQuestions);
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
      if (result.contractVersion === AI_ANALYTICS_V5_CONTRACT_VERSION) {
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

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { roundId } = await params;
    const repositories = getRepositories();
    const authorization = await authorizeManagerRound(
      request,
      roundId,
      repositories.orgRepo,
      repositories.roundRepo,
    );
    if (!authorization.ok) return authorization.response;

    const run = await repositories.aiAnalysisRunRepo.findLatestByRoundId(roundId);
    if (run?.result) {
      return NextResponse.json(run.result);
    }
    if (run) {
      return NextResponse.json(
        {
          error: 'AI insights not found for this round',
          roundId,
          run: {
            id: run.id,
            state: run.state,
            attemptCount: run.attemptCount,
            queuedAt: run.queuedAt.toISOString(),
            startedAt: run.startedAt?.toISOString() ?? null,
            completedAt: run.completedAt?.toISOString() ?? null,
            failureCode: run.failureCode ?? null,
          },
        },
        { status: 404 }
      );
    }

    // Dual-read during rollout: a result written before AiAnalysisRun existed
    // remains available from the legacy round column.
    const insights = await repositories.roundRepo.getAiInsights(roundId);
    if (!insights) {
      return NextResponse.json(
        {
          error: 'AI insights not found for this round',
          roundId,
          run: null,
        },
        { status: 404 },
      );
    }

    return NextResponse.json(insights);
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to fetch AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!hasConfiguredSharedSecret(request, 'AI_CALLBACK_SECRET')) {
      return NextResponse.json(
        { error: 'Unauthorized callback' },
        { status: 401 },
      );
    }

    const unavailable = getDurableWriteGuardResponse();
    if (unavailable) return unavailable;

    const { roundId } = await params;
    const callbackUrl = new URL(request.url);
    const headerRunId = request.headers.get('x-ai-analysis-run-id');
    const headerLeaseToken = request.headers.get('x-ai-analysis-lease-token');
    const queryRunId = callbackUrl.searchParams.get('runId');
    const queryLeaseToken = callbackUrl.searchParams.get('leaseToken');
    if (
      (headerRunId && queryRunId && headerRunId !== queryRunId) ||
      (headerLeaseToken &&
        queryLeaseToken &&
        headerLeaseToken !== queryLeaseToken)
    ) {
      return NextResponse.json(
        { error: 'Conflicting durable callback identity' },
        { status: 400 },
      );
    }
    // Headers are the current transport. Query parameters remain accepted
    // only for rollback compatibility with a worker deployed during rollout.
    const runId = headerRunId ?? queryRunId;
    const leaseToken = headerLeaseToken ?? queryLeaseToken;
    const hasRunIdentity = runId !== null || leaseToken !== null;
    if (
      hasRunIdentity &&
      (!runId || !leaseToken || !isValidLeaseToken(leaseToken))
    ) {
      return NextResponse.json(
        { error: 'A durable callback requires a valid runId and leaseToken' },
        { status: 400 },
      );
    }

    const payload: unknown = await request.json();
    const repositories = getRepositories();

    // Resolve the route and durable-run identity before validation can mark a
    // run failed. Otherwise a callback sent to the wrong round could mutate a
    // valid leased run merely by carrying an invalid payload.
    const round = await repositories.roundRepo.findById(roundId);
    if (!round) {
      return NextResponse.json(
        { error: 'Survey round not found', roundId },
        { status: 404 },
      );
    }

    if (runId && leaseToken) {
      const run = await repositories.aiAnalysisRunRepo.findById(runId);
      if (!run) {
        return NextResponse.json(
          { error: 'Analysis run not found', runId },
          { status: 404 },
        );
      }
      if (run.roundId !== roundId) {
        return NextResponse.json(
          { error: 'Analysis run does not belong to this round', runId, roundId },
          { status: 409 },
        );
      }
    }

    const validation = validateStoneMapResult(payload, roundId);
    const contractVersion = callbackContractVersion(payload);

    async function failDurableRun(failureCode: string) {
      if (!runId || !leaseToken) return;
      const outcome = await repositories.aiAnalysisRunRepo.finish(runId, {
        state: 'failed',
        failureCode,
        leaseToken,
        callbackReceivedAt: new Date(),
      });
      if (outcome === 'transitioned') {
        const completed = await repositories.aiAnalysisRunRepo.findById(runId);
        if (completed) recordAiJobCompleted(completed);
      }
    }

    if (!validation.ok) {
      await failDurableRun('contract_validation_failed');
      recordContractValidation({
        contractVersion,
        error: validation.error,
        roundId,
        runId: runId ?? undefined,
      });
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const isDynamicVersion = [
      AI_ANALYTICS_DYNAMIC_CONTRACT_VERSION,
      AI_ANALYTICS_V4_CONTRACT_VERSION,
      AI_ANALYTICS_V5_CONTRACT_VERSION,
    ].includes(validation.value.contractVersion);

    const dynamicRoundError = isDynamicVersion
      ? validateDynamicResultAgainstRound(
          validation.value,
          round,
          AnalyticsService.calculateDynamicRoundAnalytics(
            round,
            await repositories.surveyRepo.findResponsesByRoundId(roundId),
          ),
        )
      : null;
    if (dynamicRoundError) {
      await failDurableRun('round_validation_failed');
      recordContractValidation({
        contractVersion: validation.value.contractVersion,
        error: dynamicRoundError,
        roundId,
        runId: runId ?? undefined,
      });
      return NextResponse.json(
        { error: dynamicRoundError },
        { status: 400 },
      );
    }

    let completionOutcome: 'transitioned' | 'duplicate' | undefined;
    if (runId && leaseToken) {
      const succeeded =
        validation.value.status === 'success' ||
        validation.value.status === 'locked_error';
      const failureCode =
        'failureReason' in validation.value &&
        typeof validation.value.failureReason === 'string'
          ? validation.value.failureReason
          : 'analysis_validation_failed';
      const result = structuredClone(validation.value) as unknown as Record<
        string,
        unknown
      >;
      const outcome = await repositories.aiAnalysisRunRepo.finish(
        runId,
        succeeded
          ? {
              state: 'succeeded',
              leaseToken,
              result,
              callbackReceivedAt: new Date(),
            }
          : {
              state: 'failed',
              leaseToken,
              result,
              failureCode,
              callbackReceivedAt: new Date(),
            },
      );
      if (outcome === 'not_found') {
        return NextResponse.json(
          { error: 'Analysis run not found', runId },
          { status: 404 },
        );
      }
      if (outcome === 'stale') {
        return NextResponse.json(
          { error: 'The analysis callback lease is stale or superseded', runId },
          { status: 409 },
        );
      }
      completionOutcome = outcome;
      if (outcome === 'transitioned') {
        const completed = await repositories.aiAnalysisRunRepo.findById(runId);
        if (completed) recordAiJobCompleted(completed);
      }
    }

    if (!runId || completionOutcome === 'transitioned') {
      recordValidMapSample({
        contractVersion: validation.value.contractVersion,
        roundId,
        runId: runId ?? undefined,
      });
    }

    // Dual-write during rollout keeps the legacy reader/rollback path viable.
    const saved = await repositories.roundRepo.saveAiInsights(
      roundId,
      validation.value,
    );
    if (!saved) {
      return NextResponse.json(
        { error: 'Survey round not found', roundId },
        { status: 404 },
      );
    }

    return NextResponse.json({
      status: 'success',
      message: `AI insights successfully persisted for round ${roundId}`,
      roundId,
      saved,
      duplicate: completionOutcome === 'duplicate',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Failed to save AI insights: ${error.message}` },
      { status: 500 }
    );
  }
}
