# Multi-tenancy: research and plan

## Metadata

- Branch: `docs/multi-tenancy-plan`
- Base branch: `main`
- Base commit: `6d6ec97`
- Current HEAD: see `git log -1`; the plan's decisions commit is the tip
- Status: plan written and its four decisions recorded; waiting on a push
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Answer the owner's four questions about multi-tenancy from the code, and turn the
answers into a plan the next session can act on.

## User-visible outcome

None. Documentation only.

## Context

Asked after the documentation audit landed: does multi-tenancy mean more than one
user; how does a new user get a login and password; is there a registration
system; are action permissions tied to the tenant.

## Decisions made

- **Owner, 2026-08-20: many schools each with their own users** — shape (c) in the
  plan, not "a second manager in one school" and not the multi-school operator
  the product already is.
- **Owner, 2026-08-20: access by invitation**, not open registration.
- **Agent design call: the membership check belongs in the middleware**, not in
  `ManagerScopeService.resolveOrganizationId`. That function receives a repository
  and an id and has no session; the middleware has already resolved the session
  two lines above where the header is set. This avoids changing a signature
  fourteen call sites depend on.
- **Phase 0 lands before any identity work.** With one membership per session it
  changes no behaviour, which is precisely why it is cheap to verify now and
  expensive to add after a second user exists.
- **Owner, 2026-08-20: the operator can read any school**, not merely administer
  it. The agent had recommended administration-without-data-access and said so;
  the owner chose full visibility for support and onboarding, and that is the
  decision. Two things follow and are in the plan: the promise to the respondent
  changes and belongs in `docs/data-flow-and-subprocessors.md` before the role
  exists, and the persistent audit log moves from phase 4 to phase 3, because
  once one person can open every school the log is the only account of whether a
  visit was legitimate. The cross-tenant aggregate stays refused — that was part
  of every option offered and of the one accepted.
- **Owner, 2026-08-20: revocation within about fifteen minutes** — a short session
  with silent renewal, rather than a membership read on every request. The
  per-request read was declined on latency: the database is in Seoul and the
  functions in Washington, roughly 180 ms per action.

## Completed

- `f16a01b` — `docs/multi-tenancy-plan-2026-08-20.md`, listed under "Live plans"
  in `docs/README.md`.

## Remaining

Nothing on this branch. Implementation is phase 0 of the plan, on its own branch.

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

Four remain, in §5 of the plan: who may create a school, what happens to the
current operator's credentials at phase 1, own passwords or an identity provider,
and which e-mail provider. None of them blocks phase 0.

## Next concrete step

Hand over `git push origin docs/multi-tenancy-plan:main`. Then start phase 0 on
its own branch — it needs none of the four remaining answers, and it is the one
piece that is cheaper to verify now than at any later point.
