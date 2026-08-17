# Feat: one authenticated read says whether the provider is answering

## Metadata

- Branch: feat/the-service-remembers-its-last-provider-answer
- Base branch: main
- Base commit: `3a17333` (the tip of `feat/a-dead-model-leaves-a-trace`, which is
  itself not yet on `main`)
- Final commit: `3b02f1c`, pushed by the owner on 2026-08-17 and on `main`; the
  deployed AI service has run it since that evening.
- Status: **done and archived.**
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make "is the model alive?" answerable in one request instead of a session. On
2026-08-17 the deployed suggestion button was found to have been failing on a
depleted provider prepayment for an unknown length of time; establishing that
took four hand-made requests, a read of `main.py` and a signed-in look at the
service's log on Render.

## User-visible outcome

None. No manager or respondent screen changes, and no anonymous response
changes.

## Context

This is item 2 of three the owner was offered after the 2026-08-17
investigation. Item 1 (`feat/a-dead-model-leaves-a-trace`, `3a17333`) made a
failed suggestion countable in Core. This one makes the provider's state
readable at its source.

Two facts established by reading before any code was written:

- **Nothing kept the state.** No module in the service held a last provider
  outcome, and `GET /health` was its only GET. So this is not exposing something
  that existed; it is deciding to remember it.
- **Core's `/api/health` forbids exactly this.** Its own comment
  (`src/app/api/health/route.ts:22`) states that no database, provider or
  credential state is reported, because an endpoint saying whether a secret is
  set tells an anonymous caller where to push. That ruled out the obvious
  placement and made the question an owner decision rather than a detail.

## Scope

- New `ai-analytics-service/src/services/provider_health.py`.
- `ai-analytics-service/src/services/llm_transport.py` — record every outcome.
- `ai-analytics-service/src/main.py` — the authenticated read.
- `ai-analytics-service/tests/test_provider_health.py`.
- `ai-analytics-service/README.md` — its `## Endpoints` list.

## Non-goals

- No active probe: this endpoint never calls the provider.
- No persistence, no metric sink, no alerting, no Core-side consumer.
- No change to `/health`, and no provider fact added to any anonymous response.

## Acceptance criteria

- Every exit of the transport is recorded, including the one that returns before
  any HTTP is attempted.
- A process that has observed nothing answers `unknown`, never `ok`.
- The read is refused without the inbound secret.
- `/health` still says nothing about the provider, asserted by a test.
- Full Python suite and `verify:core` pass.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, verification in proportion to risk.
- `.agents/skills/shalomut-map/SKILL.md` — Core/AI boundary, existing patterns
  before new abstractions.
- `.agents/skills/shalomut-verification/SKILL.md` — the `ai-analytics-service`
  row asks for the full pytest set including contract suites.

## Relevant architecture and contracts

- `llm_transport.py` — its own docstring already asserts that every generation
  goes through `complete_with_retries`, which is why that function is the single
  correct place to record from.
- `main.py` — the inbound-secret shape shared by the webhook and the suggestion
  endpoint.
- No contract file, manifest, schema or migration is touched. Nothing crosses
  the AI wire: this is a read of the service's own memory.

## Decisions made

- **Owner decision, 2026-08-17: behind the service's inbound secret**, of three
  offered placements (anonymous on `/health`, secret-gated, manager-gated in
  Core). It keeps the reading one request for whoever operates the service and
  publishes nothing.
- **Owner decision, 2026-08-17: passive with an explicit `unknown`**, rather than
  an active probe or a flag-selectable hybrid. The cost is named under residual
  risk rather than hidden.
- **Recorded by wrapping `complete_with_retries`, not beside its three exits.**
  A fourth exit added later is then recorded without anyone remembering to, and
  the early `missing_api_key` return is covered by a test precisely because it
  leaves by a different door than the other two.
- In-memory only. A database write on the provider path would add a failure mode
  to the path that is already failing, and a stale row read after a redeploy is
  worse than an honest `unknown`.

## Assumptions

- The reader is the operator, not the public — which is what the secret gate
  encodes.

## Completed

- `provider_health.py`: thread-safe last-outcome record (the provider call runs
  under `asyncio.to_thread`, so records arrive from worker threads), plus
  `observedSince`, `observedForSeconds` and success/failure counts so `unknown`
  cannot be misread as healthy.
- `complete_with_retries` split into a recording wrapper over the original body,
  now `_complete_with_retries`.
- `GET /api/v1/provider-health`, same auth shape as the suggestion endpoint,
  including its `503` when the secret is absent outside development.
- Nine tests, and the recording falsified.
- `README.md` `## Endpoints` updated. It was already stale in a second way and
  that was corrected in the same edit: `POST /api/v1/questions/suggest` was
  missing from the list although the endpoint is older, and the line now says so.

## In progress

- Nothing.

## Remaining

