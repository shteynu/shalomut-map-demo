import assert from 'node:assert';
import test from 'node:test';
import { validateStoneMapResult } from '../ai-contract';
import {
  createPartialV5Payload,
  createValidV5Payload,
  V5_SURVEY_DEFINITION_HASH,
} from './fixtures/v5-payload';

/**
 * One refusal per product rule contract `5.0` adds or tightens, plus the
 * payload-level rules every version shares.
 *
 * `6.0` got this treatment on 2026-08-03 and `1.0`–`3.0` on 2026-08-07. `5.0`
 * was left with tests that prove a valid payload is accepted, so the mutation
 * report placed its largest remaining block of survivors in
 * `isValidV5GenerationProvenance`, `isValidV5Stone` and
 * `validateInterpretationGaps` — the distribution echoed back for Core to
 * check, the adaptation outcome on every recommendation, and the partial map.
 *
 * Each case starts from one valid payload and breaks exactly one thing. Where
 * a rule has two sides, the accepting side is here too: a range end, an
 * optional field left out, the same identifiers in another order. A suite that
 * only refuses would pass a validator that refuses everything.
 */

const ROUND_ID = 'round-v5';

type Payload = ReturnType<typeof createValidV5Payload>;

function firstDimensionId(payload: Payload): string {
  return Object.keys(payload.stones)[0];
}

function firstStone(payload: Payload): Record<string, any> {
  return payload.stones[firstDimensionId(payload)];
}

function provenanceOf(payload: Payload): Record<string, any> {
  return firstStone(payload).generationProvenance;
}

function errorOf(payload: unknown): string {
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(
    result.ok,
    false,
    'the validator accepted a payload that breaks a contract rule',
  );
  return result.ok === false ? result.error : '';
}

function refusal(mutate: (payload: Payload) => void): string {
  const payload = createValidV5Payload(ROUND_ID);
  mutate(payload);
  return errorOf(payload);
}

function accepts(message: string, mutate: (payload: Payload) => void): void {
  const payload = createValidV5Payload(ROUND_ID);
  mutate(payload);
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(result.ok, true, `${message}: ${
    result.ok === false ? result.error : ''
  }`);
}

const STONE_REFUSED = /does not match AI analytics contract/;

test('the valid fixtures are accepted, so every refusal below is about its one change', () => {
  assert.strictEqual(
    validateStoneMapResult(createValidV5Payload(ROUND_ID), ROUND_ID).ok,
    true,
  );
  assert.strictEqual(
    validateStoneMapResult(
      createPartialV5Payload(['balance', 'meaning'], ROUND_ID),
      ROUND_ID,
    ).ok,
    true,
  );
});

// --- The stone -------------------------------------------------------------

test('a 5.0 stone keeps the shape every version requires', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).score = 101;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation = null;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).dimensionNameHebrew = 'שם אחר';
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).score = 80;
    }),
    STONE_REFUSED,
  );
});

test('a 5.0 stone must be grounded in at least one question metric', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics = [];
      provenanceOf(payload).sourceQuestionIds = [];
    }),
    STONE_REFUSED,
  );
});

test('every metric of a 5.0 stone is validated, not just one of them', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[1].value = 'Moderate trend';
    }),
    STONE_REFUSED,
  );
});

test('a 5.0 interpretation may run from two to five sentences', () => {
  accepts('five sentences were refused', (payload) => {
    firstStone(payload).psychologicalInterpretation =
      'התשובות מצביעות על בסיס יציב. נראה כי השיח המשותף מסייע. כדאי לבחור צעד ממוקד. אפשר לבדוק אותו בהמשך. הצוות יוכל להחליט יחד.';
  });

  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב לצד שונות בין המשתתפים.';
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב. נראה כי השיח המשותף מסייע. כדאי לבחור צעד ממוקד. אפשר לבדוק אותו בהמשך. הצוות יוכל להחליט יחד. זהו המשפט השישי.';
    }),
    STONE_REFUSED,
  );
});

