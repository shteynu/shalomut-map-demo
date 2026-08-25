import { expect, test, type Page } from '@playwright/test';

/**
 * The breakdown screen, on a round that has something to break down.
 *
 * Until the seed grew a background question this screen could only ever be
 * read in its empty state — the canonical instrument is analytic from end to
 * end, so no seeded round asked anything a table could group by. Every walk of
 * `/breakdown` therefore proved that the empty state renders and nothing else.
 * `scripts/seed-local.ts` now gives the closed round two background questions
 * and thirty responses divided so that both halves of the privacy rule are on
 * the screen at once, and these two tests are what that seed makes possible.
 *
 * The round switcher is how they reach it, for the same reason the map spec
 * uses it: the seeded round ids are generated from a timestamp, and the manager
 * lands on the active round, whose breakdown is locked exactly as its map is.
 */

import { signIn } from './manager-session';

/** The threshold `seed-local.ts` gives the seeded rounds. */
const PRIVACY_THRESHOLD = 10;

async function openTheBreakdownOfTheClosedRound(page: Page) {
  await signIn(page, '/breakdown');

  const switcher = page.locator('#round-switcher-select');
  await expect(switcher).toBeVisible({ timeout: 15_000 });

  const closedRound = await switcher.evaluate((select) =>
    [...(select as HTMLSelectElement).options].find((option) =>
      option.textContent?.includes('סגור'),
    )?.value,
  );

  expect(
    closedRound,
    'the round switcher offers no closed round, so no breakdown can open',
  ).toBeTruthy();

  await switcher.selectOption(closedRound as string);

  await expect(page.locator('.breakdown-table')).toBeVisible({
    timeout: 20_000,
  });
}

test('the breakdown publishes the groups above the threshold and blanks the rest', async ({
  page,
}) => {
  await openTheBreakdownOfTheClosedRound(page);

  const published = page.locator(
    '.breakdown-group-size:not(.breakdown-group-size-hidden)',
  );
  const blanked = page.locator('.breakdown-group-size-hidden');

  // Both states, because either one alone is consistent with a screen that has
  // stopped consulting the suppression rule at all: a table that publishes
  // everything and a table that publishes nothing both look deliberate.
  expect(
    await published.count(),
    'no group is published, so the table proves nothing about what may be shown',
  ).toBeGreaterThan(0);
  expect(
    await blanked.count(),
    'no group is blanked, so the table proves nothing about what may not be',
  ).toBeGreaterThan(0);

  for (const text of await published.allInnerTexts()) {
    const size = Number.parseInt(text.trim(), 10);
    expect(
      size,
      `a group of ${text.trim()} is published on a round whose threshold is ${PRIVACY_THRESHOLD}`,
    ).toBeGreaterThanOrEqual(PRIVACY_THRESHOLD);
  }
});

test('the breakdown table scrolls on a phone without taking the page with it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTheBreakdownOfTheClosedRound(page);

  // The table is wider than a phone and scrolls inside its own box, which is
  // the design. What is not the design is the document scrolling with it: the
  // suppressed cells carry an absolutely positioned `.visually-hidden` span,
  // and with nothing positioned between it and the page it escaped the box
  // that was supposed to be doing the scrolling and dragged three pixels of
  // sideways scroll onto the whole screen.
  const measured = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    tableScrolls:
      (document.querySelector('.breakdown-table-scroll')?.scrollWidth ?? 0) >
      (document.querySelector('.breakdown-table-scroll')?.clientWidth ?? 0),
  }));

  expect(
    measured.tableScrolls,
    'the table fits the phone, so this test is no longer watching anything',
  ).toBe(true);
  expect(
    measured.scrollWidth - measured.clientWidth,
    'the page scrolls sideways on a phone',
  ).toBeLessThanOrEqual(0);
});
