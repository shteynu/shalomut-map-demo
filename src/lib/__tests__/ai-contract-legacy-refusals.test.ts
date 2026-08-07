import assert from 'node:assert';
import test from 'node:test';
import {
  AI_ANALYTICS_DIMENSION_IDS,
  AI_ANALYTICS_QUESTIONS,
  validateStoneMapResult,
} from '../ai-contract';
import {
  createValidV1Payload,
  createValidV2Payload,
  createValidV3Payload,
  LEGACY_SURVEY_DEFINITION_HASH,
} from './fixtures/legacy-payloads';

/**
 * One refusal per product rule the validator enforces on a callback that
 * declares a closed contract — `1.0`, `2.0` or `3.0`.
 *
 * `ai-contract-payload-refusals.test.ts` did this for `6.0` and left the older
 * versions with positive tests only. Mutation testing then reported the
 * consequence: about two thirds of the surviving mutants sat in
 * `isValidGenerationProvenance`, `isValidV3GenerationProvenance`,
 * `hasValidStoneShape`, `isLegacyMetric`, `isLegacyIntervention` and
 * `isValidQuestionMetric` — guards a mutant could delete while the suite
 * stayed green. These versions are not dead code: they are still listed in
 * `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` and still accepted on the
 * callback path.
 *
 * Each case starts from one valid payload and breaks exactly one thing, so a
 * failure names the rule that stopped holding rather than the fixture.
 */

const V1_ROUND_ID = 'round-v1';
const V2_ROUND_ID = 'round-v2';
const V3_ROUND_ID = 'round-v3';

type Payload = { stones: Record<string, Record<string, unknown>> };
type Stone = Record<string, any>;

function firstDimensionId(payload: Payload): string {
  return Object.keys(payload.stones)[0];
}

function firstStone(payload: Payload): Stone {
  return payload.stones[firstDimensionId(payload)];
}

function refusalFor(
  build: () => Payload,
  roundId: string,
  mutate: (payload: Payload) => void,
): string {
  const payload = build();
  mutate(payload);
  const result = validateStoneMapResult(payload, roundId);
  assert.strictEqual(
    result.ok,
    false,
    'the validator accepted a payload that breaks a contract rule',
  );
  return result.ok === false ? result.error : '';
}

const v1Refusal = (mutate: (payload: Payload) => void) =>
  refusalFor(createValidV1Payload, V1_ROUND_ID, mutate);
const v2Refusal = (mutate: (payload: Payload) => void) =>
  refusalFor(createValidV2Payload, V2_ROUND_ID, mutate);
const v3Refusal = (mutate: (payload: Payload) => void) =>
  refusalFor(createValidV3Payload, V3_ROUND_ID, mutate);

const STONE_REFUSED = /does not match AI analytics contract/;

test('the three valid fixtures are accepted, so every refusal below is about its one change', () => {
  assert.strictEqual(
    validateStoneMapResult(createValidV1Payload(), V1_ROUND_ID).ok,
    true,
  );
  assert.strictEqual(
    validateStoneMapResult(createValidV2Payload(), V2_ROUND_ID).ok,
    true,
  );
  assert.strictEqual(
    validateStoneMapResult(createValidV3Payload(), V3_ROUND_ID).ok,
    true,
  );
});

// --- The stone shape every version shares -----------------------------------

test('a stone must be a record that names its own dimension', () => {
  assert.match(
    v1Refusal((payload) => {
      payload.stones[firstDimensionId(payload)] = null as never;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).dimensionId = AI_ANALYTICS_DIMENSION_IDS[1];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).dimensionNameHebrew = 42;
    }),
    STONE_REFUSED,
  );
});

test('a stone status must be one of the three wellbeing statuses', () => {
  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).status = 'orange';
    }),
    STONE_REFUSED,
  );
});

test('a stone score must be a finite number inside the reportable range', () => {
  for (const score of ['60', Number.NaN, Number.POSITIVE_INFINITY, -1, 101]) {
    assert.match(
      v1Refusal((payload) => {
        firstStone(payload).score = score;
      }),
      STONE_REFUSED,
      `score ${String(score)} was accepted`,
    );
  }
});

test('a stone must carry an interpretation string and array-shaped contents', () => {
  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation = null;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).recommendedInterventions = 'none';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).metrics = { count: 2 };
    }),
    STONE_REFUSED,
  );
});

// --- Contract 1.0: the structural metric and intervention -------------------

test('a 1.0 metric must be a record with a string label and a string value', () => {
  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).metrics[0] = null;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).metrics[0].label = 7;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).metrics[0].value = 60;
    }),
    STONE_REFUSED,
  );
});

