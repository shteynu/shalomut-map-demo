import { expect, test, type Page } from '@playwright/test';

/**
 * The one path the product cannot be broken on: a manager signs in, reads the
 * round's share link, and a respondent opens that link and sees the
 * questionnaire.
 *
 * Written against accessible names rather than test ids, on purpose. The
 * application has no `data-testid` anywhere and states its meaning through
 * labels and roles, which is what the RTL and WCAG AA commitments in
 * `AGENTS.md` require anyway. A selector that breaks because a label was
 * removed is a selector that just caught something.
 *
 * The password is the throwaway one `playwright.config.ts` generated for this
 * run and handed to the server it started, so nothing here depends on the
 * repository's real secrets. Nothing here writes either: no round is created,
 * closed or answered, so the run leaves the database as it found it.
 */

import { SMOKE_PASSWORD } from '../playwright.config';

const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@shalomut.edu.il';
const PASSWORD = SMOKE_PASSWORD;

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
async function submitLogin(page: Page, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' });
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

  return response;
}

/**
 * Sign in and land on `destination`.
 *
 * The navigation is explicit rather than waiting for the form's own
 * `router.push`. That client transition does not settle reliably under test —
 * the session cookie is set and every protected page then answers 200, so what
 * the smoke would be measuring is the router, not the product. Asserting the
 * protected page renders proves the session more directly than watching the
 * address bar.
 */
async function signIn(page: Page, destination: string) {
  const response = await submitLogin(page, PASSWORD);
  expect(
    response.ok(),
    'the smoke credentials were refused: the server under test was started ' +
      'with a different MANAGER_ADMIN_PASSWORD than the run uses',
  ).toBe(true);

  await page.goto(destination);
  await expect(page).not.toHaveURL(/\/login/u);
}

test('the sign-in screen stands and refuses a wrong password', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Hebrew first, right to left: the commitment that is invisible to a unit
  // test and obvious the moment it breaks.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');

  const response = await submitLogin(page, 'definitely-not-the-password');

  expect(response.ok()).toBe(false);
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page).toHaveURL(/\/login/u);
});

test('a manager signs in and the round screen reports its numbers', async ({
  page,
}) => {
  await signIn(page, '/round');

  await expect(
    page.getByRole('region', { name: 'נתוני סבב אבחון' }),
  ).toBeVisible();

  // The tracking screen is aggregate-only by product invariant. This does not
  // prove the invariant — the repositories' tests do — but a respondent list
  // appearing here would be the visible half of that failure.
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('the share link a manager reads opens the questionnaire for a respondent', async ({
  page,
  browser,
}) => {
  await signIn(page, '/round');

  const shareLink = page.getByLabel('לינק אנונימי לשאלון');
  await expect(shareLink).toBeVisible();
  const shareUrl = await shareLink.inputValue();
  // `/answer/<share code>` is the respondent route; the manager screen builds
  // it through `respondentSurveyRoute`. Naming it here means a rename fails
  // the smoke, which is right: this is the link a school hands out.
  expect(shareUrl, 'the manager screen showed no share link to hand out').toMatch(
    /\/answer\/[^/]+/u,
  );

  // A respondent is not the manager: a fresh context carries no session
  // cookie, which is the whole point of an anonymous link.
  const respondent = await browser.newContext();
  const respondentPage = await respondent.newPage();
  await respondentPage.goto(new URL(shareUrl).pathname);

  await expect(respondentPage.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    respondentPage.getByRole('heading', { level: 1 }),
  ).toBeVisible();
  await expect(respondentPage.locator('body')).not.toContainText(
    'Application error',
  );

  await respondent.close();
});

test('the dashboard renders a map or says why it is locked', async ({ page }) => {
  await signIn(page, '/dashboard');

  // Both are correct outcomes and which one appears depends on the data the
  // environment holds, so the smoke asserts that the screen decided — not
  // which way. A blank page or a server error is neither.
  const locked = page.getByRole('heading', {
    name: /המפה עדיין נעולה|הניתוח עדיין נעול/u,
  });
  const map = page.getByRole('region', { name: /מפת|אבנים/u });
  const onboarding = page.getByRole('heading', { name: /סבב|בית ספר/u });

  await expect(locked.or(map).or(onboarding).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('body')).not.toContainText('Application error');
});
