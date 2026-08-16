import assert from 'node:assert';
import { test } from 'node:test';
import { surveyInstrument } from '../../shalomut-source';
import { AnswerValue, SurveyResponseRecord } from '../../types/backend';
import { encodeRoundAnalytics } from '../../analytics-encoder';
import { AnalyticsService } from '../analytics.service';
import {
  DEFAULT_PRIVACY_THRESHOLD,
  MINIMUM_PRIVACY_THRESHOLD,
  createCanonicalSurveyDefinition,
} from '../../survey-definition';
import { RoundService } from '../round.service';
import { SurveyService } from '../survey.service';

test('AnalyticsService.computeStatus returns correct status thresholds', () => {
  assert.strictEqual(AnalyticsService.computeStatus(100), 'green');
  assert.strictEqual(AnalyticsService.computeStatus(75), 'green');
  assert.strictEqual(AnalyticsService.computeStatus(74), 'yellow');
  assert.strictEqual(AnalyticsService.computeStatus(50), 'yellow');
  assert.strictEqual(AnalyticsService.computeStatus(49), 'red');
  assert.strictEqual(AnalyticsService.computeStatus(0), 'red');
});

test('AnalyticsService locks results when total responses < privacyThreshold', () => {
  const roundId = 'round_test_1';
  const responses: SurveyResponseRecord[] = []; // 0 responses < threshold 10

  const result = AnalyticsService.calculateRoundAnalytics(roundId, 10, responses);

  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 0);
  assert.strictEqual(result.privacyThreshold, 10);
  assert.strictEqual(result.contractVersion, '2.0');
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService unlocks results and computes correct scores when responses >= privacyThreshold', () => {
  const roundId = 'round_test_2';
  const responses: SurveyResponseRecord[] = [];

  // Generate 10 uniform 'green' responses
  for (let i = 0; i < 10; i++) {
    const answers = surveyInstrument.questions.map((q) => ({
      questionId: q.id,
      dimensionId: q.dimensionId,
      value: 'green' as AnswerValue,
      score: 100 as const,
    }));

    responses.push({
      id: `resp_${i}`,
      roundId,
      answers,
      submittedAt: new Date(),
    });
  }

  const result = AnalyticsService.calculateRoundAnalytics(roundId, 10, responses);

  assert.strictEqual(result.isLocked, false);
  assert.strictEqual(result.contractVersion, '2.0');
  assert.strictEqual(result.totalResponses, 10);
  assert.strictEqual(Object.keys(result.questionAggregates).length, 24);
  assert.strictEqual(result.dimensionScores['self-expression'].isLocked, false);
  assert.strictEqual(result.dimensionScores['self-expression'].averageScore, 100);
  assert.strictEqual(result.dimensionScores['self-expression'].computedStatus, 'green');
});

test('SurveyService processes valid submissions and validates missing fields', () => {
  const validAnswers = surveyInstrument.questions.map((q) => ({
    questionId: q.id,
    dimensionId: q.dimensionId,
    value: 'yellow' as AnswerValue,
  }));

  const validSubmission = SurveyService.processSubmission({
    roundId: 'round_valid',
    answers: validAnswers,
  });

  assert.strictEqual(validSubmission.result.success, true);
  assert.ok(validSubmission.result.responseId);
  assert.strictEqual(validSubmission.record?.answers[0].score, 60);

  // Test incomplete submission (only 5 answers instead of 24)
  const incompleteSubmission = SurveyService.processSubmission({
    roundId: 'round_invalid',
    answers: validAnswers.slice(0, 5),
  });

  assert.strictEqual(incompleteSubmission.result.success, false);
  assert.ok(incompleteSubmission.result.error?.includes('24 questions'));
});

