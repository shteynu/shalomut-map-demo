import { validateStoneMapResult } from './ai-contract';
import { toDashboardInsights } from './ai-insights-view-model';
import type { DashboardInsightsDto } from './dashboard/dashboard-insights';

/**
 * The wire contract stops here. Everything upstream of this module speaks
 * `StoneMapResult`; everything downstream — the hook, the screens — holds the
 * presentation DTO and cannot read a payload field by name.
 */
/**
 * What is happening to the map the manager is looking at.
 *
 * Present only when the newest run has not produced the map on screen — that
 * is, when a re-analysis is queued, running, or has failed. A map with no
 * `refresh` is the current one and nothing is replacing it.
 *
 * This exists because the map now survives a re-analysis. Without the note the
 * screen would be honest about the data and silent about the work: a manager
 * who pressed "rewrite this dimension" would see the old map, no spinner, and
 * no way to tell whether anything had happened.
 */
export type AiInsightsRefreshState =
  | { state: 'running' }
  | { state: 'failed'; failureCode: string | null };

export type AiInsightsLoadResult =
  | {
      status: 'ready';
      value: DashboardInsightsDto;
      refresh?: AiInsightsRefreshState;
    }
  | {
      status: 'locked';
      value: DashboardInsightsDto;
      refresh?: AiInsightsRefreshState;
    }
  | { status: 'not-found' }
  | { status: 'running' }
  | { status: 'error'; error: string };

interface AiInsightsRunState {
  run?: {
    state?: unknown;
    failureCode?: unknown;
  };
}

/**
 * The run beside a map that was read successfully. A `succeeded` run is the one
 * that produced this map, so it qualifies nothing and is reported as absent.
 */
function refreshStateOf(
  run: AiInsightsRunState['run'],
): AiInsightsRefreshState | undefined {
  if (run?.state === 'queued' || run?.state === 'running') {
    return { state: 'running' };
  }

  if (run?.state === 'failed') {
    return {
      state: 'failed',
      failureCode: typeof run.failureCode === 'string' ? run.failureCode : null,
    };
  }

  return undefined;
}

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
      // The persisted lifecycle distinguishes queued/running work from a
      // terminal failure and from a round that was never queued.
      const body = (await response
        .json()
        .catch(() => null)) as AiInsightsRunState | null;

      if (
        body?.run?.state === 'queued' ||
        body?.run?.state === 'running'
      ) {
        return { status: 'running' };
      }

      if (
        body?.run?.state === 'failed' ||
        body?.run?.state === 'succeeded'
      ) {
        return {
          status: 'error',
          error:
            'The AI analytics run finished without a readable result.',
        };
      }

      return { status: 'not-found' };
    }

    if (!response.ok) {
      return {
        status: 'error',
        error: `AI insights request failed with HTTP ${response.status}.`,
      };
    }

    // The envelope: `result` is the contract payload and the only thing
    // validated as one, `run` is Core's account of the newest run.
    const envelope = (await response.json()) as {
      result?: unknown;
    } & AiInsightsRunState;
    const validation = validateStoneMapResult(envelope?.result, roundId);
    if (!validation.ok) {
      return { status: 'error', error: validation.error };
    }

    const refresh = refreshStateOf(envelope?.run);

    if (validation.value.isLocked) {
      return {
        status: 'locked',
        value: toDashboardInsights(validation.value),
        refresh,
      };
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

    return {
      status: 'ready',
      value: toDashboardInsights(validation.value),
      refresh,
    };
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
