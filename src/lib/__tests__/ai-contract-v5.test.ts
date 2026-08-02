import assert from 'node:assert';
import test, { describe } from 'node:test';
import {
  AI_ANALYTICS_V5_CONTRACT_VERSION,
  isValidScoreDistribution,
  validateStoneMapResult,
} from '../ai-contract';

function createValidV5Payload() {
  return {
    contractVersion: '5.0',
    roundId: 'round-v5-test',
    status: 'success',
    isLocked: false,
    processedAt: '2026-07-27T12:00:00.000Z',
    surveyDefinitionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    overallPsychologicalSummary: 'הסקר מציג תמונה מקיפה של בית הספר. המדים השונים מראים שונות רבה.',
    stones: {
      'self-expression': createValidStone('self-expression'),
      'professional-competence': createValidStone('professional-competence'),
      'social-resource': createValidStone('social-resource'),
      balance: createValidStone('balance'),
      'management-support': createValidStone('management-support'),
      certainty: createValidStone('certainty'),
      'organizational-climate': createValidStone('organizational-climate'),
      meaning: createValidStone('meaning'),
    },
  };
}

function createValidStone(dimensionId: string) {
  const nameMap: Record<string, string> = {
    'self-expression': 'ביטוי עצמי',
    'professional-competence': 'מסוגלות מקצועית',
    'social-resource': 'קשרים חברתיים',
    balance: 'איזון',
    'management-support': 'עורף מקצועי',
    certainty: 'ודאות',
    'organizational-climate': 'אקלים ארגוני',
    meaning: 'משמעות',
  };

  return {
    dimensionId,
    dimensionNameHebrew: nameMap[dimensionId],
    status: 'green',
    score: 80,
    psychologicalInterpretation: 'תחושת הביטחון של צוות ההוראה גבוהה במיוחד. התקשורת הפתוחה בין המורים תורמת לתחושת השייכות והצמיחה.',
    recommendedInterventions: [
      {
        id: 'int-1',
        dimensionId,
        status: 'green',
        source: 'OECD',
        title: 'שימור תקשורת פתוחה',
        summary: 'חיזוק מעגלי שיח בצוות',
        actionable_steps: ['מפגש שבועי לקבוצות קטנות'],
        adaptationOutcome: 'llm',
      },
    ],
    metrics: [
      {
        questionId: `q-${dimensionId}-1`,
        label: 'שאלה לדוגמה בעברית',
        value: 'תוצאה טובה בעברית',
        averageScore: 80,
        responseCount: 20,
        scoreDistribution: { green: 14, yellow: 4, red: 2 },
      },
    ],
    generationProvenance: {
      outcome: 'llm',
      attempts: 1,
      retryCount: 0,
      sourceQuestionIds: [`q-${dimensionId}-1`],
      surveyDefinitionHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      backgroundContextIncluded: true,
      distributionIncluded: true,
      crossDimensionContextIncluded: true,
    },
  };
}

describe('Contract 5.0 Validation Tests', () => {
  test('isValidScoreDistribution validates exact sum matching responseCount', () => {
    assert.strictEqual(
      isValidScoreDistribution({ green: 10, yellow: 5, red: 5 }, 20),
      true,
    );
    assert.strictEqual(
      isValidScoreDistribution({ green: 10, yellow: 5, red: 4 }, 20),
      false,
    );
    assert.strictEqual(
      isValidScoreDistribution({ green: -1, yellow: 10, red: 11 }, 20),
      false,
    );
    for (const distribution of [
      { green: 0, yellow: 10, red: 10 },
      { green: 10, yellow: 0, red: 10 },
      { green: 10, yellow: 10, red: 0 },
    ]) {
      assert.strictEqual(
        isValidScoreDistribution(distribution, 20),
        true,
        JSON.stringify(distribution),
      );
    }
  });

  test('validateStoneMapResult accepts valid 5.0 payload', () => {
    const payload = createValidV5Payload();
    const result = validateStoneMapResult(payload, 'round-v5-test');
    if (!result.ok) {
      console.error('Validation error:', result.error);
    }
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.contractVersion, AI_ANALYTICS_V5_CONTRACT_VERSION);
    }
  });

  test('validateStoneMapResult accepts 3-sentence psychological interpretation in 5.0', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].psychologicalInterpretation =
      'תחושת האיזון נמצאת במגמת שיפור. המורים מדווחים על עומס מסוים בסוף השבוע. מומלץ לבחון את חלוקת המשימות הארגונית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });

  test('validateStoneMapResult rejects 6-sentence psychological interpretation in 5.0', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].psychologicalInterpretation =
      'משפט ראשון בעברית. משפט שני בעברית. משפט שלישי בעברית. משפט רביעי בעברית. משפט חמישי בעברית. משפט שישי בעברית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects overall summary with 5 sentences in 5.0', () => {
    const payload = createValidV5Payload();
    payload.overallPsychologicalSummary =
      'משפט ראשון בעברית. משפט שני בעברית. משפט שלישי בעברית. משפט רביעי בעברית. משפט חמישי בעברית.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('v4 payload continues to validate correctly without regression', () => {
    const payload = createValidV5Payload();
    payload.contractVersion = '4.0';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });

  test('validateStoneMapResult accepts catalog copy declared as such in 5.0', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].recommendedInterventions[0].adaptationOutcome =
      'deterministic_fallback';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });

  test('validateStoneMapResult rejects an intervention with no adaptation outcome in 5.0', () => {
    const payload = createValidV5Payload();
    delete (
      payload.stones['balance'].recommendedInterventions[0] as {
        adaptationOutcome?: string;
      }
    ).adaptationOutcome;
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects an invented adaptation outcome in 5.0', () => {
    const payload = createValidV5Payload();
    (
      payload.stones['balance'].recommendedInterventions[0] as {
        adaptationOutcome?: string;
      }
    ).adaptationOutcome = 'adapted';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects a locked 5.0 result that still carries stones', () => {
    // The output mirror of the input rule the Python parser enforces: below the
    // privacy threshold a distribution could point at one respondent, so a
    // locked payload may not carry the details at all.
    const payload = createValidV5Payload();
    payload.isLocked = true;
    payload.status = 'locked_error';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult accepts a locked 5.0 result without details', () => {
    const result = validateStoneMapResult(
      {
        contractVersion: '5.0',
        roundId: 'round-v5-test',
        surveyDefinitionHash:
          'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        isLocked: true,
        status: 'locked_error',
        errorMessage: 'התוצאות נעולות עד למספר המשיבים הנדרש.',
      },
      'round-v5-test',
    );
    assert.strictEqual(result.ok, true);
  });

  test('validateStoneMapResult rejects a 5.0 metric with no distribution', () => {
    const payload = createValidV5Payload();
    delete (
      payload.stones['balance'].metrics[0] as {
        scoreDistribution?: unknown;
      }
    ).scoreDistribution;
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects a 5.0 distribution that misses the response count', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].metrics[0].scoreDistribution = {
      green: 14,
      yellow: 4,
      red: 1,
    };
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('validateStoneMapResult rejects a fractional 5.0 distribution bucket', () => {
    const payload = createValidV5Payload();
    payload.stones['balance'].metrics[0].scoreDistribution = {
      green: 13.5,
      yellow: 4.5,
      red: 2,
    };
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('the metric distribution is a 5.0 rule and does not reach 4.0', () => {
    const payload = createValidV5Payload();
    payload.contractVersion = '4.0';
    delete (
      payload.stones['balance'].metrics[0] as {
        scoreDistribution?: unknown;
      }
    ).scoreDistribution;
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });

  test('the adaptation outcome is a 5.0 rule and does not reach 4.0', () => {
    const payload = createValidV5Payload();
    payload.contractVersion = '4.0';
    delete (
      payload.stones['balance'].recommendedInterventions[0] as {
        adaptationOutcome?: string;
      }
    ).adaptationOutcome;
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, true);
  });
});