test('SurveyService accepts an omitted optional dynamic question but still requires every required question', () => {
  const expectedQuestions = surveyInstrument.dimensions.map(
    (dimension, index) => ({
      id: `dynamic-${dimension.id}-${index + 1}`,
      kind: 'analytic' as const,
      dimensionId: dimension.id,
      scaleId: 'wellbeing-colour' as const,
      polarity: 'positive' as const,
      required: index !== surveyInstrument.dimensions.length - 1,
    }),
  );
  const answers = expectedQuestions.slice(0, -1).map((question) => ({
    questionId: question.id,
    dimensionId: question.dimensionId,
    value: 'green' as AnswerValue,
  }));

  const optionalOmitted = SurveyService.processSubmission(
    { roundId: 'round_dynamic_optional', answers },
    expectedQuestions,
  );
  assert.strictEqual(optionalOmitted.result.success, true);

  const requiredOmitted = SurveyService.processSubmission(
    {
      roundId: 'round_dynamic_required',
      answers: answers.slice(1),
    },
    expectedQuestions,
  );
  assert.strictEqual(requiredOmitted.result.success, false);
});

test('RoundService gives a round with no questionnaire the standard one, as a draft', () => {
  const round = RoundService.createRound({
    organizationId: 'org_123',
    title: 'Round 1 2026',
  });

  assert.strictEqual(round.organizationId, 'org_123');
  // The questions are there to be read and edited rather than built from
  // nothing. Until 2026-08-09 this was an empty draft, and a manager who opened
  // a new round found an empty builder.
  assert.strictEqual(
    round.surveyDefinition?.questions.length,
    surveyInstrument.questions.length,
  );
  // Complete, and still a draft: nobody has read it, and a round born active
  // would close the round the school is still collecting answers on. Saving the
  // questionnaire in the builder is what puts it live.
  assert.strictEqual(round.status, 'draft');
  assert.strictEqual(round.privacyThreshold, DEFAULT_PRIVACY_THRESHOLD);
  // Ten respondents is the product requirement, so it is also where a round
  // the manager never configured starts.
  assert.strictEqual(DEFAULT_PRIVACY_THRESHOLD, 10);
  assert.ok(round.shareCode.startsWith('SHALOM-'));
});

test('RoundService activates a round whose questionnaire covers all eight dimensions', () => {
  const round = RoundService.createRound({
    organizationId: 'org_123',
    title: 'Round 1 2026',
    surveyDefinition: createCanonicalSurveyDefinition('Round 1 2026', 10),
  });

  assert.strictEqual(round.status, 'active');
  assert.strictEqual(round.surveyDefinition?.questions.length, 24);
  assert.strictEqual(round.privacyThreshold, 10);
});

test('RoundService keeps a questionnaire without all eight dimensions in draft', () => {
  const questions = surveyInstrument.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );

  const round = RoundService.createRound({
    organizationId: 'org_invalid_definition',
    title: 'Invalid round',
    surveyDefinition: {
      title: 'Invalid round',
      audience: 'צוות',
      estimatedMinutes: 10,
      minimumResponses: 10,
      introText: 'פתיח',
      anonymityText: 'אנונימי',
      questions: questions.map((question) => ({
        ...question,
        enabled: true,
        kind: "analytic" as const,
        scaleId: "wellbeing-colour" as const,
        polarity: "positive" as const,
      })),
    },
  });

  assert.strictEqual(round.status, 'draft');
});

test('AnalyticsService returns a locked result for a draft round whose questionnaire is unfinished', () => {
  // A manager who is still building the questionnaire keeps opening the manager
  // screens, and every one of them computes analytics. An unfinished draft has
  // no results yet, so it must come back locked instead of throwing.
  const round = RoundService.createRound({
    organizationId: 'org_draft_analytics',
    title: 'טיוטה בבנייה',
  });

  const result = AnalyticsService.calculateDynamicRoundAnalytics(round, []);

  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 0);
  assert.deepStrictEqual(result.dimensionScores, {});
  assert.deepStrictEqual(result.questionAggregates, {});
});

