// First, and on its own line, for the same reason `tenant-fixtures` says so.
import './local-database-url';
import { expect, test, type Page } from '@playwright/test';
import { resolveCoreRepositories } from '../src/lib/composition-root';
import { ensurePeople, signInAsAdministrator } from './tenant-fixtures';

/**
 * The administrator console, with more schools on the platform than fit on a
 * screen.
 *
 * Everything else about this change is asserted without a browser: the service
 * asks for a page, the repositories agree on what a page is, and PostgreSQL
 * agrees about `ILIKE` and about `OFFSET` needing a total order. None of that
 * says the screen has a way to reach page two. The pager and the search box are
 * links and a `GET` form — they work by navigating, which is the one thing a
 * unit test cannot watch happen.
 *
 * It runs on the tenant server rather than the smoke one because it needs a
 * platform administrator, and the password door cannot issue one. See
 * `TENANT_PORT` in `playwright.config.ts`.
 */

/**
 * Enough schools to page, with fixed ids.
 *
 * Reused rather than recreated, the way `SECOND_SCHOOL` is: a developer's
 * database keeps one set of these instead of one set per run. The names carry
 * their index so the assertions below can say which school they are looking at.
 */
const PAGED_SCHOOLS = 25;
const PREFIX = 'e2e-paged-school';

/** A word that appears in exactly one school's name, for the search. */
const RARE = 'אוניקום';

async function ensurePagedSchools(): Promise<void> {
  const { orgRepo } = resolveCoreRepositories();

  for (let index = 0; index < PAGED_SCHOOLS; index += 1) {
    const id = `${PREFIX}-${String(index).padStart(2, '0')}`;
    if (await orgRepo.findById(id)) continue;

    await orgRepo.create({
      id,
      name: index === 0 ? `בית ספר ${RARE}` : `בית ספר לעימוד ${index}`,
      city: 'עיר הבדיקה',
      schoolType: 'יסודי',
      totalStaffCount: 20,
      // Distinct instants, ascending with the index, so the order on screen is
      // a fact about the data rather than about the insertion order.
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 86_400_000),
    });
  }
}

/**
 * The school-name headings, as a locator rather than as text.
 *
 * Every assertion below goes through this rather than through `cardNames`,
 * because a locator assertion retries and a read does not. That distinction is
 * the whole of this file's history with flakiness: these pages are reached by
 * following a link or submitting a `GET` form, so each step is a real document
 * navigation, and `toHaveURL` resolves when the address bar agrees — not when
 * the new document has rendered. Reading the cards in the instant between the
 * two returns the empty list, once every several runs.
 */
function cards(page: Page) {
  return page.locator('article.admin-school h3');
}

/** The school names rendered as cards, in the order they appear. */
async function cardNames(page: Page): Promise<string[]> {
  return cards(page).allInnerTexts();
}

test.describe('the administrator console', () => {
  test.beforeEach(async ({ context }) => {
    await ensurePeople();
    await ensurePagedSchools();
    await signInAsAdministrator(context);
  });

  test('a platform larger than a screenful arrives one page at a time', async ({
    page,
  }) => {
    await page.goto('/admin/');

    const first = await cardNames(page);
    // Twenty is `DEFAULT_SCHOOL_PAGE_SIZE`. Asserted as "at most" because the
    // database this runs against may hold other schools from other specs, and
    // what matters is the ceiling rather than the exact number.
    expect(first.length).toBeLessThanOrEqual(20);
    expect(first.length).toBeGreaterThan(0);

    const pager = page.getByRole('navigation', { name: 'דפדוף בין בתי ספר' });
    await expect(pager).toBeVisible();
    // On the first page there is nowhere back to, and the link is absent rather
    // than present and inert.
    await expect(pager.getByRole('link', { name: 'הקודם' })).toHaveCount(0);

    await pager.getByRole('link', { name: 'הבא' }).click();
    await expect(page).toHaveURL(/page=2/u);
    // Waits for the second document to be the one on screen, and does it by
    // asserting the property rather than by sleeping: page two opens with a
    // school page one did not have.
    await expect(cards(page).first()).not.toHaveText(first[0]);

    const second = await cardNames(page);
    expect(second.length).toBeGreaterThan(0);
    // The property the whole change turns on, seen from the browser: the second
    // page is other schools, not the first page again.
    for (const name of second) {
      expect(first).not.toContain(name);
    }

    await pager.getByRole('link', { name: 'הקודם' }).click();
    await expect(cards(page)).toHaveText(first);
  });

  test('a search narrows the list to the school that was asked for', async ({
    page,
  }) => {
    await page.goto('/admin/');
    await expect(page.locator('article.admin-school').first()).toBeVisible();
    const unsearched = await cardNames(page);

    await page.getByRole('searchbox', { name: 'חיפוש בית ספר' }).fill(RARE);
    await page.getByRole('button', { name: 'חיפוש' }).click();

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(RARE)}`, 'u'));
    await expect(cards(page)).toHaveText([`בית ספר ${RARE}`]);

    // A search short enough to fit on one page has no pager, and a page-two
    // link left over from before the search would be a link to nothing.
    await expect(
      page.getByRole('navigation', { name: 'דפדוף בין בתי ספר' }),
    ).toHaveCount(0);

    // Clearing returns the page the search was started from, so the assertion
    // is that list rather than "more than one" — which a stale document still
    // showing the pre-search page would also satisfy.
    await page.getByRole('link', { name: 'ניקוי' }).click();
    await expect(cards(page)).toHaveText(unsearched);
  });

  test('a search that matches nothing says so, rather than showing everything', async ({
    page,
  }) => {
    // The shape of the `ILIKE` defect as a reader would meet it: a search that
    // matches nothing must not fall back to the whole platform.
    await page.goto(`/admin/?q=${encodeURIComponent('אין-בית-ספר-כזה')}`);

    await expect(page.locator('article.admin-school')).toHaveCount(0);
    await expect(page.locator('.admin-empty').first()).toBeVisible();
  });
});
