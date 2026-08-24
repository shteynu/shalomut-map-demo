import { expect, test } from '@playwright/test';
import {
  ADMINISTRATOR,
  FIRST_SCHOOL_ID,
  SECOND_SCHOOL,
  administratorVisitsTo,
  ensurePeople,
  ensureSecondSchool,
  schoolName,
  signInAsAdministrator,
  signInAsMember,
} from './tenant-fixtures';

/**
 * Which school a manager is reading, in a browser.
 *
 * The rule lives in one expression in `src/middleware.ts` — `mayOpen`, built
 * from the session's active memberships and the platform-administrator flag —
 * and every manager screen below it reads only the headers that expression
 * sets. Unit and API tests cover it thoroughly and none of them can see what a
 * browser sees: a `?school=` in the address bar, a cookie the middleware writes
 * or refuses to write, and a screen that then renders somebody else's school.
 *
 * Every other spec in this directory signs in as one manager of one school and
 * never asks for another, so until this file existed the boundary had no
 * end-to-end evidence at all.
 *
 * The administrator specs use `/setup/`, for one reason: it names the school it
 * is showing, in a field with a label, whether or not that school has a round.
 *
 * The school user's spec cannot. Since 2026-08-23 `/setup/` is an
 * administrator-only screen (ADR-042) and a school user is redirected off it,
 * so that session is asked for `/` instead. The home screen names the school in
 * its eyebrow when the session has a round — the first school does — and hands
 * the name to `ManagerOnboarding` when it does not, which is the second
 * school's state. So both outcomes are legible on the same screen, and the
 * refusal is asserted against the whole page rather than one field: if the
 * boundary broke, the second school's name would render in the onboarding.
 *
 * Both sessions are minted rather than signed in, and this file runs against a
 * server of its own — `playwright.config.ts` explains why at `TENANT_PORT`. The
 * short version: with no identity provider, the directory a session renews
 * against is the password accounts, and none of them is an administrator, so a
 * minted administrator is signed out on the first activity event.
 */

const SCHOOL_NAME_FIELD = 'שם בית הספר';

test.beforeAll(async () => {
  await ensureSecondSchool();
  await ensurePeople();
});

test.describe('the tenant boundary', () => {
  test('a manager asking for a school they are not in stays where they are', async ({
    page,
    context,
  }) => {
    await signInAsMember(context);

    // The whole attack, such as it is: type another school's id into the URL.
    // The middleware refuses the choice and falls back to the one school this
    // session is a member of, so the screen must still be the manager's own.
    await page.goto(`/?school=${SECOND_SCHOOL.id}`);

    await expect(page.locator('body')).toContainText(
      await schoolName(FIRST_SCHOOL_ID),
    );
    // The second school has no round, so honouring the choice would land on the
    // onboarding screen with its name on it. Asserting against the whole page
    // catches that as well as a rendered dashboard for the wrong school.
    await expect(page.locator('body')).not.toContainText(SECOND_SCHOOL.name);

    // A refused choice must not be remembered either. Writing the cookie would
    // make the refusal a one-page event and the next navigation a second
    // attempt, this time with nothing in the URL to notice.
    const cookies = await page.context().cookies();
    const remembered = cookies.find(
      (cookie) => cookie.name === 'shalomut_school',
    );
    expect(remembered?.value ?? null).not.toBe(SECOND_SCHOOL.id);
  });

  test('a manager who is not an administrator is turned away from the administrator area', async ({
    page,
    context,
  }) => {
    await signInAsMember(context);

    await page.goto('/admin/');

    // Turned away rather than shown an empty console: the area is about every
    // school, so there is nothing in it a school user may see.
    await expect(page).not.toHaveURL(/\/admin/u);
  });

  test('a school user is turned away from the screens that act on a round, and from the log', async ({
    page,
    context,
  }) => {
    // The redirect that broke this file's first test when it landed. Nothing in
    // the browser suite covered it, so a change to `administratorOnlyScreens` or
    // to the middleware's role branch could quietly reopen all four and no
    // spec would notice — the API tests assert the 403, not the door.
    //
    // `/activity/` is the fourth and is refused for a different reason from the
    // other three: it is a read, and what it reads includes the record of an
    // administrator opening this school. It has no API route to refuse in its
    // place, so this door is the only one it has.
    await signInAsMember(context);

    for (const screen of ['/setup/', '/survey/', '/goals/', '/activity/']) {
      await page.goto(screen);
      await expect(page).toHaveURL(/\/(\?.*)?$/u);
    }

    // The reader's own screens are the negative control: if the redirect were
    // catching everything, the loop above would pass while the product was
    // unusable.
    await page.goto('/round/');
    await expect(page).toHaveURL(/\/round/u);
  });

  test('an administrator may open a school they do not belong to, and it is written down', async ({
    page,
    context,
  }) => {
    const before = await administratorVisitsTo(SECOND_SCHOOL.id);

    await signInAsAdministrator(context);
    await page.goto(`/setup/?school=${SECOND_SCHOOL.id}`);

    await expect(page.getByLabel(SCHOOL_NAME_FIELD)).toHaveValue(
      SECOND_SCHOOL.name,
    );

    // The permission and the record are one thing, not two: `loadManagerContext`
    // refuses to hand back a context whose visit it could not write. So the row
    // is not a nice-to-have alongside the screen above — the screen above is
    // evidence the row exists, and this asserts it directly rather than
    // trusting that reading.
    const after = await administratorVisitsTo(SECOND_SCHOOL.id);
    expect(after.length).toBeGreaterThan(before.length);
    expect(after.map((visit) => visit.managerId)).toContain(ADMINISTRATOR.id);
  });

  test('the log shows the administrator the visit they just made', async ({
    page,
    context,
  }) => {
    // The end of the loop the audit was missing: the write is recorded, the
    // record is read, and the reading is itself recorded. Opening this screen
    // over a school the administrator does not belong to writes a visit, so the
    // page cannot be empty — which is why this asserts the row rather than
    // merely that the screen renders.
    await signInAsAdministrator(context);
    await page.goto(`/activity/?school=${SECOND_SCHOOL.id}`);

    await expect(page).toHaveURL(/\/activity/u);
    await expect(
      page.getByRole('listitem').filter({ hasText: 'צפייה בבית הספר' }).first(),
    ).toContainText(ADMINISTRATOR.email);
  });

  test('an administrator reading a school is not the same as belonging to it', async ({
    page,
    context,
  }) => {
    await signInAsAdministrator(context);

    // The administrator area is theirs, which is the other half of the flag and
    // the thing that separates this session from the one above.
    await page.goto('/admin/');
    await expect(page).toHaveURL(/\/admin/u);
  });
});
