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
 * `/setup/` is the screen throughout, for one reason: it names the school it is
 * showing, in a field with a label, whether or not that school has a round.
 * `/` needs a round before it says anything identifying, and giving the second
 * school one would put it into the one-active-round-per-school rule that the
 * other specs' school is already in.
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
    await page.goto(`/setup/?school=${SECOND_SCHOOL.id}`);

    await expect(page.getByLabel(SCHOOL_NAME_FIELD)).toHaveValue(
      await schoolName(FIRST_SCHOOL_ID),
    );
    await expect(page.getByLabel(SCHOOL_NAME_FIELD)).not.toHaveValue(
      SECOND_SCHOOL.name,
    );

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