test('a 1.0 metric trend is optional, and a string when present', () => {
  const withoutTrend = createValidV1Payload();
  delete (firstStone(withoutTrend) as Stone).metrics[0].trend;
  assert.strictEqual(
    validateStoneMapResult(withoutTrend, V1_ROUND_ID).ok,
    true,
    'an absent trend is allowed on 1.0',
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).metrics[0].trend = { direction: 'up' };
    }),
    STONE_REFUSED,
  );
});

test('a 1.0 intervention must carry its identifying strings', () => {
  for (const field of ['id', 'source', 'title', 'summary']) {
    assert.match(
      v1Refusal((payload) => {
        firstStone(payload).recommendedInterventions[0][field] = 5;
      }),
      STONE_REFUSED,
      `a non-string ${field} was accepted`,
    );
  }
});

test('a 1.0 intervention must carry actionable steps as strings', () => {
  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].actionable_steps =
        'לקבוע זמן קבוע לשיחה קצרה עם הצוות.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].actionable_steps = [
        'לקבוע זמן קבוע לשיחה קצרה עם הצוות.',
        12,
      ];
    }),
    STONE_REFUSED,
  );
});

test('a 1.0 intervention belongs to the stone it is listed under', () => {
  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].dimensionId =
        AI_ANALYTICS_DIMENSION_IDS[1];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v1Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].dimensionId =
        'workload_balance';
    }),
    STONE_REFUSED,
  );
});

// --- Contract 2.0: the first semantic contract ------------------------------

test('a 2.0 stone must carry the canonical Hebrew name of its dimension', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).dimensionNameHebrew = 'שם אחר';
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 score and status must agree through the shared bands', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).score = 80;
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 interpretation must be Hebrew user-facing text', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'The team is stable. It needs attention.';
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 interpretation must be exactly two complete sentences', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב לצד שונות בין המשתתפים.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב. כדאי לבחון זאת יחד עם הצוות. אפשר לחזור לנושא בהמשך.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב. כדאי לבחון זאת יחד עם הצוות ולהמשיך משם';
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 stone must carry one metric for each canonical question of its dimension', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics = firstStone(payload).metrics.slice(0, 2);
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      const stone = firstStone(payload);
      stone.metrics = [...stone.metrics, { ...stone.metrics[0] }];
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 metric must name a canonical question and echo its text', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].questionId = 'balance-9';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].label = AI_ANALYTICS_QUESTIONS[23].textHebrew;
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 metric value and trend must be Hebrew user-facing text', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].value = 'Moderate trend';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].trend = 'stable';
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 metric average score must be a finite number inside the reportable range', () => {
  for (const averageScore of ['60', Number.NaN, -1, 101]) {
    assert.match(
      v2Refusal((payload) => {
        firstStone(payload).metrics[0].averageScore = averageScore;
      }),
      STONE_REFUSED,
      `average score ${String(averageScore)} was accepted`,
    );
  }
});

test('a 2.0 metric must describe at least one whole response', () => {
  for (const responseCount of [0, -1, 10.5, '10']) {
    assert.match(
      v2Refusal((payload) => {
        firstStone(payload).metrics[0].responseCount = responseCount;
      }),
      STONE_REFUSED,
      `response count ${String(responseCount)} was accepted`,
    );
  }
});

test('a 2.0 intervention carries the status of the stone it is listed under', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].status = 'red';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      delete firstStone(payload).recommendedInterventions[0].status;
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 intervention must be written in Hebrew, steps included', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].title = 'Focused team move';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].summary =
        'The proposed move strengthens a shared routine.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].actionable_steps = [];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].actionable_steps[1] =
        'Collect feedback and review progress together.';
    }),
    STONE_REFUSED,
  );
});

// --- Contract 2.0 provenance ------------------------------------------------

test('a 2.0 stone must say how it was generated', () => {
  assert.match(
    v2Refusal((payload) => {
      delete firstStone(payload).generationProvenance;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).generationProvenance.outcome = 'handwritten';
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 stone cannot report the absence of an interpretation', () => {
  assert.match(
    v2Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.outcome = 'unavailable';
      provenance.attempts = 0;
      provenance.retryCount = 0;
    }),
    STONE_REFUSED,
  );
});

test('2.0 attempts and retries must be whole, non-negative and consistent', () => {
  for (const attempts of ['1', 1.5, -1]) {
    assert.match(
      v2Refusal((payload) => {
        firstStone(payload).generationProvenance.attempts = attempts;
      }),
      STONE_REFUSED,
      `attempts ${String(attempts)} was accepted`,
    );
  }

  for (const retryCount of ['0', 0.5, -1]) {
    assert.match(
      v2Refusal((payload) => {
        firstStone(payload).generationProvenance.retryCount = retryCount;
      }),
      STONE_REFUSED,
      `retry count ${String(retryCount)} was accepted`,
    );
  }

  assert.match(
    v2Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.attempts = 2;
      provenance.retryCount = 2;
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 stone claiming model copy must have attempted the model', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).generationProvenance.attempts = 0;
    }),
    STONE_REFUSED,
  );

  const fallback = createValidV2Payload();
  const provenance = firstStone(fallback).generationProvenance;
  provenance.outcome = 'deterministic_fallback';
  provenance.attempts = 0;
  provenance.retryCount = 0;
  assert.strictEqual(
    validateStoneMapResult(fallback, V2_ROUND_ID).ok,
    true,
    'a deterministic fallback that never called the model is allowed',
  );
});

