"use client";

import { BookMarked, Flag, History, Loader2, Target, Trash2 } from "lucide-react";
import { buildGoalRows, type GoalRow } from "@/lib/dashboard/goal-rows";
import type { DashboardRecommendation } from "@/lib/dashboard/dashboard-insights";
import { goalActionLabels, goalStatusLabels } from "@/lib/goals/labels";
import { useRoundGoals } from "@/lib/hooks/use-round-goals";
import { ROUND_GOAL_STATUSES, type RoundGoalStatus } from "@/lib/types/round-goal";

function GoalStatusControl({
  row,
  isPending,
  onSelect,
}: {
  row: GoalRow & { goal: NonNullable<GoalRow["goal"]> };
  isPending: boolean;
  onSelect: (status: RoundGoalStatus) => void;
}) {
  return (
    <div
      className="dashboard-goal-status"
      role="group"
      aria-label={`מצב היעד ${row.title}`}
    >
      {ROUND_GOAL_STATUSES.map((status) => {
        const isCurrent = row.goal.status === status;
        return (
          <button
            key={status}
            type="button"
            className={`dashboard-goal-status-option${isCurrent ? " is-current" : ""}`}
            aria-pressed={isCurrent}
            disabled={isPending}
            onClick={() => {
              if (!isCurrent) onSelect(status);
            }}
          >
            {goalStatusLabels[status]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * What the school decided to work on, under the recommendations it decided from.
 *
 * The stage above is the picture; this is the decision. A tracked goal keeps
 * the recommendation's words as they read when it was chosen, so it stays here
 * after the next analysis rewrites its advice — and says so when the current
 * analysis no longer recommends it.
 */
export function DashboardGoalsPanel({
  roundId,
  dimensionId,
  dimensionLabel,
  recommendations,
}: {
  roundId: string;
  dimensionId: string;
  dimensionLabel: string;
  recommendations: DashboardRecommendation[];
}) {
  const { state, pendingKey, actionError, track, setStatus, remove } =
    useRoundGoals(roundId);

  return (
    <section
      className="dashboard-goals-panel"
      aria-label={`יעדים לעבודה ב${dimensionLabel}`}
    >
      <div className="dashboard-goals-heading">
        <h2>
          <Target size={20} aria-hidden="true" />
          מה בחרנו לעבוד עליו
        </h2>
        <p className="quiet-note">
          יעד שנבחר נשמר לסבב הזה עם הנוסח שהיה על המסך ברגע הבחירה, ולכן הוא
          נשאר גם אחרי ניתוח חדש.
        </p>
      </div>

      {state.status === "loading" ? (
        <p className="quiet-note dashboard-goals-note" role="status">
          <Loader2 size={16} aria-hidden="true" className="animate-spin" />
          טוענים את היעדים…
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="dashboard-goals-error" role="alert">
          {state.error}
        </p>
      ) : null}

      {state.status === "ready" ? (
        <>
          {actionError ? (
            <p className="dashboard-goals-error" role="alert">
              {actionError}
            </p>
          ) : null}

          <ul className="dashboard-goal-list">
            {buildGoalRows(recommendations, state.goals, dimensionId).map(
              (row) => {
                const isPending = pendingKey === (row.goal?.id ?? row.title);

                return (
                  <li
                    key={row.key}
                    className={`dashboard-goal-row${row.goal ? " is-tracked" : ""}`}
                  >
                    <div className="dashboard-goal-text">
                      <h3>{row.title}</h3>
                      {row.source ? (
                        // The one place the manager can check whether the
                        // advice came from somewhere. The blobs above carry the
                        // same recommendations, but their text is auto-fitted
                        // to the shape and a citation inside one would shrink
                        // the advice to make room for its footnote.
                        <p className="quiet-note dashboard-goal-provenance">
                          <BookMarked size={14} aria-hidden="true" />
                          מבוסס על: {row.source}
                        </p>
                      ) : null}
                      {row.fromEarlierAnalysis ? (
                        <p className="quiet-note dashboard-goal-provenance">
                          <History size={14} aria-hidden="true" />
                          נבחר מתוך ניתוח קודם. הניתוח הנוכחי אינו ממליץ על כך
                          יותר, והיעד נשאר כפי שנבחר.
                        </p>
                      ) : null}
                    </div>

                    {row.goal ? (
                      <div className="dashboard-goal-actions">
                        <GoalStatusControl
                          row={row as GoalRow & { goal: NonNullable<GoalRow["goal"]> }}
                          isPending={isPending}
                          onSelect={(status) => void setStatus(row.goal!.id, status)}
                        />
                        <button
                          type="button"
                          className="ghost-button dashboard-goal-remove"
                          disabled={isPending}
                          onClick={() => void remove(row.goal!.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          {goalActionLabels.remove}
                        </button>
                      </div>
                    ) : (
                      <div className="dashboard-goal-actions">
                        <button
                          type="button"
                          className="secondary-button dashboard-goal-track"
                          disabled={isPending}
                          aria-busy={isPending}
                          onClick={() =>
                            void track({
                              dimensionId,
                              title: row.title,
                              body: row.body,
                            })
                          }
                        >
                          {isPending ? (
                            <Loader2
                              size={16}
                              aria-hidden="true"
                              className="animate-spin"
                            />
                          ) : (
                            <Flag size={16} aria-hidden="true" />
                          )}
                          בחירה כיעד
                        </button>
                      </div>
                    )}
                  </li>
                );
              },
            )}
          </ul>
        </>
      ) : null}
    </section>
  );
}
