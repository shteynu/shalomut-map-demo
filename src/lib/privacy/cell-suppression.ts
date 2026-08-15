/**
 * Cell suppression for demographic cross-tabulation.
 *
 * `privacyThreshold` protects a round's totals: a round with fewer respondents
 * than the threshold reports nothing, and a question answered by fewer than the
 * threshold locks the whole detailed result (ADR-004, ADR-005). That rule says
 * nothing about a *cell*. "Teachers aged 51–60 who teach in the special-needs
 * track" can be a single person inside a round of eighty, and a table that
 * prints `1` there identifies them regardless of how healthy the round total is.
 *
 * So a cross-tab needs its own rule, and one that survives arithmetic. Blanking
 * the small cells is not enough: a reader who can see a row's other cells and
 * that row's total recovers the blanked one by subtraction. Suppression has to
 * be closed under the equations the table itself publishes.
 *
 * ## The invariant
 *
 * A published line of the table is each row of cells with its total, each column
 * of cells with its total, the vector of row totals against the grand total, and
 * the vector of column totals against the grand total. Every one of them
 * satisfies two rules at once, and it takes both:
 *
 * 1. **No line has exactly one suppressed entry.** One blank is not hidden; it
 *    is stated as "the total minus everything else".
 * 2. **The blanks on a line together account for nothing at all, or for at least
 *    `threshold` people.** Two blanks reveal their sum, and a sum is a real
 *    group: the union of the categories that were blanked. A line that hides
 *    two cells of one and zero has published the fact that some group of the
 *    staff room has exactly one member in it.
 *
 * Rule 1 alone permits that last table, which is why rule 2 exists. Rule 2 alone
 * would permit a lone blank of forty, which is determined by subtraction —
 * harmless as a number, but it would make the shape of the table depend on
 * whether the blank happened to be large, and rule 1 keeps that uniform.
 *
 * ## Why rule 2 is what carries across tables
 *
 * A round has more than one background question, and `/breakdown` publishes a
 * table for each of them over the same people. Nothing in one table's algebra
 * knows about another's, so the guarantee has to be one that composes without
 * coordination — and rule 2 is that guarantee, because it is a statement about
 * *every group a reader can point at*, not about this table's cells.
 *
 * Take the residual of a table: everyone not inside a published category. Its
 * size is the grand total minus the published ones, so a reader always has it,
 * and `/breakdown` publishes each group's dimension averages beside its size, so
 * a reader has the residual's scores by subtraction too. Under rule 2 the
 * residual is either empty or at least `threshold` people. Read two tables and
 * the two residuals are both groups of at least `threshold`; their intersection
 * is bounded by inclusion–exclusion but never determined, and no number
 * published by either table describes it.
 *
 * So the claim the product may make is: **no number a reader can compute from
 * these tables describes a group smaller than the threshold.** That holds for
 * one table and for all of them together.
 *
 * ## What is deliberately not suppressed
 *
 * The grand total. It is the round's response count, which the product already
 * publishes on every manager screen and sends to the AI service, so hiding it
 * inside this one table would be a fiction rather than a protection. It counts
 * as published when a line is checked, and it is never chosen as the extra cell
 * to blank.
 *
 * ## What this module is not
 *
 * It is not differential privacy, and it defends arithmetic rather than
 * knowledge. A principal who already knows that exactly one teacher joined this
 * year reads a suppressed category and learns nothing from this module that they
 * did not bring with them. What it guarantees is that the published numbers
 * themselves never single anyone out.
 */

/** One respondent count at the intersection of two demographic categories. */
export type CrossTabCell = {
  readonly rowId: string;
  readonly columnId: string;
  readonly count: number;
};

export type SuppressionReason =
  /** The count itself is below the threshold. */
  | 'below-threshold'
  /**
   * The count is at or above the threshold and would have been published, but
   * doing so would have let a reader recover a suppressed one by subtraction.
   */
  | 'complementary';

/**
 * A published entry carries its count; a suppressed one carries the reason
 * instead and no count at all. The count is *absent*, not zero and not null —
 * a caller that reads it gets `undefined` from the type, not a number it might
 * accidentally render or sum.
 */
export type SuppressedEntry =
  | { readonly suppressed: false; readonly count: number }
  | { readonly suppressed: true; readonly reason: SuppressionReason };

export type SuppressedCrossTab = {
  readonly rowIds: readonly string[];
  readonly columnIds: readonly string[];
  /** Keyed by row id, then column id. Every combination is present. */
  readonly cells: Readonly<Record<string, Readonly<Record<string, SuppressedEntry>>>>;
  readonly rowTotals: Readonly<Record<string, SuppressedEntry>>;
  readonly columnTotals: Readonly<Record<string, SuppressedEntry>>;
  /** Always published. See the module comment. */
  readonly grandTotal: number;
  /**
   * True when the round is too small for the table to say anything at all. No
   * entry is published, including the totals.
   */
  readonly isFullySuppressed: boolean;
};

