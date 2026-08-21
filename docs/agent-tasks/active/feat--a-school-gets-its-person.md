# Phase 2 — the administrator area, and invitations

## Metadata

- Branch: `feat/a-school-gets-its-person`
- Base branch: `feat/the-audit-log-survives-a-restart` (phase 3), itself stacked
  on `feat/identity-becomes-a-row` (phase 1). None of the three is pushed.
- Base commit: `914abdb`
- Current HEAD: `be3c0d7` plus the documentation commit on top
- Status: complete and verified, unpushed
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Phase 2 of [`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
give the platform a way to open a school and to decide who reaches it. Until
now the only `managers` row that could ever exist was the first administrator's,
bootstrapped from `MANAGER_ADMIN_EMAIL`.

## User-visible outcome

A platform administrator has a screen — `/admin` — listing every school, the
person in each, and the people with a row and nowhere to go. From it they open a
school, invite its user, invite another administrator, and revoke. Everybody
else has no such screen and no such routes.

## Context

Phase 1 made identity a row and phase 3 made the audit log durable. Neither gave
anybody a way in: an invitation had no mechanism, and the deployment had exactly
one person.

## Scope

Delivered:

- `/admin` and three routes under `/api/admin`, gated in the middleware and
  again in each of them.
- `ManagerAdministrationService`: the overview, invite into a school, invite an
  administrator, revoke and restore.
- Invitation accepted by arriving — `invited` becomes `active` on first sign-in.
- One user per school, enforced.
- Opening a school became an administrator's act, on the screen and in the route.
- Five audit actions that actually happen, replacing one that never did.

## Non-goals

- An e-mail notification. Nothing is sent; see the decision below.
- What an administrator can see *about* every school beyond its name, city and
  staff count — that is phase 4.
- Immediate revocation, which is phase 5.
- What a school user may not do, which is phase 6 and still undecided.

## Acceptance criteria

All met; see the evidence.

## Decisions made

- **An invitation is an entitlement, not a credential**, so nothing is sent and
  nothing is set. The plan asked for a signed token, an e-mail and a
  set-password screen; none of that survives the identity decision of
  2026-08-20, and §3 of the plan had already said what replaces it. The
  membership is written `invited`, the person signs in with their organizational
  account, and arriving is the acceptance.
- **`invited` is kept as a state** rather than inviting straight into `active`.
  It costs nothing and it is the only way the screen can show an invitation
  nobody used — which is how a mistyped address becomes visible instead of
  silently never working.
- **Every invitation activates on any successful sign-in**, not only the one
  being accepted. One rule rather than a per-school ceremony, in a product that
  gives a person one school anyway.
- **A school has one user, enforced.** A second invitation is refused while a
  standing membership exists — `active` or `invited`, since an unaccepted
  invitation is still an invitation. Replacement is revoke-then-invite, which is
  what the plan said replacement is; a suspended membership therefore does not
  block the next invitation.
- **Revocation is a status, never a delete.** The audit log's `manager_id`
  points at that row, and a school that changes hands twice should still be able
  to say who had it when. Restoring is refused while somebody else holds the
  school.
- **The membership's role is `admin`.** The owner's model gives a school one
  person who does everything today's manager does, and `manager` is the
  read-only half of `RolePermissionService`. The word collides with platform
  administrator and means something narrower.
- **The administrator area refuses with `404`**, matching the rest of the
  product: a `403` has confirmed the area exists.
- **Gated twice, in the middleware and in each route and the page.** Not
  ceremony: the middleware decides from a matcher that can be edited, and the
  routes need the session anyway to name the actor in the audit log, so the
  second check costs one verification.
- **Opening a school became a platform act.** It is the plan's own model, and it
  had been broken for everybody else since phase 0 — the creator got no
  membership, so the boundary refused them the school they had just opened and
  the screen bounced them back without saying why. A refusal with a reason is
  strictly better than that.
- **A school is created with no round.** The staff count is set here because it
  is the floor under every privacy threshold the school can choose; the first
  round belongs to the school's own user. `/setup?school=new` still opens a
  school *with* its first round, and is now administrator-only too.
- **`MEMBER_ROLE_CHANGED` was removed** from the action list. It was declared in
  slice 3, nothing can change a role, and phase 3 had just finished objecting to
  declared actions nobody records. `SCHOOL_CREATED`, `MEMBER_INVITED`,
  `MEMBER_REVOKED`, `MEMBER_RESTORED` and `ADMINISTRATOR_INVITED` replace it.
- **A platform-level event files under `platform`**, not `unknown`: it is not
  that nobody knows which school, it is that there is none.
- **The e-mail address is not re-read from the provider.** An invitation may
  name a person, and a second invitation does not rename them: an administrator's
  typo should not overwrite a name.

## Assumptions

- The administrator can tell the invitee out of band that they have been given a
  school. This is what makes shipping without an e-mail provider honest rather
  than incomplete, and it holds while the population is four administrators and
  a handful of schools.
- Nobody needs revocation to be instant yet. Phase 5 is the answer and it is
  named in the route's own comment.

## Completed

- `be3c0d7` — the service, the three routes, the page and its console, the
  middleware gate, the sign-in acceptance, the setup-screen change, the audit
  actions, and the two directory queries the screen needs.
- The documentation commit on top: ADR-027, the plan's phase 2 marked
  implemented with four struck-through bullets, `PROGRESS.md`, backlog §8 and
  the operational handoff.

## Remaining

Nothing on this branch.

## Changed files

Identity and administration: `src/lib/auth/manager-administration-service.ts`,
`src/lib/auth/manager-directory-service.ts`, `src/lib/auth/domain-contract.ts`,
`src/lib/auth/manager-audit-service.ts`,
`src/lib/repositories/prisma/prisma-manager.repository.ts`,
`src/lib/repositories/prisma/prisma-client.ts`.

Boundary: `src/middleware.ts`, `src/lib/server/admin-area.ts`,
`src/lib/server/session-auth.ts`, `src/lib/server/manager-audit.ts`.

Screens and routes: `src/app/admin/page.tsx`,
`src/components/admin/admin-console.tsx`, `src/app/api/admin/**`,
`src/app/api/manager/setup/route.ts`, `src/app/setup/page.tsx`,
`src/components/layout/manager-user-bar.tsx`, `src/lib/navigation.ts`,
`src/app/globals.css`.

Tests: `src/lib/auth/__tests__/manager-administration-service.test.ts`,
`src/app/api/admin/__tests__/admin-routes.test.ts`, and additions to
`middleware-school-scope.test.ts`, `api.test.ts`,
`manager-directory-service.test.ts` and `oidc-sign-in.test.ts`.

## Verification evidence

### Passed

Local:

- `npm test` — 1319 passed, 0 failed (1295 before this branch): 12 service
  tests, 8 route tests, 3 middleware tests, 1 setup-refusal test.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run lint:composition`,
  `npm run lint:doc-numbers`, `npm run openapi:check`,
  `npm run docs:endpoints:check` — all clean. The last two are unchanged because
  `/api/admin` is a manager surface, not part of the machine-authenticated
  endpoint contract.
- No migration. Phase 2 uses the tables phase 1 created.
- **Real-runtime walk**, `next start` on port 3212 against the local database,
  with the same stand-in OpenID Connect provider phases 1 and 3 used:
  - The administrator's `/admin` renders in Hebrew and RTL, listing both
    existing schools, the person in one of them, and themselves marked "אתם".
    Screenshot taken.
  - Creating a school answered `201` and left a `SCHOOL_CREATED` row.
  - Inviting `Walk.Newcomer@Example.Test` answered `201`, stored the address
    lowercased, wrote the membership `invited`, and left a `MEMBER_INVITED` row.
  - A second invitation to the same school answered `409` with
    "Revoke them first — a school has one user."
  - The invitee signed in through the provider and `/api/auth/me` showed them
    inside the new school; the database showed their membership had become
    `active`. Arriving accepted the invitation.
  - That school user's `/admin` redirected to `/`, and their `POST
    /api/admin/schools` answered `404`.
  - Their attempt to open a school through `/api/manager/setup` answered `403`
    with the reason, and no organization was created.
  - Revoking answered `200`, left a `MEMBER_REVOKED` row, and their next sign-in
    ended at `/login?error=no_active_membership` with no session cookie.
  - The administrator opening the new school from the area's own link left an
    `ADMINISTRATOR_SCHOOL_VISIT` row — phase 3 still holds through the new
    screen.
  - Creating the school did **not** leave a visit row. Creating is not reading.

### Failed

None.

### Blocked or not run

- **A real Google sign-in**, and therefore the provider's own screens in RTL.
  No OAuth client exists; that is the owner's, and the plan lists it.
- **The deployed runtime.** Nothing was deployed.
- **The `/admin` forms driven through the browser.** The page was rendered and
  read in the browser; the four mutations were exercised against the running
  server with cookie jars rather than by clicking, which tests the same routes
  the forms post to but not the form wiring itself. The console has no unit
  tests either — that is the thinnest part of this branch.
- `npm run verify:core` end to end; the checks in it this diff can affect were
  each run.

### Environment

Local. `next start` on port 3212 with throwaway secrets from
`.claude/launch.json`, against the local Docker database. The stand-in provider
is a scratchpad script and is not in the repository. The walk left rows in the
local database — a school, a revoked person, and their audit trail — which is
disposable data on a disposable database.

### Residual risk

- **Revocation is not immediate**, and a revoked person keeps working until
  their day-long token expires. Proven in the walk: after revocation their
  existing session still read their school. Phase 5.
- **The administrator console has no tests.** Its behaviour is a thin layer over
  four routes that are all tested, but a broken form would not be caught.
- **Nothing notifies an invitee.** If the administrator forgets to tell them,
  the invitation sits `invited` forever and looks identical to a typo.
- **`findAllManagers` returns every named person** and is the one query of that
  shape in the product. It is called from the administrator area only, which is
  why that area is gated twice rather than merely unlinked.
- **Two doors open a school**: `/admin` (school alone) and `/setup?school=new`
  (school plus its first round). Both are administrator-only now, but they are
  two paths with different results, and the second still exists mostly because
  removing it is phase 6's kind of decision.

## Known risks

An administrator can now create people and take their access away, and every one
of those acts is a row in `audit_events` — but nothing renders that table, so
reviewing what an administrator did still means opening the database.

## Approval gates

- None new. No secret, credential, alias or authentication configuration
  changed; the standing gate on the OAuth client is untouched and still the
  owner's.

## Questions requiring an owner decision

- Who may read the audit log, and whether a school sees the visits made to it.
  Unchanged from phase 3, and nothing here waits on it.
- Which e-mail provider — now a convenience rather than a blocker.

## Next concrete step

Push `feat/a-school-gets-its-person`, which carries phases 1 and 3 under it, and
apply both migrations to the deployed database. Then phase 4: what an
administrator can see about every school — counts and lists first, and the
k-anonymity limit designed in rather than checked afterwards.
