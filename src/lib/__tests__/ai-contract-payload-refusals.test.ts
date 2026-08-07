import assert from 'node:assert';
import test from 'node:test';
import { validateStoneMapResult } from '../ai-contract';
import { createValidV6Payload, SURVEY_DEFINITION_HASH } from './fixtures/v6-payload';

/**
 * One refusal per product rule the validator enforces on an incoming callback.
 *
 * The suite exists because mutation testing found the rules unpinned: a mutant
 * that deleted the "exactly five recommendations" check, the score/status
 * agreement, the provenance binding to the questionnaire snapshot or the
 * eight-dimension taxonomy survived the whole contract suite. Every one of
 * those had a positive test proving a valid payload is accepted, and none had
 * the negative half proving an invalid one is refused — so the guard could be
 * removed and the tests stayed green.
 *
 * Each case starts from one valid V6 payload and breaks exactly one thing, so
 * a failure names the rule that stopped holding rather than the fixture.
 */

const ROUND_ID = 'round-v6';

function payloadWith(
  mutate: (payload: ReturnType<typeof createValidV6Payload>) => void,
) {
  const payload = createValidV6Payload(ROUND_ID);
  mutate(payload);
  return payload;
}

function refusal(payload: unknown) {
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(
    result.ok,
    false,
    'the validator accepted a payload that breaks a contract rule',
  );
  return result.ok === false ? result.error : '';
}

function firstStone(payload: ReturnType<typeof createValidV6Payload>) {
  const dimensionId = Object.keys(payload.stones)[0];
  return payload.stones[dimensionId] as Record<string, any>;
}

test('the valid fixture is accepted, so every refusal below is about its one change', () => {
  const result = validateStoneMapResult(createValidV6Payload(ROUND_ID), ROUND_ID);
  assert.strictEqual(result.ok, true);
});

test('a stone must carry exactly five recommendations', () => {
  const four = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.recommendedInterventions = stone.recommendedInterventions.slice(0, 4);
    }),
  );
  assert.match(four, /does not match AI analytics contract/);

  const six = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.recommendedInterventions = [
        ...stone.recommendedInterventions,
        { ...stone.recommendedInterventions[0], id: 'extra-intervention' },
      ];
    }),
  );
  assert.match(six, /does not match AI analytics contract/);
});

test('five recommendations must be five distinct recommendations', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.recommendedInterventions[4] = { ...stone.recommendedInterventions[0] };
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a stone must be grounded in at least one question metric', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).metrics = [];
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a stone score must agree with the status derived from it', () => {
  const error = refusal(
    payloadWith((payload) => {
      // 62 is yellow; claiming green is the disagreement the Dashboard would show.
      const stone = firstStone(payload);
      stone.status = 'green';
      // The recommendations must move with it. Left at yellow they are refused
      // for disagreeing with their own stone, and this case would then prove
      // that rule instead of the one it names — as it did until 2026-08-05,
      // when a mutant that deleted the score/status check survived it.
      for (const intervention of stone.recommendedInterventions) {
        intervention.status = 'green';
      }
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('the score boundaries are inclusive and everything outside them is refused', () => {
  for (const [score, status] of [
    [0, 'red'],
    [100, 'green'],
  ] as const) {
    const payload = payloadWith((draft) => {
      const stone = firstStone(draft);
      stone.score = score;
      stone.status = status;
      for (const intervention of stone.recommendedInterventions) {
        intervention.status = status;
      }
    });
    const result = validateStoneMapResult(payload, ROUND_ID);
    assert.strictEqual(result.ok, true, `score ${score} must be accepted`);
  }

  for (const score of [-1, 101]) {
    const error = refusal(
      payloadWith((payload) => {
        firstStone(payload).score = score;
      }),
    );
    assert.match(error, /does not match AI analytics contract/);
  }
});

test('a stone score must be a finite number', () => {
  for (const score of ['62', Number.NaN, Number.POSITIVE_INFINITY]) {
    const error = refusal(
      payloadWith((payload) => {
        firstStone(payload).score = score;
      }),
    );
    assert.match(error, /does not match AI analytics contract/);
  }
});

test('a stone must be filed under its own dimension', () => {
  const error = refusal(
    payloadWith((payload) => {
      const [first, second] = Object.keys(payload.stones);
      firstStone(payload).dimensionId = second;
      assert.notStrictEqual(first, second);
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a stone with no overview must be a stone that declares one is missing', () => {
  // Until `8b75754` a 6.0 stone could not report `unavailable` at all, and the
  // refusal this replaces asserted that. It kept passing afterwards for a
  // reason it did not name: the payload it built also kept its three
  // paragraphs, so it was testing the gap rule while claiming to test a ban.
  //
  // The half no test pinned is this one. An empty overview beside an outcome
  // that says copy was written is a stone whose absence nothing accounts for,
  // and the manager's screen would show a blank dimension with no reason for
  // it.
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).summary = [];
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('provenance must be bound to the questionnaire snapshot the payload names', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.surveyDefinitionHash =
        `sha256:${'b'.repeat(64)}`;
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('provenance must list exactly the questions the metrics used', () => {
  const missing = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.sourceQuestionIds = [];
    }),
  );
  assert.match(missing, /does not match AI analytics contract/);

  const foreign = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.sourceQuestionIds = [
        'question-from-another-round',
      ];
    }),
  );
  assert.match(foreign, /does not match AI analytics contract/);

  const duplicated = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      const [questionId] = stone.generationProvenance.sourceQuestionIds;
      stone.generationProvenance.sourceQuestionIds = [questionId, questionId];
    }),
  );
  assert.match(duplicated, /does not match AI analytics contract/);
});