- Commit and push, both owner actions here.
- A deployed reading, which needs this on `main` and the inbound secret. See
  `Blocked or not run`.

## Changed files

Uncommitted in the working tree:

- `ai-analytics-service/src/services/provider_health.py` (new).
- `ai-analytics-service/tests/test_provider_health.py` (new).
- `ai-analytics-service/src/services/llm_transport.py` — one import, the wrapper,
  and the rename of the original function.
- `ai-analytics-service/src/main.py` — one import and the endpoint.
- `ai-analytics-service/README.md` — the endpoint list.
- `docs/agent-tasks/active/feat--the-service-remembers-its-last-provider-answer.md`
  (this file), `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`.

Pre-existing unrelated modification, left untouched and unstaged:
`next-env.d.ts`.

## Verification evidence

Context: local. Nothing was verified against the deployed environment.

### Passed

- Full Python suite: `.venv/bin/python -m pytest -q` — **493 passed**, 0 failed.
  This is the check that mattered most, because the change renames a function
  eight call sites and several tests reach through.
- `npm run verify:core` — exit 0, captured as an exit code.
- Targeted: `pytest tests/test_provider_health.py -q` — 9 passed.
- **The recording was falsified.** With the `record_provider_attempt` call
  removed from the wrapper, exactly four tests failed — the answering case, the
  refusing case, the early-exit case and the replacement case — and the other
  five passed, including the auth tests and the `/health` leak test, which is
  the right split: those five do not depend on recording.
- **Both readings were read from the running app, not inferred.** Through
  `TestClient` with the default state:
  `{"status":"unknown","detail":"no provider call has been made since this process started","lastAttempt":null,"attemptsSeen":{"succeeded":0,"failed":0},...}`
  and, after one refused provider call:
  `{"status":"failing","lastAttempt":{"answered":false,"reason":"http_429","model":"gemini-3.5-flash","attempts":1,...},"attemptsSeen":{"succeeded":0,"failed":1},...}`.
  The second reproduces the deployed defect's exact shape — same reason, same
  model — which is the closest a local run gets to the thing this was built for.
- The anonymous `/health` was asserted to contain none of `provider`,
  `lastAttempt`, `http_429`, `gemini` or `apiKey`, so the placement decision is
  enforced by a test rather than by intent.

### Failed

- None.

### Blocked or not run

- **A deployed reading.** It needs this code on `main` and the value of
  `AI_WEBHOOK_SECRET`, which is not in `.env.deployed.local` and which no agent
  reads here. The owner can run it as one `curl` with an `Authorization: Bearer`
  header once deployed; against the current account it should answer
  `status: "failing"` with `reason: "http_429"` after any suggestion attempt, and
  `status: "unknown"` on a freshly restarted instance that nobody has used.
- Browser smoke: not applicable, nothing a browser reaches changed.
- Core-side tests: unchanged and not re-run beyond `verify:core`, which ran them.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`,
  service virtualenv `ai-analytics-service/.venv` (Python 3.14).
  `GEMINI_API_KEY` was stripped from every run, so no provider call was spent.

### Residual risk

- **The honest limit of a passive reading, accepted by owner decision.** The
  state lives in one process's memory, so a redeploy or a spin-down resets it to
  `unknown`, and nothing moves it except a real suggestion or a round's analysis.
  On a quiet deployment the answer can therefore stay `unknown` indefinitely, and
  `unknown` is not health. The endpoint says exactly that in its `detail`, and
  `observedForSeconds` lets a reader see how long the silence has lasted.
- The free Render instance sleeps after 15 minutes without inbound traffic, but
  the keep-alive monitor takes `/health` roughly every 5 seconds, so in practice
  the process — and this state — is long-lived. That is an observation about the
  current monitor, not a guarantee; if the monitor is ever removed, this reading
  becomes much more often `unknown`.
- The counts are per-process and reset with it, so they are a liveness signal
  rather than a metric anyone should trend.

## Failed approaches

- None. Recording beside each of the transport's three exits was considered and
  rejected before being written, in favour of the wrapper.

## Known risks

- This is still not an alert. It makes the answer cheap for whoever asks; nobody
  is yet asking on a schedule. That is item 3 of the three, and it stays open.

## Approval gates

- None triggered. No secret, credential, alias, migration or deployment
  configuration was changed. The endpoint *reads* whether the provider answered;
  it never reports whether a secret is set, and it echoes no variable value.

## Questions requiring an owner decision

- None outstanding for this task; the two that gated it were answered on
  2026-08-17 and are recorded under `Decisions made`.

## Next concrete step

None — the work landed as `3b02f1c` and this file is archived. The reading it
added is what `feat--the-monitor-can-see-a-dead-model.md` later projected one word
out of for an anonymous watchdog; the living record is in
`docs/shalomut-tracker-handoff.md`.