test('2.0 provenance must name exactly the canonical questions of its dimension', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).generationProvenance.sourceQuestionIds = 'balance-1';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).generationProvenance.sourceQuestionIds = [1, 2, 3];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.sourceQuestionIds = provenance.sourceQuestionIds.slice(0, 2);
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.sourceQuestionIds = [
        ...provenance.sourceQuestionIds.slice(0, 2),
        'meaning-1',
      ];
    }),
    STONE_REFUSED,
  );

  const reordered = createValidV2Payload();
  const reorderedProvenance = firstStone(reordered).generationProvenance;
  reorderedProvenance.sourceQuestionIds = [
    ...reorderedProvenance.sourceQuestionIds,
  ].reverse();
  assert.strictEqual(
    validateStoneMapResult(reordered, V2_ROUND_ID).ok,
    true,
    'the same question IDs in another order are the same questions',
  );
});

// --- Contract 3.0: the round's own questionnaire -----------------------------

test('a 3.0 stone must be grounded in at least one round question', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics = [];
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 metric must name a round question and describe it in Hebrew', () => {
  for (const questionId of ['', '   ', 7]) {
    assert.match(
      v3Refusal((payload) => {
        firstStone(payload).metrics[0].questionId = questionId;
      }),
      STONE_REFUSED,
      `question id ${JSON.stringify(questionId)} was accepted`,
    );
  }

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].label = 'How stable this area feels';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].value = 'Moderate trend';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].trend = 'stable';
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 metric average score and response count keep the 2.0 rules', () => {
  for (const averageScore of ['60', Number.NaN, -1, 101]) {
    assert.match(
      v3Refusal((payload) => {
        firstStone(payload).metrics[0].averageScore = averageScore;
      }),
      STONE_REFUSED,
      `average score ${String(averageScore)} was accepted`,
    );
  }

  for (const responseCount of [0, 10.5, '10']) {
    assert.match(
      v3Refusal((payload) => {
        firstStone(payload).metrics[0].responseCount = responseCount;
      }),
      STONE_REFUSED,
      `response count ${String(responseCount)} was accepted`,
    );
  }
});

test('a 3.0 stone cannot report the same question twice', () => {
  assert.match(
    v3Refusal((payload) => {
      const stone = firstStone(payload);
      stone.metrics[1].questionId = stone.metrics[0].questionId;
      stone.generationProvenance.sourceQuestionIds = [
        stone.metrics[0].questionId,
        stone.metrics[0].questionId,
      ];
    }),
    STONE_REFUSED,
  );
});

test('3.0 provenance must name exactly the questions the stone reports', () => {
  assert.match(
    v3Refusal((payload) => {
      const stone = firstStone(payload);
      stone.generationProvenance.sourceQuestionIds = [
        stone.metrics[0].questionId,
      ];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      const stone = firstStone(payload);
      stone.generationProvenance.sourceQuestionIds = [
        stone.metrics[0].questionId,
        'round-question-99-z',
      ];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      const stone = firstStone(payload);
      stone.generationProvenance.sourceQuestionIds = [
        stone.metrics[0].questionId,
        stone.metrics[0].questionId,
      ];
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.sourceQuestionIds = 'round-question-1-a';
    }),
    STONE_REFUSED,
  );
});

test('3.0 provenance must be bound to the questionnaire snapshot the payload declares', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.surveyDefinitionHash =
        `sha256:${'c'.repeat(64)}`;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      delete firstStone(payload).generationProvenance.surveyDefinitionHash;
    }),
    STONE_REFUSED,
  );

  assert.strictEqual(
    LEGACY_SURVEY_DEFINITION_HASH,
    `sha256:${'b'.repeat(64)}`,
    'the fixture hash is the one the stones are bound to',
  );
});

test('3.0 provenance keeps the outcome, attempt and retry rules of 2.0', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.outcome = 'handwritten';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.outcome = 'unavailable';
      provenance.attempts = 0;
      provenance.retryCount = 0;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.attempts = 0;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.attempts = 1.5;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.attempts = 2;
      provenance.retryCount = 2;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.retryCount = -1;
    }),
    STONE_REFUSED,
  );
});