test('AnalyticsService keeps a partially built questionnaire locked even with responses', () => {
  const questions = surveyInstrument.questions.filter(
    (question) => question.dimensionId !== 'meaning',
  );
  const round = RoundService.createRound({
    organizationId: 'org_partial_analytics',
    title: 'שאלון חלקי',
    privacyThreshold: 1,
    surveyDefinition: {
      title: 'שאלון חלקי',
      audience: 'צוות',
      estimatedMinutes: 10,
      minimumResponses: 1,
      introText: 'פתיח',
      anonymityText: 'אנונימי',
      questions: questions.map((question) => ({
        ...question,
        enabled: true,
        kind: 'analytic' as const,
        scaleId: 'wellbeing-colour' as const,
        polarity: 'positive' as const,
      })),
    },
  });
  const responses: SurveyResponseRecord[] = [
    {
      id: 'response_partial_1',
      roundId: round.id,
      submittedAt: new Date(),
      answers: questions.map((question) => ({
        questionId: question.id,
        dimensionId: question.dimensionId,
        value: 'green' as AnswerValue,
        score: 100,
      })),
    },
  ];

  const result = AnalyticsService.calculateDynamicRoundAnalytics(round, responses);

  // Seven of eight dimensions cannot produce the fixed eight-stone Dashboard
  // output, so the round stays locked until the questionnaire is complete.
  assert.strictEqual(result.isLocked, true);
  assert.strictEqual(result.totalResponses, 1);
});

test('a locked 5.0 round carries no distributions across the service boundary', () => {
  // The mirror of the Python refusal (tests/test_contract_v5.py): the consumer
  // rejects a locked payload that carries aggregates, and the producer must
  // never build one. A distribution below the privacy threshold is exactly the
  // shape of data that could identify a single respondent.
  const previousVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const round = RoundService.createRound({
      organizationId: 'org_locked_v5',
      title: 'סבב נעול',
      privacyThreshold: 10,
      surveyDefinition: createCanonicalSurveyDefinition('סבב נעול', 10),
    });
    const responses: SurveyResponseRecord[] = Array.from(
      { length: 3 },
      (_, index) => ({
        id: `response_locked_v5_${index}`,
        roundId: round.id,
        submittedAt: new Date(),
        answers: surveyInstrument.questions.map((question) => ({
          questionId: question.id,
          dimensionId: question.dimensionId,
          value: 'green' as AnswerValue,
          score: 100,
        })),
      }),
    );

    const result = AnalyticsService.calculateDynamicRoundAnalytics(
      round,
      responses,
    );

    assert.strictEqual(encodeRoundAnalytics(result).contractVersion, '5.0');
    assert.strictEqual(result.isLocked, true);
    assert.deepStrictEqual(result.questionAggregates, {});
    assert.deepStrictEqual(result.dimensionScores, {});
  } finally {
    if (previousVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousVersion;
    }
  }
});

