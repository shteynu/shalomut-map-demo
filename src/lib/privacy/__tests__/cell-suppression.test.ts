/**
 * The two things cell suppression has to be true about: a small cell is not
 * published, and a small cell is not *recoverable* from what is published.
 *
 * The second is the one that is easy to get wrong and impossible to see by
 * reading a rendered table, so it is tested twice over — once as the structural
 * invariant the algorithm maintains, and once by brute force, by enumerating
 * every table consistent with what a reader can see and checking that more than
 * one of them fits.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  CrossTabCell,
  SuppressedCrossTab,
  SuppressedEntry,
  suppressCrossTab,
  suppressFrequency,
} from '../cell-suppression';

const THRESHOLD = 10;

function grid(rows: Readonly<Record<string, Readonly<Record<string, number>>>>): CrossTabCell[] {
  return Object.entries(rows).flatMap(([rowId, columns]) =>
    Object.entries(columns).map(([columnId, count]) => ({ rowId, columnId, count })),
  );
}

function published(entry: SuppressedEntry): number | undefined {
  return entry.suppressed ? undefined : entry.count;
}

/**
 * Every equation the table publishes, as the entry values a reader can line up
 * against each other. A line is the addends together with their sum, because a
 * sum is as recoverable from its addends as an addend is from the sum.
 */
function lines(table: SuppressedCrossTab): SuppressedEntry[][] {
  return [
    ...table.rowIds.map((rowId) => [
      ...table.columnIds.map((columnId) => table.cells[rowId][columnId]),
      table.rowTotals[rowId],
    ]),
    ...table.columnIds.map((columnId) => [
      ...table.rowIds.map((rowId) => table.cells[rowId][columnId]),
      table.columnTotals[columnId],
    ]),
    [
      ...table.rowIds.map((rowId) => table.rowTotals[rowId]),
      { suppressed: false as const, count: table.grandTotal },
    ],
    [
      ...table.columnIds.map((columnId) => table.columnTotals[columnId]),
      { suppressed: false as const, count: table.grandTotal },
    ],
  ];
}

/** No line may hold exactly one suppressed entry: one blank is not a blank. */
function assertNoLoneSuppression(table: SuppressedCrossTab, label: string): void {
  for (const [index, line] of lines(table).entries()) {
    const hidden = line.filter((entry) => entry.suppressed).length;
    assert.notStrictEqual(
      hidden,
      1,
      `${label}: line ${index} publishes everything but one entry, ` +
        'which states that entry rather than hiding it.',
    );
  }
}

/**
 * The second rule, checked against the truth rather than against the shape:
 * whatever a line blanks out must be nobody at all or at least `THRESHOLD`
 * people.
 *
 * Only a line whose *sum* is published can be checked, and only that line needs
 * checking. Subtraction is what makes the blanked addends into a group a reader
 * can point at — the sum less everything still printed — and with the sum itself
 * blank there is no subtraction to do and no group to protect.
 *
 * The table alone cannot be asked this, because a suppressed entry carries no
 * count; that is the point of suppressing it. So the real values come in
 * separately and are looked up by the same ids the table publishes.
 */
function assertHiddenPartIsNeverASmallGroup(
  table: SuppressedCrossTab,
  truth: (rowId: string, columnId: string) => number,
  label: string,
): void {
  type Valued = readonly [SuppressedEntry, number];
  const rowTotal = (rowId: string) =>
    table.columnIds.reduce((sum, columnId) => sum + truth(rowId, columnId), 0);
  const columnTotal = (columnId: string) =>
    table.rowIds.reduce((sum, rowId) => sum + truth(rowId, columnId), 0);
  const wholeTotal: Valued = [
    { suppressed: false, count: table.grandTotal },
    table.grandTotal,
  ];

  const equations: { addends: Valued[]; sum: Valued; what: string }[] = [
    ...table.rowIds.map((rowId) => ({
      what: `row ${rowId}`,
      addends: table.columnIds.map<Valued>((columnId) => [
        table.cells[rowId][columnId],
        truth(rowId, columnId),
      ]),
      sum: [table.rowTotals[rowId], rowTotal(rowId)] as Valued,
    })),
    ...table.columnIds.map((columnId) => ({
      what: `column ${columnId}`,
      addends: table.rowIds.map<Valued>((rowId) => [
        table.cells[rowId][columnId],
        truth(rowId, columnId),
      ]),
      sum: [table.columnTotals[columnId], columnTotal(columnId)] as Valued,
    })),
    {
      what: 'the row totals',
      addends: table.rowIds.map<Valued>((rowId) => [
        table.rowTotals[rowId],
        rowTotal(rowId),
      ]),
      sum: wholeTotal,
    },
    {
      what: 'the column totals',
      addends: table.columnIds.map<Valued>((columnId) => [
        table.columnTotals[columnId],
        columnTotal(columnId),
      ]),
      sum: wholeTotal,
    },
  ];

  for (const { addends, sum, what } of equations) {
    if (sum[0].suppressed) continue;

    const people = addends
      .filter(([entry]) => entry.suppressed)
      .reduce((total, [, count]) => total + count, 0);
    if (people === 0) continue;

    assert.ok(
      people >= THRESHOLD,
      `${label}: ${what} publishes its total and blanks ${people} people out ` +
        `of it, which states a group smaller than the threshold of ${THRESHOLD}.`,
    );
  }
}

