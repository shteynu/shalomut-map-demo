/**
 * The breakdown is the first thing in the product that publishes a number about
 * a subset of a staff room, so these tests are about what it refuses to say at
 * least as much as about what it computes.
 */
import assert from 'node:assert';
import test from 'node:test';

import {
  UNANSWERED_CATEGORY_ID,
  breakdownQuestionChoices,
  buildBackgroundBreakdown,
} from '../background-breakdown';
import {
  SurveyDefinition,
  SurveyDefinitionQuestion,
  SurveyResponseRecord,
  WellbeingDimensionId,
} from '../../types/backend';

const THRESHOLD = 10;
const TENURE = 'tenure';

function analyticQuestion(
  id: string,
  dimensionId: WellbeingDimensionId,
): SurveyDefinitionQuestion {
  return {
    id,
    kind: 'analytic',
    text: `שאלה ${id}`,
    required: true,
    enabled: true,
    dimensionId,
    scaleId: 'wellbeing-colour',
    polarity: 'positive',
  };
}

function tenureQuestion(
  options: { value: string; label: string }[],
): SurveyDefinitionQuestion {
  return {
    id: TENURE,
    kind: 'background',
    text: 'כמה שנים את/ה מלמד/ת?',
    required: false,
    enabled: true,
    answerMode: 'single-choice',
    options,
  };
}

function definitionWith(
  questions: SurveyDefinitionQuestion[],
): SurveyDefinition {
  return {
    title: 'סבב בדיקה',
    audience: 'צוות חינוכי',
    estimatedMinutes: 5,
    minimumResponses: THRESHOLD,
    introText: 'שלום',
    anonymityText: 'אנונימי',
    questions,
  };
}

/**
 * One response: a tenure category (or none) and a colour answer to every
 * analytic question named.
 */
function response(
  index: number,
  tenure: string | undefined,
  answers: { questionId: string; dimensionId: WellbeingDimensionId; value: string; score: number }[],
): SurveyResponseRecord {
  return {
    id: `response-${index}`,
    roundId: 'round',
    submittedAt: new Date('2026-08-15T00:00:00Z'),
    answers: [
      ...(tenure ? [{ questionId: TENURE, value: tenure }] : []),
      ...answers,
    ],
  };
}

function colourAnswers(score: number) {
  return [
    {
      questionId: 'q1',
      dimensionId: 'self-expression' as WellbeingDimensionId,
      value: score >= 100 ? 'green' : score > 0 ? 'yellow' : 'red',
      score,
    },
  ];
}

function group(
  breakdown: ReturnType<typeof buildBackgroundBreakdown>,
  categoryId: string,
) {
  const found = breakdown?.groups.find((entry) => entry.categoryId === categoryId);
  assert.ok(found, `expected a group for ${categoryId}`);
  return found;
}

const DEFINITION = definitionWith([
  analyticQuestion('q1', 'self-expression'),
  tenureQuestion([
    { value: 'new', label: 'עד שלוש שנים' },
    { value: 'veteran', label: 'ארבע שנים ומעלה' },
  ]),
]);

/** `count` responses in one category, each answering with the same score. */
function cohort(
  categoryId: string | undefined,
  count: number,
  score: number,
  startAt = 0,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) =>
    response(startAt + index, categoryId, colourAnswers(score)),
  );
}

/**
 * `count` responses in one category, of which only `answering` answered the
 * analytic question at all. Analytic questions can be optional, so a group's
 * size and the number of people behind any one of its dimension scores are two
 * different numbers — which is the whole subject of the tests below.
 */
function mixedCohort(
  categoryId: string,
  count: number,
  answering: number,
  score: number,
  startAt = 0,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) =>
    response(
      startAt + index,
      categoryId,
      index < answering ? colourAnswers(score) : [],
    ),
  );
}

/** Three teammates of one dimension, so answers and people cannot be confused. */
const THREE_PER_DIMENSION = definitionWith([
  analyticQuestion('q1', 'self-expression'),
  analyticQuestion('q2', 'self-expression'),
  analyticQuestion('q3', 'self-expression'),
  tenureQuestion([
    { value: 'new', label: 'עד שלוש שנים' },
    { value: 'veteran', label: 'ארבע שנים ומעלה' },
  ]),
]);

function trioCohort(
  categoryId: string,
  count: number,
  answering: number,
  score: number,
  startAt = 0,
): SurveyResponseRecord[] {
  return Array.from({ length: count }, (_, index) =>
    response(
      startAt + index,
      categoryId,
      index < answering
        ? ['q1', 'q2', 'q3'].map((questionId) => ({
            questionId,
            dimensionId: 'self-expression' as WellbeingDimensionId,
            value: 'green',
            score,
          }))
        : [],
    ),
  );
}

