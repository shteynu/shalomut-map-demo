# A seeded round can be broken down, and can have goals

## Metadata

- Branch: `feat/a-seeded-round-can-be-broken-down`
- Base branch: `main`
- Base commit: `31a4b3c`
- Current HEAD: this file's own commit, on top of `31a4b3c`
- Status: in progress — the local half is done and verified; the deployed
  administrator console still waits on the owner's sign-in
- Last updated: 2026-08-25
- Last agent/tool: Claude Code (Opus 5)

## Objective

Reach the two screens the previous branch recorded as unreachable: the
breakdown and the goals, which had never been read with data in them, and the
administrator console on the deployment, which needs a live administrator
session.

## User-visible outcome

`/breakdown` and `/goals` can be opened locally with real content in them, and
the breakdown no longer drags the whole page sideways on a phone.

## Context

The canonical instrument is analytic from end to end, so no round the seed
produced asked a question `/breakdown` could group by: every walk of that
screen so far read its empty state and proved only that the empty state
renders. `/goals` was the same — a goal is normally born from a recommendation
a manager pressed, and producing one is a paid provider call, so the screen had
only ever been read empty.

Twelve responses would not have been enough even with a background question.
The privacy threshold judges a *group* by the same ten it judges a round by
(`src/lib/privacy/cell-suppression.ts`), so twelve people split into groups are
groups of six and the whole table comes back blanked.

## Scope

- `scripts/seed-local.ts`: two background questions on the closed round, thirty
  responses, three goals, and a tenure effect on one dimension.
- The one defect the new content exposed, in `src/app/globals.css`.
- An end-to-end guard for both.

## Non-goals

- Changing what the product asks. The background questions are the seed's, not
  the canonical instrument's; adding demographics to the instrument is a
  methodology decision nobody has made.
- Any paid provider call.

## Acceptance criteria

- `/breakdown` shows a published group and a blanked one at the same time.
- `/goals` shows all three goal states.
- No page-level sideways scroll on a phone.
- `verify:core` and the full Playwright suite stay green.

## Relevant repository instructions

- `AGENTS.md`: the local database is disposable, so reseeding needs no ritual;
  `git push` stays the owner's.
- `.agents/skills/shalomut-verification`: record only checks that ran.

## Relevant architecture and contracts

- `src/lib/privacy/cell-suppression.ts` owns the two rules a published line
  must satisfy. Rule 2 — the blanks on a line account for nothing at all or for
  at least the threshold — is why the two suppressed groups are five and five
  rather than seven and three: seven and three would have forced a third,
  complementary blank and left one published column.
- `src/lib/analytics/background-breakdown.ts` adds the round's own lock on top
  and treats the respondents who skipped a background question as a category.
- `src/components/breakdown/breakdown-question-picker.tsx` renders nothing
  below two choices, which is why the seed asks two background questions.

## Decisions made

- **The background questions go on the closed round only.** The active round is
  what `e2e/respondent-answers.spec.ts` fills in, and that test answers every
  step by clicking one of the three wellbeing stones — a single-choice
  demographic step offers no such stone. Confirmed by running the suite.
- **Thirty responses, split 10/10/5/5 by tenure and 10/10/10 by stage.** The
  first table shows a published group beside a blanked one; the second
  publishes everything. Both states of the privacy rule are then on screen, and
  a table that had lost the rule entirely could not imitate both.
- **The stage groups are cut with a stride rather than `index % 3`.** A plain
  modulus lined the groups up exactly with the cycles `answerFor` uses, and the
  balance row came out 60 / 0 / 0 — three columns that read as a broken screen
  rather than as data.
- **One dimension is made to depend on tenure.** Without it the two published
  columns held the same distribution, and a table that reads the same whether
  its columns are mapped correctly or mirrored proves nothing.
- **`answerFor`'s `workload` branch became `certainty`.** `workload` is not one
  of the eight dimension ids, so that branch had never been taken.

## Assumptions

