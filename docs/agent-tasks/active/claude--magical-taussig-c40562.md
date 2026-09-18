# The code comments that still quote a `6.0` round catch up with `7.0`

## Metadata

- Branch: `claude/magical-taussig-c40562`
- Base branch: `main`
- Base commit: `6f78027`
- Current HEAD: `8ec73ee`, one commit on top of `6f78027`
- Status: committed on the branch; the push is the owner's
- Last updated: 2026-09-18
- Last agent/tool: Claude Code (Claude Opus 5)

## Objective

Four comment-level claims still describe behaviour the code no longer has.
Correct them, changing no value and no behaviour:

1. "roughly two dozen provider calls" is the `6.0` figure. A `7.0` round sends
   17 requests on a clean pass, 51 when every call takes all three of
   `LLM_MAX_ATTEMPTS`, 204 as the ceiling.
2. `config.py` says Core reads a run as stalled after fifteen minutes; the
   threshold is ten.
3. `render.yaml` says two containers would exceed the quota; since 2026-08-23
   each process divides its pace by the live-lease count Core reports.
4. `is_worth_another_attempt` says a reclaimed attempt re-sends the same bytes;
   a reclaimed run gets a new lease token and is analysed again.

## User-visible outcome

None. No configured value, no behaviour and no test assertion changes.

## Context

`44eda70` (branch `docs/living-docs-catch-up-with-7-0`, on `origin/main`)
already did this for `render.yaml`'s and `config.py`'s `AI_JOB_POOL_SIZE` and
`LLM_MAX_CONCURRENT_REQUESTS` blocks and for `.env.example`. Its archived task
file, `docs/agent-tasks/archive/docs--round-call-count-7-0.md`, names the rest
of the code comments as the declared follow-up — this task.

## Scope

- `ai-analytics-service/src/services/ai_job_worker.py`,
  `ai-analytics-service/src/services/result_sink.py`,
  `ai-analytics-service/tests/test_result_delivery.py`,
  `ai-analytics-service/tests/test_reasoning_effort.py`,
  `ai-analytics-service/evals/README.md`,
  `ai-analytics-service/src/config.py`, `render.yaml`.

## Non-goals

- No value, behaviour, assertion or contract change.
- Dated records stay as written: the three `PROJECT_CONTEXT.md` occurrences sit
  inside ADR-016, ADR-017 and ADR-053, and the two in
  `docs/shalomut-tracker-handoff.md` already say the figure was measured on
  `6.0`. `design.md:172` is about `clamp()` heads, not provider calls.
- No paid provider call.

## Acceptance criteria

- No occurrence of the `6.0` call count is left presented as current in the
  scoped files.
- `git diff --check` clean; the touched Python compiles; the touched test
  modules pass with the provider keys stripped.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`,
  `.agents/skills/shalomut-map/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- `contracts/capabilities.json`: `7.0` has `usesNarrativeMetrics: false`, gated
  at `psychologist_node.py:256`, so the eight metric-insight batches of a `6.0`
  round are not sent. 17 = 8 structured summaries + 1 overall + 8 adaptation
  batches; `LLM_MAX_ATTEMPTS` defaults to 3 (`config.py:298`), so 51; four
  passes bound it at 204.
- `src/lib/server/ai-analysis-worker.ts:23`:
  `AI_ANALYSIS_QUEUE_STALL_AFTER_MS = 600_000`, published as
  `stallAfterSeconds` by `GET /api/health/ai-queue`.
- `provider_rate_limit.py` `set_sending_processes`, fed by `liveWorkerIds` on
  claim and heartbeat (`ai_job_worker.py` `observe_live_workers`).
- `prisma-ai-analysis-run.repository.ts:176`: every claim mints a new lease
  token for the same run row, and `analytics_runner.process_round` re-fetches
  and re-walks the graph — no payload cache.

## Decisions made

- The `render.yaml` rewording matches the already-corrected
  *How many rounds run at once* in `docs/ai-analysis-run-lifecycle.md`, so the
  two do not drift.
- `test_result_delivery.py` keeps its "same bytes under the same run identity"
  clause: that is true of the four callback attempts inside `deliver`, which is
  what those tests cover. Only the call count there is stale.

## Assumptions

- The 17/51/204 derivation of `5b76671` still holds; re-confirmed against
  `capabilities.json`, `psychologist_node.py` and `config.py` on 2026-09-18.

## Completed

All four items, in eight files. No configured value, no behaviour and no test
assertion changed — proven rather than asserted, see *Passed*.

