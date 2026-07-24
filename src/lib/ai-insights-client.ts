import {
  type StoneMapResult,
  validateStoneMapResult,
} from './ai-contract';

export type AiInsightsLoadResult =
  | { status: 'ready'; value: StoneMapResult }
  | { status: 'locked'; value: StoneMapResult }
  | { status: 'not-found' }
  | { status: 'error'; error: string };

export async function loadAiInsights(
  roundId: string,
  fetcher: typeof fetch = fetch,
): Promise<AiInsightsLoadResult> {
  try {
    const response = await fetcher(
      `/api/rounds/${encodeURIComponent(roundId)}/ai-insights`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    );

    if (response.status === 404) {
      return { status: 'not-found' };
    }

    if (!response.ok) {
      return {
        status: 'error',
        error: `AI insights request failed with HTTP ${response.status}.`,
      };
    }

    const payload: unknown = await response.json();
    const validation = validateStoneMapResult(payload, roundId);
    if (!validation.ok) {
      return { status: 'error', error: validation.error };
    }

    if (validation.value.isLocked) {
      return { status: 'locked', value: validation.value };
    }

    if (
      validation.value.status !== 'success' ||
      !validation.value.stones
    ) {
      return {
        status: 'error',
        error: validation.value.errorMessage || 'AI analysis failed.',
      };
    }

    return { status: 'ready', value: validation.value };
  } catch (error) {
    return {
      status: 'error',
      error:
        error instanceof Error
          ? error.message
          : 'Unable to load AI insights.',
    };
  }
}