test('a cell below the threshold is not published', () => {
  const table = suppressCrossTab(
    grid({
      young: { primary: 3, secondary: 22, special: 14 },
      middle: { primary: 18, secondary: 25, special: 19 },
      senior: { primary: 16, secondary: 21, special: 17 },
    }),
    THRESHOLD,
  );

  const cell = table.cells.young.primary;
  assert.strictEqual(cell.suppressed, true);
  assert.strictEqual(cell.suppressed && cell.reason, 'below-threshold');
  // The count is absent from the shape, not zeroed — nothing downstream can
  // render it or add it up by mistake.
  assert.strictEqual(published(cell), undefined);
});

test('a cell at the threshold exactly is published', () => {
  const table = suppressCrossTab(
    grid({
      young: { primary: 10, secondary: 20 },
      middle: { primary: 15, secondary: 25 },
    }),
    THRESHOLD,
  );

  assert.strictEqual(published(table.cells.young.primary), 10);
});

test('an empty intersection is suppressed like any other small one', () => {
  // Zero is a statement about everyone else, and it is below any threshold.
  const table = suppressCrossTab(
    grid({
      young: { primary: 0, secondary: 30, special: 20 },
      middle: { primary: 21, secondary: 25, special: 19 },
      senior: { primary: 16, secondary: 24, special: 18 },
    }),
    THRESHOLD,
  );

  assert.strictEqual(table.cells.young.primary.suppressed, true);
});

test('a combination absent from the input is still a cell, and still suppressed', () => {
  const table = suppressCrossTab(
    [
      { rowId: 'young', columnId: 'primary', count: 30 },
      { rowId: 'middle', columnId: 'secondary', count: 25 },
    ],
    THRESHOLD,
  );

  assert.deepStrictEqual([...table.rowIds], ['middle', 'young']);
  assert.deepStrictEqual([...table.columnIds], ['primary', 'secondary']);
  assert.strictEqual(table.cells.young.secondary.suppressed, true);
  assert.strictEqual(table.cells.middle.primary.suppressed, true);
});

test('a lone small cell takes a second, larger cell down with it', () => {
  const table = suppressCrossTab(
    grid({
      young: { primary: 2, secondary: 40, special: 38 },
      middle: { primary: 30, secondary: 25, special: 19 },
      senior: { primary: 26, secondary: 24, special: 18 },
    }),
    THRESHOLD,
  );

  assert.strictEqual(table.cells.young.primary.suppressed, true);

  const alsoHidden = table.columnIds
    .map((columnId) => table.cells.young[columnId])
    .filter((entry) => entry.suppressed);

  assert.ok(
    alsoHidden.length >= 2,
    'a row that publishes its total and all but one cell publishes that cell too',
  );
  assertNoLoneSuppression(table, 'one small cell');
});

