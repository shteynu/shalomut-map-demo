# Feat: a failed question suggestion leaves a countable trace

## Metadata

- Branch: feat/a-dead-model-leaves-a-trace
- Base branch: main
- Base commit: `9d7c067`
- Current HEAD: `9d7c067`; the implementation is complete and **uncommitted** in
  the working tree of this worktree only.
- Status: implementation complete and verified; awaiting commit and push, both of
  which are the owner's to run here.
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give the question-suggestion path the observability every other AI path in Core
already has. Today a failed suggestion emits nothing at all — no metric, no log
line — so the only witness that the model did not answer lives in the AI
service's own Render log, which expires and which no one reads without a reason
to look.

## User-visible outcome

None. A manager sees exactly what they see today: the Hebrew "not available
right now" message and the template under the template's own label. This adds
observability, not behaviour.

## Context

Established this session, and the reason this task exists: four
`POST /api/manager/question-suggestion` calls on the deployed endpoint all
answered `503` with `reason: "upstream_error"`, `upstreamStatus: 503`, because
the provider account's prepayment is depleted (`reason=http_429` in the service's
own log, read on Render). Finding that out cost a whole session, and the reason
it was expensive is this gap: `grep` over
`src/app/api/manager/question-suggestion/route.ts` and
`src/lib/server/request-question-suggestion.ts` returns no `console.*` and no
`logger`, and `src/lib/server/ai-operational-metrics.ts` has no metric whose
name mentions a suggestion.

The round pipeline is not in this state — `ai_jobs_failed`,
`ai_deterministic_summary_ratio_sample` and
`ai_deterministic_metric_narrative_ratio_sample` already cover it. This task
closes the one path that has nothing, and deliberately does not touch the
separate, larger question of collecting emitted metrics anywhere durable.

Full reading in `docs/shalomut-tracker-handoff.md` under the 2026-08-17 entries.

## Scope

- `src/lib/server/ai-operational-metrics.ts` — two new metric names and one
  recording function.
- `src/app/api/manager/question-suggestion/route.ts` — call it on both outcomes.
- Tests beside the existing `src/app/api/__tests__/` metric tests.

## Non-goals

- No metric sink, collector, dashboard or alert. The sink stays
  `console.info`, and where those lines go remains the open owner decision this
  file does not reopen.
- No change to what a manager sees, to the AI contract, or to the AI service.
- No new metric on the round pipeline, which is already instrumented.

## Acceptance criteria

- A suggestion the model answered and a suggestion that failed are each
  countable, and the failure carries enough labels to name the cause without a
  second lookup.
- No metric is emitted for a request refused as malformed before the service is
  reached: a bad `dimensionId` is a caller defect, not a provider outcome.
- The metric emission is the log line, following
  `recordSurveySubmissionDelivery` rather than adding a second logging
  convention beside it.
- `verify:core` exits 0.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, verification in proportion to risk.
- `.agents/skills/shalomut-map/SKILL.md` — canonical boundaries, existing
  patterns before new abstractions.
- `.agents/skills/shalomut-verification/SKILL.md` — evidence for the actual
  diff.

## Relevant architecture and contracts

- `src/lib/server/ai-operational-metrics.ts` — `OperationalMetricName`, the
  `console.info` default sink, `setOperationalMetricSinkForTests`.
- `src/app/api/manager/question-suggestion/route.ts` — manager-gated, reads no
  repository, needs no round id.
- `src/lib/server/request-question-suggestion.ts` — returns the discriminated
  `QuestionSuggestionResult` this metric reports on.
- No contract file is touched: nothing here crosses the AI wire.

## Decisions made

- Two names rather than one with an `outcome` label, mirroring the existing
  `ai_jobs_succeeded` / `ai_jobs_failed` pair.
- The failure metric is emitted by the route rather than by
  `requestQuestionSuggestion`, so the transport stays a pure function of its
  input and the route keeps the one place that decides what a failure means.

## Assumptions

- The provider's depleted prepayment is the current cause but not the only one
  this counter must survive: the labels carry `reason` rather than assuming
  `upstream_error`.

## Completed

- Session start: git state read, both skills read, branch created from `9d7c067`.
- The gap confirmed by reading rather than assumed: no logging on either module
  of the path, no suggestion metric in the metrics module.
- The idiom to follow located: `recordSurveySubmissionDelivery` and
  `src/app/api/__tests__/survey-delivery-report.test.ts`.

- `ai_question_suggestions_succeeded` and `ai_question_suggestions_failed` added
  to `OperationalMetricName`, with `recordQuestionSuggestionOutcome` beside
  `recordSurveySubmissionDelivery`.
