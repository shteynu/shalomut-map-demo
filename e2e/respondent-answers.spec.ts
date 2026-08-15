import { expect, test, type Page } from '@playwright/test';

/**
 * The half of the product a school actually uses, walked to its end: consent,
 * every question, the review step, submit, and the screen that says the
 * answers arrived.
 *
 * Nothing in the repository had been here before. `smoke.spec.ts` stops at the
 * first screen of the questionnaire, and every one of the 700-odd tests below
 * it talks to functions rather than to a browser — so the answer stones, the
 * auto-advance, the review card and the submit request had never been clicked
 * by anything but a person, once per session, on a desktop. Two of the defects
 * this repository has already paid for lived exactly there: a scale anchor
 * that rendered `display: none` on a phone, and a heading that ate the page.
 *
 * **This test writes.** It submits one anonymous response to the seeded
 * round, which is the only way to prove the round takes answers, and it runs
 * once per project — so a full run leaves two more responses than it found.
 * That is ordinary here: the local and CI databases are disposable and reseeded
 * (`AGENTS.md`), and the response carries nothing but three colours per
 * question. It must never be pointed at an environment where that is not true.
 *
 * The phone matters as much as the path. `playwright.config.ts` runs this file
 * under a second project with a phone viewport and touch, because a
 * questionnaire that a teacher opens on the way home is the realistic case and
 * the desktop one is the exception.
 */

import { signIn } from './manager-session';

/** The three answer stones, by the word each one shows. */
const ANSWERS = ['ירוק', 'צהוב', 'אדום'] as const;

/**
 * How many steps this round walks, read off the progress line rather than
 * assumed to be the canonical 24: a round's questionnaire is its own snapshot,
 * and a test that hard-codes the default template would fail the day a school
 * removes a question — which is a supported thing to do.
 *
 * Steps, not questions, since the flow started walking steps: an allocation
 * grid and a block of Likert statements are each one screen holding many
 * questions. In the round this file seeds they coincide, every question being
 * its own step, which is why the loop below can answer one question per step.
 */
async function readStepTotal(page: Page): Promise<number> {
  const progress = page.locator('.survey-progress-sticky small');
  await expect(progress).toBeVisible();
  const text = (await progress.textContent()) ?? '';
  const match = /מתוך\s+(\d+)/u.exec(text);

  expect(match, `the progress line did not say how many steps: "${text}"`)
    .not.toBeNull();

  return Number(match![1]);
}

test('a respondent answers every question and the round takes the answers', async ({
  page,
}) => {
  await signIn(page, '/round');

  const shareLink = page.getByLabel('לינק אנונימי לשאלון');
  await expect(shareLink).toBeVisible();
  const shareUrl = await shareLink.inputValue();
  expect(shareUrl, 'the manager screen showed no share link to hand out').toMatch(
    /\/answer\/[^/]+/u,
  );

  /*
   * The manager's session is dropped rather than a second context opened.
   *
   * `browser.newContext()` — which is what the smoke does — starts from the
   * browser's defaults and not from the project's, so under the phone project
   * it would hand back a desktop window and this file's whole reason for
   * existing would quietly evaporate. Clearing the cookie leaves the device
   * emulation where it is and still proves the point the fresh context was
   * making: what follows happens with no session at all.
   */
  await page.context().clearCookies();
  await page.goto(new URL(shareUrl).pathname, { waitUntil: 'networkidle' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const accept = page.getByRole('button', { name: /הבנתי, אפשר להתחיל/u });
  await expect(
    accept,
    'the share link did not open the questionnaire: an inactive round serves ' +
      'the dead-link screen, which has no buttons',
  ).toBeVisible();

  // The promise about the language model is a product commitment, not copy —
  // `survey-consent-step.tsx` says so at length. A respondent must not be able
  // to reach a question without having been shown it.
  await expect(page.getByText(/מודל שפה של ספק חיצוני/u)).toBeVisible();

  await accept.click();

  const total = await readStepTotal(page);
  expect(total, 'the round asked no questions').toBeGreaterThan(0);

  for (let index = 0; index < total; index++) {
    const heading = page.locator('.survey-focus-card h2');
    await expect(heading).toBeVisible();
    await expect(
      heading,
      `question ${index + 1} rendered with no text`,
    ).not.toHaveText('');

    const stones = page.locator('button.answer-stone');
    await expect(
      stones,
      `question ${index + 1} did not offer the three answers`,
    ).toHaveCount(ANSWERS.length);

    /*
     * The first question is measured, not merely queried.
     *
     * A stone that is present in the DOM and has no box is exactly the failure
     * this file was written for: the scale anchors shipped once with
     * `display: none` on a narrow screen, and every assertion that asks the
     * document rather than the layout passed straight over it. `toBeVisible`
     * would catch that one, so this adds the case it would not — a stone small
     * enough to be untappable while technically visible.
     */
    if (index === 0) {
      for (const answer of ANSWERS) {
        const stone = page.getByRole('button', { name: new RegExp(answer, 'u') });
        await expect(stone).toBeVisible();
        const box = await stone.boundingBox();
        expect(box, `the ${answer} stone has no box on this viewport`).not.toBeNull();
        // 44px is the WCAG AA target size this project commits to in AGENTS.md,
        // and a stone below it on a phone is a stone a thumb misses.
        expect(
          box!.height,
          `the ${answer} stone is ${Math.round(box!.height)}px tall`,
        ).toBeGreaterThanOrEqual(44);
      }
    }

    // Varied on purpose: three identical answers would leave a scoring path
    // that only ever sees one value, and the round's own numbers would be
    // indistinguishable from a stuck button.
    const answer = ANSWERS[index % ANSWERS.length];
    await page.getByRole('button', { name: new RegExp(answer, 'u') }).click();

    // The flow advances itself 260 ms after a tap. Waiting for the progress
    // line to move is what proves the answer registered — clicking and
    // trusting it would pass against a button that does nothing.
    const remaining = total - index - 1;
    await expect(page.locator('.survey-progress-sticky small')).toHaveText(
      remaining === 0
        ? new RegExp(`הושלמו ${total} מתוך ${total}`, 'u')
        : new RegExp(`שלב ${index + 2} מתוך ${total}`, 'u'),
      { timeout: 10_000 },
    );
  }

  await expect(page.getByRole('heading', { name: /הכל מוכן לשליחה/u })).toBeVisible();

  const submitted = page.waitForResponse(
    (response) =>
      /\/api\/survey\/[^/]+\/submit/u.test(response.url()) &&
      response.request().method() === 'POST' &&
      (response.status() < 300 || response.status() >= 400),
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: /שליחת שאלון/u }).click();

  const response = await submitted;
  expect(
    response.status(),
    'the round refused the answers a respondent just spent five minutes giving',
  ).toBe(200);

  await expect(page.getByRole('heading', { name: /תודה, התשובות נקלטו/u })).toBeVisible();

  // The last promise of the consent screen, kept: the respondent is told the
  // answers are in and given nothing to identify themselves with.
  await expect(page.locator('body')).not.toContainText('Application error');
});
