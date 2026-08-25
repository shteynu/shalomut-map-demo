import { expect, test } from '@playwright/test';

/**
 * The header card and the content below it are one shell, and share one width.
 *
 * They were sized by four declarations in three media blocks that nobody had
 * compared: `.site-header` took its phone width from a second
 * `@media (max-width: 768px)` block seven hundred lines below the first, while
 * `.page` narrowed its own gutter at 760px and again at 430px. Nothing
 * overflowed and nothing looked broken in a screenshot — the content simply
 * finished two pixels outside the header on a phone, and four below 430px.
 *
 * A screenshot is exactly what cannot catch that, which is why this measures
 * edges instead. `--shell-width` and `--shell-gutter` are now the single
 * source; this test is what notices when a fifth declaration appears beside
 * them.
 */

import { signIn } from './manager-session';

const WIDTHS = [1440, 760, 390];

/** Sub-pixel layout rounding, not a disagreement about the width. */
const TOLERANCE = 1;

for (const width of WIDTHS) {
  test(`the header and the page share their edges at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page, '/round');
    await expect(page.locator('.site-header')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.page')).toBeVisible({ timeout: 15_000 });

    const measured = await page.evaluate(() => {
      const edges = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { left: box.left, right: box.right };
      };

      return {
        header: edges('.site-header'),
        page: edges('.page'),
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      };
    });

    expect(measured.header, 'no header on a screen that should have one').not.toBeNull();
    expect(measured.page, 'no page').not.toBeNull();

    const header = measured.header!;
    const content = measured.page!;

    expect(
      Math.abs(header.left - content.left),
      `the header starts at ${header.left} and the content at ${content.left}`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(
      Math.abs(header.right - content.right),
      `the header ends at ${header.right} and the content at ${content.right}`,
    ).toBeLessThanOrEqual(TOLERANCE);
    expect(measured.overflow, 'the page scrolls sideways').toBeLessThanOrEqual(0);
  });
}

test('the survey builder history sits in the same shell as the columns above it', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, '/survey');

  const slot = page.locator('.survey-builder-history-slot');
  await expect(slot).toBeVisible({ timeout: 20_000 });

  const measured = await page.evaluate(() => {
    const edges = (selector: string) => {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      return { left: box.left, right: box.right };
    };

    return { header: edges('.site-header'), slot: edges('.survey-builder-history-slot') };
  });

  // It is a child of `.page`, so its old `min(1240px, calc(100% - 2rem))` was
  // measured against 1180 and subtracted a gutter that had already been taken.
  expect(
    Math.abs(measured.header.left - measured.slot.left),
    `the header starts at ${measured.header.left} and the history at ${measured.slot.left}`,
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(measured.header.right - measured.slot.right),
    `the header ends at ${measured.header.right} and the history at ${measured.slot.right}`,
  ).toBeLessThanOrEqual(1);
});