test('an unlocked 5.0 round carries a distribution for every question', () => {
  const previousVersion = process.env.AI_ANALYTICS_CONTRACT_VERSION;
  process.env.AI_ANALYTICS_CONTRACT_VERSION = '5.0';

  try {
    const round = RoundService.createRound({
      organizationId: 'org_unlocked_v5',
      title: 'סבב פתוח',
      privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
      surveyDefinition: createCanonicalSurveyDefinition(
        'סבב פתוח',
        MINIMUM_PRIVACY_THRESHOLD,
      ),
    });
    // Ten answers: two red, three yellow, five green.
    const responses: SurveyResponseRecord[] = Array.from(
      { length: MINIMUM_PRIVACY_THRESHOLD },
      (_, index) => ({
        id: `response_unlocked_v5_${index}`,
        roundId: round.id,
        submittedAt: new Date(),
        answers: surveyInstrument.questions.map((question) => {
          const value: AnswerValue =
            index < 2 ? 'red' : index < 5 ? 'yellow' : 'green';
          return {
            questionId: question.id,
            dimensionId: question.dimensionId,
            value,
            score: value === 'green' ? 100 : value === 'yellow' ? 60 : 0,
          };
        }),
      }),
    );

    const result = AnalyticsService.calculateDynamicRoundAnalytics(
      round,
      responses,
    );

    assert.strictEqual(result.isLocked, false);
    // Core always counts the distribution; 5.0 is what carries it across.
    const encoded = encodeRoundAnalytics(result);
    for (const aggregate of Object.values(encoded.questionAggregates)) {
      assert.deepStrictEqual(aggregate.scoreDistribution, {
        green: 5,
        yellow: 3,
        red: 2,
      });
      assert.strictEqual(aggregate.responseCount, MINIMUM_PRIVACY_THRESHOLD);
    }

    // The same round encoded for a version without distributions drops them
    // and changes nothing else — the counting never depended on the version.
    const encodedV3 = encodeRoundAnalytics(result, '3.0');
    for (const [questionId, aggregate] of Object.entries(
      encodedV3.questionAggregates,
    )) {
      assert.strictEqual(aggregate.scoreDistribution, undefined);
      assert.strictEqual(
        aggregate.averageScore,
        encoded.questionAggregates[questionId].averageScore,
      );
      assert.strictEqual(aggregate.responseCount, MINIMUM_PRIVACY_THRESHOLD);
    }
  } finally {
    if (previousVersion === undefined) {
      delete process.env.AI_ANALYTICS_CONTRACT_VERSION;
    } else {
      process.env.AI_ANALYTICS_CONTRACT_VERSION = previousVersion;
    }
  }
});

/**
 * A questionnaire on a Likert scale, which the builder can produce today.
 *
 * Every fixture above answers on the colour scale, and that is why nothing
 * caught a Likert answer being reported as the nearest colour anchor. Nearest
 * puts the crossovers at 80 and 30, because the colour anchors score
 * `100`/`60`/`0`; `contracts/scoring-bands.json` puts them at 75 and 50. The
 * two rules therefore disagree on exactly two of the scores the shipped scales
 * can produce — and both of them are anchors a respondent clicks:
 *
 * - `75`, point 4 of 5 (`במידה רבה`): the bands call it green, nearest called
 *   it yellow;
 * - `33`, point 3 of 7 (`לעיתים די רחוקות`): the bands call it red, nearest
 *   called it yellow.
 *
 * Both errors pull toward the middle, which is the direction that hides a
 * finding rather than inventing one. The midpoint, `50`, agrees under both
 * rules — so a test built on it proves nothing, and this file had to be written
 * against the two scores that separate them.
 */
function likertRound(
  organizationId: string,
  scaleId: 'likert-7-frequency' | 'likert-5-extent',
) {
  return RoundService.createRound({
    organizationId,
    title: 'סבב ליקרט',
    privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
    surveyDefinition: {
      title: 'סבב ליקרט',
      audience: 'צוות',
      estimatedMinutes: 10,
      minimumResponses: MINIMUM_PRIVACY_THRESHOLD,
      introText: 'פתיח',
      anonymityText: 'אנונימי',
      questions: surveyInstrument.questions.map((question) => ({
        ...question,
        enabled: true,
        kind: 'analytic' as const,
        scaleId,
        polarity: 'positive' as const,
      })),
    },
  });
}

function likertResponses(
  roundId: string,
  value: string,
  score: number,
): SurveyResponseRecord[] {
  return Array.from({ length: MINIMUM_PRIVACY_THRESHOLD }, (_, index) => ({
    id: `response_${roundId}_${index}`,
    roundId,
    submittedAt: new Date(),
    answers: surveyInstrument.questions.map((question) => ({
      questionId: question.id,
      dimensionId: question.dimensionId,
      value,
      score,
    })),
  }));
}