test('suppression cannot be undone by combining cells', () => {
  const tables: Array<[string, CrossTabCell[]]> = [
    [
      'one small cell',
      grid({
        young: { primary: 4, secondary: 40, special: 36 },
        middle: { primary: 30, secondary: 25, special: 19 },
        senior: { primary: 26, secondary: 24, special: 18 },
      }),
    ],
    [
      'two small cells in one row',
      grid({
        young: { primary: 4, secondary: 6, special: 60 },
        middle: { primary: 30, secondary: 25, special: 19 },
        senior: { primary: 26, secondary: 24, special: 18 },
      }),
    ],
    [
      'small cells on a diagonal',
      grid({
        young: { primary: 3, secondary: 40, special: 36 },
        middle: { primary: 30, secondary: 5, special: 39 },
        senior: { primary: 26, secondary: 24, special: 18 },
      }),
    ],
    [
      'an entire small row',
      grid({
        young: { primary: 1, secondary: 2, special: 1 },
        middle: { primary: 30, secondary: 25, special: 19 },
        senior: { primary: 26, secondary: 24, special: 18 },
      }),
    ],
    [
      'a two-by-two, where every row is also a column',
      grid({
        young: { primary: 5, secondary: 40 },
        middle: { primary: 30, secondary: 25 },
      }),
    ],
    [
      'a single column',
      grid({
        young: { primary: 4 },
        middle: { primary: 30 },
        senior: { primary: 26 },
      }),
    ],
  ];

  for (const [label, cells] of tables) {
    const table = suppressCrossTab(cells, THRESHOLD);
    assertNoLoneSuppression(table, label);
    assertHiddenPartIsNeverASmallGroup(
      table,
      (rowId, columnId) =>
        cells.find((cell) => cell.rowId === rowId && cell.columnId === columnId)
          ?.count ?? 0,
      label,
    );
  }
});

test('more than one table fits what a reader can actually see', () => {
  // The structural invariant says no line gives a suppressed cell away on its
  // own. This checks the stronger thing directly: enumerate every assignment of
  // the suppressed cells that reproduces every published number, and confirm
  // each suppressed cell could still have been something else.
  const truth = {
    young: { primary: 3, secondary: 40, special: 37 },
    middle: { primary: 30, secondary: 25, special: 19 },
    senior: { primary: 26, secondary: 24, special: 18 },
  } as const;
  const table = suppressCrossTab(grid(truth), THRESHOLD);

  const hiddenCells = table.rowIds.flatMap((rowId) =>
    table.columnIds
      .filter((columnId) => table.cells[rowId][columnId].suppressed)
      .map((columnId) => ({ rowId, columnId })),
  );
  assert.ok(hiddenCells.length >= 2, 'the fixture is meant to hide something');

  // Each published line becomes a constraint over the hidden cells that sit on
  // it: their values must add up to the total, less whatever the line already
  // publishes. Constraints are checked as soon as their last member is assigned
  // and bounded before that, which is what keeps the enumeration finite in
  // practice rather than only in principle.
  type Constraint = { members: number[]; remainder: number };
  const constraints: Constraint[] = [];

  const addConstraint = (
    ids: readonly { rowId: string; columnId: string }[],
    total: number | undefined,
  ) => {
    if (total === undefined) return;
    const members: number[] = [];
    let publishedSum = 0;
    for (const { rowId, columnId } of ids) {
      const index = hiddenCells.findIndex(
        (cell) => cell.rowId === rowId && cell.columnId === columnId,
      );
      if (index === -1) publishedSum += published(table.cells[rowId][columnId]) ?? 0;
      else members.push(index);
    }
    constraints.push({ members, remainder: total - publishedSum });
  };

  for (const rowId of table.rowIds) {
    addConstraint(
      table.columnIds.map((columnId) => ({ rowId, columnId })),
      published(table.rowTotals[rowId]),
    );
  }
  for (const columnId of table.columnIds) {
    addConstraint(
      table.rowIds.map((rowId) => ({ rowId, columnId })),
      published(table.columnTotals[columnId]),
    );
  }
  addConstraint(
    table.rowIds.flatMap((rowId) =>
      table.columnIds.map((columnId) => ({ rowId, columnId })),
    ),
    table.grandTotal,
  );

  // A hidden cell can be no larger than the smallest line it sits on has room
  // for, which is a per-cell bound rather than one bound for the table.
  const ceilings = hiddenCells.map((_, index) =>
    Math.min(
      table.grandTotal,
      ...constraints
        .filter((constraint) => constraint.members.includes(index))
        .map((constraint) => constraint.remainder),
    ),
  );
  const possibilities = hiddenCells.map(() => new Set<number>());

  const walk = (index: number, assigned: number[]) => {
    for (const constraint of constraints) {
      const outstanding = constraint.members.filter((member) => member >= index);
      const sum = constraint.members
        .filter((member) => member < index)
        .reduce((acc, member) => acc + assigned[member], 0);
      if (outstanding.length === 0 ? sum !== constraint.remainder : sum > constraint.remainder) {
        return;
      }
    }

    if (index === hiddenCells.length) {
      assigned.forEach((value, position) => possibilities[position].add(value));
      return;
    }

    for (let value = 0; value <= ceilings[index]; value++) {
      walk(index + 1, [...assigned, value]);
    }
  };

  walk(0, []);

  hiddenCells.forEach(({ rowId, columnId }, position) => {
    const fits = possibilities[position];
    assert.ok(
      fits.has(truth[rowId as keyof typeof truth][columnId as keyof (typeof truth)['young']]),
      `${rowId}/${columnId}: the real value must be among the candidates`,
    );
    assert.ok(
      fits.size >= 2,
      `${rowId}/${columnId}: exactly one value fits the published table, ` +
        `so it is published in all but name (candidates: ${[...fits].join(', ')})`,
    );
  });
});

