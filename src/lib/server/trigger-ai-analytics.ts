import { createSharedSecretHeaders } from '@/lib/server/shared-secret';
import type {
  IRoundRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { effectivePrivacyThreshold } from '@/lib/survey-definition';

export interface AiWebhookPayload {
  event: 'round_closed';
  roundId: string;
  timestamp: string;
}

export interface TriggerAiResult {
  ok: boolean;
  status: 'accepted' | 'upstream_error' | 'timeout' | 'unavailable';
  webhookPayload: AiWebhookPayload;
  upstreamStatus?: number;
  serviceResponse?: unknown;
  error?: string;
}

/**
 * How long a dispatch claim is held. A failed webhook blocks retries for this
 * window instead of forever, and a manager double-click cannot fan out into two
 * provider runs.
 */
export const AI_RUN_CLAIM_LEASE_MS = 120_000;

/**
 * How long a dispatched run may stay silent before the screens call it lost.
 *
 * Deliberately much longer than the dispatch lease, which only guards against a
 * second webhook: one round is roughly thirty provider calls with their own
 * retries, so a run that is merely slow must not be reported as a failure. Past
 * this window nothing is coming — the service died before it could report even
 * a failure — and saying so beats an empty screen that claims the analysis was
 * never requested.
 */
export const AI_RUN_EXPECTED_COMPLETION_MS = 15 * 60_000;

export async function triggerAiAnalyticsForRound(
  roundId: string,
): Promise<TriggerAiResult> {
  const aiServiceUrl =
    process.env.AI_SERVICE_URL || 'http://localhost:8000/api/v1/webhook/events';
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS) || 30_000;

  const webhookPayload: AiWebhookPayload = {
    event: 'round_closed',
    roundId,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(aiServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...createSharedSecretHeaders('AI_WEBHOOK_SECRET'),
      },
      body: JSON.stringify(webhookPayload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const serviceResponse = await response
      .json()
      .catch(() => ({ status: response.ok ? 'accepted' : 'error' }));

    if (!response.ok) {
      return {
        ok: false,
        status: 'upstream_error',
        webhookPayload,
        upstreamStatus: response.status,
        serviceResponse,
      };
    }

    return {
      ok: true,
      status: 'accepted',
      webhookPayload,
      serviceResponse,
    };
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return {
        ok: false,
        status: 'timeout',
        webhookPayload,
        error: `AI analytics service did not answer within ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      status: 'unavailable',
      webhookPayload,
      error: `AI analytics service unavailable: ${error.message}`,
    };
  }
}

export type AutoDispatchOutcome =
  | 'below_threshold'
  | 'already_generated'
  | 'claim_not_acquired'
  | TriggerAiResult['status'];

/**
 * Automatic path used after a respondent submission. It dispatches at most one
 * analytics run per round: below the privacy threshold nothing happens, an
 * already persisted result is never regenerated automatically (managers rerun
 * it explicitly), and the repository claim collapses concurrent submissions.
 */
export async function dispatchAiAnalyticsAfterResponse(
  roundId: string,
  storedPrivacyThreshold: number,
  roundRepo: IRoundRepository,
  surveyRepo: ISurveyRepository,
): Promise<AutoDispatchOutcome> {
  const responseCount = await surveyRepo.getResponseCount(roundId);
  if (responseCount < effectivePrivacyThreshold(storedPrivacyThreshold)) {
    return 'below_threshold';
  }

  if (await roundRepo.getAiInsights(roundId)) {
    return 'already_generated';
  }

  const claimed = await roundRepo.claimAiAnalysisRun(roundId, {
    leaseMs: AI_RUN_CLAIM_LEASE_MS,
    requireNoInsights: true,
  });
  if (!claimed) {
    return 'claim_not_acquired';
  }

  const result = await triggerAiAnalyticsForRound(roundId);
  if (!result.ok) {
    await roundRepo.releaseAiAnalysisClaim(roundId);
  }
  return result.status;
}
