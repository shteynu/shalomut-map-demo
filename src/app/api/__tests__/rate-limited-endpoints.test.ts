import assert from 'node:assert';
import test from 'node:test';
import type { NextRequest } from 'next/server';
import { POST as login } from '../auth/login/route';
import { POST as submit } from '../survey/[shareCode]/submit/route';
import { RATE_LIMITS, resetRateLimitStore } from '@/lib/server/rate-limit';

/**
 * The unit tests next to the limiter prove the counting. These prove the two
 * endpoints actually call it — which is the half that silently stops being
 * true when a handler is refactored.
 *
 * Neither test needs the endpoint to work: the limiter runs before the
 * password is read and before the round is looked up, so a refusal arrives
 * whatever the request would otherwise have done. That ordering is the point.
 * A limiter placed after authentication would have counted only the attempts
 * that got the password right.
 */

const ADDRESS = '203.0.113.42';

function loginRequest(): NextRequest {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ADDRESS,
    },
    body: JSON.stringify({ email: 'a@b.c', password: 'wrong-password' }),
  }) as NextRequest;
}

test('the manager login refuses a flood of guesses with 429', async () => {
  resetRateLimitStore(null);

  const statuses: number[] = [];
  for (let attempt = 0; attempt < RATE_LIMITS.managerLogin.limit + 2; attempt++) {
    statuses.push((await login(loginRequest())).status);
  }

  const allowed = statuses.slice(0, RATE_LIMITS.managerLogin.limit);
  const refused = statuses.slice(RATE_LIMITS.managerLogin.limit);

  assert.ok(
    allowed.every((status) => status !== 429),
    `a guess inside the limit was rate limited: ${allowed.join(', ')}`,
  );
  assert.deepStrictEqual(refused, [429, 429]);

  resetRateLimitStore(null);
});

test('the guesses of one address do not lock out another', async () => {
  resetRateLimitStore(null);

  for (let attempt = 0; attempt < RATE_LIMITS.managerLogin.limit + 1; attempt++) {
    await login(loginRequest());
  }

  const neighbour = await login(
    new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.43',
      },
      body: JSON.stringify({ email: 'a@b.c', password: 'wrong-password' }),
    }) as NextRequest,
  );

  assert.notStrictEqual(neighbour.status, 429);

  resetRateLimitStore(null);
});

test('the respondent submission is limited too, and far more loosely', async () => {
  resetRateLimitStore(null);

  const send = () =>
    submit(
      new Request('http://localhost/api/survey/SHALOM-RATE/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': ADDRESS,
        },
        body: JSON.stringify({ answers: [] }),
      }),
      { params: Promise.resolve({ shareCode: 'SHALOM-RATE' }) },
    );

  // A staffroom's worth of answers must pass. Forty is more than a school of
  // this size sends in five minutes, and it is well inside the limit.
  for (let attempt = 0; attempt < 40; attempt++) {
    assert.notStrictEqual((await send()).status, 429, `answer ${attempt + 1} was refused`);
  }

  for (
    let attempt = 40;
    attempt < RATE_LIMITS.surveySubmission.limit;
    attempt++
  ) {
    await send();
  }

  assert.strictEqual((await send()).status, 429);

  resetRateLimitStore(null);
});