test('a round below the threshold publishes no cell and no total', () => {
  const table = suppressCrossTab(
    grid({
      young: { primary: 2, secondary: 1 },
      middle: { primary: 3, secondary: 1 },
    }),
    THRESHOLD,
  );

  assert.strictEqual(table.isFullySuppressed, true);
  assert.strictEqual(table.rowTotals.young.suppressed, true);
  assert.strictEqual(table.columnTotals.primary.suppressed, true);
  assert.strictEqual(table.cells.young.primary.suppressed, true);
  // The count itself is the round's response count, which every manager screen
  // already shows. Hiding it here would be a fiction, not a protection.
  assert.strictEqual(table.grandTotal, 7);
});

test('a table with no data at all is fully suppressed rather than an error', () => {
  const table = suppressCrossTab([], THRESHOLD);

  assert.strictEqual(table.isFullySuppressed, true);
  assert.strictEqual(table.grandTotal, 0);
  assert.deepStrictEqual([...table.rowIds], []);
});

test('the same counts always suppress the same cells', () => {
  // A table that hid different cells on two renders of one round would let a
  // reader intersect the two and recover both.
  const cells = grid({
    young: { primary: 4, secondary: 40, special: 36 },
    middle: { primary: 30, secondary: 25, special: 19 },
    senior: { primary: 26, secondary: 24, special: 18 },
  });

  const first = suppressCrossTab(cells, THRESHOLD);
  const second = suppressCrossTab([...cells].reverse(), THRESHOLD);

  assert.deepStrictEqual(second, first);
});

test('a raised threshold never publishes more', () => {
  const cells = grid({
    young: { primary: 12, secondary: 40, special: 36 },
    middle: { primary: 30, secondary: 25, special: 19 },
    senior: { primary: 26, secondary: 24, special: 18 },
  });

  const atTen = suppressCrossTab(cells, 10);
  const atTwenty = suppressCrossTab(cells, 20);

  for (const rowId of atTen.rowIds) {
    for (const columnId of atTen.columnIds) {
      if (atTen.cells[rowId][columnId].suppressed) {
        assert.strictEqual(
          atTwenty.cells[rowId][columnId].suppressed,
          true,
          `${rowId}/${columnId} became visible when the manager raised the threshold`,
        );
      }
    }
  }
});

test('a threshold that is not a positive integer is refused', () => {
  const cells = grid({ young: { primary: 30 }, middle: { primary: 25 } });

  assert.throws(() => suppressCrossTab(cells, 0), /positive integer/);
  assert.throws(() => suppressCrossTab(cells, -1), /positive integer/);
  assert.throws(() => suppressCrossTab(cells, 2.5), /positive integer/);
});

test('a negative or fractional count is refused', () => {
  assert.throws(
    () => suppressCrossTab([{ rowId: 'young', columnId: 'primary', count: -1 }], THRESHOLD),
    /non-negative integer/,
  );
  assert.throws(
    () => suppressCrossTab([{ rowId: 'young', columnId: 'primary', count: 1.5 }], THRESHOLD),
    /non-negative integer/,
  );
});

