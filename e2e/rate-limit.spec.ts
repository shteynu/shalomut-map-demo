import { expect, test } from '@playwright/test';
import { RATE_LIMITS } from '../src/lib/server/rate-limit';

/**
 * The limiter through a real server, which is the half the unit tests cannot
 * see.
 *
 * They call `consumeRateLimit` with the headers they choose. What broke in
 * practice was a header nobody chose: Next's own server fills in
 * `x-forwarded-for` from the socket, so every request to a locally served
 * build arrives as `::1` and the entire browser suite counted as one caller —
 * twelve sign-ins across fifteen tests, refusing themselves at the eleventh.
 * The fix is that loopback is not treated as a client identity, and this is
 * the test that would notice if that reasoning ever stopped holding.
 *
 * So it asserts both directions: the suite's own sign-ins are never limited,
 * and a request that arrives with a real client address in front of it is.
 */

const POLICY = RATE_LIMITS.managerLogin;
const CALLER = { 'x-forwarded-for': '203.0.113.77' };

const WRONG_CREDENTIALS = {
  email: 'nobody@example.com',
  password: 'not-the-password',
};

test('the sign-in endpoint refuses a flood from one address', async ({
  request,
}) => {
  const statuses: number[] = [];

  for (let attempt = 0; attempt < POLICY.limit + 1; attempt++) {
    const response = await request.post('/api/auth/login/', {
      headers: CALLER,
      data: WRONG_CREDENTIALS,
      failOnStatusCode: false,
    });
    statuses.push(response.status());
  }

  expect(
    statuses.slice(0, POLICY.limit),
    'a guess inside the limit was refused',
  ).not.toContain(429);

  const last = statuses[statuses.length - 1];
  expect(last, `the ${POLICY.limit + 1}th guess was answered ${last}`).toBe(429);

  const refusal = await request.post('/api/auth/login/', {
    headers: CALLER,
    data: WRONG_CREDENTIALS,
    failOnStatusCode: false,
  });
  expect(refusal.headers()['retry-after']).toBe(String(POLICY.windowSeconds));
});

test('a request with no proxy in front of it is not limited', async ({
  request,
}) => {
  /*
   * Twice the policy, from this run's own loopback address — the same address
   * every other spec in this suite signs in from. A failure here means the
   * browser tests are about to start rate-limiting themselves, which is how
   * this was found the first time.
   */
  for (let attempt = 0; attempt < POLICY.limit * 2; attempt++) {
    const response = await request.post('/api/auth/login/', {
      data: WRONG_CREDENTIALS,
      failOnStatusCode: false,
    });
    expect(response.status(), `attempt ${attempt + 1} was rate limited`).not.toBe(
      429,
    );
  }
});
