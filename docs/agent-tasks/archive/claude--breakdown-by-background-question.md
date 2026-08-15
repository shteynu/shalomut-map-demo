# Dimension scores broken down by one background question

## Metadata

- Branch: `claude/breakdown-by-background-question`
- Base branch: `claude/suppression-file-is-text`
- Base commit: `56fb284`
- Current HEAD: **`1aabeb4` is the last commit that changes product code** — the
  screen. Deliberately not written as the tip: the tip is the documentation
  commit carrying this file, so naming it here would name the commit before it.
  Three commits sit on this branch: `aa0e2db` the domain layer, `1aabeb4` the
  screen, and the documentation commit above them.
- Status: complete and verified, unpushed
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give the manager the first screen that answers "does this group score
differently?" — the average of each of the eight dimensions, broken down by the
categories of a single background question, with every group below the privacy
threshold suppressed.

This is the first caller `suppressCrossTab`/`suppressFrequency` have ever had.
Until now the k-anonymity rule of phase 2 ran only in its own tests.

## User-visible outcome

A new manager screen, `/breakdown`, seventh in the header navigation between the
map and the goals. It shows one table: eight dimension rows against the answer
categories of one background question. A group too small to report publishes
neither its size nor any score, and says which of the two reasons applies. A
locked round shows the locked state instead of a table, and a round whose
questionnaire asks no background question says so.

## Context

Owner decision, 2026-08-15, answering the question the previous branch left
open: the cross-tab a manager gets is **dimension scores × one background
question**, not demographic × demographic.

The suppression module counts people; it does not average scores. So the screen
is two computations joined by one rule: `suppressFrequency` decides which groups
may be spoken about, and a per-group dimension average fills the cells of the
groups that survive.

## Scope

- A pure domain module, its tests, and the screen that renders it.
- A local seed that can produce a round the screen has something to say about.

## Non-goals

- Demographic × demographic tables. The module supports them; the product does
  not offer them.
- Anything needing the methodologist's item-to-dimension mapping. Phases 3, 5
  and 6 stay blocked.
- Sending background answers across the AI boundary — still open in the plan
  (§7.4), and this screen does not settle it.

## Acceptance criteria

All four are met and each was checked rather than assumed — see the evidence.

- A group below the threshold publishes neither its size nor any score.
- No suppressed group is recoverable by subtracting the published groups from
  the round total.
- Respondents who skipped the question are a named category, not a remainder.
- A locked round shows the locked state, not a partial breakdown.

## Decisions made

- **The lock is passed in, not recomputed.** `buildBackgroundBreakdown` takes
  `isRoundLocked` from the round aggregate rather than deciding for itself. A
  second implementation of the privacy rule could disagree with the first, and
  the disagreement would surface as a breakdown published for a round whose map
  says it may not be read.
- **One reader of scoreable answers, shared with the aggregate.**
  `analytic-answers.ts` holds the rules deciding which answers count, and
  `AnalyticsService.calculateDynamicRoundAnalytics` now uses it too. The
  breakdown is the same arithmetic over a partition of the same responses; if
  the two disagreed about what counts, the difference between a group's score
  and the round's would read as a finding.
- **The unanswered are a category.** Dropping them would make the published
  groups sum to less than the round total, and a reader who knows the total —
  every manager screen shows it — recovers the difference.
- **A declared option nobody chose is a suppressed row, not a missing one.** A
  missing row and a suppressed row say different things.
- **An answer no longer on the option list keeps its own category**, labelled by
  the stored value. Reporting those people as "did not answer" would be a claim
  about them that is not true. Only reachable by editing a question after
  answers arrived; the submit route validates against the options.
- **Single-choice only.** A `number` question would produce groups of one and
  suppress all of them; banding it into ranges is a methodology decision nobody
  has made. An `allocation-100` row is a percentage, not a category.
- **The header link carries the round and never the question.** A question
  belongs to one round's snapshot, so carrying it across rounds would ask for a
  question the next round does not have.
- **The screen is round-scoped**, like the map and unlike the goals screen.

## Assumptions

- Read-only. No new write path and no new API route; the page reads through the
  composition root like every other server component.

## Completed

- `src/lib/analytics/analytic-answers.ts` — the shared reader plus `averageScore`.
- `src/lib/analytics/background-breakdown.ts` — `buildBackgroundBreakdown` and
  `breakdownQuestionChoices`.
- `src/lib/services/analytics.service.ts` — its scoring loop now goes through
  the shared reader. No behaviour change; the same 20 tests pass unaltered.
- `src/app/breakdown/page.tsx`, `src/components/breakdown/*` — the screen.
- `src/lib/navigation.ts` — the route, its metadata, `breakdownRoute`,
  `readBreakdownQuestionParam`, and the nav/home-action entries.
- `src/lib/server/manager-context.ts` — `loadRoundResponses`, read only by this
  screen because it is the only one that partitions the responses.
- `src/app/globals.css` — the `.breakdown-*` block; the picker reuses the
  round-switcher control styles rather than inventing a second select.
- `scripts/seed-breakdown-round.ts` — a local round with two background
  questions and cohorts chosen so the suppression is visible; `--locked` writes
  the same questionnaire below the threshold.

## Remaining

Nothing on this branch.

## Changed files

Modified: `src/app/globals.css`, `src/app/page.tsx`,
`src/components/layout/app-header.tsx`, `src/lib/navigation.ts`,
`src/lib/__tests__/navigation.test.ts`, `src/lib/server/manager-context.ts`,
`src/lib/services/analytics.service.ts`.