test('a single breakdown hides a small category and one more with it', () => {
  const frequency = suppressFrequency(
    { '21-30': 4, '31-40': 30, '41-50': 25, '51-60': 21 },
    THRESHOLD,
  );

  assert.strictEqual(frequency.isFullySuppressed, false);
  assert.strictEqual(frequency.total, 80);
  assert.strictEqual(frequency.categories['21-30'].suppressed, true);

  const hidden = Object.values(frequency.categories).filter((c) => c.suppressed);
  assert.ok(
    hidden.length >= 2,
    'one hidden category out of four, against a published total, is a subtraction away',
  );
});

test('a breakdown with nothing small publishes every category', () => {
  const frequency = suppressFrequency({ '31-40': 30, '41-50': 25 }, THRESHOLD);

  assert.deepStrictEqual(published(frequency.categories['31-40']), 30);
  assert.deepStrictEqual(published(frequency.categories['41-50']), 25);
});

/**
 * The residual — everyone the table does not show — is the group a reader gets
 * for free, by subtracting the published categories from the round's own
 * response count. Two blanks are not enough to protect it: two blanks over one
 * person and nobody are still one person.
 *
 * `/breakdown` publishes each group's dimension averages beside its size, so a
 * residual of one is that respondent's eight answers, recovered by arithmetic
 * from a screen that never names them.
 */
test('a table whose blanks come to one person publishes nothing at all', () => {
  const frequency = suppressFrequency(
    { veterans: 54, newcomers: 1, unanswered: 0 },
    THRESHOLD,
  );

  assert.strictEqual(frequency.total, 55);
  assert.strictEqual(frequency.isFullySuppressed, true);
  assert.strictEqual(
    published(frequency.categories.veterans),
    undefined,
    'publishing 54 of 55 states the fifty-fifth',
  );
  assert.strictEqual(
    frequency.categories.veterans.suppressed &&
      frequency.categories.veterans.reason,
    'complementary',
  );
});

test('a residual of at least the threshold is left alone', () => {
  // The line between the test above and this one: 45 published against a total
  // of 55 hides ten people, and ten is what the threshold asks for.
  const frequency = suppressFrequency(
    { veterans: 45, newcomers: 9, unanswered: 1 },
    THRESHOLD,
  );

  assert.strictEqual(frequency.isFullySuppressed, false);
  assert.strictEqual(published(frequency.categories.veterans), 45);
  assert.strictEqual(frequency.categories.newcomers.suppressed, true);
  assert.strictEqual(frequency.categories.unanswered.suppressed, true);
});

/**
 * The reason this module can be read more than once for one round.
 *
 * `/breakdown` offers a table per background question, a query parameter apart,
 * so a manager reads tenure and role over the same fifty-five people. Neither
 * table knows the other exists. What makes them safe together is that each one's
 * residual is a crowd: a reader who lines the two up is intersecting two groups
 * of at least ten, and inclusion–exclusion bounds that intersection without ever
 * determining it.
 */
test('every table of one round leaves a crowd behind, not a person', () => {
  const round = 55;
  const tables = {
    tenure: { veterans: 40, midCareer: 12, newcomers: 3, unanswered: 0 },
    role: { teachers: 48, counsellors: 5, admin: 2 },
    track: { general: 30, special: 21, unanswered: 4 },
  };

  for (const [label, counts] of Object.entries(tables)) {
    assert.strictEqual(
      Object.values(counts).reduce((sum, count) => sum + count, 0),
      round,
      `${label}: the fixture must cover the same people as every other table`,
    );

    const frequency = suppressFrequency(counts, THRESHOLD);
    const shown = Object.entries(frequency.categories).filter(
      ([, entry]) => !entry.suppressed,
    );
    const residual =
      round -
      shown.reduce(
        (sum, [, entry]) => sum + (entry.suppressed ? 0 : entry.count),
        0,
      );

    for (const [categoryId, entry] of shown) {
      assert.ok(
        !entry.suppressed && entry.count >= THRESHOLD,
        `${label}/${categoryId}: a published group is never below the threshold`,
      );
    }

    assert.ok(
      residual === 0 || residual >= THRESHOLD,
      `${label}: the people this table does not show are a group of ${residual}, ` +
        'which a reader of the next table can line up against theirs',
    );
  }
});
