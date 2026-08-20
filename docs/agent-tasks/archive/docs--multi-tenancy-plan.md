# Multi-tenancy: research and plan

## Metadata

- Branch: `docs/multi-tenancy-plan`
- Base branch: `main`
- Base commit: `6d6ec97`
- Final content commit: `136a752`; this archive commit sits on top of it
- Status: complete, merged and archived. Reached `main` on 2026-08-20.
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Answer the owner's questions about multi-tenancy from the code, and turn the
answers — and the model the owner then specified — into a plan the next session
can act on.

## User-visible outcome

None. Documentation only.

## Context

Asked after the documentation audit landed: does multi-tenancy mean more than one
user; how does a new user get a login and password; is there a registration
system; are action permissions tied to the tenant.

## Decisions made

Owner, 2026-08-20, in three rounds. The third round replaced the general
membership model with something considerably more specific:

- **Two kinds of person.** About four **platform administrators** who see and do
  everything and belong to no school, and **exactly one user per school** who
  sees only theirs. This is not "a second manager in one school" (backlog §8) —
  that feature was not chosen and is not on the way to this one.
- **Administrator is a flag on the person, not a membership.** They are outside
  the membership system rather than a member of everything, so the number of
  schools never changes what their session carries.
- **An administrator creates the school, then invites its user.** The school
  exists in the administrator's list before anyone accepts, and the staff size —
  which sets the floor under the privacy threshold — is the administrator's to
  set rather than the school's to describe.
- **The first administrator is seeded from `MANAGER_ADMIN_EMAIL` /
  `MANAGER_ADMIN_PASSWORD`** and invites the other three through the same
  mechanism as school users. One invitation flow, two things it can grant.
- **A school user starts with everything today's manager has**, scoped to their
  school. Restrictions are deferred by the owner and kept visible as phase 6, so
  that "decide later" does not decay into "nobody wanted any".
- **An administrator reads any school's results** — chosen over the narrower
  administration-without-data-access option the agent recommended and argued for.
  Two things follow and are in the plan: `docs/data-flow-and-subprocessors.md`
  needs it before the role exists, and the persistent audit log moves ahead of
  everything optional, because with four people able to open every school the log
  is the only account of whether a visit was legitimate.
- **The cross-tenant aggregate stays refused.** Per-school results yes; one figure
  computed across schools no — two schools whose small groups are each suppressed
  become readable added together. Counts of schools, rounds and responses are
  cardinalities and are safe.
- **Revocation within about fifteen minutes**, as a short session with silent
  renewal. A membership read on every request was declined on latency: Seoul
  database, Washington functions, roughly 180 ms per action.

Agent design calls, not owner decisions:

- **The membership check belongs in the middleware**, not in
  `ManagerScopeService.resolveOrganizationId` — that function receives a
  repository and an id and has no session, and threading one in would change a
  signature fourteen call sites depend on. The middleware has the session two
  lines above where the header is set, and the administrator bypass later becomes
  one more branch in the same place.
- **Phase 0 lands before any identity work.** With one membership per session it
  changes no behaviour, which is exactly why it is cheap to verify now and
  expensive to add after a second user exists.
- **`OrganizationMembership` keeps its many-to-many shape** even though every
  school user has exactly one school today. The types and the JWT already carry a
  list; the product constrains it to one, and nothing needs migrating the day that
  constraint is relaxed.
- Assumed rather than asked: a school may temporarily have no user, and replacing
  one is revoke-then-invite rather than a transfer.

## Completed

- `f16a01b` — the plan, listed under "Live plans" in `docs/README.md`.
- `ea356c2` — the first two decisions, which reordered the phases.
- `136a752` — the model rewritten around administrators and one user per school;
  §3 is new, the phases are rebuilt, and three of the six open questions are
  closed.

## Remaining

Nothing on this branch; it reached `origin/main` on 2026-08-20 as `136a752`.
Implementation is phase 0 of the plan, on its own branch and with its own task
file.

## Verification evidence

### Passed

This is a documentation branch; what needed verifying was the plan's claims about
the code, and each was read rather than assumed:

- All twelve manager API routes reach `authorizeManagerRound` or
  `resolveOrganizationId`; the thirteen that do not are the four worker routes,
  `/api/mcp`, `/api/auth/*`, `/api/health`, the four respondent share-code routes
  and `/api/manager/question-suggestion`, which reads no repository. Enumerated by
  grepping every `src/app/api/**/route.ts`.
- Server-rendered pages reach the same function through
  `manager-context.ts` → `ManagerContextService.load` →
  `ManagerScopeService.resolveOrganizationId`. Only
  `src/app/answer/[shareCode]/page.tsx` reads a repository directly, and it is the
  respondent path.
- `RolePermissionService` and `MembershipService` have zero production callers —
  the only importer is `src/lib/auth/__tests__/slice-3-roles-audit-membership.test.ts`.
- `role` and `memberships` appear in production code only in `/api/auth/me`,
  `/api/auth/login` and as an audit label in `src/lib/server/manager-audit.ts`.
- `getAuditLogRepository()` returns `InMemoryAuditLogRepository`.
- Every line number cited in the plan was checked with `sed -n`; four were wrong
  on the first pass and were corrected.
- `npm run lint:doc-numbers` and `npm run lint:skills` pass.

### Blocked or not run

The full suite was not re-run: no code changed on this branch. `npm test`,
`tsc` and `lint` were green at `6d6ec97`, the base.

### Residual risk

The plan asserts phase 0 changes no current behaviour. That rests on the deployed
session carrying exactly one membership, built from `MANAGER_ORGANIZATION_ID` —
true by construction in `defaultAccounts()`, and worth re-checking against the
code when phase 0 is actually written rather than trusted from here.

## Questions requiring an owner decision

Three remain, in §6 of the plan: own passwords or an identity provider, which
e-mail provider, and what a school user may not do. None blocks phase 0; only the
first blocks phase 1.

"Who may create a school" and "what happens to the operator's credentials" were
both answered by the 2026-08-20 model — administrators create schools, and the
environment variables become the seed for the first administrator rather than the
standing credential.

## Next concrete step

None on this branch. The work continues as phase 0 of
[`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md),
on a new branch: make the middleware honour a chosen school only when the session
holds an active membership for it, narrow `loadSchools` to the session's schools,
make `resolveOrganizationId`'s population-dependent branches membership-dependent,
and add a regression test that a foreign `?school=` is ignored. It needs none of
the three remaining owner answers, and it changes no behaviour while every session
still carries exactly one membership — which is exactly why it is cheaper to
verify now than at any later point.
