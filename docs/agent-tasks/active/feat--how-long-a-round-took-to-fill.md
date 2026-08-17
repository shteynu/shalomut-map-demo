# How long a round took to fill

## Metadata

- Branch: `feat/how-long-a-round-took-to-fill`
- Base branch: `main`
- Base commit: `8231490` (`origin/main`)
- Current HEAD: `8231490`
- Status: opened and scoped, not started
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
§7. Both live on the unpushed branch `research/how-a-round-was-filled` at
`427b7b7`; `origin` has that branch at `dc99351`, one commit behind, so the plan
document is not yet on the remote.

The owner asked to see how people answered in order to spot suspiciously filled
questionnaires. §5 of the research is why the acting half of that — excluding
them — is not built: on the current instrument the signals are directionally
biased against dissatisfied respondents, and excluding anyone creates a second
basis of calculation that turns the published per-question distributions into a
direct read of that person's answers. What survives is the describing half.

## Scope

- A pure module under `src/lib/analytics/` that turns filling durations into a
  banded, suppressed distribution.
- A service that joins responses to attempts, takes repositories as parameters,
  and gates on the round's privacy threshold.
- Tests for both, `node:test` + `node:assert`.

## Non-goals

- No UI. That is task C.
- No API route. Nothing outside Core reads this yet.
- No exclusion, no score deltas, no "what would change", no per-response row, no
  individual timestamp. See Non-goals of the plan; this is the list that keeps
  the differencing attack closed.
- No `longstring`/`IRV`/Mahalanobis. Not recommended for unidirectionally keyed
  scales, and the current template has no reverse-keyed item.
- No migration. The join key already exists on both tables.

## Acceptance criteria

- No published number describes a group smaller than the band floor, including
  numbers a reader recovers by subtracting from a published total.
- A response with no timing is counted and named, never counted as a fast one.
- A round with no stored questionnaire gets an explicit answer, not the
  canonical fallback measured as if it were the instrument that round ran.
- `resolveCoreRepositories` is not called outside an entrypoint
  (`npm run lint:composition`).
- `npm run verify:core` passes.

## Relevant repository instructions

- `AGENTS.md` — privacy is a product invariant, not an environment gate.
- `.agents/skills/shalomut-map/SKILL.md` — repositories as parameters;
  `resolveCoreRepositories` for entrypoints only.
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `SurveyFunnelService` is the shape to copy: static methods, repositories as
  parameters, and `ABANDON_DETAIL_MINIMUM = 3` as the precedent for a floor
  smaller than the privacy threshold guarding a weaker signal.
- `src/lib/privacy/cell-suppression.ts` already owns the guarantee this report
  needs. `suppressFrequency` publishes a one-line table under two rules — no
  line has exactly one suppressed entry, and the blanks on a line account for
  nothing or for at least the threshold — which is exactly the arithmetic a
  banded distribution beside a published total exposes.
- `survey_attempts` and `survey_responses` both carry
  `@@unique([roundId, anonymousTokenHash])` and the submit route writes the same
  literal to both.
- `estimateMinutesForQuestionnaire` in `src/lib/survey/survey-duration.ts`. The
  repository already decided twice — `survey-flow.tsx:108-117` and
  `survey-builder.tsx:248-254` — that this estimate is computed from the
  questions in hand rather than read from the stored `estimatedMinutes` field.

## Decisions made

To be recorded as they are taken. The design entering the task:

1. **The end of a session is the response's `submittedAt`, not the attempt's
   `completedAt`.** The plan named `completed_at − opened_at`; the response is
   the durable fact and the attempt row is a beacon, which is the same reason
   `SurveyFunnelService` counts completions from responses. It also removes one
   of the plan's three no-timing reasons: an attempt whose `markCompleted` never
   landed still has a response with a timestamp.
2. **Three bands, not more, and the split that matters is on the fast side.**
   Above the estimate the number is noise — a backgrounded tab inflates it
   arbitrarily — so everything at or above the estimate is one band, and saying
   so is more honest than splitting a tail the measurement cannot resolve.
3. **The report is gated at the round's privacy threshold; the bands inside it
   carry their own smaller floor.** This is the owner's answer to §10's open
   question ("the report appears once the completed-questionnaire minimum is
   reached") plus the funnel's precedent for detail inside it.

## Assumptions

- A duration is the lifetime of a filling session, not the work inside it. It
  survives a reload, a backgrounded tab and a lunch break. Every name and every
  string this task produces says "took longer than", never "spent".

## Completed

Nothing yet.

## In progress

Nothing.

## Remaining

1. The pure module: bands, median, and the suppression that keeps a band count
   from being recovered by subtraction.
2. The service: the join, the three no-timing reasons counted separately, the
   privacy gate and the no-questionnaire state.
3. Documentation: `docs/source-of-truth.md` if the report becomes a fact a
   screen owns — which it does not until task C, so possibly nothing here.

## Changed files

- `docs/agent-tasks/active/feat--how-long-a-round-took-to-fill.md` (new, this
  file)

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task.

## Verification evidence

### Passed

None for this branch yet.

### Failed

None.

### Blocked or not run

Everything. No code has changed.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

None yet — no code has changed.

## Failed approaches

None yet.

## Known risks

- `findResponsesByRoundId` loads every answer of every response to read two
  columns. On a 126-item instrument at 100 responses that is 12,600 rows for a
  report that needs 100 pairs. Acceptable because the same screen already loads
  them for the analytics, and a narrower repository method is the fix if it ever
  matters — but it is a real cost, not a free reuse.
- The band boundary is judgement, not measurement, exactly as the per-step
  seconds in `survey-duration.ts` are. It has to say so where it is defined, or
  a later reader will treat it as a finding.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment alias
is touched.

## Questions requiring an owner decision

- None blocking. §10 of the research leaves open whether the report should also
  appear before a round closes; this task computes it either way, and task C
  decides where it is shown.

## Next concrete step

Write the pure module `src/lib/analytics/filling-duration.ts` with its test,
including the case that proves a lone small band cannot be recovered by
subtracting the published bands from the published total.
