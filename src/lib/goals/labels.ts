/**
 * The words a goal's controls are labelled with.
 *
 * They live here rather than in the panel that renders them because a second
 * reader arrived: the manager guide explains what pressing one of them does,
 * and it can only name the control by quoting its label. A copy of the label in
 * the guide would be free to drift from the button — and the drift would be
 * silent, since nothing renders the two side by side. Numbers in the guide are
 * derived from the module that enforces them for the same reason; a label is
 * the same problem with words.
 *
 * Only actions the guide has to name belong here. A label no other module
 * quotes is better off next to the markup that shows it.
 */
export const goalActionLabels = {
  /** Deletes the goal. There is no fourth status and no archive — ADR-015. */
  remove: "הסרה מהיעדים",
} as const;
