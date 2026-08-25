# A seeded round can be broken down, and can have goals

## Metadata

- Branch: `feat/a-seeded-round-can-be-broken-down`
- Base branch: `main`
- Base commit: `31a4b3c`
- Current HEAD: this file's own commit, on top of `0ddc721`
- Status: done and deployed. Everything through `0ddc721` is on `main` and
  served; only this file's own update is not.
- Last updated: 2026-08-25
- Last agent/tool: Claude Code (Opus 5)

## Objective

Reach the two screens the previous branch recorded as unreachable: the
breakdown and the goals, which had never been read with data in them, and the
administrator console on the deployment, which needs a live administrator
session.

The administrator walk is what found the second defect, and it is not an
administrator defect: the header is the same element on every manager screen.

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
- The one the deployed administrator walk exposed, in the same file.
- An end-to-end guard for each.

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
- `/admin/` and `/admin/activity/` walked signed in on the deployment at
  1560px, which found the sticky-header slot; fixed and guarded.

## In progress

Nothing.

## Remaining

Nothing this branch set out to do. Two things it deliberately did not:

- **The header is narrower than the content.** `.site-header` and `.page` agree
  at 1180px; `.survey-builder-history-slot` uses 1240px, and the metric stones
  and stat stones overhang the card by three or four pixels on their own. The
  band spans the window, so the slot above is closed regardless — but beside
  the card, below the band, the page still shows. `.dashboard-page` also uses
  1240px and does not matter here: the dashboard renders without a header.
  Aligning the widths is a layout decision, not a defect fix.
- **The disabled submit on `/admin/` reads at about 2.1:1.** `.primary-button`
  carries `opacity: 0.58` when disabled, which is the ordinary way to draw a
  disabled control and is exempt from the contrast rule — recorded because it
  was measured, not because it is a finding.

## Changed files

- `scripts/seed-local.ts` — two background questions, thirty responses, three
  goals, the tenure effect, the dead dimension branch.
- `src/app/globals.css` — `position: relative` on `.breakdown-table-scroll`, and
  a band over the slot above the sticky header, hung off `#main-content` and
  guarded by `body:has(> .site-header)`.
- `e2e/breakdown.spec.ts` — new, two tests.
- `e2e/smoke.spec.ts` — one test, hit-testing the slot above the header.
- `docs/agent-tasks/active/feat--a-seeded-round-can-be-broken-down.md` — this
  file.

## Verification evidence

### Passed

- `npm run verify:core` — 1654 tests, 0 failures.
- `npm run test:e2e` — 34 passed against the reseeded database before the new
  spec existed, and 36 with it, the respondent walk on the active round among
  them, which is this change's main risk.
- `npx playwright test e2e/breakdown.spec.ts` — 2 passed.
- `npm run test:e2e` after each header fix — 37 passed both times.
  `submit-retry-is-recorded.spec.ts` failed twice across six runs, both times
  while a build and a second server were running beside it, and the failure is
  a thirty-second test timeout inside `locator.inputValue()` on an element the
  same call had just found visible. It passed alone, and passed in a full run
  with nothing else on the machine. Recorded as contention rather than
  explained: nothing was changed for it.
- `npm run lint:skills`, `npm run lint:doc-numbers`, `npm run lint:audit-count`
  — all clean.
- Negative check of the header guard: with the band removed and the app
  rebuilt, `the page does not show through the slot above the sticky header`
  fails naming what it found — `main at 20,0, div at 60,0, rect at 100,0, input
  at 140,0`.
- Negative check of the overflow guard: with `position: relative` removed and
  the app rebuilt, `the breakdown table scrolls on a phone without taking the
  page with it` fails with `Expected: <= 0, Received: 3`. The first attempt at
  this check passed and proved nothing — `npx playwright test` serves the
  existing `.next`, so the reverted stylesheet was never built.
- Walked signed in on the deployment (`GET /api/health/` answered `31a4b3c`,
  the branch this one is based on): `/admin/` and `/admin/activity/` at 1560px,
  zero page overflow, zero escaping elements, one `ADMINISTRATOR_INVITED` row
  on the platform log and both administrators listed on the console. Scrolled
  rather than only screenshotted, which is what found the slot — a full-page
  screenshot cannot show a sticky element's behaviour, which is why five
  earlier sweeps of these screens missed it.
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

### Deployed

`b9bbd39` was pushed to `main` and Vercel served it: `GET /api/health/` answers
`b9bbd39`, all four workflows are green on that commit, and the stylesheet it
serves — `/_next/static/chunks/2xshsj3zru-89.css` — is byte-for-byte the local
build of it. Walked signed in on `/round/`: the header rests at `top: 16`, and
no page element answers anywhere in the slot above it. The breakdown fix cannot
be *seen* there — the deployed round has no background question, so that screen
is still its empty state — and the reading for it is the stylesheet's bytes and
`Browser smoke`.

That walk is also what found the cost of the first implementation: `100vw`
counts the scrollbar, so the document measured seven pixels wider than the
window. `8430a6a` moves the band to `#main-content` and fixes it against the
window instead, which is the version this file's evidence above describes.

`0ddc721` — `8430a6a` plus this file — was pushed to `main` and Vercel served
it: `GET /api/health/` answered `0ddc721` thirty seconds after the push, all
four workflows are green on that commit, and the stylesheet it serves,
`/_next/static/chunks/3ltr42fvu8w_n.css`, is byte-for-byte the local build of
it. Deployed `/login/` answers `{ hasHeader: false, band: "none" }`, so the
`:has(> .site-header)` scoping keeps the band off the screens that have no
header.

Walked signed in on the deployed `/round/`, scrolled to `scrollY: 329`, with the
window 1728 wide and the document 1713 — a real fifteen-pixel scrollbar, which
is the condition the first implementation failed under:

- `documentElement.scrollWidth − clientWidth` is **0**. It was 7 before this
  commit, and that number is the whole reason the commit exists.
- 1376 hit tests across every pixel row of the sixteen-pixel slot, the full
  width of the window: **zero** elements answer that are not `#main-content`,
  the body, the document, or inside the header. The header rests at `top: 16`
  and the band above it computes `position: fixed`, `block-size: 16px`.

### Blocked or not run

- **The administrator console at a phone width, on the deployment.** The
  connected Chrome reported `innerWidth: 1560` after being resized to 520, with
  `outerWidth: 784` — the window chrome resized and the viewport did not, so
  the measurement would have been a fiction. Both admin screens were walked at
  390px locally in the previous branch's sweep.
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

Nothing is left on this branch. Hand this last documentation commit to the
owner to push, and close the branch — the two readings the expired session had
blocked are taken, and both are in the Deployed section above.