test('a 5.0 interpretation must be whole sentences all the way to its end', () => {
  // Three sentences and a fragment: inside the two-to-five range, so only the
  // rule that the sentences account for the whole text can refuse it.
  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב. נראה כי השיח המשותף מסייע. כדאי לבחור צעד ממוקד. ואפשר להמשיך משם';
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'התשובות מצביעות על בסיס יציב. נראה כי השיח המשותף מסייע לצוות ואפשר להמשיך משם';
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).psychologicalInterpretation =
        'The answers point to a stable base. The shared conversation helps.';
    }),
    STONE_REFUSED,
  );
});

// --- What 5.0 adds to a metric: the distribution ----------------------------

test('a 5.0 metric must echo back the distribution it was given', () => {
  assert.match(
    refusal((payload) => {
      delete firstStone(payload).metrics[0].scoreDistribution;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scoreDistribution = { green: 6, yellow: 10 };
    }),
    STONE_REFUSED,
  );
});

test('a 5.0 distribution must account for exactly the responses the metric counts', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scoreDistribution = {
        green: 6,
        yellow: 10,
        red: 3,
      };
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].responseCount = 21;
    }),
    STONE_REFUSED,
  );
});

test('a 5.0 distribution counts whole respondents in every band', () => {
  // The three still sum to the response count, so only the wholeness rule can
  // refuse these.
  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scoreDistribution = {
        green: 6,
        yellow: 9.5,
        red: 4.5,
      };
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scoreDistribution = {
        green: 6.5,
        yellow: 9.5,
        red: 4,
      };
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).metrics[0].scoreDistribution = {
        green: -1,
        yellow: 17,
        red: 4,
      };
    }),
    STONE_REFUSED,
  );

  accepts('an empty band was refused', (payload) => {
    firstStone(payload).metrics[0].scoreDistribution = {
      green: 0,
      yellow: 16,
      red: 4,
    };
  });
});

// --- What 5.0 adds to a recommendation: the adaptation outcome --------------

test('a 5.0 recommendation must say whether it was rewritten or is catalog copy', () => {
  assert.match(
    refusal((payload) => {
      delete firstStone(payload).recommendedInterventions[0].adaptationOutcome;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).recommendedInterventions[0].adaptationOutcome =
        'rewritten';
    }),
    STONE_REFUSED,
  );

  accepts('catalog copy was refused', (payload) => {
    for (const intervention of firstStone(payload).recommendedInterventions) {
      intervention.adaptationOutcome = 'deterministic_fallback';
    }
  });
});

test('a 5.0 recommendation keeps the Hebrew and status rules of 2.0', () => {
  assert.match(
    refusal((payload) => {
      firstStone(payload).recommendedInterventions[1].status = 'red';
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      firstStone(payload).recommendedInterventions[1].title = 'Focused team move';
    }),
    STONE_REFUSED,
  );
});

// --- Provenance -------------------------------------------------------------

test('5.0 provenance must be a record', () => {
  for (const provenance of ['llm', ['llm'], undefined, 42]) {
    assert.match(
      refusal((payload) => {
        firstStone(payload).generationProvenance = provenance;
      }),
      STONE_REFUSED,
      `provenance ${JSON.stringify(provenance)} was accepted`,
    );
  }
});

test('5.0 attempts and retries must be whole, non-negative and consistent', () => {
  accepts('a fallback that never called the model was refused', (payload) => {
    const provenance = provenanceOf(payload);
    provenance.outcome = 'deterministic_fallback';
    provenance.attempts = 0;
    provenance.retryCount = 0;
  });

  assert.match(
    refusal((payload) => {
      const provenance = provenanceOf(payload);
      provenance.outcome = 'deterministic_fallback';
      provenance.attempts = -1;
      provenance.retryCount = 0;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      provenanceOf(payload).attempts = 0;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      const provenance = provenanceOf(payload);
      provenance.attempts = 2;
      provenance.retryCount = 2;
    }),
    STONE_REFUSED,
  );

  accepts('one retry out of two attempts was refused', (payload) => {
    const provenance = provenanceOf(payload);
    provenance.attempts = 2;
    provenance.retryCount = 1;
  });
});