test('two metrics in one stone may not describe the same question', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.metrics = [stone.metrics[0], { ...stone.metrics[0] }];
      stone.generationProvenance.sourceQuestionIds = [
        stone.metrics[0].questionId,
        stone.metrics[0].questionId,
      ];
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a model-written stone may not claim zero attempts', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.attempts = 0;
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('attempt and retry counts must be non-negative and consistent', () => {
  const negativeAttempts = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.attempts = -1;
    }),
  );
  assert.match(negativeAttempts, /does not match AI analytics contract/);

  const negativeRetries = refusal(
    payloadWith((payload) => {
      firstStone(payload).generationProvenance.retryCount = -1;
    }),
  );
  assert.match(negativeRetries, /does not match AI analytics contract/);

  const moreRetriesThanAttempts = refusal(
    payloadWith((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.attempts = 1;
      provenance.retryCount = 1;
    }),
  );
  assert.match(moreRetriesThanAttempts, /does not match AI analytics contract/);
});

test('a metric may not report an average outside the score range', () => {
  for (const averageScore of [-1, 101]) {
    const error = refusal(
      payloadWith((payload) => {
        firstStone(payload).metrics[0].averageScore = averageScore;
      }),
    );
    assert.match(error, /does not match AI analytics contract/);
  }

  for (const averageScore of [0, 100]) {
    const payload = payloadWith((draft) => {
      firstStone(draft).metrics[0].averageScore = averageScore;
    });
    const result = validateStoneMapResult(payload, ROUND_ID);
    assert.strictEqual(
      result.ok,
      true,
      `an average of ${averageScore} is inside the range and must be accepted`,
    );
  }
});

