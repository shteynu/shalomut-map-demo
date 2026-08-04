import type { RoundGoalStatus } from './types/round-goal';

/**
 * The screen's view of a goal. It is the wire shape with the timestamps left as
 * strings: nothing on the dashboard does date arithmetic with them.
 */
export interface RoundGoalView {
  id: string;
  roundId: string;
  dimensionId: string;
  title: string;
  body: string;
  status: RoundGoalStatus;
  createdAt: string;
  updatedAt: string;
}

export type RoundGoalsResult =
  | { status: 'ready'; goals: RoundGoalView[] }
  | { status: 'error'; error: string };

export type CreateGoalResult =
  | { status: 'created'; goal: RoundGoalView }
  /** The goal already existed — a second tap, not a failure to report. */
  | { status: 'duplicate'; goal: RoundGoalView }
  | { status: 'error'; error: string };

export type MutateGoalResult =
  | { status: 'ok'; goal: RoundGoalView }
  | { status: 'error'; error: string };

export type RemoveGoalResult =
  | { status: 'ok' }
  | { status: 'error'; error: string };

const GENERIC_FAILURE = 'לא הצלחנו לעדכן את היעדים. אפשר לנסות שוב.';

function goalsPath(roundId: string) {
  return `/api/rounds/${encodeURIComponent(roundId)}/goals`;
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
  } | null;
  return typeof body?.error === 'string' ? body.error : GENERIC_FAILURE;
}

export async function loadRoundGoals(
  roundId: string,
  fetcher: typeof fetch = fetch,
): Promise<RoundGoalsResult> {
  try {
    const response = await fetcher(goalsPath(roundId), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return { status: 'error', error: await readError(response) };
    }

    const body = (await response.json()) as { goals?: RoundGoalView[] };
    return { status: 'ready', goals: body.goals ?? [] };
  } catch {
    return { status: 'error', error: GENERIC_FAILURE };
  }
}

export async function createRoundGoal(
  roundId: string,
  input: { dimensionId: string; title: string; body: string },
  fetcher: typeof fetch = fetch,
): Promise<CreateGoalResult> {
  try {
    const response = await fetcher(goalsPath(roundId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(input),
    });

    const body = (await response.json().catch(() => null)) as {
      goal?: RoundGoalView;
      error?: string;
    } | null;

    // A duplicate arrives with the goal that already exists, so the screen
    // reconciles to the truth instead of reporting a failure the manager did
    // not cause.
    if (response.status === 409 && body?.goal) {
      return { status: 'duplicate', goal: body.goal };
    }
    if (!response.ok || !body?.goal) {
      return { status: 'error', error: body?.error ?? GENERIC_FAILURE };
    }

    return { status: 'created', goal: body.goal };
  } catch {
    return { status: 'error', error: GENERIC_FAILURE };
  }
}

export async function updateRoundGoalStatus(
  roundId: string,
  goalId: string,
  status: RoundGoalStatus,
  fetcher: typeof fetch = fetch,
): Promise<MutateGoalResult> {
  try {
    const response = await fetcher(
      `${goalsPath(roundId)}/${encodeURIComponent(goalId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ status }),
      },
    );

    const body = (await response.json().catch(() => null)) as {
      goal?: RoundGoalView;
      error?: string;
    } | null;
    if (!response.ok || !body?.goal) {
      return { status: 'error', error: body?.error ?? GENERIC_FAILURE };
    }

    return { status: 'ok', goal: body.goal };
  } catch {
    return { status: 'error', error: GENERIC_FAILURE };
  }
}

export async function removeRoundGoal(
  roundId: string,
  goalId: string,
  fetcher: typeof fetch = fetch,
): Promise<RemoveGoalResult> {
  try {
    const response = await fetcher(
      `${goalsPath(roundId)}/${encodeURIComponent(goalId)}`,
      { method: 'DELETE', headers: { Accept: 'application/json' } },
    );
    if (!response.ok) {
      return { status: 'error', error: await readError(response) };
    }

    return { status: 'ok' };
  } catch {
    return { status: 'error', error: GENERIC_FAILURE };
  }
}