test('3.0 provenance may say whether background context was included, and only as a boolean', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).generationProvenance.backgroundContextIncluded = 'yes';
    }),
    STONE_REFUSED,
  );

  const absent = createValidV3Payload();
  delete firstStone(absent).generationProvenance.backgroundContextIncluded;
  assert.strictEqual(
    validateStoneMapResult(absent, V3_ROUND_ID).ok,
    true,
    'a round analysed before the field existed carries none',
  );
});

// --- The boundaries of the ranges, from the accepting side -------------------

test('the reportable score range includes both of its ends', () => {
  for (const score of [0, 100]) {
    const payload = createValidV1Payload();
    firstStone(payload).score = score;
    assert.strictEqual(
      validateStoneMapResult(payload, V1_ROUND_ID).ok,
      true,
      `score ${score} was refused`,
    );
  }
});

test('a 2.0 metric average may sit at either end of the range', () => {
  for (const averageScore of [0, 100]) {
    const payload = createValidV2Payload();
    firstStone(payload).metrics[0].averageScore = averageScore;
    assert.strictEqual(
      validateStoneMapResult(payload, V2_ROUND_ID).ok,
      true,
      `average score ${averageScore} was refused`,
    );
  }
});

test('a 2.0 metric value and trend must be strings before they are Hebrew', () => {
  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].value = 60;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v2Refusal((payload) => {
      firstStone(payload).metrics[0].trend = 1;
    }),
    STONE_REFUSED,
  );
});

test('a 2.0 fallback stone still cannot report a negative number of attempts', () => {
  assert.match(
    v2Refusal((payload) => {
      const provenance = firstStone(payload).generationProvenance;
      provenance.outcome = 'deterministic_fallback';
      provenance.attempts = -1;
      provenance.retryCount = 0;
    }),
    STONE_REFUSED,
  );
});

// --- Contract 3.0: the rules it shares with 2.0 -----------------------------

test('a 3.0 stone must carry the canonical Hebrew name of its dimension', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).dimensionNameHebrew = 'שם אחר';
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 score and status must agree through the shared bands', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).score = 80;
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 interpretation must be two complete Hebrew sentences', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'The team is stable. It needs attention.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב לצד שונות בין המשתתפים.';
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 metric label, value and trend must be strings before they are Hebrew', () => {
  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].label = 12;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].value = 60;
    }),
    STONE_REFUSED,
  );

  assert.match(
    v3Refusal((payload) => {
      firstStone(payload).metrics[0].trend = 1;
    }),
    STONE_REFUSED,
  );
});

test('a 3.0 stone with no metrics is refused even when its provenance agrees', () => {
  assert.match(
    v3Refusal((payload) => {
      const stone = firstStone(payload);
      stone.metrics = [];
      stone.generationProvenance.sourceQuestionIds = [];
    }),
    STONE_REFUSED,
  );
});

test('3.0 provenance must be a record', () => {
  for (const provenance of ['llm', ['llm'], undefined]) {
    assert.match(
      v3Refusal((payload) => {
        firstStone(payload).generationProvenance = provenance;
      }),
      STONE_REFUSED,
      `provenance ${JSON.stringify(provenance)} was accepted`,
    );
  }
});

test('a 3.0 stone may be catalog copy that never called the model', () => {
  const payload = createValidV3Payload();
  const provenance = firstStone(payload).generationProvenance;
  provenance.outcome = 'deterministic_fallback';
  provenance.attempts = 0;
  provenance.retryCount = 0;
  assert.strictEqual(
    validateStoneMapResult(payload, V3_ROUND_ID).ok,
    true,
    'a deterministic fallback with no attempt is a shape 3.0 describes',
  );
});

test('a 3.0 stone may report a retry, up to one fewer than its attempts', () => {
  const retried = createValidV3Payload();
  const provenance = firstStone(retried).generationProvenance;
  provenance.attempts = 2;
  provenance.retryCount = 1;
  assert.strictEqual(
    validateStoneMapResult(retried, V3_ROUND_ID).ok,
    true,
    'two attempts with one retry was refused',
  );
});

test('a dynamic payload hash must be the whole hash and nothing around it', () => {
  for (const hash of [
    `xsha256:${'b'.repeat(64)}`,
    `sha256:${'b'.repeat(64)}x`,
    `sha256:${'b'.repeat(63)}`,
    `SHA256:${'b'.repeat(64)}`,
  ]) {
    assert.match(
      v3Refusal((payload) => {
        (payload as Record<string, unknown>).surveyDefinitionHash = hash;
      }),
      /require a valid surveyDefinitionHash/,
      `hash ${hash} was accepted`,
    );
  }
});

test('a closed contract cannot declare a partial map', () => {
  assert.match(
    v3Refusal((payload) => {
      (payload as Record<string, unknown>).dimensionsWithoutInterpretation = [];
    }),
    /only supported by contracts with partial maps/,
  );
});