1. The call count, now 17 on a clean `7.0` pass and up to 51 with retries:
   `ai_job_worker.py`, `result_sink.py`, `test_result_delivery.py`,
   `evals/README.md`, plus two the re-grep found —
   `test_reasoning_effort.py` ("the round's twenty-eight calls") and
   `docs/local-environment.md` ("roughly 33 provider calls", which the named
   patterns missed).
2. `config.py`: ten minutes, naming `AI_ANALYSIS_QUEUE_STALL_AFTER_MS` and
   `GET /api/health/ai-queue` so the next reader can check it.
3. `render.yaml`: two containers divide one quota since 2026-08-23, worded to
   match *How many rounds run at once* in `ai-analysis-run-lifecycle.md`.
4. `is_worth_another_attempt`: a reclaimed run is minted a new lease token for
   the same run row and is analysed again — nothing caches the payload, so the
   second attempt is paid for a second time.

Two occurrences of the `6.0` figure were deliberately anchored rather than
changed, because they are true of the past they describe:
`test_ai_job_worker.py` (a past-incident docstring, now saying "the 28 a `6.0`
round cost when this was written, up to 51 on the `7.0` … now") and
`llm_provider.py:674` ("a round that used to want thirty-three", about the
pre-batching design it replaced — untouched).

## Remaining

Nothing in scope. Still open from the same family, and unchanged by this task:
once a `7.0` round has been analysed through the deployment, time it and
re-derive the `AI_JOB_POOL_SIZE` divisor — item 9 of *External blockers and
approval gates* in `docs/shalomut-tracker-handoff.md`. Until then `render.yaml`
and `config.py` correctly declare the `6.0` rate as the one still standing.

## Changed files

All committed in `8ec73ee`; the worktree is clean and nothing is staged,
unstaged or untracked:

- `ai-analytics-service/evals/README.md`
- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/services/ai_job_worker.py`
- `ai-analytics-service/src/services/result_sink.py`
- `ai-analytics-service/tests/test_ai_job_worker.py`
- `ai-analytics-service/tests/test_reasoning_effort.py`
- `ai-analytics-service/tests/test_result_delivery.py`
- `docs/local-environment.md`
- `render.yaml`
- `docs/agent-tasks/active/claude--magical-taussig-c40562.md` (this file, new)

Visibility: the handoff is on the branch, so another worktree of this clone can
consume it. It reaches another checkout or machine only after the owner pushes.

## Verification evidence

### Passed

- `git diff --check` — exit 0.
- Equivalence, which is the claim worth proving for a comment-only diff: every
  touched Python file parses to an AST identical to `HEAD`'s once docstrings
  are normalised, and `render.yaml` parses to identical YAML. So no statement,
  no default and no configured value moved.
- `.venv/bin/python -m pytest` from `ai-analytics-service` — exit 0, 639
  passed, run with `GEMINI_API_KEY`, `LLM_API_KEY` and `GOOGLE_API_KEY`
  stripped from the child environment, so no paid provider call.
- `npm run lint:doc-numbers` — exit 0, 27 claims across 4 documents.
- `npm run lint:docs-publish`, `npm run lint:audit-count`,
  `npm run lint:deploy-migrations`, `npm run lint:literals` — exit 0.
- The venv did not exist in this worktree and was created per
  `docs/local-environment.md`.

### Failed

- None.

### Blocked or not run

- The rest of `verify:core` — `typecheck`, `npm test`, `npm run build`,
  `npm run lint`, `verify:ai`. Not run deliberately: no `.ts`/`.tsx` file was
  touched, and the AST/YAML equivalence above is stronger evidence for this
  diff than a suite that cannot see a comment at all.
- No deployed check. Nothing is deployed from this branch yet.

### Environment

- local.

### Residual risk

- Prose only. The one judgement a reader should re-check is the wording of the
  `is_worth_another_attempt` docstring: the code it describes is unchanged, so
  a disagreement there is about accuracy of description, not about behaviour.

## Failed approaches

- None.

## Known risks

- Low. Comments and docstrings only.

## Approval gates

- The push is the owner's. It touches `render.yaml` and
  `ai-analytics-service/**`, so it rebuilds the service on Render.

## Questions requiring an owner decision

- None.

## Next concrete step

Owner: push the branch with

```
git push origin claude/magical-taussig-c40562:main
```

That rebuilds the AI service on Render, because the commit touches
`render.yaml` and `ai-analytics-service/**`. The rebuild carries no behaviour
change: the YAML and every touched module parse identically to `HEAD`'s.
Afterwards move this file to `docs/agent-tasks/archive/`.
