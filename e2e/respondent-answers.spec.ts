import { expect, test } from '@playwright/test';

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

import {
  ANSWERS,
  answerEveryStep,
  openQuestionnaireAsRespondent,
  readStepTotal,
} from './respondent-walk';

test('a respondent answers every question and the round takes the answers', async ({
  page,
}) => {
  const accept = await openQuestionnaireAsRespondent(page);

  // The promise about the language model is a product commitment, not copy —
  // `survey-consent-step.tsx` says so at length. A respondent must not be able
  // to reach a question without having been shown it.
  await expect(page.getByText(/מודל שפה של ספק חיצוני/u)).toBeVisible();

  await accept.click();

  const total = await readStepTotal(page);
  expect(total, 'the round asked no questions').toBeGreaterThan(0);

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
  await answerEveryStep(page, total, async (index) => {
    if (index !== 0) return;

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
  });

  await expect(page.getByRole('heading', { name: /הכל מוכן לשליחה/u })).toBeVisible();

  /*
   * The delivery beacon stays off the ordinary path.
   *
   * It exists to count the submissions that had to be sent twice, and its
   * whole cost model rests on never firing for the ones that did not. A change
   * that made it unconditional would double the requests of the product's most
   * important action and would look like nothing on any screen.
   */
  const deliveryReports: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/survey\/[^/]+\/delivery/u.test(request.url())) {
      deliveryReports.push(request.url());
    }
  });

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

  expect(
    deliveryReports,
    'a submission that went through first time still paid for a beacon',
  ).toEqual([]);

  // The last promise of the consent screen, kept: the respondent is told the
  // answers are in and given nothing to identify themselves with.
  await expect(page.locator('body')).not.toContainText('Application error');
});
