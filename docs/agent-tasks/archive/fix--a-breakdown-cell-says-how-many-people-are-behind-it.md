# A breakdown cell says how many people are behind it, or it is not shown

## Metadata

- Branch: `fix/a-breakdown-cell-says-how-many-people-are-behind-it`
- Base branch: `main`
- Base commit: `5b7f3cc`
- Current HEAD: `91f4c8b` plus the documentation commit that follows it
- Status: code complete, verified, awaiting the owner's push
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the privacy medium of the 2026-08-21 audit: a group past the size
threshold published a dimension average for every dimension it answered at all,
so an optional analytic question could print one respondent's own score.

## User-visible outcome

Every published cell of `/breakdown` prints how many people its average stands
on. A cell too few of a published group answered is blank with a stated reason,
and the table's footnote explains those blanks so they do not read as a
rendering fault.

## Context

`AGENTS.md` names the product invariant: never expose respondent identity or
detailed results below the configured privacy threshold. `src/lib/privacy/
cell-suppression.ts` already held the rule and its two-part invariant; the
breakdown applied it to group sizes only.

## Scope

- `src/lib/analytics/background-breakdown.ts` — cells suppressed by
  `suppressFrequency`, computed across the groups of one dimension.
- `src/components/breakdown/breakdown-board.tsx` — the three blank states and
  the respondent count.
- `src/app/globals.css` — the respondent-count affordance.
- Tests in both `__tests__` directories.
- ADR-037, `PROGRESS.md`, the audit file, this file, the handoff.

## Non-goals

- The round map's own per-dimension numbers. They are about everyone in the
  round, which is what the round threshold already protects.
- Cross-tabulation of two background questions. Not a screen that exists.

## Acceptance criteria

- A cell below the threshold in respondents is not published.
- A lone hidden cell in a dimension takes a companion with it.
- The threshold counts people, not answers.
- A published cell states its respondent count on screen.

## Relevant repository instructions

`.agents/skills/shalomut-map`, `.agents/skills/shalomut-verification`,
`.agents/skills/shalomut-tracker`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-004, ADR-005 (the round-level threshold), ADR-030 (one
basis of calculation per round), and the new ADR-037.

## Decisions made

- `suppressFrequency`, not a fresh `count < threshold` comparison. The rule that
  bites here is the second one — hidden entries account for nothing or for at
  least the threshold — and a hand-written comparison enforces only the first.
- Computed across the groups of a dimension rather than inside each group,
  because the round's own map publishes the dimension average and a lone hidden
  cell is recoverable by subtraction from it.
- A respondent is a person however many of the dimension's questions they
  answered.
- `respondentCount` is printed on every published cell, not only when it looks
  alarming: a conditional count is one nobody learns to read.

## Assumptions

- The round map continues to publish per-dimension averages and per-question
  counts. If it ever stops, the across-groups computation is stricter than
  needed but never wrong.

## Completed

- The suppression, the union type `BreakdownDimensionScore`, the three blank
  states in `ScoreCell`, the footnote, the CSS, twenty-four tests across the two
  files, ADR-037, `PROGRESS.md`, the audit entry and two further audit entries
  re-read and annotated.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `src/lib/analytics/background-breakdown.ts`
- `src/lib/analytics/__tests__/background-breakdown.test.ts`
- `src/components/breakdown/breakdown-board.tsx`
- `src/components/breakdown/__tests__/breakdown-board.test.tsx`
- `src/app/globals.css`
- `PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/critical-audit-2026-08-21.md`,
  `docs/shalomut-tracker-handoff.md`, this file
- `docs/agent-tasks/active/perf--an-administrator-overview-is-a-constant-number-of-queries.md`
  moved to `archive/` — it was staged and unpushed from the previous slice.

## Verification evidence

### Passed

- `npm run verify:core`, unpiped, `REAL_EXIT=0`. 1421 tests.
- Six mutations, each caught by the test that should catch it:
  1. count answers instead of people → 2 failures
  2. publish every cell that has an average → 3 failures
  3. threshold without the closure across groups → 1 failure
  4. drop the respondent count from the cell → 1 failure
  5. a withheld cell renders as the empty cell → 1 failure
  6. drop the footnote about withheld cells → 1 failure
  The tree was restored from a scratchpad copy after each, and the focused suite
  is green again (24/24).
- Signed-in browser walk on `next start -p 3210` against the local database,
  with a purpose-seeded closed round: three tenure groups of 22/18/20, of whom
  22/6/4 answered the `balance` questions. The table published `balance` for the
  group of 22 and blanked it for the other two — their hidden respondents come
  to ten, which is the threshold — while every other row published all three
  cells with `22 משיבים` / `18 משיבים` / `20 משיבים` under them. The footnote
  appeared. No console errors.

### Failed

None.

### Blocked or not run

- `npm run verify:db` — not run. No repository, schema or migration code
  changed on this branch.

### Environment

Local. The seed and cleanup scripts were written at the repository root, run,
and deleted; the demo round and its 60 responses were removed from the local
database afterwards. Local migrations were applied (`db:migrate:deploy`) because
the local database predated the previous slice's two migrations.

### Residual risk

Low. The suppression is strictly more conservative than what shipped, so the
failure mode of a mistake here is a blank cell rather than a published one.

## Failed approaches

None on this branch. The first text replacement left a dead stub
(`unusedDimensionScoresFor`) behind, which was deleted before anything ran.

## Known risks

A group whose people all answered every question sees a respondent count equal
to its column header — visually redundant, deliberately kept, per ADR-037.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

None from this slice. Standing: rotate `GEMINI_API_KEY` before any paid round;
decide whether pagination and server-side search in the administration console
are worth a slice.
