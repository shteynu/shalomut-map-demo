import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  SURVEY_DRAFT_SCHEMA_VERSION,
  clearSurveyDraft,
  createSurveyDraft,
  loadSurveyDraft,
  parseSurveyDraft,
  questionnaireFingerprint,
  surveyDraftStorageKey,
  writeSurveyDraft,
  type SurveyDraftExpectation,
  type SurveyDraftV1,
} from '../survey-draft-storage';
import type { SurveyDefinitionQuestion } from '../types/backend';

const questions: SurveyDefinitionQuestion[] = [
  {
    id: 'q1',
    dimensionId: 'self-expression',
    text: 'האם את/ה מרגיש/ה בנוח להביע דעה?',
    required: true,
    enabled: true,
    answerMode: 'traffic-light',
  },
  {
    id: 'q2',
    dimensionId: 'social-resource',
    text: 'האם את/ה מרגיש/ה שייכ/ת לצוות?',
    required: true,
    enabled: true,
    answerMode: 'traffic-light',
  },
];

const fingerprint = questionnaireFingerprint(questions);

const expected: SurveyDraftExpectation = {
  shareCode: 'SHALOM-7K2M',
  questionnaireFingerprint: fingerprint,
  questionIds: new Set(questions.map((question) => question.id)),
  questionCount: questions.length,
};

const draft: SurveyDraftV1 = createSurveyDraft(
  {
    shareCode: expected.shareCode,
    questionnaireFingerprint: fingerprint,
    attemptToken: 'a2f0a5f4-0a5a-4a41-9a0f-4f4f8f4a1a11',
    answers: { q1: 'green' },
    currentIndex: 1,
    consentAcceptedAt: '2026-08-03T10:00:00.000Z',
  },
  new Date('2026-08-03T10:01:00.000Z'),
);

function stored(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...draft, ...overrides });
}

/** A storage double that records what happened to it. */
function fakeStorage(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  const removed: string[] = [];

  return {
    removed,
    entries,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      removed.push(key);
      entries.delete(key);
    },
  };
}

describe('questionnaire fingerprint', () => {
  it('is stable for the same questionnaire', () => {
    assert.equal(questionnaireFingerprint(questions), fingerprint);
  });

  it('changes when a question is reworded', () => {
    const reworded = [
      { ...questions[0], text: `${questions[0].text} באמת?` },
      questions[1],
    ];

    assert.notEqual(questionnaireFingerprint(reworded), fingerprint);
  });

  it('changes when questions are reordered, because a draft restores a position', () => {
    assert.notEqual(
      questionnaireFingerprint([questions[1], questions[0]]),
      fingerprint,
    );
  });

  it('changes when a question moves to another dimension', () => {
    const moved: SurveyDefinitionQuestion[] = [
      { ...questions[0], dimensionId: 'balance' },
      questions[1],
    ];

    assert.notEqual(questionnaireFingerprint(moved), fingerprint);
  });

  it('is synchronous, so hydration never awaits before the first save', () => {
    // Regression guard for the hydration race: an async fingerprint would let
    // the save effect write the empty initial state over a stored draft.
    assert.equal(typeof questionnaireFingerprint(questions), 'string');
  });
});