test('a Likert answer is bucketed by the shared score bands, not by the nearest colour', () => {
  // Ten respondents who all answered `במידה רבה` — point 4 of 5, score 75,
  // the first score of the green band. Nearest-anchor reported them yellow,
  // because 75 is closer to the yellow anchor at 60 than to the green one at
  // 100. A staff room that answered well read as merely adequate.
  const strong = likertRound('org_likert_strong', 'likert-5-extent');
  const strongResult = AnalyticsService.calculateDynamicRoundAnalytics(
    strong,
    likertResponses(strong.id, '4', 75),
  );

  assert.strictEqual(strongResult.isLocked, false);
  for (const aggregate of Object.values(strongResult.questionAggregates)) {
    assert.deepStrictEqual(aggregate.scoreDistribution, {
      green: MINIMUM_PRIVACY_THRESHOLD,
      yellow: 0,
      red: 0,
    });
  }

  // The property the fix exists for, and the one a manager could have seen:
  // the stone has always gone through the shared bands, so before the fix this
  // round showed eight green stones above questions whose every answer was
  // counted yellow. One screen, two rules, no way to tell which was right.
  for (const dimension of Object.values(strongResult.dimensionScores)) {
    assert.strictEqual(dimension.computedStatus, 'green');
  }

  // The other direction, and the one that costs more: `לעיתים די רחוקות` —
  // point 3 of 7, score 33, inside the red band. Nearest-anchor reported it
  // yellow, so a dimension in trouble was published as middling.
  const weak = likertRound('org_likert_weak', 'likert-7-frequency');
  const weakResult = AnalyticsService.calculateDynamicRoundAnalytics(
    weak,
    likertResponses(weak.id, '3', 33),
  );

  for (const aggregate of Object.values(weakResult.questionAggregates)) {
    assert.deepStrictEqual(aggregate.scoreDistribution, {
      green: 0,
      yellow: 0,
      red: MINIMUM_PRIVACY_THRESHOLD,
    });
  }
  for (const dimension of Object.values(weakResult.dimensionScores)) {
    assert.strictEqual(dimension.computedStatus, 'red');
  }
});

test('a colour answer still reports the colour the respondent picked', () => {
  // The regression guard for the fix above: a colour question must keep
  // reporting the pick rather than the band. Yellow is the value that proves
  // it — it scores 60, which the bands also call yellow, so this fixture would
  // pass either way. What separates them is red at 0 and green at 100 staying
  // exactly where the respondents put them while the round's average sits in
  // the yellow band; a rule that bucketed by score would still agree here, so
  // the assertion that matters is the one in the Likert test above. This test
  // exists to catch the fix changing behaviour it was not meant to touch.
  const round = RoundService.createRound({
    organizationId: 'org_colour_unchanged',
    title: 'סבב צבעים',
    privacyThreshold: MINIMUM_PRIVACY_THRESHOLD,
    surveyDefinition: createCanonicalSurveyDefinition(
      'סבב צבעים',
      MINIMUM_PRIVACY_THRESHOLD,
    ),
  });
  const responses: SurveyResponseRecord[] = Array.from(
    { length: MINIMUM_PRIVACY_THRESHOLD },
    (_, index) => ({
      id: `response_colour_${index}`,
      roundId: round.id,
      submittedAt: new Date(),
      answers: surveyInstrument.questions.map((question) => {
        const value: AnswerValue =
          index < 2 ? 'red' : index < 5 ? 'yellow' : 'green';
        return {
          questionId: question.id,
          dimensionId: question.dimensionId,
          value,
          score: value === 'green' ? 100 : value === 'yellow' ? 60 : 0,
        };
      }),
    }),
  );

  const result = AnalyticsService.calculateDynamicRoundAnalytics(
    round,
    responses,
  );

  for (const aggregate of Object.values(result.questionAggregates)) {
    assert.deepStrictEqual(aggregate.scoreDistribution, {
      green: 5,
      yellow: 3,
      red: 2,
    });
  }
});
