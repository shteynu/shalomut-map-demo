# The pool gets the lanes the pace allows

## Metadata

- Branch: `feat/the-pool-gets-the-lanes-the-pace-allows`
- Base branch: `feat/a-stalled-queue-says-so`, itself based on `main`
- Base commit: `960e8dd`
- Current HEAD: `2b88fa5`; the work is `ce6d1b0` and `2b88fa5`
- Status: complete, landed on `main`, archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop a burst of closures draining one round at a time. Raise the deployed
`AI_JOB_POOL_SIZE`, and put the number next to arithmetic that is actually true
of this deployment.

## User-visible outcome

None per round: one analysis still takes about three minutes. What changes is a
queue — ten rounds closing together drain in about ten minutes instead of about
thirty.

## Context

The research that produced the five-point list ranked this second: the queue
already exists and already survives a burst, but one lane means fifty schools
wait for hours, and the pool knob has existed since 2026-08-18 with the deployed
value left at `1` and a note saying the number belongs next to its evidence.

Gathering that evidence is what changed the answer. Every document said the
useful ceiling is `60/11 ≈ 5` lanes, from the fast tier's configured pace of 60.
It is not. `requests_per_minute_for` counts per model *name* and takes the
stricter tier when one name is configured on both — deliberately, so that
naming one model twice cannot buy twice the quota. The deployment sets
`LLM_MODEL_HEAVY` to the same `gemini-3.5-flash` as the fast tier, so its real
pace is the heavy 30. The binding arithmetic is `30/11 ≈ 2.7`, and the right
pool is three.

That error was latent rather than harmless: at one lane a round asks for about
eleven a minute and never meets the limit, so nothing could have revealed it
until somebody sized a pool from it. The 2026-08-18 task file names the
assumption in as many words — *"if the real tier differs, the useful ceiling
differs"* — and this is that case.

## Scope

- `render.yaml` — `AI_JOB_POOL_SIZE` `1` → `3`, with the corrected reasoning.
- `ai-analytics-service/src/config.py` — the comment on `ai_job_pool_size`.
- `ai-analytics-service/README.md` — the pool in the worker section, the
  collision in the pace section, and a stale model name beside the pace.
- `docs/ai-analysis-run-lifecycle.md` — "How many rounds run at once", the
  numbers table row.
- `.env.example` — the same caveat where the setting is introduced.
- `docs/shalomut-tracker-handoff.md`, this file.

## Non-goals

- **Raising the pace.** Separating the two tiers — a distinct heavy model, or a
  heavy pace not stricter than the fast one — would make five lanes useful. The
  30 was measured for that tier on 2026-08-05 and only applies on validator
  replays; changing it is its own decision with its own evidence and its own
  429 risk, not a side effect of wanting a bigger pool. Named in `render.yaml`
  as the lever for anyone who wants more than three.
- A second container. Still blocked on a shared rate limiter, unchanged.
- Fairness between schools. The queue stays globally FIFO; more lanes drain it
  faster without changing whose round goes first.
- Lowering the hard clamp of 10. It is a guardrail against a typo, and its
  wording now says so instead of implying it is a recommendation.
- A lint that checks the pool against the configured pace. It is the class of
  check this repository already likes and would have caught exactly this
  mistake — recorded here as a candidate rather than built, because it is a new
  script and CI entry the ask did not include.

## Acceptance criteria

- The deployed value is the largest that the real pace can keep busy, and the
  file carrying it explains the arithmetic that produced it.
- No document still says the useful ceiling is five, or the pace 60.
- Default behaviour unchanged: `config.py` still defaults to `1`, so local and
  test runs are byte-identical.

## Relevant repository instructions

- `AGENTS.md`: current code outranks prose, and a living document that
  disagrees is fixed in the same task. That is why the README's stale model
  name went with this diff rather than being left for a documentation pass.
- `AGENTS.md`: obtain approval before changing credentials, secrets or auth
  configuration. This changes none — `AI_JOB_POOL_SIZE` is a throughput knob
  and carries no secret.

## Relevant architecture and contracts

- ADR-006 owns durable execution. A pool changes how many leases one process
  holds and nothing about who owns run state.
- ADR-010 requires an always-available process for polling; the pool makes
  better use of the one that requirement already pays for.

## Decisions made

- **Three, because three saturates and four does not.** At an effective 30 a
  minute and about eleven per round, the pace becomes the binding limit at 2.7
  lanes. Three keeps it fully spent even while a lane waits on an answer, which
  is most of a round. A fourth would queue behind the pace while still holding
  a lease Core keeps alive and running a poll loop of its own.
- **Deployed value in `render.yaml`, default still `1`.** The file already
  argues that a throughput number belongs beside its evidence rather than in a
  dashboard, and a default of 1 keeps every local and test run unchanged.
- **The wrong arithmetic is corrected everywhere it appears, not just where it
  is now load-bearing.** Four files stated `60/11`; a reader who found the
  survivor would have rederived the same wrong pool.
- **The clamp stays at 10.** Tuning it to the current pace would encode one
  deployment's configuration in the code and would need moving again the day the
  pace changes. Its comment now says it is a typo guard.

## Assumptions

- `LLM_MODEL_HEAVY` on the Render dashboard is `gemini-3.5-flash`. Two
  independent sources agree — `render.yaml`'s own comment and
  `.env.render.local` — and the deployed service publishes no model name, so
  this cannot be read back from outside. **If the dashboard has since been
  pointed at a different model, the effective pace is 60 and three lanes leave
  quota unspent** — the failure is slowness, not breakage.
