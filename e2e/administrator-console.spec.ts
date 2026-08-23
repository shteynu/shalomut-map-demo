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

/** The school names rendered as cards, in the order they appear. */
async function cardNames(page: Page): Promise<string[]> {
  return page.locator('article.admin-school h3').allInnerTexts();
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

    const second = await cardNames(page);
    expect(second.length).toBeGreaterThan(0);
    // The property the whole change turns on, seen from the browser: the second
    // page is other schools, not the first page again.
    for (const name of second) {
      expect(first).not.toContain(name);
    }

    await pager.getByRole('link', { name: 'הקודם' }).click();
    expect(await cardNames(page)).toEqual(first);
  });

  test('a search narrows the list to the school that was asked for', async ({
    page,
  }) => {
    await page.goto('/admin/');
    await expect(page.locator('article.admin-school').first()).toBeVisible();

    await page.getByRole('searchbox', { name: 'חיפוש בית ספר' }).fill(RARE);
    await page.getByRole('button', { name: 'חיפוש' }).click();

    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(RARE)}`, 'u'));
    expect(await cardNames(page)).toEqual([`בית ספר ${RARE}`]);

    // A search short enough to fit on one page has no pager, and a page-two
    // link left over from before the search would be a link to nothing.
    await expect(
      page.getByRole('navigation', { name: 'דפדוף בין בתי ספר' }),
    ).toHaveCount(0);

    await page.getByRole('link', { name: 'ניקוי' }).click();
    expect((await cardNames(page)).length).toBeGreaterThan(1);
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