/**
 * A frequency table of one demographic question, with the same guarantee: a
 * single suppressed category would be recoverable from the total, so there are
 * never fewer than two.
 */
export type SuppressedFrequency = {
  readonly categories: Readonly<Record<string, SuppressedEntry>>;
  readonly total: number;
  readonly isFullySuppressed: boolean;
};

/**
 * The internal working shape: one mutable entry per publishable number, with
 * the equations that relate them expressed as lines over entry keys.
 */
type WorkingEntry = {
  readonly key: string;
  readonly count: number;
  /** Never chosen as a complementary suppression, and never counted as hidden. */
  readonly alwaysPublished: boolean;
  suppressed: boolean;
  reason?: SuppressionReason;
};

/**
 * One published equation. Every member of a line is derivable from the others,
 * which is why a line with exactly one hidden member hides nothing. A line is
 * the full set — the addends and the sum together — because the sum is as
 * recoverable from the addends as an addend is from the sum.
 */
type Line = readonly string[];

/**
 * A key that two different id pairs cannot collide on. The separator is NUL
 * because an id may contain any printable character, including whichever one
 * would otherwise look safe to use here. It is written as an escape rather
 * than a raw byte so that this file stays text: Git reads a literal NUL as
 * binary and stops producing a diff, a blame or a resolvable conflict for it.
 */
function cellKey(rowId: string, columnId: string): string {
  return `cell:${rowId}\u0000${columnId}`;
}
const rowTotalKey = (rowId: string) => `row:${rowId}`;
const columnTotalKey = (columnId: string) => `column:${columnId}`;
const GRAND_TOTAL_KEY = 'grand';

/**
 * Blank every member of every line until both rules of the invariant hold on
 * every line: no line has exactly one blank, and the blanks on a line account
 * for nothing or for at least `threshold` people.
 *
 * Each pass suppresses at least one more entry and nothing is ever unsuppressed,
 * so with a finite number of entries this terminates. The extra entry chosen is
 * the smallest published one in the line: the smallest count is both the closest
 * to the threshold and the least informative to lose. Ties break on the key, so
 * the same table always suppresses the same cells — a table that changed shape
 * between two renders of the same data would itself be a leak.
 */
function closeUnderSubtraction(
  entries: Map<string, WorkingEntry>,
  lines: readonly Line[],
  threshold: number,
): void {
  let changed = true;

  while (changed) {
    changed = false;

    for (const line of lines) {
      const members = line
        .map((key) => entries.get(key))
        .filter((entry): entry is WorkingEntry => entry !== undefined);

      const hidden = members.filter((entry) => entry.suppressed);
      if (hidden.length === 0) continue;

      const hiddenTotal = hidden.reduce((sum, entry) => sum + entry.count, 0);
      if (hidden.length >= 2 && hiddenTotal >= threshold) continue;

      const candidates = members
        .filter((entry) => !entry.suppressed && !entry.alwaysPublished)
        .sort((a, b) => a.count - b.count || a.key.localeCompare(b.key));

      // A line whose only other members must stay published cannot be closed.
      // The one case that reaches here is a line of a single cell against a
      // total that is always published, and the loop below leaves it as it is
      // rather than pretending the leak is gone.
      const victim = candidates[0];
      if (!victim) continue;

      victim.suppressed = true;
      victim.reason = 'complementary';
      changed = true;
    }
  }
}

function readEntry(entries: Map<string, WorkingEntry>, key: string): SuppressedEntry {
  const entry = entries.get(key)!;
  return entry.suppressed
    ? { suppressed: true, reason: entry.reason ?? 'below-threshold' }
    : { suppressed: false, count: entry.count };
}

function hiddenEntry(reason: SuppressionReason): SuppressedEntry {
  return { suppressed: true, reason };
}

/**
 * Suppress a demographic cross-tabulation so that no cell below `threshold` is
 * published and none is recoverable from what is.
 *
 * Missing combinations count as zero, and a zero cell is below any positive
 * threshold, so an empty intersection is suppressed like any other small one.
 * Publishing "no one" is publishing something about everyone else.
 */
