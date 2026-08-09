import { expect, test, type Page } from '@playwright/test';

/**
 * The header, while a manager is opening a round that does not exist yet.
 *
 * `/setup?round=new` is how the setup screen is asked for a round the school
 * has not got. `new` is a sentinel, and the setup screen is its only reader.
 * The header used to pass it on to every link it renders, so a manager who
 * touched the menu mid-form arrived at `/round?round=new`,
 * `/survey?round=new` or `/dashboard?round=new` — screens that look the value
 * up as an id, find nothing, and say the round was not found and may have been
 * deleted. Nothing had been deleted. The round did not exist yet, which is what
 * the screen they came from is for.
 *
 * Found by walking the deployed endpoint on 2026-08-09; the unit half is
 * `navigationRoundId` in `src/lib/__tests__/navigation.test.ts`. This is the
 * half that only exists once the page renders: the header reads the query
 * string in the browser, inside a Suspense boundary, and no unit test sees
 * that wiring.
 *
 * Read-only, like `smoke.spec.ts`: it opens the form and never submits it, so
 * the run leaves the database as it found it.
 */

import { SMOKE_PASSWORD } from '../playwright.config';

const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@shalomut.edu.il';

async function signIn(page: Page, destination: string) {
  await page.goto(`/login?${new URLSearchParams({ next: destination })}`, {
    waitUntil: 'networkidle',
  });
  await page.getByLabel('כתובת דוא"ל').fill(EMAIL);
  await page.getByLabel('סיסמה').fill(SMOKE_PASSWORD);

  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes('/api/auth/login') &&
        (candidate.status() < 300 || candidate.status() >= 400),
      { timeout: 30_000 },
    ),
    page.getByRole('button', { name: /התחבר|כניסה/u }).click(),
  ]);

  expect(
    response.ok(),
    'the smoke credentials were refused: the server under test was started ' +
      'with a different MANAGER_ADMIN_PASSWORD than the run uses',
  ).toBe(true);

  await expect(page).not.toHaveURL(/\/login/u, { timeout: 30_000 });
}

test('opening a new round leaves the menu pointing at real screens', async ({
  page,
}) => {
  await signIn(page, '/setup?round=new');
  await page.waitForURL(/\/setup/u, { timeout: 30_000 });

  // The form is the one for a round being opened, not the running round's.
  await expect(
    page.getByRole('heading', { name: 'פתיחת סבב אבחון חדש' }),
  ).toBeVisible({ timeout: 30_000 });

  const menu = page.getByRole('navigation', { name: 'ניווט ראשי' });
  const hrefs = await menu.getByRole('link').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href') ?? ''),
  );

  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    expect(href, `${href} carries the sentinel into a screen that reads it as an id`)
      .not.toMatch(/round=new/u);
  }
});

test('the menu still carries a round that is a round', async ({ page }) => {
  // The other half of the rule: dropping `new` must not drop real round ids,
  // which is how the map, the builder and the tracking screen stay on the round
  // a manager is reading.
  await signIn(page, '/round');
  await page.waitForURL(/\/round/u, { timeout: 30_000 });

  const roundId = await page.evaluate(async () => {
    const response = await fetch('/api/rounds', { headers: { accept: 'application/json' } });
    const body = (await response.json()) as { round?: { id?: string } };
    return body.round?.id ?? '';
  });
  expect(roundId).not.toBe('');

  await page.goto(`/round?round=${encodeURIComponent(roundId)}`, {
    waitUntil: 'networkidle',
  });

  const menu = page.getByRole('navigation', { name: 'ניווט ראשי' });
  await expect(menu.getByRole('link', { name: /מפת השלומות/u })).toHaveAttribute(
    'href',
    new RegExp(`round=${roundId}`, 'u'),
  );
});
