# A run may name the dimensions it rewrites

## Metadata

- Branch: `feat/one-dimension-can-be-analysed-again`
- Base branch: `main`
- Base commit: `68fd473`, the tip of
  `feat/the-map-says-which-paragraphs-it-wrote-itself` (rebased there on
  2026-08-19; the original base was `e752081`, and the two branches now form a
  linear stack above `main` at `2b59526`)
- Current HEAD: `2ad95e9`, three commits above the base
- Status: complete, landed on `main` as `2ad95e9`, archived
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Make "re-run the analysis of one dimension" a real operation instead of a
sentence in a note. Until now every `AiAnalysisRun` started every field empty,
so the only re-run that existed was the whole round — eight dimensions of
provider calls to replace one paragraph.

## User-visible outcome

On a dimension screen whose paragraph was derived from the data rather than
written by the model, the note now carries a button — `ניתוח מחדש לממד הזה`.
Pressing it queues a run that writes that one dimension again and answers
`הבקשה נקלטה. הניתוח של הממד הזה ייכתב מחדש ברקע, ויופיע כאן בכניסה הבאה למסך.`
A run already in flight answers that one is already running; a round with no
stored analysis answers that there is nothing to amend.

## Context

Option 3 of the fallback-disclosure research (`claude/fallback-disclosure`,
merged as `9819d1f`), offered there and not ordered. Requested on 2026-08-19
together with option 2, which is the sibling branch
`feat/the-map-says-which-paragraphs-it-wrote-itself`.

The owner chose the shape: **the service re-runs only the named dimensions and
the callback still carries all eight stones.** No partial-payload contract, no
merge step in Core.

## Scope

- Core: `AiAnalysisRun.regenerateDimensionIds`, the trigger-ai route, the claim
  route, the dimension screen's button.
- Service: initial state seeded from the previous map, and the existing replay
  plan pointed at the named dimensions.
- The migration, the OpenAPI document, ADR-024, and the service README.

## Non-goals

- Changing the callback contract. Contract 6.0 is untouched, and so is
  `verifyAiResultAgainstRound`.
- Any Core-side merging of an old map with a new one. Core stores what it
  verified, whole, as before.
- Carrying numbers across runs. Only copy is carried; every score, status and
  aggregate in the delivered map is recomputed from this round's aggregates.
- Automatic re-runs. A person presses the button.

## Acceptance criteria

- A POST with no body behaves exactly as it did before the field existed.
- A POST naming one dimension queues a run whose stored list is that dimension.
- An unknown dimension name is refused (400), not silently widened to a round.
- Naming dimensions on a round with no stored analysis is refused (409
  `no_previous_analysis`).
- The claim response carries the list and, only then, the previous result.
- A partial run asks the provider for the named dimensions only, and still
  delivers eight stones, the unnamed ones keeping their previous provenance.

## Relevant repository instructions

`AGENTS.md` (branch-scoped task state, mandatory handoff, parallel-agent Git
safety), `.agents/skills/shalomut-map`, `.agents/skills/shalomut-verification`.
Pushing is an owner action in this environment.

## Relevant architecture and contracts

- Contract 6.0 stone map; `generationProvenance.outcome` is one of
  `llm`, `deterministic_fallback`, `unavailable`.
- The durable run lifecycle: enqueue, claim (lease token), heartbeat,
  callback or fail.
- The graph's existing `ReplayPlan` / `_replay_plan`, which already knew how to
  skip a dimension whose provenance says who wrote it. The partial run needed no
  new node logic — only a seeded initial state and a targeted first-pass plan.

## Decisions made

- **The delivered map stays whole.** Owner's choice, and the reason the change
  is small: nothing downstream of the callback learns that a run was partial.
- **The list lives on the run, not on the round.** It describes one attempt, and
  the next run must not inherit it.
- **`previousResult` travels with the lease.** A worker fetching it separately
  could read a map belonging to a different run, and the manager-scoped
  `ai-insights` route would have had to be widened for a service to read it.
- **Only copy is carried.** Interpretations, summaries, metric insight text,
  recommendations and provenance. Numbers are always recomputed, so a carried
  stone cannot disagree with this round's aggregates.
- **`findLatestResultByRoundId` filters on `state: 'succeeded'`** rather than on
  a non-null result, which would have required importing the Prisma namespace
  that this repository otherwise keeps out of the repositories.

## Assumptions

- Responses cannot change on a closed round, and only closed rounds can be
  analysed. So a carried stone's copy still describes the data it was written
  from.
- A worker that has never heard of `regenerateDimensionIds` sees an empty list
  on every ordinary run and behaves as before.

## Completed

Everything in Scope. Code, tests, migration, OpenAPI, ADR-024, READMEs, this
file and the handoff entry.

## In progress

Nothing.

## Remaining

None. The push happened: `2ad95e9` is in `main`'s history, so the branch
landed as it stood. `20260819120000_a_run_may_name_the_dimensions_it_rewrites`
had already been applied to the deployed database on 2026-08-19, ahead of it.

Archived 2026-08-20, when the file was found still sitting in `active/`
claiming the push was outstanding. Nothing above this line was rewritten —
only the metadata and this section, which were describing a state that had
stopped being true.

## Changed files

Core:

- `prisma/schema.prisma`,
  `prisma/migrations/20260819120000_a_run_may_name_the_dimensions_it_rewrites/migration.sql`
- `src/lib/types/ai-analysis-run.ts`, `src/lib/repositories/interfaces.ts`
- `src/lib/repositories/prisma/prisma-ai-analysis-run.repository.ts`,
  `src/lib/repositories/in-memory/in-memory-ai-analysis-run.repository.ts`