New: `src/lib/analytics/analytic-answers.ts`,
`src/lib/analytics/background-breakdown.ts`,
`src/lib/analytics/__tests__/background-breakdown.test.ts`,
`src/app/breakdown/page.tsx`, `src/components/breakdown/breakdown-board.tsx`,
`src/components/breakdown/breakdown-question-picker.tsx`,
`src/components/breakdown/index.ts`, `scripts/seed-breakdown-round.ts`, and this
file.

`.idea/shalomut-map-demo.iml` is a pre-existing user modification and stays
unstaged. `next-env.d.ts` churned under `build` and was reverted, as on the two
branches below this one.

## Verification evidence

### Passed

- `npm run verify:core` — **exit 0**. 994 TypeScript tests pass, 0 fail, up from
  the 980 of the base branch: the 12 new breakdown tests and 2 new navigation
  tests. Typecheck, ESLint, the production build and all eight lint gates green.
- **The suppression was watched working in a browser**, signed in against a
  production build (`next start`, port 3210) on the local database, on the round
  `seed-breakdown-round.ts` writes — 41 responses, tenure cohorts of 14 / 12 / 4
  and 11 who skipped the question:
  - `עד שנה` (4) is suppressed as `קבוצה קטנה מדי מכדי להישאר אנונימית`;
  - `לא ענו על השאלה` (11) is suppressed as *complementary* — the closure took a
    second group so the four could not be recovered, and it took the smallest
    publishable one;
  - `שנה עד חמש שנים` (12) and `יותר מחמש שנים` (14) publish 93 and 100;
  - the note reads 41 total, threshold 10, two groups hidden and says the
    published groups deliberately do not add up.
- **The locked state** was walked on the `--locked` round: four responses, no
  table, no group sizes, and the copy names the threshold and the count.
- **The empty state** was walked on the canonical-24 round: no background
  question, so the screen says so instead of rendering an empty table.
- **The question picker** was walked with two background questions on the round:
  choosing the role question re-rendered the table on the same round, so the
  hidden round field does what it is there for.
- **The route is behind the manager gate**, checked anonymously rather than
  assumed: `curl -I /breakdown/` answers `307` to
  `/login?next=%2Fbreakdown`. The middleware is deny-by-default and `/breakdown`
  is not on either public list.
- **Contrast measured in the browser**, computed colours against the effective
  background: green 4.89:1, yellow 5.49:1, red 6.49:1, the muted group size and
  footnote 5.12:1. All clear WCAG AA 4.5:1, including the 12.48px status words,
  and the status is never colour alone — the number carries the word beside it.
- **No console errors** on any of the three states.
- **The table scrolls inside its own container** at a 375px viewport:
  `.breakdown-table-scroll` is 323px wide over a 429px table, and the chain up
  to `.page` stays within the viewport.

### Failed

None.

### Blocked or not run

- `verify:db` and `verify:ai` — not run and not applicable. No schema, migration,
  repository, contract, prompt or Python file is in this diff.
- The AI boundary was not exercised. Nothing here reaches it.
- Nothing was checked on the deployed endpoint. This branch is unpushed and
  unmerged, and the deployed database holds no round with a background question.

### Environment

local

### Residual risk

- **No respondent has ever produced this data by answering.** The respondent
  screen cannot render a single-choice background question — that is phase 3 and
  it is not built. The submit API validates and stores these answers, and the
  seed writes them through the same repository, so the stored shape is real; the
  collection path is not walked end to end and cannot be until phase 3.
- **The suppression is closed within one table, not across two.** Reading the
  tenure breakdown and the role breakdown of the same round is outside what
  `cell-suppression.ts` claims to defend, and its own module comment says so.
  With two questions now offered on one screen, that limit is closer to reach
  than it was — worth an owner decision before a real school uses this.
- No automated browser test guards the screen. `npm run test:e2e` is deliberately
  one smoke path, and a spec for this screen would need CI to seed a round it
  does not seed today.

## Failed approaches

None. One test was written wrong — it expected an unanswered category on a round
where nobody skipped the question — and the module was right; the test now
asserts the absence.

## Known risks

- Pre-existing and **not** introduced here: every manager screen overflows
  horizontally at 375px. `document.scrollWidth` is 420 against a 375 viewport on
  `/round/` as well as on `/breakdown/`, and the cause is `.site-header`, whose
  own `scrollWidth` is 409. Measured on both screens deliberately, to be sure the
  new table was not the cause. Left alone as out of scope.
- Two design-hook findings in `globals.css` (lines 2043 and 5070) are outside
  this diff and were left alone for the same reason.

## Approval gates

- `git push` is an owner action and has **not** happened for this branch. The
  work is visible in this worktree and, once committed, to another worktree on
  the same machine — not to another checkout until it is pushed.
- This branch sits on top of the five-branch stack, none of which is merged.

## Questions requiring an owner decision

- **Unchanged:** the methodologist's item-to-dimension mapping still blocks
  phases 3, 5 and 6.
- **New, raised by this screen:** the module defends one published table, and
  the screen now offers several of them for the same round. Should a manager be
  able to read the tenure breakdown and the role breakdown of one round, or does
  the product need suppression that holds across the tables it publishes
  together? The first real school is the wrong place to find out.

## Next concrete step

Answer the cross-table question above. If the answer is "one table at a time is
fine for now", the next unblocked piece of work is phase 3's respondent
rendering of background questions — which is blocked on the mapping table for
the analytic items but **not** for the background ones, so the demographic half
of that phase could be built and would close the residual risk that no
respondent has ever answered one of these questions.
