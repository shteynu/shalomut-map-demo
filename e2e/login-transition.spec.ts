import { expect, test } from '@playwright/test';

/**
 * The first sign-in of a browser session has to land, not spin.
 *
 * This exists because the smoke test deliberately does not check it: it
 * navigates to the destination itself rather than waiting for the login form's
 * own transition, on the grounds that the client router is not the product.
 * That workaround hid a real defect for as long as it stood. The login page
 * prefetches `/` while the manager is still signed out, so the client router
 * cached the middleware's redirect back to `/login`; after the cookie was set,
 * `router.push("/")` was served from that cache and never left the page. The
 * form spun on "מתחבר..." with no way to clear itself.
 *
 * So the assertion here is specifically the thing the smoke skips: click the
 * button, touch nothing else, and end up on the home screen. The first attempt
 * in a fresh browser is the one that matters — a reload used to hide the bug,
 * because the prefetch then ran with a cookie and returned the real page.
 */

import { SMOKE_PASSWORD } from '../playwright.config';

const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@shalomut.edu.il';

test('the first sign-in lands on the home screen without a reload', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' });

  await page.getByLabel('כתובת דוא"ל').fill(EMAIL);
  await page.getByLabel('סיסמה').fill(SMOKE_PASSWORD);

  // Hydration, for the reason the smoke spells out: a click before the client
  // handler exists submits the form natively and proves nothing.
  const loginResponse = page.waitForResponse(
    (candidate) =>
      candidate.url().includes('/api/auth/login') &&
      (candidate.status() < 300 || candidate.status() >= 400),
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: /התחבר|כניסה/u }).click();
  expect((await loginResponse).status()).toBe(200);

  // Nothing below drives the browser: whatever happens next is the product's
  // own transition. Before the fix this timed out, having never asked the
  // server for the destination at all.
  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'שלום,' })).toBeVisible();
});

/**
 * `?next=` is attacker-controlled even though the middleware only ever writes
 * a pathname into it, and the form now performs a real document navigation —
 * so an unfiltered value would send a manager who just typed their password to
 * whatever host the link named.
 */
test('a foreign ?next= destination is refused and the manager lands home', async ({ page }) => {
  await page.goto('/login?next=https://example.com/', { waitUntil: 'networkidle' });

  await page.getByLabel('כתובת דוא"ל').fill(EMAIL);
  await page.getByLabel('סיסמה').fill(SMOKE_PASSWORD);
  await page.getByRole('button', { name: /התחבר|כניסה/u }).click();

  await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 30_000 });
  expect(new URL(page.url()).host).toBe(new URL(page.context().pages()[0].url()).host);
  expect(page.url()).not.toContain('example.com');
  await expect(page.getByRole('heading', { name: 'שלום,' })).toBeVisible();
});