export function suppressCrossTab(
  cells: readonly CrossTabCell[],
  threshold: number,
): SuppressedCrossTab {
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error(
      `A privacy threshold must be a positive integer; received ${threshold}.`,
    );
  }

  const rowIds = [...new Set(cells.map((cell) => cell.rowId))].sort();
  const columnIds = [...new Set(cells.map((cell) => cell.columnId))].sort();

  const counts = new Map<string, number>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.count) || cell.count < 0) {
      throw new Error(
        `A cross-tab count must be a non-negative integer; received ` +
          `${cell.count} at ${cell.rowId}/${cell.columnId}.`,
      );
    }
    const key = cellKey(cell.rowId, cell.columnId);
    counts.set(key, (counts.get(key) ?? 0) + cell.count);
  }

  const grandTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);

  // Below the threshold the round says nothing at all, so neither does the
  // table. Returning a suppressed shape rather than throwing keeps a small
  // round renderable: the screen shows "not enough responses", not an error.
  if (grandTotal < threshold || rowIds.length === 0 || columnIds.length === 0) {
    const blank = hiddenEntry('below-threshold');
    return {
      rowIds,
      columnIds,
      cells: Object.fromEntries(
        rowIds.map((rowId) => [
          rowId,
          Object.fromEntries(columnIds.map((columnId) => [columnId, blank])),
        ]),
      ),
      rowTotals: Object.fromEntries(rowIds.map((rowId) => [rowId, blank])),
      columnTotals: Object.fromEntries(
        columnIds.map((columnId) => [columnId, blank]),
      ),
      grandTotal,
      isFullySuppressed: true,
    };
  }

  const entries = new Map<string, WorkingEntry>();
  const add = (key: string, count: number, alwaysPublished = false) => {
    entries.set(key, {
      key,
      count,
      alwaysPublished,
      suppressed: count < threshold && !alwaysPublished,
      reason: count < threshold && !alwaysPublished ? 'below-threshold' : undefined,
    });
  };

  for (const rowId of rowIds) {
    for (const columnId of columnIds) {
      add(cellKey(rowId, columnId), counts.get(cellKey(rowId, columnId)) ?? 0);
    }
  }
  for (const rowId of rowIds) {
    add(
      rowTotalKey(rowId),
      columnIds.reduce(
        (sum, columnId) => sum + (counts.get(cellKey(rowId, columnId)) ?? 0),
        0,
      ),
    );
  }
  for (const columnId of columnIds) {
    add(
      columnTotalKey(columnId),
      rowIds.reduce(
        (sum, rowId) => sum + (counts.get(cellKey(rowId, columnId)) ?? 0),
        0,
      ),
    );
  }
  add(GRAND_TOTAL_KEY, grandTotal, true);

  const lines: Line[] = [
    ...rowIds.map((rowId) => [
      ...columnIds.map((columnId) => cellKey(rowId, columnId)),
      rowTotalKey(rowId),
    ]),
    ...columnIds.map((columnId) => [
      ...rowIds.map((rowId) => cellKey(rowId, columnId)),
      columnTotalKey(columnId),
    ]),
    [...rowIds.map(rowTotalKey), GRAND_TOTAL_KEY],
    [...columnIds.map(columnTotalKey), GRAND_TOTAL_KEY],
  ];

  closeUnderSubtraction(entries, lines, threshold);

  // A table can close to nothing: rule 2 answers a residual of one person by
  // blanking the group it was subtracted from, and with few enough categories
  // that is every one of them. Saying so here rather than leaving it to each
  // caller to notice keeps "this round says nothing" a single fact.
  const publishesNothing = [...entries.values()].every(
    (entry) => entry.suppressed || entry.alwaysPublished,
  );

  return {
    rowIds,
    columnIds,
    cells: Object.fromEntries(
      rowIds.map((rowId) => [
        rowId,
        Object.fromEntries(
          columnIds.map((columnId) => [
            columnId,
            readEntry(entries, cellKey(rowId, columnId)),
          ]),
        ),
      ]),
    ),
    rowTotals: Object.fromEntries(
      rowIds.map((rowId) => [rowId, readEntry(entries, rowTotalKey(rowId))]),
    ),
    columnTotals: Object.fromEntries(
      columnIds.map((columnId) => [
        columnId,
        readEntry(entries, columnTotalKey(columnId)),
      ]),
    ),
    grandTotal,
    isFullySuppressed: publishesNothing,
  };
}

/**
 * Suppress a single demographic breakdown — the counts for one background
 * question, with no second variable crossed against them.
 *
 * The same closure applies, over the one line this table publishes: the
 * categories and their total. Both rules land on that line, and the second is
 * the one that matters here — the blanked categories are exactly the table's
 * residual, so "the blanks account for at least `threshold` people" reads
 * directly as "the people this table does not show are a crowd, not a person".
 * That is the sentence that stays true when a manager opens the next background
 * question of the same round.
 */
export function suppressFrequency(
  counts: Readonly<Record<string, number>>,
  threshold: number,
): SuppressedFrequency {
  const table = suppressCrossTab(
    Object.entries(counts).map(([categoryId, count]) => ({
      rowId: categoryId,
      columnId: 'all',
      count,
    })),
    threshold,
  );

  const categories = table.rowTotals;

  return {
    categories,
    total: table.grandTotal,
    // Read off the categories rather than inherited from the cross-tab. This
    // table is built with one dummy column, whose column total is the grand
    // total and is therefore published even when every category is blank — so
    // the cross-tab's own answer is "something is published" for a table that
    // shows a reader nothing.
    isFullySuppressed:
      table.isFullySuppressed ||
      Object.values(categories).every((entry) => entry.suppressed),
  };
}