/**
 * A partial map: the round finished, and one dimension's interpretation is
 * missing because the provider never wrote it.
 *
 * Before this, one dead dimension out of eight discarded the seven that had
 * answered and the manager saw nothing. The gap is stated rather than filled:
 * a stone carrying heuristic text under a provenance that says nothing was
 * generated would be the fallback posing as analysis.
 */
function withUnavailableDimensions(dimensionIds: string[]) {
  const payload = createValidV5Payload();
  for (const dimensionId of dimensionIds) {
    const stone = payload.stones[dimensionId as keyof typeof payload.stones];
    stone.psychologicalInterpretation = '';
    stone.generationProvenance.outcome = 'unavailable';
    stone.generationProvenance.attempts = 2;
    stone.generationProvenance.retryCount = 1;
  }
  return {
    ...payload,
    dimensionsWithoutInterpretation: [...dimensionIds].sort(),
  };
}

describe('Contract 5.0 partial maps', () => {
  test('a stone the provider never wrote is accepted when it says so', () => {
    const result = validateStoneMapResult(
      withUnavailableDimensions(['certainty']),
      'round-v5-test',
    );
    if (!result.ok) console.error('Validation error:', result.error);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.deepStrictEqual(result.value.dimensionsWithoutInterpretation, [
        'certainty',
      ]);
      assert.strictEqual(
        result.value.stones!['certainty'].generationProvenance!.outcome,
        'unavailable',
      );
    }
  });

  test('an unavailable stone may not carry an interpretation after all', () => {
    const payload = withUnavailableDimensions(['certainty']);
    payload.stones['certainty'].psychologicalInterpretation =
      'תחושת הודאות נמוכה. מומלץ לפרסם שינויים מראש.';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('a gap that is not declared is rejected', () => {
    const payload = withUnavailableDimensions(['certainty']);
    delete (payload as { dimensionsWithoutInterpretation?: unknown })
      .dimensionsWithoutInterpretation;
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
    assert.match(
      (result as { error: string }).error,
      /dimensionsWithoutInterpretation/,
    );
  });

  test('a declared list that disagrees with the stones is rejected', () => {
    // The banner would say two dimensions are missing over a map missing one.
    const payload = withUnavailableDimensions(['certainty']);
    payload.dimensionsWithoutInterpretation = ['certainty', 'meaning'];
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('a round where nothing was written is a failure, not a partial map', () => {
    const result = validateStoneMapResult(
      withUnavailableDimensions([
        'self-expression',
        'professional-competence',
        'social-resource',
        'balance',
        'management-support',
        'certainty',
        'organizational-climate',
        'meaning',
      ]),
      'round-v5-test',
    );
    assert.strictEqual(result.ok, false);
    assert.match((result as { error: string }).error, /failure, not a partial/);
  });

  test('the partial map is a 5.0 rule and does not reach 4.0', () => {
    const payload = withUnavailableDimensions(['certainty']);
    payload.contractVersion = '4.0';
    const result = validateStoneMapResult(payload, 'round-v5-test');
    assert.strictEqual(result.ok, false);
  });

  test('a whole map declares no gaps at all', () => {
    // The payload of a full round is unchanged by the partial map existing.
    const payload = createValidV5Payload();
    assert.ok(
      !Object.hasOwn(payload, 'dimensionsWithoutInterpretation'),
      'a full payload must not carry an empty gap list',
    );
    assert.strictEqual(
      validateStoneMapResult(payload, 'round-v5-test').ok,
      true,
    );
  });
});