test('a metric may not describe zero responses', () => {
  const error = refusal(
    payloadWith((payload) => {
      const metric = firstStone(payload).metrics[0];
      metric.responseCount = 0;
      metric.scoreDistribution = { green: 0, yellow: 0, red: 0 };
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a metric must name the question it aggregates', () => {
  for (const questionId of ['', '   ']) {
    const error = refusal(
      payloadWith((payload) => {
        const stone = firstStone(payload);
        stone.metrics[0].questionId = questionId;
        stone.generationProvenance.sourceQuestionIds = [questionId];
      }),
    );
    assert.match(error, /does not match AI analytics contract/);
  }
});

test('the map must contain exactly the eight canonical dimensions', () => {
  const missing = refusal(
    payloadWith((payload) => {
      delete (payload.stones as Record<string, unknown>)[
        Object.keys(payload.stones)[0]
      ];
    }),
  );
  assert.match(missing, /exactly the eight canonical dimensions/);

  const extra = refusal(
    payloadWith((payload) => {
      (payload.stones as Record<string, unknown>)['invented-dimension'] =
        firstStone(payload);
    }),
  );
  assert.match(extra, /exactly the eight canonical dimensions/);
});

test('a successful payload may not also be privacy locked', () => {
  const error = refusal(
    payloadWith((payload) => {
      payload.isLocked = true;
    }),
  );
  assert.match(error, /cannot be privacy locked/);
});

test('a locked_error payload must actually set the lock', () => {
  const error = refusal(
    payloadWith((payload) => {
      payload.status = 'locked_error' as 'success';
      payload.isLocked = false;
    }),
  );
  assert.match(error, /must set isLocked to true/);
});

test('payload metadata must be present and well formed', () => {
  const summary = refusal(
    payloadWith((payload) => {
      (payload as Record<string, unknown>).overallPsychologicalSummary = 42;
    }),
  );
  assert.match(summary, /metadata is invalid/);

  const processedAt = refusal(
    payloadWith((payload) => {
      payload.processedAt = 'not-a-timestamp';
    }),
  );
  assert.match(processedAt, /metadata is invalid/);
});

test('a dynamic payload must carry a well-formed survey definition hash', () => {
  for (const hash of ['sha256:short', SURVEY_DEFINITION_HASH.toUpperCase(), '']) {
    const error = refusal(
      payloadWith((payload) => {
        payload.surveyDefinitionHash = hash;
      }),
    );
    assert.match(error, /valid surveyDefinitionHash/);
  }
});

/**
 * Everything below closes the gaps the 2026-08-07 mutation runs found in this
 * suite, after `1.0`–`3.0` and `5.0` got refusal suites of their own.
 *
 * Most are rules that were tested from one side only, and a few are rules a
 * shorter payload could not reach: a stone with one metric and five distinct
 * recommendations cannot tell `every` from `some`, so the cases that need a
 * second metric or a sixth recommendation build them here.
 */

function stoneWithTwoMetrics(payload: ReturnType<typeof createValidV6Payload>) {
  const stone = firstStone(payload);
  const second = {
    ...stone.metrics[0],
    questionId: `${stone.metrics[0].questionId}-second`,
  };
  stone.metrics = [stone.metrics[0], second];
  stone.generationProvenance.sourceQuestionIds = [
    stone.metrics[0].questionId,
    second.questionId,
  ];
  return stone;
}

test('a stone must carry the canonical Hebrew name of its dimension', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).dimensionNameHebrew = 'שם אחר';
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('every metric of a stone is validated, not just one of them', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stone = stoneWithTwoMetrics(payload);
      stone.metrics[1].insightText = 'טקסט קצר מדי.';
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a stone with no metrics is refused even when its provenance agrees', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.metrics = [];
      stone.generationProvenance.sourceQuestionIds = [];
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a sixth recommendation is refused even when five of them are distinct', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stone = firstStone(payload);
      stone.recommendedInterventions = [
        ...stone.recommendedInterventions,
        { ...stone.recommendedInterventions[0] },
      ];
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('every recommendation of a stone is validated, not just one of them', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).recommendedInterventions[3].status = 'red';
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a recommendation summary must be the long narrative, not one sentence', () => {
  const error = refusal(
    payloadWith((payload) => {
      firstStone(payload).recommendedInterventions[2].summary =
        'המהלך המוצע מחזק שגרה משותפת וברורה בצוות.';
    }),
  );
  assert.match(error, /does not match AI analytics contract/);
});

test('a qualitative narrative runs from three hundred to five hundred characters', () => {
  const hebrew = (length: number) => `${'א'.repeat(length - 1)}.`;

  for (const length of [300, 500]) {
    const payload = createValidV6Payload(ROUND_ID);
    firstStone(payload).metrics[0].insightText = hebrew(length);
    assert.strictEqual(
      validateStoneMapResult(payload, ROUND_ID).ok,
      true,
      `a narrative of ${length} characters was refused`,
    );
  }

  for (const length of [299, 501]) {
    const error = refusal(
      payloadWith((payload) => {
        firstStone(payload).metrics[0].insightText = hebrew(length);
      }),
    );
    assert.match(
      error,
      /does not match AI analytics contract/,
      `a narrative of ${length} characters was accepted`,
    );
  }

  const padded = createValidV6Payload(ROUND_ID);
  firstStone(padded).metrics[0].insightText = `  ${hebrew(500)}  `;
  assert.strictEqual(
    validateStoneMapResult(padded, ROUND_ID).ok,
    true,
    'surrounding whitespace was counted toward the length',
  );
});

test('every paragraph of an overview must be a string of Hebrew prose', () => {
  const notAString = refusal(
    payloadWith((payload) => {
      firstStone(payload).summary[1] = 42;
    }),
  );
  assert.match(notAString, /does not match AI analytics contract/);

  const withNumbers = refusal(
    payloadWith((payload) => {
      firstStone(payload).summary[1] =
        'שישים אחוז מן המשיבים דיווחו על תחושה יציבה, ובמספרים זה 60.';
    }),
  );
  assert.match(withNumbers, /does not match AI analytics contract/);

  const withLatin = refusal(
    payloadWith((payload) => {
      firstStone(payload).summary[1] =
        'התשובות מצביעות על בסיס יציב, כפי שמראה הדוח של OECD.';
    }),
  );
  assert.match(withLatin, /does not match AI analytics contract/);
});

test('every paragraph of an overview must end where its last sentence ends', () => {
  const unterminated = refusal(
    payloadWith((payload) => {
      firstStone(payload).summary[2] =
        'התשובות מצביעות על בסיס יציב. ואפשר להמשיך משם';
    }),
  );
  assert.match(unterminated, /does not match AI analytics contract/);

  const padded = createValidV6Payload(ROUND_ID);
  firstStone(padded).summary[2] = `${firstStone(padded).summary[2]}   `;
  assert.strictEqual(
    validateStoneMapResult(padded, ROUND_ID).ok,
    true,
    'a paragraph was refused for trailing whitespace after its full stop',
  );
});

test('processedAt must be a string, not something that merely parses as a date', () => {
  const error = refusal(
    payloadWith((payload) => {
      (payload as Record<string, unknown>).processedAt = [
        '2026-08-02T08:00:00.000Z',
      ];
    }),
  );
  assert.match(error, /metadata is invalid/);
});

test('the eight dimensions are compared one by one, not counted', () => {
  const error = refusal(
    payloadWith((payload) => {
      const stones = payload.stones as Record<string, unknown>;
      stones['balance-2'] = stones.balance;
      delete stones.balance;
    }),
  );
  assert.match(error, /canonical dimensions/);
});
