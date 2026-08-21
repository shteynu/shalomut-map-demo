// First, and on its own line: it must run before anything reaches the
// database, and it must not be mistaken for `dotenv/config`. See the file.
import './local-database-url';
import type { BrowserContext } from '@playwright/test';
import { SMOKE_SESSION_SECRET, TENANT_BASE_URL } from '../playwright.config';
import { JwtSessionProvider } from '../src/lib/auth/jwt-session-provider';
import { ADMINISTRATOR_SCHOOL_VISIT } from '../src/lib/auth/manager-audit-service';
import { resolveCoreRepositories } from '../src/lib/composition-root';
import { SESSION_COOKIE_NAME } from '../src/lib/server/session-auth';
import type { Manager, OrganizationMembership } from '../src/lib/auth/types';

/**
 * The second school, and the administrator who is not in it.
 *
 * `playwright.config.ts` pins the server to one school — `local-dev-organization`,
 * the one `seed-local.ts` fills — and the password door hands out accounts that
 * are members of exactly that school and administrators of nothing. Both halves
 * of the tenant boundary need something the harness cannot produce: a school
 * nobody in the run belongs to, and a session that is allowed into it anyway.
 *
 * They are built here rather than in the spec so that the spec reads as a walk
 * and not as a setup script, and through the application's own repositories
 * rather than SQL, so a schema change breaks this file the way it breaks the
 * product.
 *
 * `./local-database-url` is what gives this file a `DATABASE_URL` locally, and
 * why it is not `dotenv/config`.
 */

/** The school under `MANAGER_ORGANIZATION_ID`, which every other spec signs into. */
export const FIRST_SCHOOL_ID =
  process.env.MANAGER_ORGANIZATION_ID ?? 'local-dev-organization';

/**
 * A fixed id, not a generated one. The run creates this school if it is
 * missing and reuses it otherwise, so repeated runs against a developer's
 * database leave one extra school behind rather than one per run.
 */
export const SECOND_SCHOOL = {
  id: 'e2e-second-school',
  name: 'בית ספר שני לבדיקת גבול',
} as const;

/**
 * No round, deliberately. A school with an active round would take part in the
 * one-active-round-per-school rule and give the other specs a second school to
 * stumble over; `/setup/` names a school with or without one, which is all this
 * boundary needs to be visible.
 */
export async function ensureSecondSchool(): Promise<void> {
  const { orgRepo } = resolveCoreRepositories();
  if (await orgRepo.findById(SECOND_SCHOOL.id)) return;

  await orgRepo.create({
    id: SECOND_SCHOOL.id,
    name: SECOND_SCHOOL.name,
    city: 'עיר הבדיקה',
    schoolType: 'יסודי',
    totalStaffCount: 20,
    createdAt: new Date(),
  });
}

export async function schoolName(organizationId: string): Promise<string> {
  const { orgRepo } = resolveCoreRepositories();
  const organization = await orgRepo.findById(organizationId);
  if (!organization) throw new Error(`No school '${organizationId}' to read`);
  return organization.name;
}

/** Recorded visits to one school, newest first is not guaranteed and not needed. */
export async function administratorVisitsTo(
  organizationId: string,
): Promise<{ managerId: string }[]> {
  const { auditLogRepo } = resolveCoreRepositories();
  const events = await auditLogRepo.findByOrganizationId(organizationId);
  return events
    .filter((event) => event.action === ADMINISTRATOR_SCHOOL_VISIT)
    .map((event) => ({ managerId: event.managerId }));
}

/**
 * A manager of the first school and nothing else, in the database.
 *
 * The password door would have supplied one, and this spec's server does not
 * have that door open — see `TENANT_PORT` in `playwright.config.ts`. Since the
 * administrator has to be a row anyway, both sides of the boundary are rows,
 * which also means both are read the way the deployment reads them.
 */
export const MEMBER: Manager = {
  id: 'e2e-school-member',
  email: 'member@shalomut.test',
  name: 'מנהלת בית ספר לבדיקה',
  isPlatformAdministrator: false,
  createdAt: new Date(),
};

const MEMBERSHIP: OrganizationMembership = {
  id: 'e2e-school-membership',
  managerId: MEMBER.id,
  organizationId: FIRST_SCHOOL_ID,
  role: 'manager',
  status: 'active',
  createdAt: new Date(),
};

export const ADMINISTRATOR: Manager = {
  id: 'e2e-platform-administrator',
  email: 'platform@shalomut.test',
  name: 'מנהל פלטפורמה לבדיקה',
  isPlatformAdministrator: true,
  createdAt: new Date(),
};

/**
 * The administrator needs a row, not only a token.
 *
 * A session is short and renews itself by re-reading the directory, so a
 * manager who exists only inside a signed token is refused on the first
 * renewal with `USER_NOT_FOUND` and the browser lands back on `/login` — which
 * is the product being right and the fixture being half-built. Found by
 * watching exactly that happen.
 *
 * No membership goes with it. That is the whole point of the person: an
 * administrator belongs to no school, and every school they open is one they
 * are not in.
 */
export async function ensurePeople(): Promise<void> {
  const { managerRepo } = resolveCoreRepositories();

  if (!(await managerRepo.findById(ADMINISTRATOR.id))) {
    await managerRepo.saveManager(ADMINISTRATOR);
  }

  if (!(await managerRepo.findById(MEMBER.id))) {
    await managerRepo.saveManager(MEMBER);
    await managerRepo.saveMembership(MEMBERSHIP);
  }
}

/**
 * Put a session in the browser, without a door.
 *
 * Both callers below are about what happens *after* a session exists, and the
 * doors have specs of their own: `login-transition.spec.ts` for the password
 * one, and the provider's is not reachable from a test at all. Minting keeps
 * this file's subject to one thing.
 */
async function setSession(
  context: BrowserContext,
  manager: Manager,
  activeOrganizationId: string | null,
  memberships: OrganizationMembership[],
): Promise<void> {
  const provider = new JwtSessionProvider(SMOKE_SESSION_SECRET);
  const { token } = await provider.createSession(
    manager,
    activeOrganizationId,
    memberships,
  );

  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: token,
      url: TENANT_BASE_URL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/** A manager of the first school, and of no other. */
export async function signInAsMember(context: BrowserContext): Promise<void> {
  await setSession(context, MEMBER, FIRST_SCHOOL_ID, [MEMBERSHIP]);
}

/**
 * Put a platform administrator's session into the browser.
 *
 * Minting the token instead of signing in is a deliberate narrowing: the door
 * has its own specs, and the only door that can produce an administrator is the
 * identity provider, which the local runtime does not have. What this spec is
 * about starts one step later — a session that names no school, carries no
 * membership, and is allowed to open any school that exists.
 *
 * `createSession` refuses a school user with no active school, so passing
 * `null` here is itself a small proof that the flag is what makes the session
 * legal.
 */
export async function signInAsAdministrator(
  context: BrowserContext,
): Promise<void> {
  await setSession(context, ADMINISTRATOR, null, []);
}
