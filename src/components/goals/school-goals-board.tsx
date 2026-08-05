"use client";

import Link from "next/link";
import { Archive, CheckCircle2, Loader2, Target } from "lucide-react";
import { useState } from "react";
import { dashboardDimensionRecommendationsRoute } from "@/lib/navigation";
import { updateRoundGoalStatus } from "@/lib/round-goals-client";
import type { SchoolGoalRow, SchoolGoalsView } from "@/lib/goals/school-goals";
import { ROUND_GOAL_STATUSES, type RoundGoalStatus } from "@/lib/types/round-goal";

const STATUS_LABELS: Record<RoundGoalStatus, string> = {
  selected: "נבחר",
  in_progress: "בתהליך",
  done: "הושלם",
};

function GoalRow({
  row,
  isPending,
  onSelect,
}: {
  row: SchoolGoalRow;
  isPending: boolean;
  onSelect: (status: RoundGoalStatus) => void;
}) {
  return (
    <li className="school-goal-row">
      <div className="school-goal-text">
        <h3>{row.title}</h3>
        <p className="quiet-note">{row.body}</p>
        <p className="school-goal-origin">
          {/* Back to the recommendations of the round this goal came from,
              not of whichever round the manager last looked at. */}
          <Link
            href={dashboardDimensionRecommendationsRoute(
              row.dimensionId,
              row.roundId,
            )}
          >
            {row.dimensionLabel}
          </Link>
          <span aria-hidden="true">·</span>
          <span>{row.roundTitle}</span>
          {row.roundStatus === "archived" ? (
            <span className="school-goal-archived">
              <Archive size={14} aria-hidden="true" />
              בארכיון
            </span>
          ) : null}
        </p>
      </div>

      <div
        className="dashboard-goal-status"
        role="group"
        aria-label={`מצב היעד ${row.title}`}
      >
        {ROUND_GOAL_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            className={`dashboard-goal-status-option${row.status === status ? " is-current" : ""}`}
            aria-pressed={row.status === status}
            disabled={isPending}
            onClick={() => {
              if (row.status !== status) onSelect(status);
            }}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </li>
  );
}

/**
 * Every goal the school is tracking, in one place, whichever round it came from.
 *
 * A goal has always belonged to the round it was chosen in, and that round's
 * recommendations screen was the only place to read it. An archived round now
 * sits behind a disclosure and refuses every other write — but not this one, on
 * purpose: finishing what a measurement started is the school's work, not part
 * of the measurement. That exception needs somewhere to happen.
 *
 * The status is written through the same per-round endpoint the dimension
 * screen uses, so there is one write path for a goal's state and no second
 * story about what a status change means.
 */
export function SchoolGoalsBoard({ view }: { view: SchoolGoalsView }) {
  const [rows, setRows] = useState(view);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(row: SchoolGoalRow, status: RoundGoalStatus) {
    setPendingId(row.id);
    setError(null);

    const result = await updateRoundGoalStatus(row.roundId, row.id, status);
    if (result.status === "error") {
      setError(result.error);
      setPendingId(null);
      return;
    }

    // Re-grouped rather than patched in place: a goal that just became `הושלם`
    // belongs under the finished heading, and the screen would otherwise claim
    // the school is still working on it.
    setRows((current) => {
      const all = [...current.open, ...current.done].map((entry) =>
        entry.id === row.id ? { ...entry, status: result.goal.status } : entry,
      );
      return {
        open: all.filter((entry) => entry.status !== "done"),
        done: all.filter((entry) => entry.status === "done"),
      };
    });
    setPendingId(null);
  }

  if (rows.open.length === 0 && rows.done.length === 0) {
    return (
      <section className="school-goals-empty">
        <Target size={20} aria-hidden="true" />
        <p>
          עדיין לא נבחרו יעדים. יעד נבחר מתוך ההמלצות של מדד במפה, ומשם הוא יופיע
          כאן — גם אחרי שהסבב שממנו נבחר עבר לארכיון.
        </p>
      </section>
    );
  }

  return (
    <section className="school-goals" aria-label="יעדים של בית הספר">
      {error ? (
        <p className="dashboard-goals-error" role="alert">
          {error}
        </p>
      ) : null}

      <h2>
        <Target size={20} aria-hidden="true" />
        בעבודה ({rows.open.length})
      </h2>
      {rows.open.length === 0 ? (
        <p className="quiet-note">אין כרגע יעד פתוח. כל מה שנבחר הושלם.</p>
      ) : (
        <ul className="school-goal-list">
          {rows.open.map((row) => (
            <GoalRow
              key={row.id}
              row={row}
              isPending={pendingId === row.id}
              onSelect={(status) => setStatus(row, status)}
            />
          ))}
        </ul>
      )}

      {rows.done.length > 0 ? (
        <>
          <h2>
            <CheckCircle2 size={20} aria-hidden="true" />
            הושלמו ({rows.done.length})
          </h2>
          <ul className="school-goal-list is-done">
            {rows.done.map((row) => (
              <GoalRow
                key={row.id}
                row={row}
                isPending={pendingId === row.id}
                onSelect={(status) => setStatus(row, status)}
              />
            ))}
          </ul>
        </>
      ) : null}

      {pendingId ? (
        <p className="quiet-note" role="status">
          <Loader2 size={14} aria-hidden="true" className="animate-spin" />
          שומרים…
        </p>
      ) : null}
    </section>
  );
}
