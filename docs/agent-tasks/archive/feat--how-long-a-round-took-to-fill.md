# How long a round took to fill

## Metadata

- Branch: `feat/how-long-a-round-took-to-fill`
- Base branch: `main`
- Base commit: `8231490` (`origin/main`)
- Current HEAD: `1c65ce7`, four commits ahead of `origin/main`, nothing pushed
- Status: complete and landed
- Landed on `main` on 2026-08-17, in the five-branch stack that reached
  `f5798cb`. Archived from `active/` the same day.
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Compute a descriptive report about how a round was filled — how long completed
questionnaires took against the estimate the questionnaire itself gave — as a
pure module plus a service. No UI, no route, no AI.

## User-visible outcome

None yet. Task C puts this on `/round`. What this task delivers is the number
that panel will read, and the guarantee that it never describes one person.

## Context

Task B of
[`response-quality-plan-2026-08-17.md`](../../response-quality-plan-2026-08-17.md),
following [`response-quality-research-2026-08-17.md`](../../response-quality-research-2026-08-17.md)
§7. **Both documents live on the branch `research/how-a-round-was-filled`, which
`origin` has at `dc99351` — one commit behind local `427b7b7`, so the plan
document is not on the remote at all and neither document is on `main`.** That
is why ADR-022 restates the reasoning instead of linking to it.

The owner asked to see how people answered in order to spot suspiciously filled
questionnaires. §5 of the research is why the acting half of that — excluding
them — is not built: on the current instrument the signals are directionally
biased against dissatisfied respondents, and excluding anyone creates a second
basis of calculation that turns the published per-question distributions into a
direct read of that person's answers.

## Scope

- A pure module under `src/lib/analytics/` that turns filling durations into
  what may be published about them.
- A service that joins responses to attempts, takes repositories as parameters,
  and gates on the round's privacy threshold.
- Tests for both, `node:test` + `node:assert`.

## Non-goals

- No UI. That is task C.
- No API route. Nothing outside Core reads this yet.
- No exclusion, no score deltas, no "what would change", no per-response row, no
  individual timestamp.
- No `longstring`/`IRV`/Mahalanobis. Not recommended for unidirectionally keyed
  scales, and the current template has no reverse-keyed item.
- No migration. The join key already exists on both tables.

## Acceptance criteria

- No published number describes a group smaller than the band floor, including
  numbers a reader recovers by subtracting from a published total. — **met**,
  and met by changing the shape rather than by suppressing harder (see Decisions
  made, 4).
- A response with no timing is counted and named, never counted as a fast one. —
  **met**; three reasons, three counts, three tests.
- A round with no stored questionnaire gets an explicit answer. — **met**;
  `status: 'no-questionnaire'`.
- `resolveCoreRepositories` is not called outside an entrypoint. — **met**;
  `npm run lint:composition` passed.
- `npm run verify:core` passes. — **met**, exit 0.

## Relevant repository instructions

- `AGENTS.md` — privacy is a product invariant, not an environment gate.
- `.agents/skills/shalomut-map/SKILL.md` — repositories as parameters.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `SurveyFunnelService` is the shape copied: static, repositories as parameters,
  `ABANDON_DETAIL_MINIMUM = 3` as the precedent for a floor smaller than the
  privacy threshold guarding a weaker signal.
- `src/lib/privacy/cell-suppression.ts` was the intended primitive and is not
  used. Why is decision 4.
- `survey_attempts` and `survey_responses` both carry
  `@@unique([roundId, anonymousTokenHash])`.
- `estimateMinutesForQuestionnaire` in `src/lib/survey/survey-duration.ts`.

## Decisions made

1. **The end of a session is the response's `submittedAt`, not the attempt's
   `completedAt`.** The response is the durable fact and the attempt row is a
   beacon — the same reason `SurveyFunnelService` counts completions from
   responses. It removes one of the plan's three no-timing reasons: a submission
   whose `markCompleted` never landed keeps its timing. A test asserts this
   against attempt rows that all have `completedAt === undefined`.
2. **The estimate is recomputed from the round's enabled questions**, not read
   from the stored `estimatedMinutes` field, because the computed number is what
   the respondent was shown (`survey-flow.tsx:108-117` says so and why). A test
   trims a questionnaire to twelve questions with the stored field left at four
   minutes and asserts the report measures against two.
3. **The report is gated at the round's privacy threshold; the fast count inside
   it carries the funnel's smaller floor.** This is the owner's answer to §10's
   open question plus the funnel's precedent for detail inside a report.
4. **There is no histogram, and the three-band shape was written and then
   removed.** It fails twice. A partition published beside its total is solvable
   by subtraction, so suppressing one small band forces a second — and then the
   *good* case, a round nobody rushed, renders as two blanks a manager reads as
   concealment. Measured on the real primitive before deciding:
   `[10,11,12,13,30,40,50]` against a 24-minute estimate came back with
   `far-below` suppressed and `at-or-above` suppressed complementarily, from a
   set with zero fast sessions. The report would have been least legible exactly
   when it had the best news. What replaced it publishes one count and one
   median and no third number to solve for.
5. **Zero is published exactly; one or two are bounded.** `farBelowEstimate` is
   a union — `{known: true, count}` or `{known: false, fewerThan}` — rather than
   a nullable number, so a screen cannot render "nobody was fast" and "we are
   not telling you" the same way.