- The seeded goals may name dimensions no analysis ever recommended. The goal
  copies its own title and body at the moment of the decision and carries no
  foreign key into an analysis (`prisma/schema.prisma`), so this is the shape a
  real goal has, not a fixture shortcut.

## Completed

- Two background questions, thirty responses and three goals in the seed.
- The mobile overflow defect found on `/breakdown`, fixed and guarded.
- `/breakdown` (both questions), `/goals`, `/dashboard` and the dimension
  recommendations screen walked at 1440px and 390px.

## In progress

Nothing.

## Remaining

- The administrator console on the deployment. Blocked below.

## Changed files

- `scripts/seed-local.ts` — two background questions, thirty responses, three
  goals, the tenure effect, the dead dimension branch.
- `src/app/globals.css` — `position: relative` on `.breakdown-table-scroll`.
- `e2e/breakdown.spec.ts` — new, two tests.
- `docs/agent-tasks/active/feat--a-seeded-round-can-be-broken-down.md` — this
  file.

## Verification evidence

### Passed

- `npm run verify:core` — 1654 tests, 0 failures.
- `npm run test:e2e` — 34 passed against the reseeded database before the new
  spec existed, and 36 with it, the respondent walk on the active round among
  them, which is this change's main risk.
- `npx playwright test e2e/breakdown.spec.ts` — 2 passed.
- `npm run lint:skills`, `npm run lint:doc-numbers`, `npm run lint:audit-count`
  — all clean.
- Negative check of the overflow guard: with `position: relative` removed and
  the app rebuilt, `the breakdown table scrolls on a phone without taking the
  page with it` fails with `Expected: <= 0, Received: 3`. The first attempt at
  this check passed and proved nothing — `npx playwright test` serves the
  existing `.next`, so the reverted stylesheet was never built.
- Walked signed in against a production build on port 3210: `/breakdown` by
  tenure (two groups published at 10, two blanked) and by stage (three
  published at 10), `/goals` (two open, one done), `/dashboard`, and
  `/dashboard/<dimension>/recommendations`. Zero page-level overflow and zero
  escaping elements at 1440px and 390px on every one.
- `.breakdown-picker select` draws its caret with the 45° tile at 12px and the
  135° tile at 16.8px — the order the caret fix put them in. That fix landed
  without this select ever being visible, because no seeded round offered two
  background questions.

### Failed

None.

### Blocked or not run

- **The administrator console on the deployment.** `GET /admin/` still answers
  with `/login/?next=%2Fadmin`, and the deployed login offers only the
  organizational Google account. The owner has to sign in in the connected
  Chrome; the tab opened for it is `741623090`.
- **The remove control on a goal** (`הסרה מהיעדים`). It lives on
  `dashboard-goals-panel.tsx`, and the dimension recommendations page returns
  the "no analysis yet" card before that panel renders — so seeding goals does
  not reach it. It needs a paid analysis run.

### Environment

Local Postgres on 5433 (`shalomut-local-db`), reseeded with
`MANAGER_ORGANIZATION_ID=local-dev-organization npx tsx scripts/seed-local.ts
--reset` three times during this task. A production build served by `next
start` on 3210 with blank `OIDC_*` and an invented `MANAGER_ADMIN_PASSWORD`, so
the local password door stayed open. `GEMINI_API_KEY` stripped from every child
environment.

### Residual risk

The seed's shape is now load-bearing for `e2e/breakdown.spec.ts`: a future edit
that changes the group sizes can make the table fully published or fully
blanked, and the spec says so in its failure messages rather than failing
silently.

## Failed approaches

- Negative-checking the CSS fix without rebuilding. See above.

## Known risks

Sixty responses instead of twenty-four makes the seed and the CI smoke a little
slower. It stayed within its existing timeouts.

## Approval gates

None reached. Nothing was pushed; nothing on the deployment was changed.

## Questions requiring an owner decision

None.

## Next concrete step

Ask the owner to sign in to `https://shalomut-map-demo.vercel.app/login/` in the
connected Chrome tab `741623090`, then walk `/admin/` and `/admin/activity/`
there at 1560px and 500px and record what the walk found.
