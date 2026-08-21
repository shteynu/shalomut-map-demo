# Phase 0 — a chosen school is honoured only for a member of it

## Metadata

- Branch: `feat/a-chosen-school-needs-a-membership`
- Base branch: `main`
- Base commit: `8a9d803`
- Current HEAD: `c8db2d6` (the documentation commit sits on top of it)
- Status: complete, verified and **landed on `main`** — its tip is `6a19916`,
  pushed by the owner on 2026-08-20. Archived 2026-08-20.
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Phase 0 of [`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
move the tenant boundary from "a school that exists" to "a school this session is
an active member of", while the deployment still has one membership per session
and the change therefore costs nothing to verify.

## User-visible outcome

None in the deployed runtime, which holds one school. In any runtime holding more
schools than the session is a member of, the setup screen's switcher stops
listing the schools the manager cannot open — which is the disclosure this phase
closes, and it is visible in the local database today.

## Context

`ManagerScopeService.resolveOrganizationId` accepted any `?school=` that appeared
in `orgRepo.findAll()`, and the session's memberships were never consulted. With
one manager that is a wrong screen; on the first day of phase 1 it is one query
parameter between a school user and another school's data. The plan puts the
check in the middleware, which already holds the session two lines above where it
sets the scope header.

## Scope

- The middleware honours a chosen school only for an **active** membership.
- The session's member schools travel to the app as a second server-owned header.
- `loadSchools` returns only the session's schools.
- `resolveOrganizationId`'s population-dependent branches count the session's
  schools rather than every school in the system.
- Regression tests that a foreign `?school=` is ignored.

## Non-goals

- The platform-administrator bypass. There are no administrators until phase 1;
  it arrives as one more branch in the same place.
- Persistent identity, invitations, the audit log, short sessions, school-user
  restrictions — phases 1 through 6.
- Any change to the respondent path, the worker secrets or the privacy threshold.

## Acceptance criteria

All met — see the evidence below.

## Relevant repository instructions

`AGENTS.md` (branch-scoped task state, mandatory handoff), `shalomut-tracker`,
`shalomut-verification` (rows: server guards; auth and authorization; browser
smoke for a user-visible flow).

## Relevant architecture and contracts

ADR-020 built the scope layer for this moment: "When memberships become real,
this is the layer that starts consulting them; nothing above it has to move."
That held — no route signature changed. ADR-009 in `PROJECT_CONTEXT.md` was
updated in the same task, because its sentence about a chosen school being
"matched against the schools that exist" is exactly what stopped being true.

## Decisions made

- **The check is in the middleware, not in `resolveOrganizationId`.** As the plan
  argued: that function receives a repository and an id and has no session.
- **The session's schools travel as a second header**
  (`x-shalomut-manager-member-organization-ids`), rather than each caller
  resolving the session again. It is deleted from the incoming request and
  re-set alongside the scope header, by the same function, so a client cannot
  send its own — there is a test for exactly that.
- **`resolveOrganizationId` gained an optional third argument** rather than a
  session object. Four call sites pass it; no route signature moved.
- **The population it reasons about is the session's existing schools, and the
  memberships themselves when none of those has a row yet.** That last case is
  the empty deployment naming the id its first school will be created with, which
  used to be expressed as "the system has no schools at all".
- **A remembered school the session is not a member of is deleted from the
  cookie** rather than refused again on every navigation. It is a preference
  being dropped; the access was already gone.
- **A suspended or invited membership is not a school.** Only `active` counts.
- **The `admin` role in `ManagerRole` is deliberately not a bypass.** The platform
  administrator of the 2026-08-20 model is a flag on `Manager` that does not exist
  yet, and quietly treating today's local `admin` account as one would have
  shipped phase 1's exception without phase 1's identity.

## Assumptions

- A session always carries its memberships; `createSession` refuses to mint one
  whose active organization is not among them. Verified in
  `jwt-session-provider.ts`.
- `undefined` member schools means "no session behind this call" and keeps the
  old system-wide behaviour. Every production caller that has a request passes
  the header through, so this is a fallback for tests and non-request callers,
  not a path a manager request can take.

## Completed

- `c8db2d6` — the boundary: `src/middleware.ts`, `src/lib/server/manager-scope.ts`,
  `src/lib/server/manager-context.ts`, `src/lib/services/manager-scope.service.ts`,
  `src/lib/services/manager-context.service.ts`, the two routes that resolve scope
  directly, and both test suites.
- The documentation commit on top: ADR-009 in `PROJECT_CONTEXT.md`, phase 0's
  status in the plan, the operational handoff, and this file.

## In progress

Nothing.

## Remaining

Push the branch — an owner action in this environment. Then phase 1, which is
blocked on one owner answer (own passwords or an identity provider).

## Changed files

- `src/middleware.ts`
- `src/lib/server/manager-scope.ts`
- `src/lib/server/manager-context.ts`
- `src/lib/services/manager-scope.service.ts`
- `src/lib/services/manager-context.service.ts`
- `src/app/api/rounds/route.ts`
- `src/app/api/manager/setup/route.ts`
- `src/lib/server/__tests__/middleware-school-scope.test.ts`
- `src/lib/services/__tests__/manager-scope.service.test.ts`
- `PROJECT_CONTEXT.md`, `docs/multi-tenancy-plan-2026-08-20.md`,
  `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

Local, on `c8db2d6` plus the documentation commit:

- `npm test` — 1231 passed, 0 failed. Three tests in
  `middleware-school-scope.test.ts` failed first and were meant to: they switched
  to a second school on a session that held one membership, which is the
  behaviour being removed. They now run on a two-membership session, and the
  suite grew from 5 to 10 tests and from 7 to 14 in the scope service.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run lint:doc-numbers`
  — all clean.
- **Real-runtime walk**, `next start` on port 3211 against the local database,
  which holds two schools (`local-dev-organization` and
  `34d05e66-fa4d-4a07-a2af-c9d5c41b6088`) with different rounds. Sessions were
  minted directly with `JwtSessionProvider` and the walk secret, so the walk could
  choose what memberships to hold:
  - One membership (`local-dev-organization`), asking for the other school:
    `/api/rounds?school=34d05e66-…` answered with `round_local_1786790341143`,
    organization `local-dev-organization`. `/dashboard?school=34d05e66-…`
    rendered that school's own active round. The foreign school has three rounds
    of its own, so honouring it would have been unmistakable.
  - The same session's `/setup` rendered **no school switcher at all** — the page
    has one `select`, and it is the audience one. `loadSchools` returned one
    school out of the two that exist.
  - Two memberships, asking for the second school: `/api/rounds?school=34d05e66-…`
    answered with `סבב פילוח נעול`, organization `34d05e66-…`, and `/setup`
    rendered the `school` select with both schools. Switching still works for
    someone entitled to switch.

### Failed

None.

### Blocked or not run

- No deployed verification. Nothing was deployed; the branch is unpushed.
- `verify:core` was not run end to end; the checks it contains that this diff can
  affect were run individually and are listed above.
- No database write of any kind. The walk only read.

### Environment

Local. `next start` on port 3211 with the throwaway `SESSION_SECRET` from the
`signed-in-walk-local-org` launch configuration, against the local database.

### Residual risk

- `undefined` member schools falls back to the old system-wide population. A new
  route that resolves scope itself and forgets the header would be
  system-scoped rather than refused. The middleware still narrows the scope
  header itself, so the exposure would be the fallback branch rather than an
  honoured `?school=`; the four current call sites all pass it.
- The two local schools share a name and a city, so screens naming the school
  cannot tell them apart. The walk therefore relied on round identity, which is
  distinct, rather than on the heading.

## Failed approaches

An earlier version of `resolveOrganizationId` kept the old "no school exists"
branch and added a membership test beside it. It refused the empty deployment
whose configured school has no row yet — a bootstrap the product depends on. The
population is the memberships in that case, which is what the committed version
says.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No credentials, no deployment alias, no schema change. The push itself is
an owner action in this environment.

## Questions requiring an owner decision

None left for this branch. The one that blocked phase 1 was answered while this
branch was being written: **identity comes from Google Workspace / OIDC and the
product stores no passwords**, owner, 2026-08-20, now recorded in §3 of the plan
with the accepted risk that a school not on Google cannot sign in until an
e-mailed link path exists.

## Next concrete step

Push `feat/a-chosen-school-needs-a-membership` to `main`, then start phase 1 on
its own branch: `Manager` and `OrganizationMembership` as rows behind the
interfaces in `src/lib/auth/domain-contract.ts`, the platform-administrator flag,
sign-in through the identity provider replacing `authenticateCredentials`'s
password path outright, and the second branch of the middleware check this branch
left one line away.