- Both call sites in the route: the failure branch before its `503`, the success
  branch before returning the suggestion.
- Four tests added to the route's existing suite, and both call sites falsified.
- `PROGRESS.md` gains one bullet beside the existing "a failure leaves a trace"
  entry, which this extends; `docs/shalomut-tracker-handoff.md` corrects its own
  2026-08-17 sentence about Core holding no trace.

## In progress

- Nothing.

## Remaining

- Commit and push, both owner actions in this environment.

## Changed files

Uncommitted in the working tree:

- `src/lib/server/ai-operational-metrics.ts` — two metric names and
  `recordQuestionSuggestionOutcome`.
- `src/app/api/manager/question-suggestion/route.ts` — the two call sites.
- `src/app/api/__tests__/question-suggestion.test.ts` — four tests and a metric
  sink reset in `afterEach`.
- `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
  `docs/agent-tasks/active/feat--a-dead-model-leaves-a-trace.md` (this file).

No contract, schema, migration, configuration or AI-service file changed.

The four documentation commits already on this branch (`a09d315`, `84d8e56`,
`181f2e4`, `9d7c067`) belong to the investigation that produced this task rather
than to its implementation, and they are also on
`chore/the-consent-text-is-approved-and-the-tasks-are-archived`, which points at
the same commit.

Pre-existing unrelated modification, left untouched and unstaged:
`next-env.d.ts`.

## Verification evidence

Context: local. Nothing in this task was verified against the deployed
environment, and nothing needed to be — the change is Core-side and emits to
stdout.

### Passed

- `npm run verify:core` — exit 0, captured as an exit code rather than read off
  the tail of its output. That covers all eight `lint:*` checks, `typecheck`,
  `npm test`, `verify:ai` (the Python suite), `lint` and `build`.
- `npm test` — 1160 tests, 1160 pass, 0 fail, 18 suites.
- `npm run build` — exit 0.
- Targeted: `npx tsx --test src/app/api/__tests__/question-suggestion.test.ts`
  — 14 pass, 0 fail.
- **Both call sites falsified before the tests were trusted.** Removing the
  success call failed exactly test 10; removing the failure call failed exactly
  tests 11 and 12; the rest passed in both runs. So each test fails for the
  absence of the thing it claims to check.
- **The emitted lines were read, not inferred.** With the default sink untouched,
  the three shapes are:
  `{"observability":"shalomut_operational_metric","name":"ai_question_suggestions_succeeded","value":1,"unit":"count","labels":{"attempts":"2"}}`,
  the same with `ai_question_suggestions_failed` and
  `{"reason":"upstream_error","upstreamStatus":"503"}`, and one carrying
  `{"reason":"unavailable"}` with no status key at all. Same envelope as every
  existing counter, so whatever eventually collects those lines needs no change
  to pick these up.

### Failed

- None.

### Blocked or not run

- Browser smoke: not run, and not required by the matrix row for
  `src/app/api`/utilities. Nothing a manager sees changed — the Hebrew message
  and the template fallback are byte-identical.
- A deployed reading of the new counter: not run. It needs the change on `main`
  and one press of the suggestion button there. Worth doing once the provider
  account has credit, because the same walk then reads
  `ai_question_suggestions_succeeded` and proves both halves.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  Node 22. `GEMINI_API_KEY` was stripped from the environment of every test and
  verification run, so nothing here spent a provider call.

### Residual risk

- The counter is emitted from the route, so a future caller of
  `requestQuestionSuggestion` outside this route would not be counted. There is
  exactly one caller today, asserted by `grep`; a second one is the thing to
  watch.
- `attempts` on the success path comes from the AI service and defaults to `0`
  when absent, so an `attempts="0"` label means the service did not report one
  rather than that no attempt was made.

## Failed approaches

- None.

## Known risks

- A counter nobody collects is still not an alert. This task makes the failure
  countable in the same place the product's other counters land; it does not
  make anyone notice. Naming that limit is part of the deliverable so it is not
  mistaken for detection.

## Approval gates

- None. No secrets, credentials, aliases, migrations or deployment
  configuration are touched.

## Questions requiring an owner decision

- None for this task. The open one it sits next to — where emitted metric lines
  should be collected — is recorded in `docs/shalomut-tracker-handoff.md` and is
  deliberately out of scope.

## Next concrete step

Commit the working tree as one commit and push the branch. Until a commit exists
this work is visible in this worktree only — not to another worktree, and not to
another checkout or machine. Suggested message:
`feat(observability): a question suggestion that never reached the model is countable`.
