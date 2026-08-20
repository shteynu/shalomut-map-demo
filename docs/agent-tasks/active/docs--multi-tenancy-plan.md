# Multi-tenancy: research and plan

## Metadata

- Branch: `docs/multi-tenancy-plan`
- Base branch: `main`
- Base commit: `6d6ec97`
- Current HEAD: `f16a01b`
- Status: plan written, waiting on a push and on owner answers
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

Six, in §5 of the plan. The two that gate design rather than detail:

1. **Is there a role above the tenant?** Support and onboarding need someone who
   sees more than their own memberships, and that person can read every school's
   respondent aggregates — so it is a privacy decision, not a convenience. Note
   the k-anonymity guarantee is stated for one population, so such a role must not
   be handed a cross-tenant aggregate.
2. **How fast must revocation take effect?** The session is a stateless 24-hour
   JWT, so a revoked member keeps access for up to a day unless something changes.

## Next concrete step

Hand over `git push origin docs/multi-tenancy-plan:main`. Then either answer the
two gating questions above, or start phase 0, which needs neither.
