"use client";

import {
  BREAKDOWN_QUESTION_PARAM,
  DASHBOARD_ROUND_PARAM,
  routes,
} from "@/lib/navigation";
import type { BreakdownQuestionChoice } from "@/lib/analytics/background-breakdown";

/**
 * Which background question the results are grouped by.
 *
 * Built like `RoundSwitcher`, and for the same reasons: it is a navigation, the
 * choice belongs in the URL so a manager can return to it, and it works with
 * scripting off. The round travels as a hidden field rather than being read off
 * the current URL, because submitting this form replaces the query string
 * entirely — without it, choosing a question would silently move the manager
 * back to the school's current round.
 */
export function BreakdownQuestionPicker({
  choices,
  selectedQuestionId,
  roundId,
}: {
  choices: readonly BreakdownQuestionChoice[];
  selectedQuestionId: string | undefined;
  roundId: string;
}) {
  if (choices.length < 2) return null;

  return (
    <form className="breakdown-picker" method="get" action={`${routes.breakdown}/`}>
      <input type="hidden" name={DASHBOARD_ROUND_PARAM} value={roundId} />
      <label htmlFor="breakdown-question-select">פילוח לפי</label>
      <select
        id="breakdown-question-select"
        name={BREAKDOWN_QUESTION_PARAM}
        value={selectedQuestionId ?? ""}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        {choices.map((choice) => (
          <option key={choice.questionId} value={choice.questionId}>
            {choice.questionText}
          </option>
        ))}
      </select>

      <noscript>
        <button className="secondary-button" type="submit">
          הצגה
        </button>
      </noscript>
    </form>
  );
}
