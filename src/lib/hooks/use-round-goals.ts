"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createRoundGoal,
  loadRoundGoals,
  removeRoundGoal,
  updateRoundGoalStatus,
  type RoundGoalView,
} from "@/lib/round-goals-client";
import type { RoundGoalStatus } from "@/lib/types/round-goal";

export type RoundGoalsUiState =
  | { status: "loading" }
  | { status: "ready"; goals: RoundGoalView[] }
  | { status: "error"; error: string };

function replaceGoal(goals: RoundGoalView[], goal: RoundGoalView) {
  const existing = goals.findIndex((entry) => entry.id === goal.id);
  if (existing === -1) return [...goals, goal];

  const next = [...goals];
  next[existing] = goal;
  return next;
}

/**
 * The goals of one round, with the three writes the screen needs.
 *
 * A failed write leaves the list as the server last described it and reports
 * the failure separately: a goal that looks tracked but was never saved is the
 * one outcome this screen must never produce.
 */
export function useRoundGoals(roundId: string) {
  const [state, setState] = useState<RoundGoalsUiState>({ status: "loading" });
  /** The row currently waiting on the server, so only it shows a busy state. */
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void loadRoundGoals(roundId).then((result) => {
      if (active) setState(result);
    });

    return () => {
      active = false;
    };
  }, [roundId]);

  const withPending = useCallback(
    async <T,>(key: string, run: () => Promise<T>): Promise<T> => {
      setPendingKey(key);
      setActionError(null);
      try {
        return await run();
      } finally {
        setPendingKey(null);
      }
    },
    [],
  );

  const track = useCallback(
    (input: { dimensionId: string; title: string; body: string }) =>
      withPending(input.title, async () => {
        const result = await createRoundGoal(roundId, input);
        if (result.status === "error") {
          setActionError(result.error);
          return;
        }

        // 'created' and 'duplicate' both end with the goal that exists on the
        // server, which is what the list must show.
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", goals: replaceGoal(current.goals, result.goal) }
            : current,
        );
      }),
    [roundId, withPending],
  );

  const setStatus = useCallback(
    (goalId: string, status: RoundGoalStatus) =>
      withPending(goalId, async () => {
        const result = await updateRoundGoalStatus(roundId, goalId, status);
        if (result.status === "error") {
          setActionError(result.error);
          return;
        }

        setState((current) =>
          current.status === "ready"
            ? { status: "ready", goals: replaceGoal(current.goals, result.goal) }
            : current,
        );
      }),
    [roundId, withPending],
  );

  const remove = useCallback(
    (goalId: string) =>
      withPending(goalId, async () => {
        const result = await removeRoundGoal(roundId, goalId);
        if (result.status === "error") {
          setActionError(result.error);
          return;
        }

        setState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                goals: current.goals.filter((goal) => goal.id !== goalId),
              }
            : current,
        );
      }),
    [roundId, withPending],
  );

  return { state, pendingKey, actionError, track, setStatus, remove };
}