6. **The slow side is not reported at all.** A duration here is a session's
   lifetime, so a forgotten tab reports six hours; splitting that tail would
   dress noise as a finding.

## Assumptions

- A duration is the lifetime of a filling session, not the work inside it. Every
  name and every string this task produces says "took less than", never "spent".

## Completed

1. `edd8b3c` — `src/lib/analytics/filling-duration.ts` and its 12 tests. The
   fast-filling boundary, the floor, the bounded count and the median.
2. `36b221d` — `src/lib/services/round-filling.service.ts` and its 13 tests, plus
   the barrel export. The join, the three no-timing reasons, the privacy gate
   and the no-questionnaire state.
3. `1c65ce7` — `PROJECT_CONTEXT.md` ADR-022, which restates the reasoning that
   keeps exclusion from being rebuilt, including the three-path trap for whoever
   revives it.

`PROGRESS.md` and `docs/source-of-truth.md` were inspected and deliberately left
alone. `PROGRESS.md` records product-level milestones and nothing here is
visible to a manager yet; `source-of-truth.md` records which screen owns which
value and no screen owns this one. Both belong to task C.

## In progress

Nothing.

## Remaining

Nothing in scope. Task C is the next piece of this feature and is not started.

## Changed files

Four commits, `origin/main..HEAD`, 7 files, +1108/−0. Nothing staged, nothing
untracked.

- New: `src/lib/analytics/filling-duration.ts`,
  `src/lib/analytics/__tests__/filling-duration.test.ts`,
  `src/lib/services/round-filling.service.ts`,
  `src/lib/services/__tests__/round-filling.service.test.ts`, and this file.
- Edited: `src/lib/services/index.ts` (one export), `PROJECT_CONTEXT.md`
  (ADR-022).

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch, is not part of this task, and was deliberately left uncommitted.

## Verification evidence

### Passed

- `npm run verify:core`, exit 0, on `1c65ce7`: **1105 tests, 1105 pass, 0 fail**
  across 18 suites, plus typecheck, eslint, the production build and all eight
  lint gates. `origin/main` was 1080 tests; the 25 added here are the 12 and 13
  named above.
- The suppression measurement in decision 4 was run against the real
  `suppressFrequency`, not reasoned about. Four duration sets were put through
  the three-band implementation and printed; the zero-fast set came back with
  two suppressed bands, which is what removed that design.

### Failed

One, during the work and by design: the three-band implementation failed its own
test `a round where nobody was fast still says so, because zero is not a small
group`. The test was right and the design was wrong — `suppressFrequency`
suppresses a zero cell deliberately ("Publishing 'no one' is publishing
something about everyone else"), which is correct for a demographic cross-tab
and wrong for this report. The design was replaced rather than the test relaxed.

### Blocked or not run

- **No browser evidence, and none is possible.** There is no route and no
  screen; nothing in this branch is reachable from a running server.
- **e2e (Playwright): not run.** Not part of `verify:core`, and no spec touches
  anything here.
- **The database integration suite (`__dbtests__`): not run.** Not in
  `verify:core`. This branch adds no migration and no repository method, so it
  exercises nothing new there — but that is reasoning, not a run.
- **No real data.** Every test builds its own sessions in memory. The report has
  never been computed over a real round's attempts, so the shape of a genuine
  duration distribution is unknown, and `FAST_FILLING_FRACTION` has not been
  checked against one.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

- **`FAST_FILLING_FRACTION = 1/3` is judgement.** The module says so where it is
  defined, on the model of the per-step seconds in `survey-duration.ts`. The
  first real round is what should confirm or move it.
- **The report is computed over responses the round holds now.** A round
  reopened after closing gets a different report, as it should — but nothing
  stores a report, so the number a manager saw is not recoverable later.
- `findResponsesByRoundId` loads every answer of every response to read two
  columns: on a 126-item instrument at 100 responses, 12,600 rows for 100 pairs.
  Acceptable because the same screen already loads them for the analytics, and a
  narrower repository method is the fix if it matters — but it is a real cost.

## Failed approaches

- **A three-band histogram suppressed with `suppressFrequency`.** Written,
  tested, measured and removed; decision 4 and the Failed section above have the
  detail. The lesson worth keeping is that the primitive was not wrong — the
  shape being fed to it was, and adding a privacy primitive to a leaky shape
  makes it unreadable rather than safe.

## Known risks

- ADR-022 is now the only place on `main`-bound history where the
  no-exclusion reasoning lives. If `research/how-a-round-was-filled` is deleted
  without landing, the two documents it cites go with it.

## Approval gates

- **Push is the owner's.** Four commits sit on the branch with no upstream. No
  secrets, credentials, authentication configuration or deployment alias was
  touched.

## Questions requiring an owner decision

- Should the report appear while a round is still collecting, or only once it is
  closed? The service computes it either way and gates only on the privacy
  threshold; task C is where the answer becomes visible.
- `FAST_FILLING_FRACTION` is a third of the estimate. Worth a look once one real
  round has been filled, and worth moving if the first distribution says so.

## Next concrete step

Hand the push over to the owner:

```bash
git push origin feat/how-long-a-round-took-to-fill
```

Then task C: a panel on `/round` in the existing warm design language, RTL-first
and WCAG AA, with first-class empty, below-threshold and no-timing states.
`RoundFunnel` is the nearest neighbour in both purpose and shape, and the two
states this service returns besides `ready` are what that panel has to render
without making either look like a failure.