/** The published side of a cell, or a failed assertion naming what it was. */
function cell(
  breakdown: ReturnType<typeof buildBackgroundBreakdown>,
  categoryId: string,
  dimensionId: WellbeingDimensionId = 'self-expression',
) {
  const score = group(breakdown, categoryId).dimensionScores?.[dimensionId];
  assert.ok(score, `expected a ${dimensionId} cell for ${categoryId}`);
  assert.equal(
    score.suppressed,
    false,
    `the ${categoryId} cell is suppressed, not published`,
  );
  assert.ok(!score.suppressed);
  return score;
}

/** The suppressed side of a cell, likewise. */
function hiddenCell(
  breakdown: ReturnType<typeof buildBackgroundBreakdown>,
  categoryId: string,
  dimensionId: WellbeingDimensionId = 'self-expression',
) {
  const score = group(breakdown, categoryId).dimensionScores?.[dimensionId];
  assert.ok(score, `expected a ${dimensionId} cell for ${categoryId}`);
  assert.equal(
    score.suppressed,
    true,
    `the ${categoryId} cell is published, not suppressed`,
  );
  assert.ok(score.suppressed);
  return score;
}

test('a group at the threshold publishes its size and its dimension scores', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 10, 100), ...cohort('veteran', 10, 0, 10)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  assert.equal(breakdown.isFullySuppressed, false);

  const newcomers = group(breakdown, 'new');
  assert.equal(newcomers.size.suppressed, false);
  assert.equal(newcomers.size.suppressed === false && newcomers.size.count, 10);
  assert.equal(newcomers.label, 'עד שלוש שנים');

  const newcomerScore = cell(breakdown, 'new');
  assert.equal(newcomerScore.averageScore, 100);
  assert.equal(newcomerScore.computedStatus, 'green');
  assert.equal(newcomerScore.answerCount, 10);
  assert.equal(newcomerScore.respondentCount, 10);

  const veteranScore = cell(breakdown, 'veteran');
  assert.equal(veteranScore.averageScore, 0);
  assert.equal(veteranScore.computedStatus, 'red');
});

test('a group below the threshold publishes neither its size nor any score', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 3, 100), ...cohort('veteran', 20, 0, 3)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const newcomers = group(breakdown, 'new');
  assert.equal(newcomers.size.suppressed, true);
  assert.equal(newcomers.dimensionScores, undefined);
});

/**
 * The published groups have to leave a crowd behind, not a person.
 *
 * Fifty-four veterans out of fifty-five is two blanks — the newcomer and the
 * empty unanswered category — so the older rule was satisfied and the table was
 * published. But the blanks come to one person, and this screen prints each
 * group's dimension averages beside its size: `(55 × round − 54 × veterans)`
 * is that respondent's own answer, arrived at without ever naming them.
 *
 * It is also what makes the round's *other* background questions safe. A reader
 * who can isolate one person here can carry them to the next table.
 */
test('a table whose blanks come to one person publishes no group at all', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('veteran', 54, 100), ...cohort('new', 1, 0, 54)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  assert.equal(breakdown.totalResponses, 55);
  assert.equal(breakdown.isFullySuppressed, true);

  for (const entry of breakdown.groups) {
    assert.equal(
      entry.size.suppressed,
      true,
      `${entry.categoryId} is published, and the rest of the round is one person`,
    );
    assert.equal(entry.dimensionScores, undefined);
  }
});

test('a lone small group takes a second one down with it, so it cannot be subtracted out', () => {
  // 3 newcomers, 20 veterans, 0 unanswered. Only the newcomers are below the
  // threshold — and publishing 20 beside a total of 23 states the 3 outright.
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 3, 100), ...cohort('veteran', 20, 0, 3)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  const suppressedCount = breakdown.groups.filter(
    (entry) => entry.size.suppressed,
  ).length;
  assert.ok(
    suppressedCount >= 2,
    `one suppressed group is recoverable; got ${suppressedCount}`,
  );

  // And the survivor carries no score either, because it was suppressed too.
  for (const entry of breakdown.groups) {
    if (entry.size.suppressed) assert.equal(entry.dimensionScores, undefined);
  }
});

