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
  assert.equal(newcomers.dimensionScores?.['self-expression']?.averageScore, 100);
  assert.equal(newcomers.dimensionScores?.['self-expression']?.computedStatus, 'green');
  assert.equal(newcomers.dimensionScores?.['self-expression']?.answerCount, 10);

  const veterans = group(breakdown, 'veteran');
  assert.equal(veterans.dimensionScores?.['self-expression']?.averageScore, 0);
  assert.equal(veterans.dimensionScores?.['self-expression']?.computedStatus, 'red');
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
  assert.equal(skipped.dimensionScores?.['self-expression']?.averageScore, 60);
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
  assert.equal(
    group(breakdown, 'new').dimensionScores?.['self-expression']?.averageScore,
    100,
  );
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
  assert.equal(newcomers.dimensionScores?.['meaning'], undefined);
  assert.equal(newcomers.dimensionScores?.['self-expression'], undefined);
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