- `src/app/api/rounds/[roundId]/trigger-ai/route.ts`,
  `src/app/api/ai-analysis-runs/claim/route.ts`
- `src/components/dashboard/dashboard-dimension-rerun.tsx` (new),
  `src/components/dashboard/dashboard-dimension-page.tsx`
- tests: `src/app/api/__tests__/trigger-ai-one-dimension.test.ts` (new),
  `src/app/api/__tests__/ai-job-worker.test.ts`,
  `src/lib/repositories/__dbtests__/prisma-ai-analysis-runs.integration.test.ts`,
  `src/lib/server/__tests__/ai-operational-metrics.test.ts`
- `docs/openapi.yaml`, `public/openapi.json`, `PROJECT_CONTEXT.md` (ADR-024),
  `docs/shalomut-tracker-handoff.md`

Service:

- `src/agents/state.py` (`carried_state_from_result`, widened
  `build_initial_state`), `src/agents/node_support.py` (targeted first-pass
  replay plan), `src/services/analytics_runner.py`, `src/application/ports.py`,
  `src/services/ai_job_worker.py`, `README.md`
- tests: `tests/test_partial_run.py` (new), `tests/test_ai_job_worker.py`

## Verification evidence

### Passed

- `npm run typecheck`, `npm run lint`, `npm run build` — clean.
- `npm test` — 1212 passed.
- `npm run verify:db` — 37 passed, including the new integration test covering
  the column and `findLatestResultByRoundId`.
- `ai-analytics-service` pytest — 526 passed, including the two full-graph tests
  that prove one dimension is re-asked and eight stones come back.
- **All of the above re-run on the rebased tip, 2026-08-19**, because the two
  branches touch the same dashboard DTO and the stack had never been compiled
  together: `typecheck`, `lint` and `build` clean, `npm test` 1219 passed (1212
  plus the sibling branch's seven), `verify:db` 37 passed, and pytest 534 passed
  (526 plus the eight `deployment_commit` tests that arrived with the
  already-landed health branch). Run pytest with
  `ai-analytics-service/.venv/bin/python`; the system Python has no pytest.
- `prisma migrate status` against the deployed database after applying
  `20260819120000_a_run_may_name_the_dimensions_it_rewrites` on 2026-08-19:
  sixteen migrations, `Database schema is up to date!`. A read-back selecting
  `regenerate_dimension_ids` from `ai_analysis_runs` succeeded there, with a
  deliberately wrong column name as the control that it failed.
- **Exercised on the deployed stack, 2026-08-19**, in the owner's signed-in
  Chrome, against a seeded round (`SHALOM-DEPLOYED`). The map notice named
  `איזון` under its own heading; the dimension screen carried the button; a
  press queued a run with `regenerate: ["balance"]`, the deployed service
  claimed it, and the callback came back `succeeded` with eight stones —
  `balance` rewritten at `attempts: 3`, the other seven carrying the previous
  map's paragraphs **verbatim** at `attempts: 1`, every score and status
  identical. That is the carry proven from stored data. The provider is
  `failing` for want of credit, so the rewritten `balance` came back
  `deterministic_fallback` rather than as model copy, and both screens said so
  on their own.
- The seeded round's Hebrew copy is placeholder text shaped to pass the
  contract validators; only its numbers are real. It was written by a one-off
  script that was deleted. `scripts/seed-local.ts` still refuses any
  non-loopback host and was not changed.
- Live browser walk on `localhost:3210` against the local database: the button
  rendered under the deterministic note on `/dashboard/balance/`; pressing it
  produced the Hebrew acknowledgement; the database showed
  `manual:… | manual | queued | regenerate: ["balance"]`; a worker-style claim
  returned `regenerateDimensionIds: ["balance"]` and a `previousResult` with
  eight stones, the `balance` one carrying `deterministic_fallback`.

### Failed

None outstanding.

### Blocked or not run

- No end-to-end run against a real provider. The service side is covered by the
  graph tests, which stub the provider; the paid path was deliberately not
  called.
- Nothing outstanding. The deployed walk was done after the push; see below.

### Environment

Local only. Next served by `next start` on port 3210 (a dev server on 3000 can
show a stale layout). The local dev database needed
`npm run db:migrate:deploy`; `npm run verify:db` migrates only `shalomut_test`.
The database was returned to its exact prior state after the walk, the server
stopped and the scratch directory removed.

### Residual risk

Low. The new field defaults to empty everywhere, and every path that ignores it
behaves as it did before. The deployed database already has the column, applied
ahead of the code — safe for an additive column with a default, and it removes
the window where a pushed claim route would read a column that is not there. A
fresh environment or a second checkout still needs the migration before the
claim route is exercised.

## Failed approaches

- `where: { result: { not: Prisma.DbNull } }` — correct, but it drags the Prisma
  namespace into a repository that has stayed free of it. Replaced with
  `state: 'succeeded'`.
- `carried_state_from_result` first read `stone["interpretation"]`, a key the
  encoder does not write (it writes `psychologicalInterpretation`, or `summary`
  in 6.0). The symptom was a partial run that quietly regenerated all eight.

## Known risks

- A manager pressing the button on several dimensions in a row gets
  `already_running` for the second, which is the existing single-active-run rule
  and reads correctly, but it is one press per run.

## Approval gates

Push. Nothing else — no credentials, secrets, auth configuration or deployment
aliases were touched.

## Questions requiring an owner decision

None.

## Next concrete step

None for this task — it is done, landed and exercised on the deployed stack.
The one thing it leaves for someone else is not its own: the provider account
has no credit, so no re-run anywhere can produce model copy until that is
fixed. `docs/shalomut-tracker-handoff.md` owns that item.
