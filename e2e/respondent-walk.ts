import { expect, type Locator, type Page } from '@playwright/test';
import { signIn } from './manager-session';

/**
 * Walking the questionnaire, for the specs that need to be at the end of it.
 *
 * Extracted when a second spec needed the same walk for a different reason —
 * `respondent-answers.spec.ts` is about what the screens look like on the way,
 * and `submit-retry-is-recorded.spec.ts` is about what happens once the last
 * answer is in. Both have to get there the same way, and the progress line has
 * already changed its wording once (`שאלה N מתוך M` became `שלב N מתוך M`,
 * which turned CI red on a stale test). Once is enough for that to be in two
 * files.
 */

/** The three answer stones, by the word each one shows. */
export const ANSWERS = ['ירוק', 'צהוב', 'אדום'] as const;

/**
 * How many steps this round walks, read off the progress line rather than
 * assumed to be the canonical 24: a round's questionnaire is its own snapshot,
 * and a test that hard-codes the default template would fail the day a school
 * removes a question — which is a supported thing to do.
 *
 * Steps, not questions, since the flow started walking steps: an allocation
 * grid and a block of Likert statements are each one screen holding many
 * questions. In the round these specs seed they coincide, every question being
 * its own step, which is why the loop below can answer one question per step.
 */
export async function readStepTotal(page: Page): Promise<number> {
  const progress = page.locator('.survey-progress-sticky small');
  await expect(progress).toBeVisible();
  const text = (await progress.textContent()) ?? '';
  const match = /מתוך\s+(\d+)/u.exec(text);

  expect(match, `the progress line did not say how many steps: "${text}"`)
    .not.toBeNull();

  return Number(match![1]);
}

/**
 * Signs a manager in, takes the share link off their screen, drops the session
 * and opens the questionnaire as a stranger would.
 *
 * The manager's session is dropped rather than a second context opened.
 * `browser.newContext()` starts from the browser's defaults and not from the
 * project's, so under the phone project it would hand back a desktop window and
 * that project's whole reason for existing would quietly evaporate. Clearing
 * the cookie leaves the device emulation where it is and still proves the point
 * the fresh context was making: what follows happens with no session at all.
 *
 * Returns the consent button rather than clicking it, so a caller can assert
 * about the consent screen before accepting it.
 */
export async function openQuestionnaireAsRespondent(
  page: Page,
): Promise<Locator> {
  await signIn(page, '/round');

  const shareLink = page.getByLabel('לינק אנונימי לשאלון');
  await expect(shareLink).toBeVisible();
  const shareUrl = await shareLink.inputValue();
  expect(shareUrl, 'the manager screen showed no share link to hand out').toMatch(
    /\/answer\/[^/]+/u,
  );

  await page.context().clearCookies();
  await page.goto(new URL(shareUrl).pathname, { waitUntil: 'networkidle' });

  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const accept = page.getByRole('button', { name: /הבנתי, אפשר להתחיל/u });
  await expect(
    accept,
    'the share link did not open the questionnaire: an inactive round serves ' +
      'the dead-link screen, which has no buttons',
  ).toBeVisible();

  return accept;
}

/**
 * Answers every step and leaves the flow on the review screen.
 *
 * `onStep` runs after each step's heading and stones are on screen and before
 * the answer is given, which is where a spec that cares about the layout puts
 * its measurements.
 */
export async function answerEveryStep(
  page: Page,
  total: number,
  onStep?: (index: number) => Promise<void>,
): Promise<void> {
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

    await onStep?.(index);

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
}