- ~28 provider calls per round over ~3 minutes, the figure every prior document
  uses. Not re-measured here.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing in this branch. The owner pushes; Render rebuilds because `render.yaml`
is in this service's `buildFilter`.

## Changed files

Added: this file.

Modified: `render.yaml`, `ai-analytics-service/src/config.py`,
`ai-analytics-service/README.md`, `docs/ai-analysis-run-lifecycle.md`,
`.env.example`, `docs/shalomut-tracker-handoff.md`.

## Verification evidence

### Passed

- `ai-analytics-service`: `.venv/bin/python -m pytest -q` with `GEMINI_API_KEY`
  stripped — **576 passed**.
- **The effective pace, from the real settings object** rather than from
  reading the file. Loaded with the deployment's own values
  (`LLM_MODEL_FAST=LLM_MODEL_HEAVY=gemini-3.5-flash`, 60 fast, 30 heavy):
  `requests_per_minute_for('gemini-3.5-flash')` → **30.0**, useful ceiling
  **2.73 lanes**. This is the whole reason the number is three.
- The behaviour is already pinned by
  `test_two_tiers_on_one_model_share_one_queue` — one name, one bucket, the
  stricter pace — so the collision is intended and cannot regress silently.
- **Three lanes start and are named.** Service booted locally with
  `AI_JOB_POOL_SIZE=3`: startup line reads *"Polling with 3 concurrent slot(s),
  every 2.0s and up to 30.0s while the queue is empty"*.
- **Three lanes against real Core and the real local database.** Core on 3210,
  service on 8099, one claimable run in the queue: exactly one lane claimed it
  (`200`, `attempt=2`), the other two were answered `204`, the round completed
  and its callback returned `200`, and the queue endpoint then read `idle`,
  `waitingCount 0`. No double claim, no collision.
- Memory, measured on this machine: 51 MB resident with the pool idle and
  polling off, 72 MB with three lanes polling. Against the free plan's 512 MB
  the structural cost of the extra lanes is not the constraint.
- Concurrency is already proven where it can be forced:
  `test_ai_job_worker.py` holds two slots inside `process_round` at once and
  asserts `peak_in_flight == 2` on distinct run ids.
- `npm run lint:doc-numbers` — 17 claims across 3 documents, passing.

### Failed

- None.

### Blocked or not run

- **Three rounds analysed simultaneously was not observed.** The local database
  holds one survey round, and the partial unique index allows one active run per
  round, so a third claimable run cannot exist without new fixtures. What was
  observed is three lanes polling one queue correctly; genuine parallelism rests
  on the unit test above.
- No Core-side check beyond the walk: this diff touches no `.ts` file, so
  `npm test`, `typecheck` and `build` were not re-run for it.
- Nothing on the deployment. The branch is unpushed.
- The provider was never called: the one local round is privacy-locked while
  collecting (ADR-030), so the pipeline short-circuited at the privacy gate.
  Nothing was billed, and no round of eight real dimensions ran through three
  lanes at once.

### Environment

- local and test.

### Residual risk

- **Per-lane memory under a real round is unmeasured.** 72 MB is three idle
  lanes; three rounds each holding graph state, prompts and Hebrew responses
  will be more. The failure mode is bounded rather than silent: an OOM restart
  drops the leases, Core re-claims the runs on their remaining attempts, and
  `/api/health/ai-queue` from the previous branch now reports the gap.
- **Retries get slightly more fragile at a saturated pace.** A first send waits
  for its turn outside the retry budget, but a retry books with what the budget
  has left, so a turn quoted too far out is declined and the attempt stops. Three
  lanes make that marginally more likely than one; the outcome is a disclosed
  deterministic fallback rather than a wrong map.
- **Core pays three times the idle polling.** About 8 600 invocations a day at
  the 30-second ceiling instead of about 2 900.
- A second queued round can still wait out an idle lane's current sleep, up to
  30 s — the known risk recorded when the backoff landed, unchanged and now
  three times less likely to bite.

## Failed approaches

- None. Five was the number in the earlier plain-language answer and it was
  wrong; the correction came from reading `requests_per_minute_for` rather than
  from trying five.

## Known risks

- Four files now agree that the effective pace is 30 because two model names
  collide. Nothing enforces that agreement: pointing `LLM_MODEL_HEAVY` at
  another model on the dashboard would make all four wrong at once and no check
  would notice. That is the candidate lint under Non-goals.

## Approval gates

- None. No secret, credential, authentication configuration or alias changed.
  The pace settings were read, not modified.

## Questions requiring an owner decision

- Whether to separate the two tiers so more than three lanes become useful.
  That is the only lever left on this axis, and it costs a decision about the
  heavy pace rather than a config bump.

## Exact Git state

- Branch `feat/the-pool-gets-the-lanes-the-pace-allows`, based on `960e8dd`.
- `origin/main` is `57c9e58`; three commits sit locally ahead of it —
  `026ae50`, the two from `feat/a-stalled-queue-says-so`, and this branch's.
- Unstaged and unrelated: `next-env.d.ts`, generated and left alone.
- Visibility: local only, not portable to another checkout until pushed.

## Next concrete step

Push. Render rebuilds this service because `render.yaml` is in its
`buildFilter`; confirm from the startup line in Render's logs that it reads
*"Polling with 3 concurrent slot(s)"*, which is the whole deployed proof this
change needs.
