import { expect, type Page } from '@playwright/test';

/**
 * Signing in as the manager, for the specs that need to be past the door
 * before they can start.
 *
 * This lived inside `smoke.spec.ts` while it was the only file that needed it.
 * It moved here when the respondent path got a spec of its own: a second copy
 * of a login helper is how two specs start disagreeing about what a healthy
 * sign-in looks like, and the comments below are the expensive part — each one
 * is a failure mode that cost a session to find.
 *
 * `login-transition.spec.ts` deliberately does not use this. Its subject *is*
 * the transition after the click, so a helper that waits for the destination
 * would do the very thing that test exists to watch the product do.
 */

import { SMOKE_PASSWORD } from '../playwright.config';

export const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@shalomut.edu.il';
export const PASSWORD = SMOKE_PASSWORD;

/**
 * The sign-in form is a client component: its submit handler exists only after
 * hydration, and a click before that submits the form natively — the browser
 * navigates, the fields reset and no error ever appears. That is a real
 * failure mode of the page, but it is not the one a smoke test is asking
 * about, so the run waits for the client to take over instead of racing it.
 *
 * Waiting for the login request itself is what proves hydration happened: no
 * request means no handler.
 *
 * Redirects are skipped deliberately. The application serves trailing-slash
 * URLs, so `POST /api/auth/login` answers 308 before the handler ever runs,
 * and a matcher that takes the first response reads that redirect as a
 * refused sign-in.
 */
export async function submitLogin(page: Page, password: string, next?: string) {
  const target = next
    ? `/login?${new URLSearchParams({ next }).toString()}`
    : '/login';

  await page.goto(target, { waitUntil: 'networkidle' });
  await page.getByLabel('כתובת דוא"ל').fill(EMAIL);
  await page.getByLabel('סיסמה').fill(password);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/api/auth/login') &&
        (candidate.status() < 300 || candidate.status() >= 400),
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: /התחבר|כניסה/u }).click(),
  ]);

  // Returned unjudged: one caller signs in with a deliberately wrong password
  // and needs the refusal, so deciding here what a good response looks like
  // would take that test's subject away from it.
  return response;
}

/**
 * Sign in and land on `destination` — by letting the form take the browser
 * there, which is what a manager actually does.
 *
 * This used to call `page.goto(destination)` itself, on the reasoning that the
 * form's own transition "does not settle reliably under test" and that the
 * smoke should measure the product rather than the router. That reasoning was
 * wrong: a sign-in that never arrives is the product being broken, however
 * healthy every protected page is once something else navigates to it. The
 * transition was not unstable either — it was broken outright for one
 * destination, and `8d4af8d` fixed it.
 *
 * **This is not the test that guards that fix**, and it is worth saying so
 * plainly rather than letting the next reader assume otherwise. The defect
 * needed the destination to be one the login screen had already prefetched
 * while signed out, which is `/` — the brand link in its header. A sign-in
 * carrying `?next=/round` was never affected, and this helper still passed
 * against the pre-fix code when that was checked deliberately. The regression
 * lives in `login-transition.spec.ts`, which signs in with no `next` at all.
 *
 * What removing the workaround buys is smaller and still real: the deep-link
 * path — middleware turns an unauthenticated request away, writes `?next=`,
 * and the form has to honour it — is now exercised end to end instead of being
 * stepped over.
 *
 * `destination` may carry a query string; only the pathname is compared,
 * because a screen is free to rewrite its own query on arrival.
 */
export async function signIn(page: Page, destination: string) {
  const response = await submitLogin(page, PASSWORD, destination);
  expect(
    response.ok(),
    'the smoke credentials were refused: the server under test was started ' +
      'with a different MANAGER_ADMIN_PASSWORD than the run uses',
  ).toBe(true);

  // Nothing below drives the browser. `trailingSlash` is on, so `/round`
  // arrives as `/round/` after one redirect — the destination is compared
  // without it rather than the test hard-coding which form the app serves.
  const withoutTrailingSlash = (path: string) => path.replace(/(.)\/$/u, '$1');
  const expected = withoutTrailingSlash(new URL(destination, 'http://x').pathname);

  await page.waitForURL(
    (url) => withoutTrailingSlash(new URL(url).pathname) === expected,
    { timeout: 30_000 },
  );
  await expect(page).not.toHaveURL(/\/login/u);
}
