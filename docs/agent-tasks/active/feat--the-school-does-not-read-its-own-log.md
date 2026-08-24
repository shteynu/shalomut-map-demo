# A school does not read its own log

## Metadata

- Branch: `feat/the-school-does-not-read-its-own-log`
- Base branch: `main`
- Base commit: `0b57ec3`
- Current HEAD: two commits on `0b57ec3` — `6314479` the decision, and this
  file's own commit above it. `git log --oneline 0b57ec3..` names both; the
  second hash is deliberately not written here, because a document cannot hold
  the hash of the commit that adds it.
- Status: implementation complete and verified; unpushed
- Last updated: 2026-08-24
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Two things, in the order they happened.

1. **Walk both audit-log screens signed in on the deployment.** ADR-054 shipped
   them and the previous branch could only read the anonymous refusal, so the
   deployed runtime had never rendered either screen for a signed-in
   administrator.
2. **Close the owner's question.** May a school read the log of its own school?
   The owner answered `no` on 2026-08-24. The repository still said the question
   was open, in four places, and `ManagerAuditService` still permitted the other
   answer.

## User-visible outcome

None. The screens already behaved this way — `activity` has been in
`administratorOnlyScreens` and refused by the middleware since ADR-054. What
changed is that the service behind them now refuses a school user too, instead
of permitting a read nothing asked for.

## Context

The deployed walk needed a signed-in Google session, which the previous branch
recorded as absent from both connected Chrome browsers. It was present in
`Browser 2` on 2026-08-24, so the walk was possible after all.

## Scope

- `src/lib/auth/manager-audit-service.ts` — the read permits
  `session.isPlatformAdministrator` and nothing else.
- `src/lib/auth/__tests__/slice-3-roles-audit-membership.test.ts` — two
  assertions encoded the old answer; one test's name did too. Plus one new
  assertion naming the decided case directly.
- `src/lib/navigation.ts` — the comment on `administratorOnlyScreens`.
- `PROJECT_CONTEXT.md` — ADR-055, and the two earlier passages that called the
  question open (ADR-026's audit table, ADR-054).
- `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`.

## Non-goals

- No screen, route, navigation or middleware change. The three locks in front of
  the service were already correct; this is the fourth agreeing with them.
- Retention — whether an `audit_events` row is ever deleted — stays open
  (ADR-049).

## Decisions made

1. **Remove the permission rather than leave it uncalled.** The branch compared
   `session.activeOrganizationId` with the school being asked for. Left in place
   it would have been the default behaviour for the next screen that wants a
   log, sitting under a comment saying the question was open.
2. **The decision is an ADR, not a line in a task file.** ADR-055 records what
   the answer is about — the log holds `ADMINISTRATOR_SCHOOL_VISIT`, so the
   question is really "is a school told when it is looked at".

## Assumptions

- None. Every caller of `getOrganizationAuditLogs` was read: the two screens,
  both administrator-gated.

## Completed

Everything listed under Scope.

## In progress

- Nothing.

## Remaining

- Nothing in this task. The commit is unpushed; pushing is the owner's.

## Changed files

`git diff --stat 0b57ec3..HEAD`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, read from the redirected log rather than
  through a pipe. 1652 unit/component tests passed, 0 failed; the Python suite
  587 passed; all fourteen fitness/lint gates, `typecheck`, `lint` and `build`.
- `npx playwright test` — 30 passed. Run because the change is about which
  session sees rows, which `verify:core` does not walk. The two paths that
  matter are unchanged and still pass: a school user is turned away from
  `/activity/`, and an administrator sees the visit they just made.
- Deployed, signed in, 2026-08-24, connected Chrome `Browser 2`, as
  `shteynumaks@gmail.com`:
  - `GET /api/health/` → `commit: 0b57ec3`, the head of `main`; the AI service
    `8760e62`, the expected resting gap.
  - `/admin/activity` renders `יומן הפלטפורמה` with **one** row —
    `הזמנת מנהל פלטפורמה`, actor `shteynumaks@gmail.com`, 21 באוג׳ 2026 17:07,
    detail `email: klyachkina.sasha@gmail.com`. The expectation that it would be
    empty was wrong: a second administrator had been invited through the route.
  - Its `חזרה לבתי הספר ולמשתמשים` leads to `/admin/`; the console's
    `יומן הפלטפורמה` leads back. Both directions followed.
  - The school card's third link opens `/activity/?school=…` and renders 22
    rows, all `צפייה בבית הספר`, newest first. The top row is the visit that
    opening the page had just recorded, at 15:05 that day, with the
    administrator's own address on it; two rows name `סבב הדגמה`.
  - `/activity/?after=not-a-cursor` renders the newest page rather than an
    error, which is ADR-054's cursor rule on the deployed runtime.

### Failed

- None.

### Blocked or not run

- `npm run verify:db` — not run. No schema, migration or repository change; the
  changed function is a permission check above the repository.
- `npm run test:mutation:ai-contract` — not run; no mutated file was touched.
- **The pager was not walked on the deployment.** The one school's log holds 22
  rows and the page size is 25, so no pager link exists there to follow. It was
  walked locally with 30 seeded rows on the previous branch.
- Reading the log **as a school user** on the deployment was not attempted: it
  needs a second Google account signed in there, and the refusal it would show
  is the one the middleware already gives before any handler runs, covered by a
  Playwright path.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  local PostgreSQL. The deployed walk was read-only apart from the
  `ADMINISTRATOR_SCHOOL_VISIT` row that opening `/activity` records — which is
  the screen working, not a side effect to undo.

### Residual risk

- Low. The removed branch had no caller, so no behaviour a user can reach
  changed. What could still surprise: a future screen that wants to show a
  school its own activity now has to change the service and will meet ADR-055
  when it does, which is the point.

## Failed approaches

- None.

## Known risks

- None specific to this change.

## Approval gates

- None. No secret, credential, authentication configuration or alias.

## Questions requiring an owner decision

- Retention of `audit_events` rows — open since ADR-049, untouched here.

## Visibility of this handoff

Local to this worktree until the branch is pushed. Nothing is on `origin`.

## Next concrete step

Push the branch (owner's action):

```
git push origin feat/the-school-does-not-read-its-own-log:main
```