describe('survey draft parsing', () => {
  it('round-trips a draft it wrote', () => {
    const result = parseSurveyDraft(stored(), expected);

    assert.ok(result.ok);
    assert.deepEqual(result.draft, draft);
  });

  it('reports an absent draft separately from a broken one', () => {
    const result = parseSurveyDraft(null, expected);

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, 'absent');
  });

  it('refuses malformed JSON', () => {
    const result = parseSurveyDraft('{not json', expected);

    assert.equal(result.ok === false && result.reason, 'malformed');
  });

  it('refuses a non-object payload', () => {
    const result = parseSurveyDraft('["answers"]', expected);

    assert.equal(result.ok === false && result.reason, 'malformed');
  });

  it('refuses an unknown schema version instead of guessing its shape', () => {
    const result = parseSurveyDraft(stored({ schemaVersion: 2 }), expected);

    assert.equal(result.ok === false && result.reason, 'unknown-version');
  });

  it('refuses a draft written for another share code', () => {
    const result = parseSurveyDraft(
      stored({ shareCode: 'SHALOM-OTHR' }),
      expected,
    );

    assert.equal(result.ok === false && result.reason, 'share-code-mismatch');
  });

  it('refuses a draft written for another questionnaire', () => {
    const result = parseSurveyDraft(
      stored({ questionnaireFingerprint: 'deadbeef' }),
      expected,
    );

    assert.equal(result.ok === false && result.reason, 'fingerprint-mismatch');
  });

  it('refuses a draft without a usable attempt token', () => {
    for (const attemptToken of [undefined, '', '   ', 42]) {
      const result = parseSurveyDraft(stored({ attemptToken }), expected);

      assert.equal(result.ok === false && result.reason, 'missing-token');
    }
  });

  it('refuses an answer value the scale does not define', () => {
    const result = parseSurveyDraft(
      stored({ answers: { q1: 'purple' } }),
      expected,
    );

    assert.equal(result.ok === false && result.reason, 'invalid-answers');
  });

  it('refuses an answer for a question the questionnaire does not have', () => {
    const result = parseSurveyDraft(
      stored({ answers: { q1: 'green', q9: 'red' } }),
      expected,
    );

    assert.equal(result.ok === false && result.reason, 'invalid-answers');
  });

  it('discards every answer rather than keeping the ones that still match', () => {
    // Partially restoring would attribute an answer to a question the
    // respondent never read.
    const result = parseSurveyDraft(
      stored({ answers: { q1: 'green', q2: 'purple' } }),
      expected,
    );

    assert.equal(result.ok, false);
  });

  it('refuses a draft with no consent timestamp', () => {
    const result = parseSurveyDraft(stored({ consentAcceptedAt: '' }), expected);

    assert.equal(result.ok === false && result.reason, 'malformed');
  });

  it('clamps a cursor past the end onto the review step', () => {
    const result = parseSurveyDraft(stored({ currentIndex: 99 }), expected);

    assert.ok(result.ok);
    assert.equal(result.draft.currentIndex, expected.questionCount);
  });

  it('clamps a negative cursor to the first question', () => {
    const result = parseSurveyDraft(stored({ currentIndex: -3 }), expected);

    assert.ok(result.ok);
    assert.equal(result.draft.currentIndex, 0);
  });

  it('keeps the answers when only the cursor drifted', () => {
    const result = parseSurveyDraft(stored({ currentIndex: 99 }), expected);

    assert.ok(result.ok);
    assert.deepEqual(result.draft.answers, { q1: 'green' });
  });

  it('refuses a cursor that is not a whole number', () => {
    const result = parseSurveyDraft(stored({ currentIndex: 'first' }), expected);

    assert.equal(result.ok === false && result.reason, 'malformed');
  });

  it('accepts an empty answer set, because consent precedes the first answer', () => {
    const result = parseSurveyDraft(
      stored({ answers: {}, currentIndex: 0 }),
      expected,
    );

    assert.ok(result.ok);
    assert.deepEqual(result.draft.answers, {});
  });
});

describe('survey draft storage', () => {
  const key = surveyDraftStorageKey(expected.shareCode);

  it('names the key by share code and schema version', () => {
    assert.equal(
      key,
      `shalomut:survey-draft:v${SURVEY_DRAFT_SCHEMA_VERSION}:SHALOM-7K2M`,
    );
  });

  it('writes and reads back the same draft', () => {
    const storage = fakeStorage();

    assert.deepEqual(writeSurveyDraft(storage, key, draft), { ok: true });
    assert.deepEqual(loadSurveyDraft(storage, key, expected), draft);
  });

  it('returns null and deletes the key when the draft is refused', () => {
    const storage = fakeStorage({ [key]: '{not json' });

    assert.equal(loadSurveyDraft(storage, key, expected), null);
    assert.deepEqual(storage.removed, [key]);
  });

  it('does not delete anything when there was no draft', () => {
    const storage = fakeStorage();

    assert.equal(loadSurveyDraft(storage, key, expected), null);
    assert.deepEqual(storage.removed, []);
  });

  it('survives storage that throws on read', () => {
    const storage = {
      getItem: () => {
        throw new Error('storage disabled');
      },
      removeItem: () => {},
    };

    assert.equal(loadSurveyDraft(storage, key, expected), null);
  });

  it('reports an unavailable storage instead of throwing', () => {
    const storage = {
      setItem: () => {
        throw new Error('storage disabled');
      },
    };

    assert.deepEqual(writeSurveyDraft(storage, key, draft), {
      ok: false,
      reason: 'unavailable',
    });
  });

  it('tells a full storage apart from a disabled one', () => {
    const quota = Object.assign(new Error('exceeded'), {
      name: 'QuotaExceededError',
    });
    const storage = {
      setItem: () => {
        throw quota;
      },
    };

    assert.deepEqual(writeSurveyDraft(storage, key, draft), {
      ok: false,
      reason: 'quota',
    });
  });

  it('recognises the legacy numeric quota code Safari reports', () => {
    const quota = Object.assign(new Error('exceeded'), { code: 22 });
    const storage = {
      setItem: () => {
        throw quota;
      },
    };

    assert.deepEqual(writeSurveyDraft(storage, key, draft), {
      ok: false,
      reason: 'quota',
    });
  });

  it('clears without throwing when storage refuses to delete', () => {
    const storage = {
      removeItem: () => {
        throw new Error('storage disabled');
      },
    };

    assert.doesNotThrow(() => clearSurveyDraft(storage, key));
  });

  it('stores nothing that could identify the respondent', () => {
    const storage = fakeStorage();
    writeSurveyDraft(storage, key, draft);

    const raw = storage.entries.get(key) ?? '';
    const persisted = JSON.parse(raw) as Record<string, unknown>;

    assert.deepEqual(Object.keys(persisted).sort(), [
      'answers',
      'attemptToken',
      'consentAcceptedAt',
      'currentIndex',
      'questionnaireFingerprint',
      'schemaVersion',
      'shareCode',
      'updatedAt',
    ]);
  });
});
