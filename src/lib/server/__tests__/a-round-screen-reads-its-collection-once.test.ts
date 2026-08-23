/**
 * What the round screen actually asks the database for.
 *
 * The 2026-08-21 audit recorded this as "responses and attempts loaded twice
 * per render". Half of that was still true when it was opened — the funnel and
 * the fill-time report each fetched the round's attempts for themselves — and
 * the other half had become worse than the audit said. The fill-time report
 * asked for responses *whole*, which joins every `question_answers` row of the
 * round, to read `submittedAt`, `anonymousTokenHash` and `visibleSeconds` off
 * each one.
 *
 * These assertions count calls rather than time them. On a seeded store the
 * duplicate read costs nothing measurable, and the defect is not that it was
 * slow here — it is that the screen asked at all.
 */
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import {
  InMemorySurveyAttemptRepository,
  InMemorySurveyRepository,
} from '@/lib/repositories';
import type {
  ISurveyAttemptRepository,
  ISurveyRepository,
} from '@/lib/repositories/interfaces';
import { overrideCoreRepositories } from '@/lib/composition-root';
import { loadRoundActivity } from '../manager-context';
import { createCanonicalSurveyDefinition } from '@/lib/survey-definition';
import type { SurveyResponseRecord, SurveyRound } from '@/lib/types/backend';

const ROUND_ID = 'round-activity';
const OPENED = new Date('2026-08-20T08:00:00.000Z');

/** Counts the calls, answers exactly as the store would. */
function counting<T extends object>(target: T): [T, Record<string, number>] {
  const calls: Record<string, number> = {};
  const watched = new Proxy(target, {
    get(base, key) {
      const value = Reflect.get(base, key, base);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls[String(key)] = (calls[String(key)] ?? 0) + 1;
        return (value as (...rest: unknown[]) => unknown).apply(base, args);
      };
    },
  });
  return [watched, calls];
}

function round(): Pick<
  SurveyRound,
  'id' | 'privacyThreshold' | 'surveyDefinition'
> {
  return {
    id: ROUND_ID,
    privacyThreshold: 10,
    surveyDefinition: createCanonicalSurveyDefinition('סבב', 10),
  };
}

function response(index: number): SurveyResponseRecord {
  return {
    id: `resp-${index}`,
    roundId: ROUND_ID,
    anonymousTokenHash: String(index).padStart(64, 'x'),
    submittedAt: new Date(OPENED.getTime() + 600_000),
    visibleSeconds: 240,
    // The rows the narrow read must not fetch, present here so that a store
    // handing them back would be visible rather than vacuously absent.
    answers: [
      { questionId: 'q1', dimensionId: 'balance', value: 'green', score: 3 },
      { questionId: 'q2', dimensionId: 'balance', value: 'blue', score: 4 },
    ],
  };
}

let attemptRepo: ISurveyAttemptRepository;
let surveyRepo: ISurveyRepository;
let calls: Record<string, number>;
let surveyCalls: Record<string, number>;

beforeEach(async () => {
  const attempts = new InMemorySurveyAttemptRepository();
  const responses = new InMemorySurveyRepository();

  for (let index = 0; index < 12; index += 1) {
    await attempts.record({
      roundId: ROUND_ID,
      anonymousTokenHash: String(index).padStart(64, 'x'),
      stage: 'consented',
      at: OPENED,
    });
    await responses.saveResponse(response(index));
  }

  [attemptRepo, calls] = counting(attempts);
  [surveyRepo, surveyCalls] = counting(responses);
  overrideCoreRepositories({ surveyAttemptRepo: attemptRepo, surveyRepo });
});

test("the round's attempts are read once for two reports, not once each", async () => {
  const { funnel, filling } = await loadRoundActivity(round());

  assert.equal(calls.findByRoundId, 1);
  // And both reports were genuinely produced from that one read, or the
  // assertion above would pass on a screen that had stopped rendering one.
  assert.equal(funnel.opened, 12);
  assert.equal(filling.status, 'ready');
});

test('the fill-time report does not fetch the answers it never reads', async () => {
  await loadRoundActivity(round());

  assert.equal(surveyCalls.findResponseTimingsByRoundId, 1);
  assert.equal(
    surveyCalls.findResponsesByRoundId,
    undefined,
    'that read joins every question_answers row of the round',
  );
});

test("the funnel's completion count is the responses, without a second query", async () => {
  const { funnel } = await loadRoundActivity(round());

  assert.equal(funnel.completed, 12);
  assert.equal(
    surveyCalls.getResponseCount,
    undefined,
    'the same number is already the length of the read that just happened',
  );
});

test('a timing carries no answers to read', async () => {
  // The type says so, which is the real guard — this pins that the store agrees
  // with the type at runtime, so a `JSON.stringify` of one of these rows cannot
  // start carrying a round's answers.
  const timings = await surveyRepo.findResponseTimingsByRoundId(ROUND_ID);

  assert.equal(timings.length, 12);
  for (const timing of timings) {
    assert.ok(!('answers' in timing), 'a timing row must carry no answers');
    assert.equal(timing.visibleSeconds, 240);
  }
});
