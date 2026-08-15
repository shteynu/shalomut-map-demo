# Phase 2 — k-anonymity for demographic cross-tabs

## Metadata

- Branch: `claude/k-anonymity-for-demographics`
- Base branch: `claude/answer-model-for-research-instrument` (phase 1)
- Base commit: `4e71bd8`
- Current HEAD: `c888b66` when this file was written; the documentation commit
  that carries the file is its child.
- Status: implementation complete and verified
- Last updated: 2026-08-14
- Last agent/tool: Claude Code (Opus 5)

## Objective

Phase 2 of `docs/default-research-instrument-plan-2026-08-14.md`: give the
product the privacy mechanism the owner's 2026-08-14 decision requires — full
demographic cross-tabulation with cell suppression — and settle the two rule
questions the same phase raised.

## User-visible outcome

None yet, deliberately. Nothing collects demographics and no screen renders a
cross-tab. This phase supplies the rule such a screen must obey, so that the
screen cannot be built without it.

## Context

`privacyThreshold` counts responses. It protects a round total and says nothing
about a cell: "teachers aged 51–60 in the special-needs track" can be one person
inside a round of eighty. The research instrument asks 16 background questions,
which cross into a re-identification set long before any one of them does alone.

The harder half is that blanking small cells is not enough. A reader who sees a
row's other cells and that row's published total recovers the blank by
subtraction — and that failure is invisible in a rendered table.

## Scope

- A suppression module with its own tests.
- The ADR-004 amendment putting background questions outside the
  all-or-nothing unlock rule.
- The decision, documented and pinned by a test, on whether background answers
  cross the AI boundary.
- `docs/data-flow-and-subprocessors.md` rewritten in the same branch.

## Non-goals

- Any screen, route or API that renders a cross-tab (a later phase).
- Collecting demographics at all — that is phase 3, and it is blocked on the
  methodologist's mapping table.
- Differential privacy, or any defence against combining several *different*
  published tables of one round. The module says so in its own comment.

## Acceptance criteria

- A cell below the threshold is not published, and its count is absent from the
  returned shape rather than zeroed.
- No line the table publishes holds exactly one suppressed entry.
- More than one table fits what a reader can see — verified by enumeration, not
  only by the structural invariant.
- The MCP payload names no background question.
- A skipped demographic item cannot lock a round.

## Relevant repository instructions

- `AGENTS.md` — "Never expose respondent identity or detailed results below the
  configured privacy threshold. This is a product invariant, not an environment
  gate."
- `.agents/skills/shalomut-verification/SKILL.md` — falsification before
  claiming a test is load-bearing.

## Relevant architecture and contracts

- ADR-004 and ADR-005 in `PROJECT_CONTEXT.md`, both amended in this branch.
- `contracts/ai-analytics-v6.json` — `metricCoverage: "exactly every input
  question aggregate"`. Unchanged and untouched: a background question produces
  no aggregate, so the coverage rule is satisfied without an exception in it.

## Decisions made

- **The invariant is closure under subtraction, not a cell-by-cell rule.** Every
  published line — each row against its total, each column against its total,
  and both margins against the grand total — holds either no suppressed entry or
  at least two. One blank against a published total is a subtraction.
- **A line is the addends together with their sum.** A sum is as recoverable
  from its addends as an addend is from the sum, so the total is a member of the
  line rather than a special case. This is what makes one loop cover row totals,
  column totals and the margins uniformly.
- **The grand total is never suppressed.** It is the round's response count,
  which every manager screen already shows and which the AI payload already
  carries. Hiding it inside this one table would be a fiction, not a protection,
  so it counts as published in every line and is never chosen as the extra cell
  to blank.
- **Zero is a suppressed cell.** An empty intersection is below any positive
  threshold, and publishing "no one" publishes something about everyone else.
- **Suppression is deterministic.** The extra cell is the smallest published one
  in the line, ties broken on the key. A table that hid different cells on two
  renders of one round would let a reader intersect the two and recover both.
- **Background answers do not cross the model boundary.** Nothing in an insight
  needs a salary band, and sending one would make a subprocessor hold a
  demographic profile of a named school. The enforcement was already there from
  phase 1 — `AnalyticsService` filters to analytic questions before building any
  aggregate — but it was one `.filter` away from being untrue and undocumented,
  so it is now a decision with a test against the serialised payload.
- **ADR-004 is amended, not rewritten.** The all-or-nothing rule stays exactly
  as it was for analysed questions; it simply never counted an optional question
  about commute time, and reading it as if it did would let one skipped
  demographic item take a school's whole result away.

## Assumptions

- Demographic tables will be rendered by Core and only by Core. If that ever
  changes, the AI-boundary decision above has to be reopened, not worked around.

## Completed