test('the published sizes never add up to the total when something is hidden', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 3, 100), ...cohort('veteran', 20, 0, 3)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  const publishedTotal = breakdown.groups.reduce(
    (sum, entry) => sum + (entry.size.suppressed ? 0 : entry.size.count),
    0,
  );
  const hidden = breakdown.groups.filter((entry) => entry.size.suppressed);

  if (hidden.length > 0) {
    assert.notEqual(
      publishedTotal,
      breakdown.totalResponses,
      'the published groups account for the whole round, so nothing was hidden',
    );
  }
});

test('respondents who skipped the question are a named category, not a remainder', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [
      ...cohort('new', 10, 100),
      ...cohort('veteran', 10, 0, 10),
      ...cohort(undefined, 12, 60, 20),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const skipped = group(breakdown, UNANSWERED_CATEGORY_ID);
  assert.equal(skipped.size.suppressed === false && skipped.size.count, 12);
  assert.equal(cell(breakdown, UNANSWERED_CATEGORY_ID).averageScore, 60);
  assert.equal(skipped.label, 'לא ענו על השאלה');
});

test('a locked round publishes no group at all, sizes included', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 30, 100), ...cohort('veteran', 30, 0, 30)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: true,
  });

  assert.ok(breakdown);
  assert.equal(breakdown.isFullySuppressed, true);
  for (const entry of breakdown.groups) {
    assert.equal(entry.size.suppressed, true);
    assert.equal(entry.dimensionScores, undefined);
  }
});

test('a declared option nobody chose is a suppressed row rather than a missing one', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: cohort('veteran', 30, 60),
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  const newcomers = group(breakdown, 'new');
  assert.equal(newcomers.size.suppressed, true);
});

test('an answer no longer on the option list is its own category, not an unanswered one', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [
      ...cohort('retired', 12, 40),
      ...cohort('veteran', 12, 80, 12),
      ...cohort('new', 12, 80, 24),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const stale = group(breakdown, 'retired');
  assert.equal(stale.size.suppressed === false && stale.size.count, 12);
  assert.equal(stale.label, 'retired');

  // And nobody skipped the question here, so there is no unanswered group at
  // all. A declared option nobody chose is still a row, because the manager
  // asked it; a group that does not exist is not.
  assert.equal(
    breakdown?.groups.some(
      (entry) => entry.categoryId === UNANSWERED_CATEGORY_ID,
    ),
    false,
  );
});

test('a background answer never reaches a dimension average', () => {
  const withTenureScored: SurveyResponseRecord[] = cohort('new', 12, 100).map(
    (record) => ({
      ...record,
      // A forged submission scoring the demographic answer into a dimension.
      answers: record.answers.map((answer) =>
        answer.questionId === TENURE
          ? {
              ...answer,
              dimensionId: 'self-expression' as WellbeingDimensionId,
              score: 0,
            }
          : answer,
      ),
    }),
  );

  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...withTenureScored, ...cohort('veteran', 12, 100, 12)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  // 100, not the 50 that averaging the forged zero in would produce.
  assert.equal(cell(breakdown, 'new').averageScore, 100);
});

test('an answer naming a dimension its question does not belong to is refused', () => {
  const forged = cohort('new', 12, 100).map((record) => ({
    ...record,
    answers: record.answers.map((answer) =>
      answer.questionId === 'q1'
        ? { ...answer, dimensionId: 'meaning' as WellbeingDimensionId, score: 0 }
        : answer,
    ),
  }));

  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...forged, ...cohort('veteran', 12, 100, 12)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const newcomers = group(breakdown, 'new');
  // `meaning` is absent because this round asks nothing about it, and the
  // refused answer does not conjure a column. `self-expression` is present and
  // blank, because the round does measure it and these twelve contributed
  // nobody to it — an unlike fact that has to look unlike.
  assert.equal(newcomers.dimensionScores?.['meaning'], undefined);
  assert.equal(hiddenCell(breakdown, 'new').reason, 'below-threshold');
});

test('only single-choice background questions are offered', () => {
  const choices = breakdownQuestionChoices(
    definitionWith([
      analyticQuestion('q1', 'self-expression'),
      tenureQuestion([{ value: 'new', label: 'עד שלוש שנים' }]),
      {
        id: 'hours',
        kind: 'background',
        text: 'שעות עבודה',
        required: false,
        enabled: true,
        answerMode: 'number',
      },
      {
        id: 'grid-1',
        kind: 'background',
        text: 'הוראה',
        required: false,
        enabled: true,
        answerMode: 'allocation-100',
        allocationGroupId: 'load',
      },
      {
        ...tenureQuestion([{ value: 'new', label: 'עד שלוש שנים' }]),
        id: 'disabled',
        enabled: false,
      },
    ]),
  );

  assert.deepEqual(
    choices.map((choice) => choice.questionId),
    [TENURE],
  );
  assert.equal(choices[0].categoryCount, 1);
});

