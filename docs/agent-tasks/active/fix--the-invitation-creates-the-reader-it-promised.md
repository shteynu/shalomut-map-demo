# The invitation creates the reader phase 6 promised

## Metadata

- Branch: `fix/the-invitation-creates-the-reader-it-promised`
- Base branch: `main`
- Base commit: `c929d9c`
- Current HEAD: see **Exact Git state**
- Status: complete and verified, uncommitted at the time of writing
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

`Browser smoke` went red on `main` at `c929d9c` — the phase 6 documentation
commit. Fix the break, and the defect underneath it that the break exposed.

## What actually broke, and what it exposed

The failing test is `e2e/tenant-boundary.spec.ts:49`, "a manager asking for a
school they are not in stays where they are". It signs in with a `manager`-role
membership and drives that session to `/setup/?school=<other>`. Phase 6 made
`/setup` an administrator-only screen, so the session is redirected to `/` and
the school-name field the test reads is not on the page.

That is a stale test, and fixing it alone would have hidden the real finding:

**`inviteSchoolUser` granted `role: "admin"`, and it is the only place a school
membership is created.** So every school user the product can produce was an
`admin`, phase 6's gate had nobody to refuse, and the restriction the owner
asked for on 2026-08-23 was live and unreachable at the same time. The e2e
fixture held the only `manager`-role membership in the repository, which is why
the browser suite is what found it: the API tests assert the 403 against a
hand-built request and never ask who the product actually creates.

The `admin` value was chosen deliberately in phase 2 on 2026-08-22, on the
reading that a school gets one person who does everything today's manager does.
The owner's decision of 2026-08-23 replaces that reading. "Administrator" in
their sentence is the platform administrator — the role above the tenant —
because a school user who could do everything inside their school is exactly the
thing the decision rules out.

## Decisions made

1. **The invitation grants `manager`.** One line, plus the comment that recorded
   the superseded reasoning.
2. **`admin` stays in the type.** The column is `String`, rows written before
   this change carry it, and `RolePermissionService` still has to answer for
   them. Nothing creates one now.
3. **The school user's boundary test moves to `/`, not to a relaxed
   assertion.** The home screen names the school in its eyebrow when the session
   has a round — the first school does — and hands the name to
   `ManagerOnboarding` when it does not, which is the second school's state. So
   the assertion runs against the whole page rather than one field, and a broken
   boundary is caught in both shapes. The administrator tests keep `/setup/`,
   which is open to them.
4. **A new e2e test covers the redirect itself.** It is what broke, nothing in
   the browser suite covered it, and a change to `administratorOnlyScreens` or
   to the middleware's role branch could otherwise reopen all three screens
   silently. It carries its own negative control: `/round/` must still open.

## Changed files

- `src/lib/auth/manager-administration-service.ts` — the role, and the comment.
- `src/lib/auth/__tests__/manager-administration-service.test.ts` — the
  assertion that was pinning `admin`.
- `e2e/tenant-boundary.spec.ts` — the school user's boundary test moved to `/`,
  the file's header comment corrected, and the redirect test added.
- `PROJECT_CONTEXT.md` ADR-042, `docs/multi-tenancy-plan-2026-08-20.md` phase 6,
  `PROGRESS.md` — each amended in place rather than restated, because each said
  the rule applied to a school user and none of them was true yet.

## Exact Git state

See the commit on this branch; nothing is staged afterwards. The only unstaged
file is `next-env.d.ts`, which is generated and belongs to the owner — stage
with `git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run test:e2e` — exit `0`, **24 passed**, including all five tenant
  boundary tests and the new redirect test. This is the suite that was red on
  `main`; it was not run before phase 6 landed, which is why the break reached
  CI.
- `npm run verify:core` — exit `0`, zero `not ok`.
- `src/lib/auth/__tests__/manager-administration-service.test.ts` — 11 tests.
- `npm run lint:doc-numbers` — 26 claims across 4 documents.

### Blocked or not run

- `npm run verify:db` — not run. No query, migration or repository method
  changed.
- The deployed runtime was not exercised. It holds one administrator and no
  invited school user, so there is nothing there this change alters.

### Environment

Local. Playwright builds and serves its own instance; the owner's `next dev` on
`:3000` was left running and untouched.

### Residual risk

- Any membership row already written with `role: "admin"` keeps it. There are
  none on the deployed database — no school user has been invited — but a local
  database seeded before today could hold one, and it would still act as an
  administrator inside its school.

## Lesson

`npm run verify:core` does not run Playwright. Phase 6 changed which screens
exist for whom, which is exactly what the browser suite is for, and the
verification skill's matrix asks for browser smoke on a user-visible flow. A
manual walk was done and the suite was not, so CI found what a local `npm run
test:e2e` would have found in fifty seconds.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin fix/the-invitation-creates-the-reader-it-promised:main
```
