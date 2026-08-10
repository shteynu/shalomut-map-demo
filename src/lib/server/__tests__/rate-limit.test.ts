import assert from 'node:assert';
import test from 'node:test';
import {
  clientAddress,
  consumeRateLimit,
  getRateLimitResponse,
  resetRateLimitStore,
  type RateLimitPolicy,
} from '../rate-limit';

const POLICY: RateLimitPolicy = {
  name: 'test-policy',
  limit: 3,
  windowSeconds: 60,
};

function headersFor(address: string | null) {
  return new Headers(address ? { 'x-forwarded-for': address } : {});
}

/**
 * The store is process-wide, so every test that counts has to start from a
 * known one. Passing `null` makes the next call resolve a fresh in-memory
 * store from the environment, which is what the runtime does on a cold start.
 */
function useFreshStore() {
  resetRateLimitStore(null);
}

test('the client address is the first entry of a forwarded chain', () => {
  assert.strictEqual(
    clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })),
    '203.0.113.7',
  );
  assert.strictEqual(
    clientAddress(new Headers({ 'x-real-ip': '203.0.113.9' })),
    '203.0.113.9',
  );
});

test('a request that appears to come from the machine itself has no client address', () => {
  for (const loopback of ['::1', '127.0.0.1', '::ffff:127.0.0.1', '[::1]', 'localhost']) {
    assert.strictEqual(
      clientAddress(new Headers({ 'x-forwarded-for': loopback })),
      null,
      `${loopback} was treated as a client`,
    );
  }

  // The chain a real proxy writes still resolves, even when the hop behind it
  // is the loopback interface.
  assert.strictEqual(
    clientAddress(new Headers({ 'x-forwarded-for': '203.0.113.7, 127.0.0.1' })),
    '203.0.113.7',
  );
});

test('a request with no client address is not limited at all', async () => {
  useFreshStore();

  // Ten times the policy, from a request that carries no address: local
  // development and the browser smoke look like this, and bucketing them
  // together would rate-limit a test suite as though it were an attacker.
  for (let attempt = 0; attempt < POLICY.limit * 10; attempt++) {
    const decision = await consumeRateLimit(headersFor(null), POLICY);
    assert.strictEqual(decision.allowed, true);
  }
});

test('the limit is the last allowed request, not the first refused one', async () => {
  useFreshStore();

  for (let attempt = 1; attempt <= POLICY.limit; attempt++) {
    const decision = await consumeRateLimit(headersFor('198.51.100.4'), POLICY);
    assert.strictEqual(decision.allowed, true, `attempt ${attempt} was refused`);
  }

  const refused = await consumeRateLimit(headersFor('198.51.100.4'), POLICY);
  assert.strictEqual(refused.allowed, false);
  assert.strictEqual(refused.retryAfterSeconds, POLICY.windowSeconds);
});

test('one address running out does not refuse another', async () => {
  useFreshStore();

  for (let attempt = 0; attempt <= POLICY.limit; attempt++) {
    await consumeRateLimit(headersFor('198.51.100.5'), POLICY);
  }

  const neighbour = await consumeRateLimit(headersFor('198.51.100.6'), POLICY);
  assert.strictEqual(neighbour.allowed, true);
});

test('two policies count separately for the same address', async () => {
  useFreshStore();

  for (let attempt = 0; attempt <= POLICY.limit; attempt++) {
    await consumeRateLimit(headersFor('198.51.100.7'), POLICY);
  }

  const other = await consumeRateLimit(headersFor('198.51.100.7'), {
    ...POLICY,
    name: 'a-different-policy',
  });
  assert.strictEqual(other.allowed, true);
});

test('the window expires and the address is served again', async () => {
  useFreshStore();

  const instant: RateLimitPolicy = { ...POLICY, windowSeconds: 0 };
  for (let attempt = 0; attempt < 10; attempt++) {
    const decision = await consumeRateLimit(headersFor('198.51.100.8'), instant);
    assert.strictEqual(decision.allowed, true);
  }
});

test('a store that throws lets the request through rather than locking anyone out', async () => {
  resetRateLimitStore({
    async increment() {
      throw new Error('redis is having an afternoon');
    },
  });

  const decision = await consumeRateLimit(headersFor('198.51.100.9'), POLICY);
  assert.strictEqual(decision.allowed, true);

  resetRateLimitStore(null);
});

test('the refusal is a 429 that says when to come back', async () => {
  useFreshStore();

  for (let attempt = 0; attempt < POLICY.limit; attempt++) {
    assert.strictEqual(
      await getRateLimitResponse(headersFor('198.51.100.10'), POLICY),
      null,
    );
  }

  const response = await getRateLimitResponse(
    headersFor('198.51.100.10'),
    POLICY,
  );
  assert.ok(response);
  assert.strictEqual(response.status, 429);
  assert.strictEqual(
    response.headers.get('Retry-After'),
    String(POLICY.windowSeconds),
  );

  const body = (await response.json()) as { code?: string; error?: string };
  assert.strictEqual(body.code, 'RATE_LIMITED');
  // The respondent and the manager both read Hebrew; an English refusal would
  // be the one screen in the product that is not in their language.
  assert.match(String(body.error), /[֐-׿]/u);
});