test('a question the round does not have breaks down to null rather than to nothing', () => {
  assert.equal(
    buildBackgroundBreakdown({
      definition: DEFINITION,
      responses: cohort('new', 12, 100),
      questionId: 'no-such-question',
      privacyThreshold: THRESHOLD,
      isRoundLocked: false,
    }),
    null,
  );
});

/**
 * The cell is where the threshold was still missing.
 *
 * A group large enough to name is not a guarantee about any one of its
 * dimensions: analytic questions may be optional, and a group of twenty can
 * bring four people to one dimension. The published average was then those four
 * people's, printed beside a group size of twenty that said nothing about it.
 */
test('a dimension too few of a published group answered publishes no number', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: definitionWith([
      analyticQuestion('q1', 'self-expression'),
      tenureQuestion([
        { value: 'new', label: 'עד שלוש שנים' },
        { value: 'mid', label: 'בין ארבע לעשר' },
        { value: 'veteran', label: 'אחת עשרה ומעלה' },
      ]),
    ]),
    responses: [
      ...mixedCohort('new', 20, 20, 100),
      ...mixedCohort('mid', 20, 4, 40, 20),
      ...mixedCohort('veteran', 20, 8, 60, 40),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  // Every group is on the table: the sizes are twenty apiece and this rule is
  // about the cells, not about who may be named.
  for (const entry of breakdown.groups) {
    assert.equal(entry.size.suppressed, false, `${entry.categoryId} lost its size`);
  }

  assert.equal(hiddenCell(breakdown, 'mid').reason, 'below-threshold');
  assert.equal(hiddenCell(breakdown, 'veteran').reason, 'below-threshold');

  // The two blanks come to twelve, which is a crowd, so the third cell stands.
  const newcomers = cell(breakdown, 'new');
  assert.equal(newcomers.averageScore, 100);
  assert.equal(newcomers.respondentCount, 20);
});

/**
 * One blank in a dimension is not a blank. The round's own map publishes each
 * dimension's average and the answers behind it, so the published groups of a
 * dimension plus that dimension's total determine the hidden one — the same
 * subtraction the group sizes are already closed under, one row down.
 */
test('a lone thin cell takes a published cell down with it', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [
      ...mixedCohort('new', 20, 20, 100),
      ...mixedCohort('veteran', 20, 5, 0, 20),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  assert.equal(hiddenCell(breakdown, 'veteran').reason, 'below-threshold');
  assert.equal(hiddenCell(breakdown, 'new').reason, 'complementary');

  // And the table itself survives: the groups are still named and sized, so a
  // manager reads "these two groups exist, this dimension is not shown for
  // them" rather than an empty screen.
  assert.equal(breakdown.isFullySuppressed, false);
  assert.equal(
    breakdown.groups.every((entry) => !entry.size.suppressed),
    true,
  );
});

/**
 * The threshold counts people, and a person who answered three questions of one
 * dimension is one person. Counting answers would publish a cell standing on
 * four teachers as though twelve of them were behind it.
 */
test('four people answering three questions each are four, not twelve', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: THREE_PER_DIMENSION,
    responses: [
      ...trioCohort('new', 20, 4, 100),
      ...trioCohort('veteran', 20, 20, 60, 20),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  assert.ok(breakdown);
  assert.equal(hiddenCell(breakdown, 'new').reason, 'below-threshold');
});

test('a published cell says how many answers and how many people it stands on', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: THREE_PER_DIMENSION,
    responses: [
      ...trioCohort('new', 12, 12, 100),
      ...trioCohort('veteran', 12, 12, 100, 12),
    ],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const newcomers = cell(breakdown, 'new');
  assert.equal(newcomers.respondentCount, 12);
  assert.equal(newcomers.answerCount, 36);
});

/**
 * A dimension the questionnaire asks nothing about is absent rather than
 * blank. There is nothing to hide there, and a suppressed cell would tell a
 * manager the round measured something it never asked.
 */
test('a dimension this round does not measure has no cell at all', () => {
  const breakdown = buildBackgroundBreakdown({
    definition: DEFINITION,
    responses: [...cohort('new', 12, 100), ...cohort('veteran', 12, 60, 12)],
    questionId: TENURE,
    privacyThreshold: THRESHOLD,
    isRoundLocked: false,
  });

  const newcomers = group(breakdown, 'new');
  assert.equal(newcomers.dimensionScores?.['meaning'], undefined);
  assert.equal(Object.keys(newcomers.dimensionScores ?? {}).length, 1);
});
