import { createSharedSecretHeaders } from '@/lib/server/shared-secret';

export interface TriggerAiResult {
  ok: boolean;
  status: 'accepted' | 'upstream_error' | 'timeout' | 'unavailable';
  upstreamStatus?: number;
  serviceResponse?: unknown;
  error?: string;
}

export async function triggerAiAnalyticsForRound(
  roundId: string,
): Promise<TriggerAiResult> {
  const aiServiceUrl =
    process.env.AI_SERVICE_URL || 'http://localhost:8000/api/v1/webhook/events';
  const timeoutMs = Number(process.env.AI_SERVICE_TIMEOUT_MS) || 30_000;

  const webhookPayload = {
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
        upstreamStatus: response.status,
        serviceResponse,
      };
    }

    return {
      ok: true,
      status: 'accepted',
      serviceResponse,
    };
  } catch (error: any) {
    if (error?.name === 'TimeoutError') {
      return {
        ok: false,
        status: 'timeout',
        error: `AI analytics service did not answer within ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      status: 'unavailable',
      error: `AI analytics service unavailable: ${error.message}`,
    };
  }
}