test('5.0 provenance must name exactly the questions its stone reports', () => {
  assert.match(
    refusal((payload) => {
      const provenance = provenanceOf(payload);
      provenance.sourceQuestionIds = provenance.sourceQuestionIds.slice(0, 1);
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      const provenance = provenanceOf(payload);
      provenance.sourceQuestionIds = [
        provenance.sourceQuestionIds[0],
        'round-question-99-z',
      ];
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      provenanceOf(payload).sourceQuestionIds = 'round-question-1-a';
    }),
    STONE_REFUSED,
  );

  accepts('the same question IDs in another order were refused', (payload) => {
    const provenance = provenanceOf(payload);
    provenance.sourceQuestionIds = [...provenance.sourceQuestionIds].reverse();
  });
});

test('5.0 provenance must be bound to the questionnaire snapshot the payload declares', () => {
  assert.match(
    refusal((payload) => {
      provenanceOf(payload).surveyDefinitionHash = `sha256:${'e'.repeat(64)}`;
    }),
    STONE_REFUSED,
  );

  assert.match(
    refusal((payload) => {
      delete provenanceOf(payload).surveyDefinitionHash;
    }),
    STONE_REFUSED,
  );

  assert.strictEqual(
    V5_SURVEY_DEFINITION_HASH,
    `sha256:${'d'.repeat(64)}`,
    'the fixture hash is the one the stones are bound to',
  );
});

test('the context flags of 5.0 provenance are optional, and booleans when present', () => {
  for (const field of [
    'backgroundContextIncluded',
    'distributionIncluded',
    'crossDimensionContextIncluded',
  ]) {
    assert.match(
      refusal((payload) => {
        provenanceOf(payload)[field] = 'yes';
      }),
      STONE_REFUSED,
      `a non-boolean ${field} was accepted`,
    );

    accepts(`an absent ${field} was refused`, (payload) => {
      delete provenanceOf(payload)[field];
    });
  }
});

test('a 5.0 stone cannot label metric narratives it does not carry', () => {
  assert.match(
    refusal((payload) => {
      provenanceOf(payload).metricInsightsOutcome = 'llm';
    }),
    STONE_REFUSED,
  );
});

// --- The gap: a stone with no interpretation --------------------------------

test('an unavailable 5.0 stone carries no interpretation at all', () => {
  const payload = createPartialV5Payload(['balance'], ROUND_ID);
  payload.stones.balance.psychologicalInterpretation =
    'התשובות מצביעות על בסיס יציב. נראה כי השיח המשותף מסייע לצוות.';
  const result = validateStoneMapResult(payload, ROUND_ID);
  assert.strictEqual(
    result.ok,
    false,
    'a stone claimed both that nothing was generated and that this is the copy',
  );
});

test('an interpretation gap may say why, and only in the words the contract has', () => {
  const unknownReason = createPartialV5Payload(['balance'], ROUND_ID);
  unknownReason.stones.balance.generationProvenance.unavailableReason =
    'model_was_tired';
  assert.strictEqual(
    validateStoneMapResult(unknownReason, ROUND_ID).ok,
    false,
    'an invented reason was accepted',
  );

  const noReason = createPartialV5Payload(['balance'], ROUND_ID);
  delete noReason.stones.balance.generationProvenance.unavailableReason;
  assert.strictEqual(
    validateStoneMapResult(noReason, ROUND_ID).ok,
    true,
    'a round analysed before the reason existed carries none',
  );
});

test('a reason belongs to an absence and to nothing else', () => {
  assert.match(
    refusal((payload) => {
      provenanceOf(payload).unavailableReason = 'provider_unavailable';
    }),
    STONE_REFUSED,
  );
});

