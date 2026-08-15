import { expect, test } from '@playwright/test';
import {
  answerEveryStep,
  openQuestionnaireAsRespondent,
  readStepTotal,
} from './respondent-walk';

/**
 * The failure the deployed endpoint has, reproduced on purpose, walked to the
 * end of what the product now does about it.
 *
 * On 2026-08-15 the first submit after an idle period returned nothing at all —
 * no invocation reached the function, so the request died upstream of every
 * line of code in this repository. `sendWithRetry` sends again and the
 * respondent never learns anything went wrong, which is right for the
 * respondent and left the failure with no witness at all. The report this file
 * checks is the witness put back.
 *
 * Aborting the first request is a faithful stand-in for that: the browser's
 * `fetch` rejects, which is exactly the shape the retry is written for and
 * exactly what `net::ERR_EMPTY_RESPONSE` produced. What it cannot reproduce is
 * the *cause*, which is out of reach from here and from anywhere in this
 * repository.
 *
 * **This test writes.** It stores one anonymous response in the seeded round,
 * as `respondent-answers.spec.ts` does and for the same reason: the local and
 * CI databases are disposable (`AGENTS.md`). It must never be pointed at an
 * environment where that is not true.
 */

test('a submission that had to be sent twice says so, and still arrives', async ({
  page,
}) => {
  const accept = await openQuestionnaireAsRespondent(page);
  await accept.click();

  const total = await readStepTotal(page);
  expect(total, 'the round asked no questions').toBeGreaterThan(0);

  await answerEveryStep(page, total);

  await expect(page.getByRole('heading', { name: /הכל מוכן לשליחה/u })).toBeVisible();

  /*
   * Only the first send dies. A route that killed every attempt would prove
   * the `lost` half instead, and that half cannot also prove the answers
   * arrive — which is the property this failure most needs to keep.
   */
  let submitAttempts = 0;
  await page.route(/\/api\/survey\/[^/]+\/submit/u, async (route) => {
    submitAttempts += 1;
    if (submitAttempts === 1) {
      await route.abort('connectionfailed');
      return;
    }
    await route.continue();
  });

  const reported = page.waitForRequest(
    (request) =>
      /\/api\/survey\/[^/]+\/delivery/u.test(request.url()) &&
      request.method() === 'POST',
    { timeout: 30_000 },
  );

  await page.getByRole('button', { name: /שליחת שאלון/u }).click();

  // The screen says it is trying again rather than leaving one spinner
  // spinning. A respondent watching this is the reason the retry exists.
  await expect(page.getByRole('button', { name: /מנסה שוב/u })).toBeVisible({
    timeout: 10_000,
  });

  const report = await reported;
  expect(
    JSON.parse(report.postData() ?? 'null'),
    'the report did not say what the delivery actually cost',
  ).toEqual({ outcome: 'recovered', attempts: 2 });

  await expect(page.getByRole('heading', { name: /תודה, התשובות נקלטו/u })).toBeVisible();

  expect(
    submitAttempts,
    'the retry sent more times than the policy allows',
  ).toBe(2);

  // The report is a beacon, not a gate: whatever the server did with it, the
  // respondent is on the thank-you screen and the answers are stored.
  await expect(page.locator('body')).not.toContainText('Application error');
});
