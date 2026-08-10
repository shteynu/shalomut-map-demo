import { expect, test } from '@playwright/test';

/**
 * The manager gate lives in `middleware.ts`, and middleware runs in no unit
 * test: `npm test` calls route handlers directly, which is exactly the layer
 * the gate sits above. So the claim "an uptime monitor can reach this without a
 * session" can only be proved against a running server, which is what this
 * file is.
 *
 * It uses the `request` fixture rather than a page, and that is the assertion:
 * no browser, no cookie, nothing that could accidentally carry the sign-in the
 * smoke test performs.
 */

test('an anonymous monitor can read the health endpoint', async ({ request }) => {
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe('ok');
  // Worth pinning: this is what the endpoint is for. A monitor that only knows
  // the process answered would not notice a deployment producing a contract
  // version nobody expects.
  expect(body.analytics.producedContractVersion).toMatch(/^\d+\.\d+$/u);
});

test('the gate it sits behind is otherwise intact', async ({ request }) => {
  // If this ever answers 200, the bypass has been widened past the one route it
  // was opened for.
  const response = await request.get('/api/rounds');

  expect(response.status()).toBe(401);
});