test('a partial 5.0 map must declare exactly the stones that have no interpretation', () => {
  const undeclared = createPartialV5Payload(['balance'], ROUND_ID);
  delete (undeclared as Record<string, unknown>).dimensionsWithoutInterpretation;
  assert.match(
    errorOf(undeclared),
    /must be listed in dimensionsWithoutInterpretation/,
  );

  const tooMany = createPartialV5Payload(['balance'], ROUND_ID);
  (tooMany as Record<string, unknown>).dimensionsWithoutInterpretation = [
    'balance',
    'meaning',
  ];
  assert.match(
    errorOf(tooMany),
    /exactly the stones whose outcome is unavailable/,
  );

  const wrongOne = createPartialV5Payload(['balance'], ROUND_ID);
  (wrongOne as Record<string, unknown>).dimensionsWithoutInterpretation = [
    'meaning',
  ];
  assert.match(
    errorOf(wrongOne),
    /exactly the stones whose outcome is unavailable/,
  );

  const notStrings = createPartialV5Payload(['balance'], ROUND_ID);
  (notStrings as Record<string, unknown>).dimensionsWithoutInterpretation = [7];
  assert.match(
    errorOf(notStrings),
    /exactly the stones whose outcome is unavailable/,
  );

  // The same number of dimensions, one of them the wrong one: only a
  // member-by-member comparison can tell this from the truth.
  const rightCountWrongMember = createPartialV5Payload(
    ['balance', 'meaning'],
    ROUND_ID,
  );
  (rightCountWrongMember as Record<string, unknown>).dimensionsWithoutInterpretation =
    ['balance', 'certainty'];
  assert.match(
    errorOf(rightCountWrongMember),
    /exactly the stones whose outcome is unavailable/,
  );

  const reordered = createPartialV5Payload(['balance', 'meaning'], ROUND_ID);
  (reordered as Record<string, unknown>).dimensionsWithoutInterpretation = [
    'meaning',
    'balance',
  ];
  assert.strictEqual(
    validateStoneMapResult(reordered, ROUND_ID).ok,
    true,
    'the same dimensions in another order are the same dimensions',
  );
});

test('a round with no interpretation anywhere is a failure, not a partial map', () => {
  const everything = createPartialV5Payload(
    Object.keys(createValidV5Payload(ROUND_ID).stones),
    ROUND_ID,
  );
  assert.match(
    errorOf(everything),
    /is a failure, not a partial map/,
  );
});

// --- The payload around the stones ------------------------------------------

test('a callback payload must be a JSON object', () => {
  for (const payload of [null, 'payload', ['payload'], 42]) {
    const result = validateStoneMapResult(payload, ROUND_ID);
    assert.strictEqual(
      result.ok,
      false,
      `${JSON.stringify(payload)} was accepted as a payload`,
    );
  }
});

test('a successful payload must say when it was processed', () => {
  for (const processedAt of [undefined, 'yesterday', 20260801]) {
    assert.match(
      refusal((payload) => {
        (payload as Record<string, unknown>).processedAt = processedAt;
      }),
      /metadata is invalid/,
      `processedAt ${JSON.stringify(processedAt)} was accepted`,
    );
  }
});

test('a map must carry the eight canonical dimensions and no others', () => {
  assert.match(
    refusal((payload) => {
      payload.stones.wellbeing = payload.stones.balance;
    }),
    /canonical dimensions/,
  );

  assert.match(
    refusal((payload) => {
      delete payload.stones.balance;
    }),
    /canonical dimensions/,
  );
});

test('the status fields of a payload must be a boolean lock and a known status', () => {
  assert.match(
    refusal((payload) => {
      (payload as Record<string, unknown>).isLocked = 'false';
    }),
    /status fields are invalid/,
  );

  assert.match(
    refusal((payload) => {
      (payload as Record<string, unknown>).status = 'partial';
    }),
    /status fields are invalid/,
  );
});

test('a failed analysis is reported as a payload, not refused as one', () => {
  const payload = createValidV5Payload(ROUND_ID) as Record<string, unknown>;
  payload.status = 'validation_failed';
  payload.isLocked = false;
  payload.errorMessage = 'הניתוח נכשל';
  delete payload.stones;
  delete payload.overallPsychologicalSummary;
  assert.strictEqual(
    validateStoneMapResult(payload, ROUND_ID).ok,
    true,
    'an unlocked failure was refused, so the screen would have no failure to show',
  );
});

test('a locked_error payload must actually be locked', () => {
  assert.match(
    refusal((payload) => {
      const record = payload as Record<string, unknown>;
      record.status = 'locked_error';
      record.isLocked = false;
      delete record.stones;
      delete record.overallPsychologicalSummary;
    }),
    /must set isLocked to true/,
  );
});
