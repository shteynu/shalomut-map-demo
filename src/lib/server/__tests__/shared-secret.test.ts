import assert from 'node:assert';
import test from 'node:test';
import { hasConfiguredSharedSecret } from '@/lib/server/shared-secret';

/**
 * The machine-to-machine door, and the one question it has to get right when
 * it is not configured: is this a deployed runtime?
 *
 * Until 2026-08-22 it asked only about `VERCEL_ENV`, so a runtime deployed any
 * other way — a container, a self-hosted Node server — authorized every caller
 * the moment the secret was missing. Nothing was exposed, because Core runs on
 * Vercel; the defect was that this file answered a question two auth modules
 * were already answering, and answered it differently.
 *
 * The constant-time comparison that landed with it is deliberately not tested
 * here. It has no observable behaviour to assert — the same requests are
 * accepted and refused either way — and a timing assertion in a test suite is a
 * coin toss, not evidence.
 */

const VARIABLE = 'TEST_SHARED_SECRET';

function request(authorization?: string): Request {
  return new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
  });
}

/** Restores every variable this file touches, whatever the test did. */
function withEnvironment(
  values: Record<string, string | undefined>,
  run: () => void,
) {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('an unconfigured secret on a deployed runtime refuses, Vercel or not', () => {
  // The regression: `NODE_ENV=production` with no Vercel around it. The old
  // predicate read this as "not deployed" and opened the door.
  withEnvironment(
    {
      [VARIABLE]: undefined,
      NODE_ENV: 'production',
      VERCEL_ENV: undefined,
      NEXT_PHASE: undefined,
    },
    () => {
      assert.strictEqual(hasConfiguredSharedSecret(request(), VARIABLE), false);
    },
  );

  withEnvironment(
    {
      [VARIABLE]: undefined,
      NODE_ENV: 'development',
      VERCEL_ENV: 'preview',
      NEXT_PHASE: undefined,
    },
    () => {
      assert.strictEqual(hasConfiguredSharedSecret(request(), VARIABLE), false);
    },
  );
});

test('an unconfigured secret off a deployed runtime still lets the local pipeline through', () => {
  withEnvironment(
    {
      [VARIABLE]: undefined,
      NODE_ENV: 'development',
      VERCEL_ENV: undefined,
      NEXT_PHASE: undefined,
    },
    () => {
      assert.strictEqual(hasConfiguredSharedSecret(request(), VARIABLE), true);
    },
  );
});

test('the production build is not a deployed runtime', () => {
  // `next build` prerenders with NODE_ENV=production and none of the runtime
  // configuration. Counting it would make every build demand the secrets.
  withEnvironment(
    {
      [VARIABLE]: undefined,
      NODE_ENV: 'production',
      VERCEL_ENV: undefined,
      NEXT_PHASE: 'phase-production-build',
    },
    () => {
      assert.strictEqual(hasConfiguredSharedSecret(request(), VARIABLE), true);
    },
  );
});

test('a configured secret accepts its own bearer token and nothing else', () => {
  withEnvironment({ [VARIABLE]: 'the-real-secret', VERCEL_ENV: 'production' }, () => {
    assert.strictEqual(
      hasConfiguredSharedSecret(request('Bearer the-real-secret'), VARIABLE),
      true,
    );

    for (const wrong of [
      'Bearer the-real-secre',
      'Bearer the-real-secret-and-more',
      'Bearer THE-REAL-SECRET',
      'the-real-secret',
      'Basic the-real-secret',
      '',
    ]) {
      assert.strictEqual(
        hasConfiguredSharedSecret(request(wrong), VARIABLE),
        false,
        `accepted ${JSON.stringify(wrong)}`,
      );
    }

    // A missing header, which is a different path from a wrong one: digests
    // are only compared once there is something to compare.
    assert.strictEqual(hasConfiguredSharedSecret(request(), VARIABLE), false);
  });
});
