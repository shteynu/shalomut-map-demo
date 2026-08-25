import { expect, test, type Page } from '@playwright/test';

/**
 * Whether the marks on a stone are on the stone.
 *
 * Every stone on the map is an organic `border-radius`, and each of the eight
 * has its own. Two decorations are placed against that shape by absolute
 * offsets: the ordinal badge in one top corner and the "+" in the other. Both
 * were anchored to the corner of the *bounding box* instead, which is a place
 * the paint has already curved away from — so on a screen they sat on the page
 * behind the stone rather than on it, in a product whose whole visual language
 * is that nothing has a straight edge.
 *
 * A measurement of either element alone cannot see this: each box is where the
 * stylesheet asked for it, sized as asked, and visible. What is wrong is the
 * relationship between two elements, and the only cheap way to state it is to
 * recompute the shape. So this spec reads the used `border-radius` of every
 * stone and asks whether the four corners of each mark satisfy the corner
 * ellipse they are nearest — the same inequality that decides which pixels the
 * stone paints.
 *
 * Twice, because the two layouts place the marks differently and for different
 * reasons: on the map a stone is a small free-floating shape, and stacked into
 * one column it is as wide as the screen and barely taller than its copy, so
 * its top corners fall away far sooner.
 *
 * The seeded closed round is what makes this runnable — `seed-local.ts` puts
 * it above the privacy threshold precisely so that its map opens — and the
 * round switcher is how the spec reaches it without knowing the generated id.
 */

import { signIn } from './manager-session';

type StrayMark = {
  stone: string;
  mark: string;
  corner: string;
};

/**
 * Every corner of every mark that is outside the shape it decorates.
 *
 * The whole judgement happens in the page because the pseudo-element carrying
 * the ordinal has no handle out here: `getComputedStyle(stone, '::after')` is
 * the only way to learn where it was placed and how big it came out.
 */
async function strayMarks(page: Page): Promise<StrayMark[]> {
  return page.evaluate(() => {
    const size = (value: string) => Number.parseFloat(value) || 0;

    // Percentages resolve the way the property resolves them: horizontal radii
    // against the width, vertical against the height. Only the two top corners
    // are tested, because that is where both marks sit; a point outside both
    // corner boxes is inside the shape by definition.
    const isInside = (
      point: { x: number; y: number },
      width: number,
      height: number,
      radius: string,
    ) => {
      const [horizontalList, verticalList] = radius
        .split('/')
        .map((half) => half.trim().split(/\s+/u));
      const resolve = (list: string[], total: number) =>
        list.map((value) =>
          value.endsWith('%')
            ? (Number.parseFloat(value) / 100) * total
            : Number.parseFloat(value),
        );

      const [topLeftX, topRightX] = resolve(horizontalList, width);
      const [topLeftY, topRightY] = resolve(
        verticalList ?? horizontalList,
        height,
      );

      if (point.x < topLeftX && point.y < topLeftY) {
        return (
          ((topLeftX - point.x) / topLeftX) ** 2 +
            ((topLeftY - point.y) / topLeftY) ** 2 <=
          1
        );
      }

      if (point.x > width - topRightX && point.y < topRightY) {
        return (
          ((point.x - (width - topRightX)) / topRightX) ** 2 +
            ((topRightY - point.y) / topRightY) ** 2 <=
          1
        );
      }

      return true;
    };

    const stray: StrayMark[] = [];

    for (const stone of document.querySelectorAll<HTMLElement>(
      '.dashboard-map-blob',
    )) {
      const width = stone.offsetWidth;
      const height = stone.offsetHeight;
      const radius = getComputedStyle(stone).borderRadius;
      const index = stone.dataset.stoneIndex ?? '?';

      const boxes: {
        mark: string;
        left: number;
        top: number;
        width: number;
        height: number;
      }[] = [];

      const plus = stone.querySelector<HTMLElement>('.dashboard-map-blob-plus');

      if (plus) {
        const placed = getComputedStyle(plus);

        boxes.push({
          mark: 'the "+"',
          left: size(placed.left),
          top: size(placed.top),
          width: plus.offsetWidth,
          height: plus.offsetHeight,
        });
      }

      const badge = getComputedStyle(stone, '::after');

      boxes.push({
        mark: 'the ordinal badge',
        left: width - size(badge.right) - size(badge.width),
        top: size(badge.top),
        width: size(badge.width),
        height: size(badge.height),
      });

      for (const box of boxes) {
        const corners = {
          'top-left': { x: box.left, y: box.top },
          'top-right': { x: box.left + box.width, y: box.top },
          'bottom-left': { x: box.left, y: box.top + box.height },
          'bottom-right': { x: box.left + box.width, y: box.top + box.height },
        };

        for (const [corner, point] of Object.entries(corners)) {
          if (!isInside(point, width, height, radius)) {
            stray.push({ stone: index, mark: box.mark, corner });
          }
        }
      }
    }

    return stray;
  });
}

async function openTheMapOfTheClosedRound(page: Page) {
  await signIn(page, '/dashboard');

  const switcher = page.locator('#round-switcher-select');
  await expect(switcher).toBeVisible({ timeout: 15_000 });

  // By the option's own text rather than by index: the seed generates the round
  // ids from a timestamp, and which round the switcher opens on depends on
  // which one is active.
  const closedRound = await switcher.evaluate((select) =>
    [...(select as HTMLSelectElement).options].find((option) =>
      option.textContent?.includes('סגור'),
    )?.value,
  );

  expect(
    closedRound,
    'the round switcher offers no closed round, so no map can open',
  ).toBeTruthy();

  await switcher.selectOption(closedRound as string);

  await expect(page.locator('.dashboard-map-blob').first()).toBeVisible({
    timeout: 20_000,
  });
}

function report(stray: StrayMark[], where: string) {
  return `marks outside the shape they decorate ${where}: ${stray
    .map((one) => `${one.mark} on stone ${one.stone} (${one.corner})`)
    .join('; ')}`;
}

test('every mark on a stone of the map is on the stone', async ({ page }) => {
  await openTheMapOfTheClosedRound(page);

  const stray = await strayMarks(page);

  expect(stray, report(stray, 'on the map')).toEqual([]);
});

test('every mark stays on its stone once the map stacks into a column', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTheMapOfTheClosedRound(page);

  const stray = await strayMarks(page);

  expect(stray, report(stray, 'on a phone')).toEqual([]);
});
