import { expect, test } from '@playwright/test';

/**
 * The headers are configuration, and configuration is what silently stops
 * being true.
 *
 * `next.config.ts` is the only place these exist — there is no `vercel.json` —
 * and nothing else in the repository reads them back. A refactor that renames
 * a `source` pattern, or a second `headers()` entry that shadows the first,
 * costs nothing at build time and shows up only as a missing header on a
 * response nobody inspects. That is exactly how this application came to ship
 * with none at all.
 *
 * So this asserts on a real response from the production build the smoke run
 * serves, not on the config object. It checks the promises, not the exact
 * strings: `max-age` may be retuned and a directive may be added, but framing
 * must stay refused and the policy must stay same-origin.
 */

const PROTECTED_PATH = '/login/';

test('every response carries the security headers', async ({ request }) => {
  const response = await request.get(PROTECTED_PATH);
  const headers = response.headers();

  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');

  // Served over plain HTTP here, where browsers ignore it — but a header that
  // is absent locally is a header that was removed for everyone.
  expect(headers['strict-transport-security']).toMatch(/max-age=\d{6,}/u);
});

test('the content security policy refuses framing and foreign origins', async ({
  request,
}) => {
  const response = await request.get(PROTECTED_PATH);
  const policy = response.headers()['content-security-policy'] ?? '';

  expect(policy, 'no Content-Security-Policy on a manager screen').not.toBe('');

  // The one that matters most on screens whose buttons close a round or reset
  // an analysis: a signed-in manager must not be clickable through an iframe.
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  expect(policy).toContain("base-uri 'self'");
  // A stolen session posted to another host would go out through a form.
  expect(policy).toContain("form-action 'self'");
  expect(policy).toContain("default-src 'self'");

  /*
   * No foreign origin may appear in the policy that covers the product's own
   * screens. `/api-docs` has its own header for unpkg, and the test below is
   * the reason this one can be this strict — the two rules must not merge.
   */
  expect(
    policy,
    'a foreign origin reached the policy that covers the manager screens',
  ).not.toMatch(/https?:\/\//u);
});

test('the docs screen keeps its exception, and keeps it to itself', async ({
  request,
}) => {
  /*
   * `maxRedirects: 0` is load-bearing. `/api-docs` is behind the manager
   * gate, so a followed redirect ends on `/login` and hands back *that*
   * screen's policy — which reads as "the exception is gone" and is really
   * "you are looking at a different page". The redirect response itself is
   * still an `/api-docs` response and carries its headers.
   */
  const docs = (
    await request.get('/api-docs/', { maxRedirects: 0 })
  ).headers()['content-security-policy'];
  const app = (await request.get(PROTECTED_PATH)).headers()[
    'content-security-policy'
  ];

  /*
   * `/api-docs` pulls Swagger UI from unpkg at runtime, so without this it
   * renders blank. Checked the other way round too, by removing the exception
   * and rebuilding: the browser then reports `script-src-elem blocked
   * https://unpkg.com/...` and `style-src-elem blocked`, which is the whole
   * screen.
   */
  expect(docs).toContain('https://unpkg.com');
  expect(app).not.toContain('unpkg.com');
  expect(docs).toContain("frame-ancestors 'none'");
});
