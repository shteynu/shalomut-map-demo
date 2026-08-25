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

  // And the third way this panel can fail, which no measurement of its own box
  // can see: it renders at full size, in the right place, underneath the page.
  // A `.stat-stone` is rotated, and a transform makes a stacking context, so
  // the panel's own `z-index` is spent inside the stone; the action cards below
  // the grid come later in the document and painted over its lower two thirds.
  // `elementFromPoint` asks the only question that matters — if a manager
  // clicked where the last bullet is, would they hit the bullet?
  const readable = await panel.evaluate((node) => {
    const box = node.getBoundingClientRect();
    // The panel's own foot sits below a 720px fold, as the note above says, and
    // `elementFromPoint` answers nothing at all for a point outside the
    // viewport. So this asks about the lowest row of it that is on screen —
    // which is the row the action cards used to cover, because those cards
    // begin immediately below the stone grid.
    const y = Math.min(box.bottom - 8, window.innerHeight - 12);
    const topmost = document.elementFromPoint(box.left + box.width / 2, y);

    return { y, inside: y > box.top, covering: Boolean(topmost && node.contains(topmost)) };
  });

  expect(
    readable.inside,
    'the open tooltip starts below the fold, so nothing about it was measured',
  ).toBe(true);

  expect(
    readable.covering,
    `something on the page paints over the open privacy tooltip at y=${readable.y}`,
  ).toBe(true);
});

/**
 * The manager header, on a phone.
 *
 * `playwright.config.ts` runs the manager screens at desktop size on purpose,
 * and that reasoning still holds for their content — a school reads the map on
 * a laptop. The header is the exception the owner asked for on 2026-08-25: it
 * is the same component on every screen, it is the first thing a phone shows,
 * and it was failing there in two ways at once. Eight destinations wrapped
 * into a two-column grid that broke every label of more than one word across
 * three lines, and the identity chip beside them overflowed the viewport by
 * 30px — which gave every manager screen a sideways scrollbar, not just this
 * one.
 *
 * Resizing inside the desktop project rather than adding a mobile project: the
 * config's objection to the latter is the minutes it costs, and this is
 * seconds.
 */
test('the manager header holds one line of navigation on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, '/');

  const navigation = page.getByRole('navigation', { name: 'ניווט ראשי' });
  await expect(navigation).toBeVisible();

  const rows = await navigation.evaluate((node) => {
    const tops = [...node.querySelectorAll('a')].map((link) =>
      Math.round(link.getBoundingClientRect().top),
    );

    return new Set(tops).size;
  });

  expect(
    rows,
    'the header navigation stacked into rows instead of scrolling sideways',
  ).toBe(1);

  const geometry = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    geometry.scrollWidth,
    `the page is ${geometry.scrollWidth - geometry.clientWidth}px wider than the ` +
      'phone it is being read on',
  ).toBeLessThanOrEqual(geometry.clientWidth + 1);
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

/**
 * The caret on the round switcher, which was pointing at nothing.
 *
 * It is drawn without an image: two square tiles, each filled diagonally by a
 * `linear-gradient`, sitting side by side so their hypotenuses meet into a
 * downward triangle. A 45deg gradient fills its tile's top-right corner and a
 * 135deg one fills the top-left, so the 45deg tile has to be the inline-start
 * half. Reversed, the two halves meet at their *outer* corners instead and the
 * control wears an M — two peaks with a valley between them, at the size of a
 * pair of quotation marks. It shipped that way on every screen that switches
 * rounds, schools or breakdowns.
 *
 * Asserted as the order of the two halves rather than as pixels, because a
 * pixel baseline for a 10px mark would be a screenshot to maintain forever and
 * this is the whole of the rule. The trap is worth naming too: the recipe this
 * came from anchors both tiles on `right`, where the same order is correct.
 * Anchored on `left`, as an RTL product does, the order flips.
 */
