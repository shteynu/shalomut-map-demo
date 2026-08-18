import type { RoundGoalStatus } from "@/lib/types/round-goal";

/**
 * The words a goal's controls and groups are labelled with.
 *
 * They live here rather than in the components that render them because more
 * than one module needs the same words, and nothing puts those modules on one
 * screen where a disagreement would be visible. The status labels were written
 * out twice — identically, which is the state a duplicate is in right up until
 * someone edits one of them. The remove label was written out twice as well,
 * once as the button and once inside the manager guide explaining what pressing
 * it does.
 *
 * Only labels a second module has to name belong here. A label nothing else
 * quotes is better off next to the markup that shows it.
 */

/**
 * The three states a goal moves through, in the order they happen. The labels
 * are the whole vocabulary of this feature: there is no owner, no due date and
 * no plan of steps, because a school that has never tracked a goal should not
 * have to fill a form to try one.
 */
export const goalStatusLabels: Record<RoundGoalStatus, string> = {
  selected: "נבחר",
  in_progress: "בתהליך",
  done: "הושלם",
};

/**
 * The two groups the school's goals screen sorts into.
 *
 * `open` is every goal that is not finished, so it holds `selected` alongside
 * `in_progress` — it is not the `in_progress` status under another name, and a
 * goal labelled `נבחר` sitting under `בעבודה` is that grouping showing through
 * rather than a mislabelled row. The wording is left as it was found; if it is
 * ever changed to match the empty state below it, which calls the same goals
 * `פתוח`, this is the one place to change.
 */
export const goalGroupLabels = {
  open: "בעבודה",
  done: "הושלמו",
} as const;

export const goalActionLabels = {
  /** Deletes the goal. There is no fourth status and no archive — ADR-015. */
  remove: "הסרה מהיעדים",
} as const;
