import { expect, test } from '@playwright/test';

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

import { signIn, submitLogin } from './manager-session';

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

  /*
   * The consent screen by name, not "some `h1` rendered".
   *
   * The looser assertion is what this test shipped with, and it passed for
   * months against the wrong page: `scripts/seed-local.ts` seeded its round as
   * `closed`, `answer/[shareCode]/page.tsx` calls `notFound()` for a round
   * that is not active, and `not-found.tsx` is a Hebrew RTL page with an `h1`
   * of its own — הקישור אינו פעיל. Every assertion above passed on the dead
   * link, so the sentence in this file's header, that a respondent "sees the
   * questionnaire", was never once verified.
   *
   * Naming the accept button fixes that in the direction that cannot rot: the
   * dead-link screen has no buttons at all.
   */
  await expect(
    respondentPage.getByRole('button', { name: /הבנתי, אפשר להתחיל/u }),
    'the share link did not open the questionnaire — a dead-link or ' +
      'not-found screen also renders an RTL heading',
  ).toBeVisible();
  await expect(respondentPage.locator('body')).not.toContainText(
    'Application error',
  );

  await respondent.close();
});

/**
 * The privacy tooltip is a paragraph of prose inside a 22rem panel, and every
 * line of it has to read as prose. That sounds too obvious to test until it
 * isn't: the three bullet lead-ins shipped rendering at 46.4px on this screen
 * and stayed that way through a refactor of the very component that holds them,
 * because `.custom-tooltip-content strong` ties on specificity with
 * `.stat-stone strong` — a 2.9rem number — and loses on source order.
 *
 * Nothing about that failure is visible to a unit test: the markup was right,
 * the class names were right, and only the cascade was wrong. Nor was it caught
 * by asserting a handful of named elements, which is what the check before this
 * one did — it read the five sizes someone thought to name and walked past the
 * three that were broken. So this enumerates *every* text node in the open
 * panel and lets the worst one speak.
 *
 * The ceiling is 17px rather than the exact design sizes on purpose. The
 * tooltip's own title is 1.05rem and the body 0.84rem, and a future designer
 * may move either; what may never happen again is a line of this panel
 * rendering at headline size. Pinning the exact values would turn every
 * deliberate typography change into a failing test, which is how a guard gets
 * deleted.
 */
test('the privacy tooltip reads as prose, and the stone it sits on still shouts', async ({
  page,
}) => {
  await signIn(page, '/');

  const trigger = page
    .getByRole('button', { name: 'הסבר על סף הפרטיות' })
    .first();
  await expect(trigger).toBeVisible();

  // The panel is `display: none` while closed, so it has no geometry and no
  // useful computed styles until the trigger is pressed. Hover would open it
  // too; the click is what a touch user does and it survives a headless run.
  await trigger.click();

  const panel = page.getByRole('tooltip').first();
  await expect(panel).toBeVisible();

  const measured = await panel.evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const lines: { text: string; px: number }[] = [];

    for (let cursor = walker.nextNode(); cursor; cursor = walker.nextNode()) {
      const text = cursor.textContent?.trim() ?? '';
      const parent = cursor.parentElement;
      if (!text || !parent) {
        continue;
      }
      lines.push({
        text: text.slice(0, 40),
        px: Number.parseFloat(getComputedStyle(parent).fontSize),
      });
    }

    const box = node.getBoundingClientRect();

    return {
      lines,
      // A panel that grew past its own box would be the same defect showing up
      // as clipped text rather than as a huge word.
      clipped: node.scrollHeight > node.clientHeight + 1,
      // Horizontal only. The panel is 22rem of prose anchored below a stone
      // partway down the home screen, so in a 720px viewport its foot sits
      // below the fold — measured at 798px, and the reader scrolls. Sideways
      // is different: this panel centres itself on its trigger, nothing
      // scrolls it back, and text too wide for it goes off the edge unread.
      offscreen: box.left < 0 || box.right > window.innerWidth,
      width: box.width,
    };
  });

  const MAX_TOOLTIP_PX = 17;
  const oversized = measured.lines.filter((line) => line.px > MAX_TOOLTIP_PX);

  expect(
    measured.lines.length,
    'the tooltip opened empty: no text node to measure',
  ).toBeGreaterThan(0);
  expect(
    oversized,
    `these lines of the privacy tooltip render above ${MAX_TOOLTIP_PX}px, which ` +
      'means something outside the panel is winning the cascade over ' +
      '.custom-tooltip-content',
  ).toEqual([]);
  expect(measured.clipped, 'the tooltip panel is taller than its own box').toBe(
    false,
  );
  expect(
    measured.offscreen,
    `the tooltip panel (${Math.round(measured.width)}px wide) runs off the ` +
      'side of the viewport',
  ).toBe(false);

  // The other half of the assertion, and the reason the fix above is a scalpel
  // and not a hammer: the stone's own number is *supposed* to be enormous. A
  // change that quieted the tooltip by quieting `.stat-stone strong` would pass
  // every check above and be a worse bug than the one it fixed.
  const stoneNumber = page.locator('.stat-stone > strong').first();
  await expect(stoneNumber).toBeVisible();
  const stoneNumberPx = await stoneNumber.evaluate((node) =>
    Number.parseFloat(getComputedStyle(node).fontSize),
  );
  expect(
    stoneNumberPx,
    'the headline number on the stat stone shrank to tooltip size',
  ).toBeGreaterThan(30);
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