- `src/lib/privacy/cell-suppression.ts` — `suppressCrossTab` and
  `suppressFrequency`. Primary suppression below the threshold, then
  complementary suppression iterated to a fixed point over the table's own
  equations. Refuses a non-positive or fractional threshold and a negative or
  fractional count.
- `src/lib/privacy/__tests__/cell-suppression.test.ts` — 15 tests, including the
  enumeration described below.
- `src/lib/privacy/__tests__/background-answers-stay-in-core.test.ts` — 4 tests
  on the AI boundary, the questionnaire hash and the unlock rule.
- `PROJECT_CONTEXT.md` — ADR-004 and ADR-005 amendments, dated.
- `docs/data-flow-and-subprocessors.md` — a new *Demographics* section stating
  the rule and the boundary; the "not covered here" bullet narrowed to what is
  genuinely still open, which is where a manager will see these tables.
- `docs/shalomut-tracker-handoff.md` — both phases recorded, both branches noted
  as unpushed.

### On the enumeration test

The structural invariant is what the algorithm maintains, so a test that checks
only the invariant checks the algorithm against itself. `more than one table
fits what a reader can actually see` instead reconstructs the reader's position:
it takes every published number as a constraint over the suppressed cells and
enumerates the assignments that satisfy all of them, then asserts that each
suppressed cell has at least two candidates and that the real value is among
them. Constraints are checked as their last member is assigned and each cell is
bounded by the tightest line it sits on, which is what keeps it at ~3 ms.

## In progress

Nothing.

## Remaining

- Phase 3 (respondent experience) and phase 5 (contract `7.0`) — both blocked on
  the methodologist's mapping table.
- Phase 4 (builder support for background questions) — unblocked.
- A manager-facing cross-tab screen, which is what will finally call this
  module. Until then it is a mechanism with tests and no caller, which is the
  order the plan chose deliberately: the rule exists before the screen that
  could break it.

## Changed files

New: `src/lib/privacy/cell-suppression.ts`,
`src/lib/privacy/__tests__/cell-suppression.test.ts`,
`src/lib/privacy/__tests__/background-answers-stay-in-core.test.ts`, this file.

Modified: `PROJECT_CONTEXT.md`, `docs/data-flow-and-subprocessors.md`,
`docs/shalomut-tracker-handoff.md`.

`.idea/shalomut-map-demo.iml` is a pre-existing user modification and stays
unstaged.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. That is `lint:literals`, `lint:interpreter`,
  `lint:composition`, `lint:fixtures`, `lint:skills`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `typecheck`, `npm test`, `lint` and
  `build`. **961 tests pass, 0 fail** — 942 before this branch, 19 added.
- **Falsification, three separate breaks, each restored afterwards:**
  - complementary suppression disabled → 4 tests fail, including the
    enumeration one;
  - the threshold comparison changed from `<` to `<=` → the boundary test fails;
  - `.filter(isAnalyticQuestion)` removed from `AnalyticsService` → 2 of the 4
    boundary tests fail.

### Failed

None.

### Blocked or not run

- `npm run verify:db` — not run, and not applicable. This branch changes no
  schema, no migration and no repository; it adds one pure module and two test
  files. Phase 1 ran it against the widened columns.
- No browser walkthrough — this branch renders nothing.

### Environment

Local only. No database write and no deployed action of any kind.

### Residual risk

Low, with one honest boundary. The module defends a single published table; an
attacker who combines two *different* tables of the same round — say age × role
and age × track — can in principle narrow a suppressed cell. That is stated in
the module comment rather than papered over, and it becomes a real question only
when a screen lets a manager open more than one table of one round. Whoever
builds that screen owns it.

## Failed approaches

- The enumeration test first used one ceiling for the whole table, taken as the
  smallest line remainder. That excluded the true value of any cell sitting on a
  roomier line, and the test failed on `senior/primary` — correctly, since the
  real value was not among the candidates it had allowed. The bound is per cell:
  the tightest line that cell sits on.
- Before that it enumerated `0..grandTotal` for every suppressed cell with no
  pruning, which for four cells and a total of 202 is about 1.7 billion
  assignments; it was killed after two minutes.

## Known risks

- `next-env.d.ts` churns between `.next/dev/types` and `.next/types` depending
  on whether `typecheck` or `build` ran last. Revert it rather than commit it.

## Approval gates

- `git push` is an owner action. Two branches are now waiting: this one and
  `claude/answer-model-for-research-instrument`, which is its base.

## Questions requiring an owner decision

- Unchanged from phase 1: the methodologist's item-to-dimension mapping, with
  reverse-scoring marked. It blocks phases 3 and 5.

## Next concrete step

Owner: push phase 1 first, then this branch —
`git push origin claude/answer-model-for-research-instrument` followed by
`git push origin claude/k-anonymity-for-demographics`. Then either supply the
mapping table, or say to start phase 4 (builder support for background
questions), which is the only remaining unblocked phase.