test('the round switcher wears a caret and not an M', async ({ page }) => {
  await signIn(page, '/');

  const switcher = page.locator('#round-switcher-select');
  await expect(switcher).toBeVisible({ timeout: 15_000 });

  const caret = await switcher.evaluate((node) => {
    const style = getComputedStyle(node);

    // The image list is not split on commas: every gradient carries `rgba(...)`
    // stops with commas of their own. Two gradients is the whole of this
    // recipe, so where each angle appears in the string is the order they are
    // painted in, and the positions — which carry no parentheses — do split.
    const image = style.backgroundImage;
    const positions = style.backgroundPosition
      .split(',')
      .map((one) => one.trim());
    const fortyFive = image.indexOf('(45deg');
    const oneThirtyFive = image.indexOf('(135deg');

    return {
      positions,
      halves: positions.length,
      bothAngles: fortyFive >= 0 && oneThirtyFive >= 0,
      fortyFiveFirst: fortyFive < oneThirtyFive,
      offsets: positions.map((one) => Number.parseFloat(one)),
    };
  });

  expect(
    caret.halves === 2 && caret.bothAngles,
    'the caret is no longer two diagonal gradients; this guard needs rewriting ' +
      'for whatever draws it now',
  ).toBe(true);

  const [start, end] = caret.fortyFiveFirst
    ? [caret.offsets[0], caret.offsets[1]]
    : [caret.offsets[1], caret.offsets[0]];

  expect(
    Number.isFinite(start) && Number.isFinite(end),
    `the caret's offsets no longer read as lengths (${caret.positions.join(', ')}), ` +
      'so which half is inline-start is the thing to re-derive here',
  ).toBe(true);

  expect(
    start,
    'the two halves of the caret do not meet: the 45deg tile fills its own ' +
      'top-right corner, so it has to be the inline-start half, or the pair ' +
      'joins at its outer corners and the control wears an M ' +
      `(45deg at ${start}px, 135deg at ${end}px)`,
  ).toBeLessThan(end);
});

/**
 * The slot between the top of the window and the sticky header.
 *
 * The header floats: `top: 1rem` when stuck, `margin-top: 1rem` at rest, so it
 * never appears to move. What the two have in common is a 16px slot above the
 * card, and until this guard existed the page scrolled through that slot in
 * full — on this screen the share link, a whole legible line of text, slid
 * across the top of the window above the header.
 *
 * The test hit-tests rather than looks: what is wrong is that something *other
 * than the header* answers at those coordinates, and no screenshot comparison
 * states that as directly as asking the document who is there. It runs on the
 * round screen because that is where the leak was worst, and the header is the
 * same element on every manager screen.
 */
test('the page does not show through the slot above the sticky header', async ({
  page,
}) => {
  // Short on purpose: the guard needs the page to scroll, and the round screen
  // fits inside a tall enough window with nothing left over to pass behind.
  await page.setViewportSize({ width: 1280, height: 560 });
  await signIn(page, '/round');

  const header = page.locator('.site-header');
  await expect(header).toBeVisible({ timeout: 15_000 });
  // The screen's own content, not just its header: the document is barely
  // taller than the window until the round's panel has rendered into it.
  await expect(
    page.getByRole('region', { name: 'נתוני סבב אבחון' }),
  ).toBeVisible({ timeout: 15_000 });

  const room = await page.evaluate(() => {
    window.scrollTo(0, 600);
    return document.documentElement.scrollHeight - window.innerHeight;
  });

  expect(
    room,
    'the round screen no longer scrolls, so nothing can pass behind the header',
  ).toBeGreaterThan(200);

  const intruders = await page.evaluate(() => {
    const main = document.getElementById('main-content')!;
    const box = document
      .querySelector('.site-header')!
      .getBoundingClientRect();
    const found: string[] = [];

    // Every pixel row of the slot, across the window rather than across the
    // card: the metric stones overhang the header by a few pixels and the
    // survey builder's history slot by thirty, so a check that stopped at the
    // card's edges would not be checking the part that leaks last.
    //
    // `main` and `body` are allowed answers. The band is `#main-content`'s own
    // `::before`, and hit-testing a pseudo-element reports the element that
    // generated it; a bare `main` where the band is absent means empty
    // container, which is also nothing showing through. What may never answer
    // is a piece of the page — the check below is what keeps that from being
    // vacuous.
    for (let y = 0; y < Math.floor(box.top); y += 2) {
      for (let x = 20; x < window.innerWidth - 20; x += 40) {
        const element = document.elementFromPoint(x, y);
        if (
          element &&
          element !== main &&
          element !== document.body &&
          element !== document.documentElement &&
          !element.closest('.site-header')
        ) {
          found.push(`${element.tagName.toLowerCase()} at ${x},${y}`);
        }
      }
    }

    return {
      top: box.top,
      band: getComputedStyle(main, '::before').backgroundImage,
      found: found.slice(0, 6),
      count: found.length,
    };
  });


  expect(
    intruders.top,
    'the header no longer floats below the top of the window, so this guard ' +
      'needs rewriting for whatever holds it now',
  ).toBeGreaterThan(0);

  expect(
    intruders.count,
    `the page shows through the slot above the header: ${intruders.found.join(', ')}`,
  ).toBe(0);

  // Read second because the count above is the behaviour and this is how it is
  // achieved — but read at all, because an unpainted band hit-tests exactly
  // like a painted one and would leave the count green over a visible leak.
  expect(
    intruders.band,
    'nothing paints the slot, so what the page shows there is whatever happens ' +
      'to be behind it',
  ).not.toBe('none');
});
