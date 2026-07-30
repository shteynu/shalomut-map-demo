# Shalomut Map — PROGRESS.md

Updated: 2026-07-30 (**`main` now enforces the complete TypeScript, ESLint, build and Python verification suite
before deploy**, and GitHub Actions proved it on commit `4430796`; the live AI state is unchanged: contract
`5.0` is proven, items 8, 10 and 15–21 are closed, and item 12 — rotating the four exposed secrets — remains
the one open risk and the one open item)

## Current State

- **Session close, 2026-07-30: the deploy workflow can no longer go green while the TypeScript tests, ESLint
  or Python service are red.** Commit `620c5f6` changed `Build & Validate` from three checks to the complete
  sequence: `npm ci`, typecheck, `npm test`, ESLint, build, a fresh Python 3.11 venv, dependency install from
  `ai-analytics-service/requirements.txt` plus its dev extra, and `.venv/bin/python -m pytest`. The first CI
  attempt exposed that quoted recursive globs are not expanded by the Ubuntu runner; commit `4430796` replaced
  the fragile command with `scripts/run-tests.mjs`, which enumerates every `src/**/__tests__/*.test.ts(x)` file
  and invokes the pinned `tsx@4.23.1` without a network fallback. Before wiring them into CI, `npm test` (274
  tests), `npm run lint`, `.venv/bin/python -m pytest` (269 tests) and the `js-yaml` workflow parse all passed
  locally. GitHub Actions run
  [30560598544](https://github.com/shteynu/shalomut-map-demo/actions/runs/30560598544) then passed every validate
  step on `main` at `4430796`; its `Success` state and successful `Build & Validate` node were also confirmed
  visually in Chrome. The manual production deploy was skipped as designed. One non-blocking annotation remains:
  `actions/checkout@v4`, `actions/setup-node@v4` and `actions/setup-python@v5` target deprecated Node.js 20 and
  are currently forced by GitHub onto Node.js 24.
  - At the CI implementation handoff, before the documentation-only session-close commit, `HEAD`,
    `origin/main` and `origin/HEAD` all pointed to `4430796`.
  - The working tree is intentionally not clean: seven pre-existing user-owned files remain modified
    (`ROADMAP.md`, three files under `ai-analytics-service`, `next-env.d.ts` and two AI insights view-model
    files). They were preserved and excluded from the CI commits.

- **Item 10 closed: the model writes all eight dimensions, and green stopped being refused for ordinary
  Hebrew.** Both parts as the owner decided them: `ONLY_LLM_FOR_PROBLEMATIC` goes to `false`, and a green
  dimension the provider refuses keeps its deterministic sentence rather than becoming a gap — the one status
  whose fallback is not a guess about a problem, with `attempts` saying which road it came by and the outcome
  never claiming `llm`. The blacklist lost `שיפור` and `לשפר` outright and now refuses `שחיקה` only where it is
  asserted, so "אין סימני שחיקה" passes. That cost was already being paid: green recommendations have gone to
  the model all along, so a rewrite reaching for the ordinary word lost its adaptation to catalog copy every
  round. The quota objection was empty — the live round of 2026-07-29 was already an all-eight-model round at 22
  requests with no `429`. `pytest` 269/269 with 19 new, fail-first confirmed on 8 of them. **Not exercised
  live**; residual risk named in the item. Details in item 10 of Next Up.

- **Item 8 closed: the builder can ask the model for a question, and cannot pass its answer off as its own.**
  The question library was three hardcoded items covering three dimensions of eight; it is now the canonical
  instrument for all eight, plus a request to the AI service for a fresh one. The three rules that make a
  suggestion safe to offer are each a test: the request names the dimension, the source is marked and the mark
  is true end to end (a non-model string is refused rather than relabelled), and the wording cannot join the
  questionnaire until the manager has rewritten it — template wording included. An AI failure falls back to the
  template with a note, so the button never dead-ends. `pytest` 250/250, `npm test` 274/274, `eslint` clean; the
  six UI states were also looked at rather than only asserted on, which is what caught the AI button competing
  with the page's save primary. **Not exercised against the deployment**, and **Python deploys first** — Core is
  the only caller of the new endpoint. Details in item 8 of Next Up.

- **Item 21 closed: a replay writes what the validator rejected, not the round.** The residual risk item 20
  named and could not reach with a pace. Repairing one refused stone cost **17 heavy requests of the 20 the
  heavy tier allows in a day; it now costs 1**, measured on a graph run before and after. The validator records
  which dimensions it refused and which part of them, and the three nodes skip everything else — keeping an
  accepted interpretation's text and its attempt count, not just its text. `pytest` 234/234 with six new tests,
  five of which fail against the previous code. Not exercised live, and not exercisable on demand: the heavy
  tier opens only when the validator rejects something. Details in item 21 of Next Up.
  - Both halves of the deployment were on `69dfbbd` when this session started — Render's `/health` says so, and
    the Vercel production deployment holding the alias was built one minute after that commit. So the
    consumer-first ordering item 15 needed was satisfied on its own, and `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY=4`
    reached Render with that deploy through `render.yaml` (inferred from the blueprint winning before, not read
    back: `/health` does not report it).

- **Session of 2026-07-30, closed with everything pushed** — `origin/main` at `01fd852`, working tree clean.
  Six items closed in order: 16 and 18 on the Hebrew validation chain, 17 on what a refusal may log, 15 on the
  partial map, 19 on the published contract shapes, 20 on per-model pacing. Two of them were verified against
  the deployment; the other four are local-only, and each says so in its own entry.
  - **Left open by the owner's decision, not by a blocker**: item 8, the AI-generated question suggestion,
    deferred on 2026-07-26 and again on 2026-07-30; and item 10, whether the model should also write the green
    dimensions (`ONLY_LLM_FOR_PROBLEMATIC=false`). **Both were taken up later the same day and closed** — see
    the two entries above.
  - **The one open risk is item 12**, the four secrets exposed on 2026-07-29 and not yet rotated. Nothing in
    this session touched them, and nothing can: it is the owner's hands by `AGENTS.md`.
  - **Two things wait on a deployed round rather than on code**: the partial map (item 15) has never been
    exercised live, and per-model pacing (item 20) cannot be exercised on demand, because the heavy tier opens
    only when a safety validator rejects a whole node. `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY=4` reaches Render
    with the next deploy through `render.yaml`.

- **The first successful live round, 2026-07-29 19:02:15–19:03:52 UTC on round `f9c18f1c`.** Ninety-seven
  seconds from webhook to callback `200`, and **not one `429` in the log** — the acceptance criterion the
  quota plan was written for. Persistence says `status: success`, contract `5.0`, and
  `inspect-ai-provenance` reads **8 stones out of 8 with `outcome: llm`** (seven on the first attempt, one on
  the second). That closes step 4 of the E2 plan and item 2 in Next Up, and it exceeds their criterion, which
  asked only for some of the stones to be model-written.
  - **The pace held.** Consecutive provider answers are 4.2–4.4 seconds apart, and 22 requests went out in
    about 91 seconds — 14.2 a minute against a tier that allows 15. Every call names
    `model=gemini-3.5-flash-lite`, so Render's blueprint value did win over the dashboard entry: that open
    question is answered, no dashboard edit was needed.
  - **The prompt fix held in production too.** The stored summary says "11 תשובות אדומות מתוך 40" and "9 ל-19
    תשובות לכל ממד" — answers, with their denominator, where the same prompt had reported people.
  - **18 of 24 recommendations were rewritten by the model; 6 stayed catalog copy** — all three entries of
    `certainty` and all three of `professional-competence`, both red dimensions. Their adaptation batches
    failed twice with `invalid_semantic_output` and fell back by design, which is a legal outcome, so the
    round succeeded with two dimensions carrying the generic paragraph every school gets. **Diagnosed, fixed
    and reproven on the deployment** (commit `6569c4d`) — the two failed for unrelated reasons that shared one
    label. The rerun of 2026-07-30 07:31:21–07:32:40 UTC came back with **24 of 24 recommendations written by
    the model**; see item 16.
  - **A retry now stops at two attempts, not three**, although `LLM_MAX_ATTEMPTS` is `3`: at 14 a minute the
    queue's next turn no longer fits inside `llm_retry_budget_seconds` once the minimum window is reserved,
    so the budget declines it. That is the designed behaviour meeting the new pace, not a fault — but the
    third attempt is effectively unreachable for a semantically rejected answer at this rate.

- **Contract `5.0` is live and proven (2026-07-29).** `AI_ANALYTICS_CONTRACT_VERSION` was set in Vercel
  Production and Preview and the production deployment redeployed; step 3 of the E2 plan is closed, with the
  runbook and the evidence in [e2-step3-contract-version-rollout.md](docs/e2-step3-contract-version-rollout.md).
  Two records were corrected on the way: the variable had never existed in Preview at all, so Preview was
  producing `3.0`, and the variable is of type Sensitive, so its value can never be read back — the proof is
  behavioural, from an authenticated `/api/mcp/` call and from `5.0` persisted in a round's own result.
- **The pipeline works end to end on the deployed stack; the provider quota is what stops it.** Two live rounds
  ran on `f9c18f1c`. The second left a complete Render trace: webhook `202`, privacy gate at ten responses
  unlocked, provider calls, callback `200`, all in 42 seconds. Five `outcome=llm` lines on `gemini-3.5-flash`
  prove the model answers. Three dimensions — `certainty`, `organizational-climate`, `meaning` — exhausted
  three attempts each against `status=429` and ended as `provider_unavailable reason=http_429`, which fails the
  whole round by design, so none of the successful dimensions reached the database.
  - This is the fail-loud behaviour of PR #12 working as intended, observed on the deployment for the first
    time: `status: validation_failed`, `failureReason: provider_unavailable`, Hebrew unavailability copy, no
    invented analysis.
  - One anomaly is unexplained: two rejections with `reason=invalid_finish_reason` before any `429`. The
    truncation theory was checked and disproved — `MAX_TOKENS_PER_DIMENSION` is not set on Render, so the
    `2048` default applies. The log records the label but never the provider's actual `finish_reason`.
- **Four live secrets were exposed in a chat transcript on 2026-07-29** — the Gemini API key and the three
  shared secrets between Core and the AI service. Rotation is the owner's call and has not been done; see item
  12 in Next Up. No secret value was written to the repository.

- **A round no longer meets the provider all at once (2026-07-29, deployed).** Both LLM nodes hand
  their whole batch to `asyncio.gather` — eight interpretations, then up to two dozen recommendation
  adaptations — so roughly 33 calls used to leave together. Free provider tiers cap concurrent requests (the
  strictest at two), and the burst spent that budget in the first breath of the round.
  - `LLM_MAX_CONCURRENT_REQUESTS` (default `2`) bounds them; the slot is taken before the worker thread is
    dispatched, so waiting costs no part of the per-dimension retry budget and the default thread pool is no
    longer flooded either. Rounds get longer; the webhook has already answered `202`, so nothing user-facing
    waits on it. Declared in `render.yaml` and forwarded locally.
  - Two tests: one asserts the invariant (peak ≤ 2 across eight dimensions), one raises the limit to five and
    requires a peak above two — without it a serial-by-accident run would satisfy the first test just as well.
- **The fast path moved to `gemini-3.5-flash-lite`, checked on this project's own prompts and then on a
  live round (2026-07-29; deployed).** Limits are per model, so this is a different budget rather than a bigger share of the same
  one: 15 RPM / 1000 RPD against 5 / 20. `render.yaml` now carries `LLM_MODEL_FAST` and
  `LLM_MAX_REQUESTS_PER_MINUTE` as values, together, because a rate means nothing without the model it counts
  for. `LLM_MODEL_HEAVY` stays on `gemini-3.5-flash` in the dashboard.
  - **`gemini-2.5-flash-lite` was the first candidate and is not available** — the endpoint answers `404`
    "This model is no longer available to new users", although `v1beta/models` still lists it. Recorded so it
    is not tried again.
  - **Checked against the production entry points, not a bespoke script**: the real 5.0 interpretation,
    summary and adaptation prompts, judged by the real acceptance predicate. 6/6 accepted, every one on the
    first attempt. One interpretation cost 373 prompt + 197 visible tokens and **0 thinking tokens** against
    the 2048 cap — where `gemini-3.5-flash` spent ~1076 on thinking, which is the whole history behind
    `MAX_TOKENS_PER_DIMENSION`. The fixture was invented; no respondent data was involved.
  - **Three defects in the copy were found and fixed in the prompts, then the run was repeated.** The round
    summary had reported "21 staff members in the red zone" on a round of 20 respondents — the buckets are
    summed over a dimension's questions, so they count answers, and nothing validates a number in the summary
    beyond it being Hebrew. An interpretation had merged 9 yellow and 3 red into "12 of 20 reported a lack of
    support". An adaptation had opened with "adapting recommendations to reduce the load" — the task
    description where the advice belongs. All three land on the 5.0 path only, so the prompts of the closed
    contracts are untouched, and a test asserts that. After the fix the same fixture produced "21 answers out
    of 40", each colour quoted separately with yellow named as monitoring, and the recommendation itself.
  - **Known edge, resolved 2026-07-30 as item 20**: the pace was one number for the process while the limits
    are per model, so a safety-validator replay — the only path that reaches `LLM_MODEL_HEAVY` — ran at lite's
    14 per minute against flash's 5. The queue is now one per model, which is what that entry called the real
    fix.
- **A round is now paced to what the tier allows (2026-07-29; `794c9b1`, deployed and proven live).**
  Concurrency was the wrong axis: two slots still deliver a round's seventeen requests inside one minute, and
  the free tier for `gemini-3.5-flash` allows five. `LLM_MAX_REQUESTS_PER_MINUTE` (default `5`) adds the axis
  that was missing and is declared in `render.yaml` **with a value**, so unlike `LLM_MAX_CONCURRENT_REQUESTS`
  it does not live on a default invisible in the dashboard. At five per minute a round takes about three and a
  half minutes, against the fifteen `AI_RUN_EXPECTED_COMPLETION_MS` allows before a run reads as stalled.
  - The queue lives in [`provider_rate_limit.py`](ai-analytics-service/src/services/provider_rate_limit.py)
    and is taken in `llm_transport.py` rather than beside the semaphore in `_in_provider_slot`, which is where
    [the plan](docs/provider-quota-plan-2026-07-29.md) put it. The transport is the one place every request
    already passes through, so the queue charges real sends and only those: a green dimension that never calls
    a provider spends no turn, and the round summary — which does not go through `_in_provider_slot` at all —
    cannot slip past it. The plan's invariant is kept: the turn is taken before `request_started_at`, so
    waiting for one costs no part of a call's `llm_retry_budget_seconds`.
  - **Retries take a turn of their own**, which is the specific reason retrying never helped: three attempts
    0.5 and 1.1 seconds apart spent themselves inside the minute that had just refused them. A `Retry-After`
    the provider sends now outranks `LLM_RETRY_MAX_DELAY_SECONDS`, which had been shortening a seven-second
    wait to two; what bounds it instead is the retry budget, which declines a wait it cannot hold rather than
    shortening it.
  - Seven tests in [`test_provider_rate_limit.py`](ai-analytics-service/tests/test_provider_rate_limit.py):
    the interval is kept, a raised limit really does raise the pace (without which a serial-by-accident run
    would satisfy the first on its own), a retry after `429` waits for the next turn, a queued call keeps its
    whole retry budget, a `Retry-After` beyond the budget stops the retry, a declined turn costs nobody their
    place, and the setting is read from the environment. `pytest` 187/187, `npm test` 241/241.
- **`llm_provider.py` (1323 lines, one class) is split along what each part is responsible for (deployed).** Half its
  public surface was a Hebrew validator that `nodes.py` called on text no provider had returned.
  - `llm_transport.py` — one bounded conversation with a provider (endpoint, attempts, backoff, `Retry-After`,
    hard-quota rules); it never reads the copy it carries, acceptance arrives as a predicate.
    `hebrew_prompts.py` — the three prompts plus the interpretation the service writes without a model.
    `hebrew_validation.py` — what counts as acceptable copy; `nodes.py` now calls it directly.
    `llm_provider.py` stays the facade: model tier, which prompt goes out, which predicate judges the answer,
    and what a refused answer means for the round.
  - Behaviour is unchanged and the facade keeps the whole surface tests use, private helpers included. The only
    test edit was two monkeypatch paths for the clock, which now lives in `llm_transport`. Total line count grew
    (~1540 against 1323): the win is that the validator no longer pretends to be part of the provider.
  - `scripts/local-stack.mjs` now forwards every `LLM_*` variable by prefix instead of by name — the enumerated
    list is how a variable added to `src/config.py` silently failed to reach the local service.
- **GitHub Models / Llama 3.3 70B was evaluated as a second provider and dropped at the owner's request
  (2026-07-29).** Recorded so it is not re-investigated: the catalog id is `meta/llama-3.3-70b-instruct`, the
  endpoint `https://models.github.ai/inference` is OpenAI-compatible and needs no code (`LLM_API_KEY` +
  `LLM_BASE_URL`), but the free tier for that model is 10 requests/minute, 50/day and 2 concurrent against a
  round of ~33 calls. No key was ever placed in `.env`, and every trace of the provider was removed from the
  repository afterwards. Gemini remains the provider.
- **Code anchors in the planning documents were re-verified (2026-07-29).** All 35 `file:line` links in
  `docs/ai-insights-depth-plan-2026-07-27.md` now land on the code the surrounding sentence describes; six had
  moved with the split, the rest had drifted earlier and independently. Four more references were repointed in
  `docs/shalomut-tracker-handoff.md`, `docs/manager-feedback-plan-2026-07-26.md` and
  `docs/completion-plan-2026-07-26-evening.md`. The prose of the dated plans was not rewritten — only the
  anchors, plus a note in the plan's header saying so.
- **Verification of the above (local, 2026-07-29)**: `.venv/bin/python -m pytest` 177/177, `npm test` 241/241,
  `npm run lint` clean, `node --check scripts/local-stack.mjs`, and `npx tsx scripts/local-unlocked-pipeline.ts`
  reaching Python unchanged. The prefix forwarding was exercised against the real source of `aiEnvironment()`
  with a fabricated `LLM_` name. Every anchor was resolved programmatically and its target line printed.
  **Not verified: a live provider call.** No key was available and this session's sandbox proxy presents a CA
  that Python's TLS refuses, so the model was never actually reached — the concurrency bound is measured
  against a stub, not against a provider.
  - **Merged and live.** The owner pushed the branch and squash-merged it as PR #13; `main` is `10c94ff` and
    its tree is identical to the three-commit branch. Render rebuilt itself off the merge:
    `GET https://shalomut-ai-analytics.onrender.com/health` returns `commit: 10c94ff`, `env: production`,
    `privacyThreshold: 10`, versions `1.0`–`5.0`. `LLM_MAX_CONCURRENT_REQUESTS` is declared in `render.yaml`
    with no dashboard value, so the deployed service runs on the default of two.

- **The deterministic fallback no longer stands in for a failed provider call (2026-07-28, owner decision,
  local, not deployed).** Until now any provider failure — no key, `429`, timeout, malformed JSON, or output the
  validators kept refusing — was replaced by a sentence the service composed from the aggregates, and the round
  was persisted as `status: "success"`. A quota outage and a finished analysis looked identical on the
  dashboard, which is the reason for the change: a school cannot act on advice it has no way of knowing was
  invented.
  - `LLMProviderService` now raises `ProviderUnavailableError` (carrying the same transport reason the logs
    use: `http_429`, `missing_api_key`, `invalid_finish_reason`…) instead of substituting copy, for the
    dimension interpretations and for the `5.0` round summary. The psychologist node collects the failures and
    stops the round rather than spending tokens on the rest of it.
  - The whole round comes back as `status: "validation_failed"` with `failureReason: "provider_unavailable"`
    and a Hebrew message. The status stays inside the versioned set Core validates and `failureReason` is
    additive, which the deployed callback validator already accepts on a non-success payload — so no contract
    version bump and no consumer-first ordering constraint.
  - `AnalyticsRunnerService` sends that failure payload on the callback even when the pipeline raises after the
    MCP fetch. The webhook has already answered `202` by then, so a crash used to be silent.
  - Two things deliberately kept, decided by the owner this session: the green dimension that
    `ONLY_LLM_FOR_PROBLEMATIC` never sends to a provider keeps its aggregate-grounded sentence (no call is made,
    so no failure is hidden; recorded as `deterministic_fallback` with `attempts=0`), and a failed `5.0`
    recommendation rewrite still falls back to the human-written catalog entry.
- **Core says which of three things happened when no result is stored.** `GET /api/rounds/{id}/ai-insights`
  answers `404` with `run.state` — `idle` (never dispatched), `running` (dispatched inside
  `AI_RUN_EXPECTED_COMPLETION_MS`, 15 min) or `stalled` (dispatched, nothing ever delivered). A run that died
  without reporting used to read as "the analysis was never requested". The dashboard error state now says
  `שירות הניתוח אינו זמין כרגע` with the reassurance that the answers are intact, and a separate
  `הניתוח בעבודה` state keeps a run in flight from looking like a failure. OpenAPI JSON and YAML carry the new
  `404` body.
- **Fixed on the way through: a privacy-locked round on contract `4.0`/`5.0` never reached the manager.**
  `privacy_gate_node` attached `surveyDefinitionHash` only on `3.0`, and Core refuses any `3.0`/`4.0`/`5.0`
  payload without it — the locked result was rejected at the callback with `400` and nothing was persisted. The
  gate now uses the same dynamic-version set as the rest of the graph.
- **Verification of the above (local, 2026-07-28)**: `.venv/bin/python -m pytest` 175/175,
  `npm test` 241/241, `npm run lint` 0 errors, `npm run build` 39/39 pages, `git diff --check` clean.
  `npx tsc --noEmit` reports the same 19 lines it reports on the stashed baseline, all in test files this work
  did not touch. Pipeline tests that used to reach the end of a round by leaving the key unset now say so
  explicitly through the `answering_llm` fixture (`ai-analytics-service/tests/llm_stub.py`); the Core↔Python
  boundary test drives `tests.stub_pipeline_cli`, which is the shipping pipeline with only the two model-written
  calls answered locally — deliberately a test entry point, so no flag exists in the service that could put
  invented copy in front of a manager.
  - **Proven live rather than only in tests.** With the local stack running (Core `:3000`, AI `:8000`, local
    Postgres, the seeded 12-response round), a manual trigger returned `202`, Gemini answered `429` three times
    for `organizational-climate`, the service logged `outcome=provider_unavailable reason=http_429`, the
    callback delivered the failure and Core answered `200`, and the dashboard showed the Hebrew unavailable
    copy. The same round on the old code would have been a green "success" with an invented paragraph.
    `run.state` was observed going `idle` → `running` after the trigger. The `הניתוח בעבודה` screen itself was
    not seen in the browser: the round failed in about three seconds on the quota, too fast to catch, and it
    rests on the API check plus a component render test.

- **Contract 5.0 is Live & Pushed**: Full Contract 5.0 implementation pushed to `main` (commits `84e5875` -> `01c3858`).
  - Score distribution (`green`, `yellow`, `red`) calculated and sent in `questionAggregates`.
  - 8-dimension context & per-question distribution included in LLM prompt.
  - Multi-sentence psychological interpretations (2–5 sentences) and generative `overallPsychologicalSummary` (2–4 Hebrew sentences) enabled.
  - KB expanded to 80 items with context-aware RAG ranking in Python AI service.
- **Automated tests** (branch `feature/ai-insights-depth-v5`, 2026-07-28): `npm test` 232/232 passed
  (231 before the threshold-default guard was added), `.venv/bin/python -m pytest` in `ai-analytics-service`
  169/169 passed, `npm run lint` 0 errors, `npm run build` compiled and generated 39/39 pages. Use the venv interpreter: the system `python3` has no
  pytest. On `main` the same suites stood at 202 and 107. The earlier "16/16" figure came from
  `run_tests.py`, which carried its own sixteen tests and never collected `tests/` — the full suite was in fact
  red (`test_rag_store.py`, broken by the catalog expansion) while that number was recorded. The sixteen now live
  in `tests/test_service_integration.py`, `run_tests.py` only forwards to pytest, and a root `conftest.py` makes
  a bare `pytest` work too.
- **Why the LLM never answered — settled, and fixed on a branch.** An owner-approved live provider call on
  2026-07-28 reproduced the `deterministic_fallback` on all eight stones of `SHALOM-F125` and named the cause:
  `gemini-*` are reasoning models, their thinking is charged against `max_tokens`, and the thinking is invisible
  in the response — it shows only as the gap between `completion_tokens` and `total_tokens`. Measured on
  `gemini-flash-latest`: at `max_tokens=420` the answer came back `finish_reason: "length"` with
  `completion_tokens: 16` against `prompt_tokens: 266` and `total_tokens: 682`, so 400 tokens went to thinking
  and the 16 returned were a fragment of it. At `2048`: `finish_reason: "stop"`, 1440 thinking tokens, 108
  visible, correct Hebrew. `MAX_TOKENS_PER_DIMENSION` now defaults to `2048`, and the live run returns
  `outcome=llm` on the first attempt for the interpretation (`4.0` and `5.0`), the round summary and the
  intervention adaptation. The model configured for the deployment (`gemini-3.5-flash`) was checked separately:
  ~1076 thinking tokens, so `2048` covers it too. Deployed since the merge below.
- **`feature/ai-insights-depth-v5` is merged and live (2026-07-28)**: PR
  [#11](https://github.com/shteynu/shalomut-map-demo/pull/11) squash-merged into `main` as `2be0708` at 12:51 UTC,
  carrying all 36 commits of the depth plan and the 2026-07-28 work. The merge deployed both halves at once:
  Vercel production `shalomut-map-demo-2lfgwm6he` is `● Ready` (35s) and holds the alias, and Render rebuilt the
  AI service by itself — `GET /health` reports `commit: 2be0708`, `env: production`, `privacyThreshold: 10`,
  `supportedContractVersions: ["1.0","2.0","3.0","4.0","5.0"]`. Read-only smoke: `/login/` `200`,
  `/api/rounds/` `401 JSON`.
  That is E2 steps 1 and 2 satisfied, though not in the ordered way the plan asked for — both halves went out
  from one merge. It is safe here only because Python accepts a superset of versions and Core emits `5.0` only
  when `AI_ANALYTICS_CONTRACT_VERSION` says so. The variable exists in both Production and Preview scopes; its
  value is encrypted and was not read this session, and the handoff records it as `4.0` since 2026-07-27.
- **Privacy threshold is 10 everywhere**, and since 2026-07-28 that includes the database. Code:
  minimum and default in Core, fallback and clamp in the Python service, declared threshold of contract `5.0`.
  Rounds configured below ten are raised rather than refused — a stored definition loads at ten, a payload below
  ten is read as locked, and the `round.privacyThreshold` column is only ever read through
  `effectivePrivacyThreshold`. **Owner decision taken 2026-07-28: migrate.** Migration
  `20260728120000_privacy_threshold_minimum_ten` puts the column default back to `10`, raises rounds below it and
  raises the `minimumResponses` their questionnaire snapshot quotes. Applied to the one database the same day —
  see the database bullet for the before/after values.
  While `SHALOM-F125` still existed the migration locked it immediately, because the then-deployed `main` read the
  column raw: until that point production served a full dashboard for a round answered by three people. The round
  has since been deleted with the rest of the data — see the database bullet.
- **Deployed runtime**: `https://shalomut-map-demo.vercel.app/` serves current `main`.
- **One database**: Supabase `tpfzhyalaftotljmlont` (`aws-1-ap-northeast-2`, Seoul) is the only database of the
  project. The deployed runtime, local `.env` and `prisma migrate` all resolve to it; all five migrations are
  applied and `privacy_threshold` defaults to `10`. The second project `fvnulyirrqjrnjbahmsn` was deleted by the
  owner on 2026-07-27; nothing referenced it. Never define a second `DATABASE_URL` in `.env.local`: Next.js
  prefers it over `.env` while migrations read `.env`, and the two drift apart silently.
  **The database is empty as of 2026-07-28**, cleared by the owner for manual testing: `0` organizations,
  `0` rounds, `0` responses, `0` question answers, no persisted insights. `prisma migrate status` still reports
  the schema up to date and the column default is `10`, so the next round a manager creates starts at ten in both
  the code and the row. `GET /api/survey/SHALOM-F125/` on the deployed app now answers `404` — the round is gone
  and empty persistence stays empty rather than inventing a demo round.
  The contents before the clear are dumped to `~/shalomut-db-backup-2026-07-28.json` (outside the repository,
  mode `600`): 1 organization, 1 round `SHALOM-F125` (`3173c065-aa01-470e-a54b-eb0e7669756b`), 3 responses,
  72 question answers and its `ai_insights` at contract `4.0` in full. With no PITR on the Free plan that file is
  the only way back.
  State read the same day, before the threshold migration: column default `1`; that round at threshold `1` with
  snapshot `minimumResponses` `1`; 3 answers on each question. After it: column default `10`, round threshold
  `10`, snapshot `minimumResponses` `10`; response and answer counts unchanged. Rollback of the migration itself,
  should it ever be wanted, is `ALTER TABLE "survey_rounds" ALTER COLUMN "privacy_threshold" SET DEFAULT 1;` and
  deleting the migration's row from `_prisma_migrations`; the row-level part no longer applies, since the rows are
  gone. The project is on the Supabase Free plan, so there is
  no PITR behind this: the recorded values are the whole safety net.
- **Two environments, local and deployed, since 2026-07-28** — see
  [local-environment.md](docs/local-environment.md). The local one is a Postgres container
  (`compose.yaml`, `127.0.0.1:5433`) plus `npm run local`, which is the whole environment in one command: it
  starts the Docker daemon when it is down and `colima` is installed, brings the container up, applies the
  migrations, and only then starts the core on `:3000` and the AI service on `:8000`, handing the service its
  configuration from the repository-root `.env`. Ctrl-C stops the two services and leaves the database running;
  `docker compose down` ends it. Verified from a removed volume: all five migrations applied, then both halves up.
  The wiring matches the deployment rather than relaxing it: the three shared secrets are required on both sides,
  the provider key and contract version come from the same file, and the service runs with the new `ENV=local`,
  which is `production` minus one rule — its Data Layer may be on loopback. Deliberate differences: `next dev`
  instead of a production build, and `admin123` when `MANAGER_ADMIN_PASSWORD` is empty.
  `.env` now points at the local container; the deployed database credentials moved to `.env.deployed.local`, and
  a deployed migration needs its URL passed on the command line. Proven end to end on 2026-07-28: manager login,
  seeded round of twelve responses, `trigger-ai` → `202` → MCP callback into the local core → `outcome=llm` on
  `gemini-flash-latest` before the free-tier quota answered `429`.
- **Single deployed environment**: `https://shalomut-map-demo.vercel.app/` is the only product URL.
- **Manager organization scope**: `MANAGER_ORGANIZATION_ID` is `34d05e66-fa4d-4a07-a2af-c9d5c41b6088` in both
  Vercel Production and Preview. The organization it names was deleted with the rest of the data, and that is
  survivable rather than broken: `PUT /api/manager/setup` writes the server-owned scoped id
  ([`setup/route.ts:182`](src/app/api/manager/setup/route.ts:182)) and the service creates the organization under
  exactly that id when none exists ([`manager-setup.service.ts:56`](src/lib/services/manager-setup.service.ts:56)),
  so the first setup after the clear recreates `34d05e66-…` and the variable keeps pointing at the right row.
  `organizationId` is embedded in the signed session at login, so a session issued earlier keeps its old
  organization for up to 24 hours.

---

## Next Up

1. [x] Deploy updated Python AI service container to Render to serve Contract 5.0 endpoints — live and current:
       `GET https://shalomut-ai-analytics.onrender.com/health` on 2026-07-28 returns `commit: 2be0708` and
       `supportedContractVersions: ["1.0","2.0","3.0","4.0","5.0"]`. Render rebuilt itself off the merge.
2. [x] Finish the E2 deploy order for `5.0` — **step 4 closed 2026-07-29**: the live round on `f9c18f1c`
       finished `status: success` with 8/8 stones `outcome: llm` and no `429` in the Render log. Details in
       the first Current State entry. The history below is kept because it records what the failure was and
       how it was found.
       ([ai-insights-depth-plan-2026-07-27.md](docs/ai-insights-depth-plan-2026-07-27.md), section
       "Продолжение"). Steps 1 and 2 landed with the merge of PR #11 — Python is deployed and `/health` was read.
       **Step 3 is done** (2026-07-29, by the owner; runbook and evidence in
       [e2-step3-contract-version-rollout.md](docs/e2-step3-contract-version-rollout.md)):
       `AI_ANALYTICS_CONTRACT_VERSION` now exists in both Vercel Production and Preview, and the production
       redeploy `shalomut-map-demo-1t7fim7ss` holds the alias. Two corrections came out of it — Preview never
       had the variable at all, so it was producing `3.0` rather than the recorded `4.0`; and the variable is
       of type Sensitive, so its value cannot be read back by `vercel env pull` or the dashboard. **The written
       value was then proven twice** on round `f9c18f1c`: an authenticated `POST /api/mcp/` returned `200` with
       `contractVersion: "5.0"`, `totalResponses: 10`, `privacyThreshold: 10`, `isLocked: false`, eight
       dimensions and 27 question aggregates — plus `backgroundContext`, which only crosses the boundary at
       `4.0`/`5.0` on an unlocked round — and `5.0` is also persisted in the round's own result, so the whole
       Core → Python → callback → persistence chain carried it. **Step 4 is open and was attempted**: the live
       round ran end to end on 2026-07-29 and failed, `dispatchedAt 10:57:25.393Z` → `processedAt
       11:01:19.081Z`, `status: validation_failed`, `failureReason: provider_unavailable`. The acceptance
       criterion is not met in persistence, and `inspect-ai-provenance` has nothing to read on this round.
       **The cause is established** from the Render log of a re-run on the same round (11:17:14–11:17:56, 42
       seconds, full trace from webhook `202` through privacy gate to `Callback response status: 200`), and it
       is two independent problems. **Quota:** `outcome=retry status=429` with `547→1106 ms` backoff, then
       `no_answer attempts=3` and `provider_unavailable reason=http_429` on `certainty`,
       `organizational-climate` and `meaning`. **An unexplained second failure:** two earlier rejections with
       `reason=invalid_finish_reason`, which `llm_transport.py` emits when `finish_reason != "stop"`. The
       truncation theory — an explicit `MAX_TOKENS_PER_DIMENSION=420` in the Render dashboard — was checked and
       disproved: the variable is not set there, so the `2048` default applies and that is enough for
       `gemini-3.5-flash` (~1076 thinking tokens measured). A safety filter, `recitation` or another non-`stop`
       finish reason remains possible; the log records only the label, never the provider's actual
       `finish_reason`, so adding that to the log line is the next diagnostic step. Note that
       the model did answer: five `outcome=llm` lines on `gemini-3.5-flash`. None of it reached the database,
       because failing one dimension fails the whole round. That is a product contradiction worth settling
       before step 4 — on the free tier `429` reliably kills three of eight dimensions, so no round can ever
       succeed even though the provider works. It is wider than item 10, which only covered green dimensions.
       The timeout objection is gone: the background webhook of item 6 is deployed, so a long round can no
       longer be cancelled mid-run.
3. [x] Decide what the ten-respondent threshold means for rounds created before it — the owner chose the migration
       (2026-07-28). `20260728120000_privacy_threshold_minimum_ten` is applied to the one database: default `10`,
       `SHALOM-F125` raised from `1` to `10` in both the column and its questionnaire snapshot, verified read-only
       afterwards on the deployed respondent endpoint. That round has since been deleted with the rest of the
       data; the column default survives it and governs every round created from now on.
4. [x] Sign in as a manager on the deployed app and run the first setup against the empty database — done by
       the owner on 2026-07-29. Round `f9c18f1c` exists with ten responses and is unlocked at a privacy
       threshold of ten, which is what an `/api/mcp/` read returns for it, so manager sign-in, round setup and
       the respondent flow all work on the deployment. Not separately checked: that the recreated
       organization's id equals `MANAGER_ORGANIZATION_ID` — the variable is encrypted and was never read.
5. [x] Delete or pause the retired Supabase project `fvnulyirrqjrnjbahmsn` (completed by owner 2026-07-27; no runtime referenced it).
6. [x] Make the Python webhook answer `202` and process in the background — done 2026-07-28 in
       [`main.py`](ai-analytics-service/src/main.py). Authentication, configuration and event-type rejections stay
       synchronous; everything after them runs in a FastAPI background task, and a failure there is logged instead
       of raised, since the caller has already been answered. Measured locally against mock MCP and a local
       callback sink: `202` in `0.003s`, callback delivered `15.6s` later, `Background analytics finished` in the
       service log. Core needed no change — its trigger already reads any 2xx as `accepted` and answers `202`
       itself. The dashboard's "generate analysis" button no longer reloads immediately, since the result cannot
       be there yet; it now says the map will update within a few minutes, matching the round screen.
       **Deployed and verified 2026-07-28**: the owner pushed, Render rebuilt itself, and a read-only smoke
       returns `commit: 813c718`, `env: production`, versions `1.0`–`5.0`; an unauthenticated
       `POST /api/v1/webhook/events` still answers `401`, so the rejections that stayed synchronous still are.
7. [x] Extend the callback's round cross-check beyond `3.0`
       ([`ai-insights/route.ts`](src/app/api/rounds/[roundId]/ai-insights/route.ts)) — done in `c284caa`:
       `4.0` and `5.0` now go through `validateDynamicResultAgainstRound()` like `3.0`. Comparing the score
       distribution itself is still open and is slice D1 of
       [ai-insights-depth-plan-2026-07-27.md](docs/ai-insights-depth-plan-2026-07-27.md).
8. [x] **AI-generated proposed question flow, slice 3.1** (2026-07-30). Deferred twice by the owner and taken
       up on request. The premise the item was written on held right up to the change: the builder's library was
       three hardcoded questions cycling on `bankCursor % questionBank.length`, covering `management-support`,
       `certainty` and `self-expression` — three dimensions of eight, so a manager building a round about the
       other five had nothing to start from. All three rules of
       [slice 3.1](docs/manager-feedback-plan-2026-07-26.md) are now in place, and each one is a test.
       - **A request that names the dimension.** `POST /api/manager/question-suggestion` (manager session, same
         middleware as the rest of the manager API) asks Python for one item about one of the eight dimensions.
         `POST /api/v1/questions/suggest` is a plain endpoint, deliberately **outside the versioned analytics
         contracts** — it carries no round, no scores and no school context, so versioning it alongside the map
         would tie an unrelated shape to the 5.0 chain. It reuses `AI_WEBHOOK_SECRET` rather than adding a
         fourth shared secret, and Core derives its URL from `AI_SERVICE_URL` with `new URL(path, base)`, so no
         new environment variable exists to go missing.
       - **The source is marked, and the mark is true end to end.** Python only ever answers `source: "llm"` on
         an item the model wrote; Core only ever emits `source: "ai"` on such an item, and rejects a `200` whose
         source says anything else as `invalid_response` — a deterministic string must not wear the model's
         label here for the same reason it must not in a stone. The other button is labelled as what it is:
         the canonical questionnaire. The OpenAPI test pins `QuestionSuggestion.source.enum` to `['ai']` so a
         later consumer cannot be told `template` may arrive from that route.
       - **Manual editing is mandatory.** The dialog opens with the suggested wording and refuses to add it
         while the text still equals what was suggested, with the reason in Hebrew text and wired through
         `aria-describedby` — not a disabled button and a colour. This applies to the template item too: a
         school reads the questionnaire as the manager's own words.
       - Two smaller things came with it. The library was replaced by the instrument itself, so **all eight
         dimensions have a template suggestion** and one already in the draft is not offered again (normalized
         comparison, so spacing and a missing full stop are the same item). And an AI failure is not a dead
         end: it falls back to the template with a note saying so, in the panel where the request was made.
       - Validation reuses the Hebrew chain rather than inventing one: Hebrew-only letters, 20–200 characters,
         one sentence, no digits, no question mark — an item in this instrument is a first-person statement,
         not a question — and not a duplicate of an item the draft holds.
       - Verification: `pytest` 250/250 (16 new), `npm test` 274/274 (23 new), `eslint` clean. The changed
         surfaces were looked at, not only asserted on: the builder sits behind manager auth, so the panel and
         the dialog were rendered to a static page and six states inspected in RTL — idle, in flight, AI
         unavailable with the template offered, an unedited suggestion, an edited one, and an ordinary edit
         with no label. That check found a design fault the tests could not: the AI button was a third dark
         primary next to the page's real primary, saving the questionnaire, and is now a tinted secondary.
         **Not exercised against the deployment** — no round has asked the deployed service for a suggestion.
       - Ordering: Python gains a new endpoint and Core is its only caller, so **deploy Python first**; a Core
         deploy that lands ahead of it answers `503` with a Hebrew note and offers the template, which is the
         same path as a provider outage.
9. [x] Empty the database for manual testing — done by the owner on 2026-07-28 and verified read-only afterwards:
       `0` organizations, `0` rounds, `0` responses, `0` answers, schema still up to date. The dump taken
       beforehand is at `~/shalomut-db-backup-2026-07-28.json` and is the only way back.
10. [x] **The model writes all eight dimensions, and the blacklist stopped refusing ordinary Hebrew**
       (2026-07-30). Decided by the owner after two deferrals, both parts as recommended: the switch goes to
       `false`, and a green dimension the provider refuses keeps its deterministic sentence instead of becoming
       a gap. What made the decision cheap is that all three obstacles the item was written on had been moved
       by other work; what made it worth taking is that the blacklist was costing something already.
       - **The quota objection was empty.** The live round of 2026-07-29 was already an all-eight-model round —
         `8/8 outcome: llm` means none of its dimensions came out green — at 22 requests in 97 seconds with no
         `429`. So the measurement for the configuration this item was debating existed before the item was
         decided. What the switch costs is up to five more requests in a round that does have green dimensions,
         against 1000 a day.
       - **The blacklist refused `שיפור`, `לשפר` and `שחיקה` for green, and two of those are what a school does
         with a strength.** They are gone from the rule. `שחיקה` stays, but as a claim only: a denial standing
         before it in the same sentence clears it, so "אין סימני שחיקה" — a statement in green's favour — is no
         longer refused for naming the thing it denies. That is the distinction `5.0` already draws for a
         foreign colour, allowed as a count and refused as a verdict. `מצוקה מבנית` and `טיפול מיידי` are
         refused whatever the phrasing: those contradict the score Core owns.
       - **This was not a hypothetical cost.** The adaptation node has no colour filter, so green
         recommendations have been going to the model all along, and the safety validator applies the same
         `is_status_consistent` to a rewritten entry. A green rewrite that reached for `שיפור` lost its
         adaptation to catalog copy silently, in every round, with the switch on. The catalog itself never
         carried the words — checked across all 40 green-targeted entries — so only the model was being
         punished, for the ordinary word.
       - **A refused green dimension keeps the sentence rather than the gap.** Green is the one status whose
         deterministic sentence is not a guess about a problem: it is built from the aggregates and it is the
         copy green had for as long as it was never asked. Taking it away would have made letting the model
         near green a net loss for the reader. `attempts` separates the two roads — `0` never asked, higher
         asked and refused — the outcome stays `deterministic_fallback` and never `llm`, and yellow and red
         still raise, because there a formula in place of an analysis is exactly what fail-closed exists to
         prevent. `inspect-ai-provenance` now reads the attempt count out loud for that reason.
       - **`ONLY_LLM_FOR_PROBLEMATIC` is declared in `render.yaml` at last**, which is the part of this item
         that had nothing to do with the decision: it was unset in both blueprint and dashboard and defaulted
         to `true` in `config.py`, so the choice lived nowhere a reader could find it. The code default moved to
         `false` with it, and the blueprint wins over a dashboard entry — established on `LLM_MODEL_FAST` — so
         one deploy is enough either way.
       - Verification: `pytest` 269/269 with 19 new in
         [`test_green_dimensions.py`](ai-analytics-service/tests/test_green_dimensions.py); fail-first
         confirmed — 8 of the 19 fail against the previous code and the other 11 are the guards that must pass
         on both sides (the verdicts still refused, a negation hidden inside `לאורך` or `מלא` still not a
         denial, yellow and red untouched, the switch still skipping, and the deterministic sentence still
         clearing the validators it will be judged by). Two existing tests encoded the old rule and were
         rewritten rather than deleted: one asserted `יש לשפר` was refused for green, the other that a green
         stone in a default round is `deterministic_fallback`. `npm test` 274/274 and `eslint` clean; the Core
         side changed only the diagnostic. **Not exercised live.**
       - Ordering: Python-only plus a blueprint value, no contract change, so this deploys in either order.
         **Residual risk, named rather than fixed:** a safety-validator refusal that survives three replays
         still fails the whole round on every version, including `5.0` — the partial map absorbs
         `provider_unavailable` and not `validation_failed`. Green adds up to five more dimensions that can
         reach that path. It is not new and not green-specific, and the blacklist fix removes the trigger that
         made green likelier than the rest.

       What follows is the item as it stood, kept because it records the reasoning the decision rests on.
       Decide whether the model should also write the green dimensions (`ONLY_LLM_FOR_PROBLEMATIC=false`) — the
       owner raised it on 2026-07-29 and deferred the work. No code is needed to switch it, but three things
       have to be settled first, in this order. (a) The green blacklist in
       [`hebrew_validation.py:129`](ai-analytics-service/src/services/hebrew_validation.py) refuses `שיפור`,
       `לשפר` and `שחיקה`, which is ordinary phrasing about a strength ("keep and develop"); it was written when
       green never reached a provider. A refusal now costs the **whole round**, since a provider that answers
       nothing ends it. (b) Whether green should be allowed the deterministic sentence as a fallback instead of
       failing the round — the one place where the fallback was never hiding a failure. (c) Quota: +3–5 calls per
       round, and a safety-validator failure replays the whole psychologist node, all dimensions, up to three
       times. `ONLY_LLM_FOR_PROBLEMATIC` is also not declared in `render.yaml`, so a dashboard value could be
       lost on a blueprint sync. Note that the model already writes about green dimensions through the `5.0`
       recommendation adaptation — only the interpretation is withheld.
       **Left open by the owner on 2026-07-30, and cheaper than when it was written.** Items 15 and 20 moved two
       of the three obstacles. On `5.0` a refused dimension no longer ends the round: a validation refusal
       exhausts its attempts and raises `ProviderUnavailableError` with its dimension id
       ([`llm_provider.py:219`](ai-analytics-service/src/services/llm_provider.py)), which is exactly what the
       partial map now absorbs — the stone comes back `unavailable` and the other seven stand. So (a) costs one
       stone rather than the round, and (b) is close to answered by the same mechanism: a gap is declared
       instead of filled, which was the point. (c) is smaller too, since a replay is now paced at the heavy
       model's own limit rather than at three times it. What still wants deciding is the blacklist itself —
       `שיפור`, `לשפר` and `שחיקה` are ordinary phrasing about a strength — and whether losing a green stone to
       it is acceptable when the same words are unremarkable in context.
11. [x] Commit the 2026-07-29 work — done as three commits (refactor, concurrency bound, documentation) on
       `refactor/llm-provider-split`, squash-merged by the owner as PR #13. The refactor commit was verified
       green on its own in a temporary worktree (175 tests, the two concurrency tests arriving with the next
       commit).
12. [ ] **Rotate the four secrets exposed in a chat transcript on 2026-07-29** — the Gemini API key and
       `MCP_SHARED_SECRET`, `AI_WEBHOOK_SECRET`, `AI_CALLBACK_SECRET`. Owner's decision and owner's hands:
       AGENTS.md gates credential changes, and the session permission layer declines the writes anyway. What
       makes this more than a chore is the ordering — the three shared secrets exist in pairs, one copy in
       Render and one in Vercel, and between the two writes the callback and the MCP read will both fail
       closed. Do them one secret at a time, Render and Vercel back to back, and expect any round in flight to
       die. The Gemini key is independent and rotates in Google AI Studio. Until this is done, anyone with the
       transcript can trigger analysis, read a round's aggregates and forge a result callback.
13. [x] **Done 2026-07-29: the round no longer meets `429`.** Pacing plus the move to
       `gemini-3.5-flash-lite` closed both axes — proven by the live round in the first Current State entry,
       97 seconds, no `429`, `success`. What follows is the record of how it was diagnosed and decided.
       Decide how to get past the Gemini `429`. **Plan and work order in
       [provider-quota-plan-2026-07-29.md](docs/provider-quota-plan-2026-07-29.md)**, including the options
       considered and deferred. **The limits are now known** — read from AI Studio on
       2026-07-29 for `Gemini 3.5 Flash` on the free tier: **RPM 5** (peak 7), **TPM 250K** (peak 7.51K),
       **RPD 20** (peak 22). A round is roughly 33 calls, so **one round does not fit in a day**, and the
       throttling idea recorded here earlier is wrong: pacing fixes RPM and cannot touch RPD. Tokens are not a
       constraint at all. **The daily cap is now met**: adaptations are batched one request per dimension
       instead of one per catalog entry, so a round costs 8 interpretations + 1 summary + 8 adaptations = **17
       requests against 33 before** (measured on the 5.0 fixture: 8 dimensions, 24 entries). **RPM is still
       unmet** — 17 requests with a concurrency bound of 2 and no pacing still leave far more than five in the
       first minute, so a green round is not yet guaranteed. What remains is a rate limiter, not just the
       concurrency semaphore: paced at 5 RPM a round takes about three and a half minutes, which the background
       webhook already absorbs. **Setting up billing** and moving to Tier 1 remains the alternative that needs
       no further code. Note that limits are per model, but `LLM_MODEL_HEAVY` cannot be used to split the load:
       [`nodes.py`](ai-analytics-service/src/agents/nodes.py) only reaches for the heavy tier when the whole
       node is replayed, so the normal path is entirely `fast`.
       **Step 0 decided by the owner (2026-07-29): stay on the free tier, and move the fast path to
       `gemini-3.5-flash-lite`.** Tier 1 is not being bought. The residual risk the plan recorded — one round
       per day — **is gone with the model rather than with money**: limits are counted per model, and
       lite's free tier is 15 RPM / 1000 RPD against 5 / 20 for `gemini-3.5-flash` (read in AI Studio
       2026-07-29). 17 requests a round against 1000 a day is roughly sixty rounds, and the pace is set to
       `14`, not `15`, because evenly spaced sends four seconds apart put sixteen of them inside some
       sixty-second window. **Steps 1, 2 and 3 are all done**: the pace shipped as
       `794c9b1`, the live round ran clean, and `inspect-ai-provenance` read 8/8 stones as model-written.
14. [x] Log the provider's actual `finish_reason` alongside `reason=invalid_finish_reason` — done 2026-07-29 in
       [`llm_transport.py`](ai-analytics-service/src/services/llm_transport.py). The label collapses truncation,
       a safety block and recitation into one word, and the three want different fixes. The value is sanitized
       through `_safe_log_token` like every other outside value that reaches a log line. A second gap closed on
       the way: an exhausted attempt budget in the `200 OK` branch used to `break` silently, so the finish
       reason of the last attempt — the one that actually decides the dimension — was recorded nowhere; it now
       logs `outcome=no_answer` like every other exhausted path. Fail-first confirmed against the previous code,
       `pytest` 178/178.
15. [x] **A partial map is acceptable, and now exists** (2026-07-30, commit `69e2b42`). The premise the item
       was written on had expired: rounds do succeed now, so this was never about unblocking the free tier in
       the end — it is about resilience. Two days earlier `certainty` and `professional-competence` both
       refused twice; had those been interpretation refusals rather than adaptation ones, the round would
       have failed whole, repeatedly, and the manager would never have seen the other six dimensions.
       Decided with the owner: no threshold — a gap is allowed in any dimension, green or red, and only a
       round where nothing at all was written is a failure — and the round status stays `success`, with the
       gap visible per stone and declared once at the top of the payload. A stone with no interpretation
       keeps its score, metrics and recommendations, all of which are real; only the paragraph is missing,
       and `generationProvenance.outcome: "unavailable"` says so. Contracts up to 4.0 still fail whole.

19. [x] **The published spec stopped two contract versions short, and now cannot again** (2026-07-30). Found
       while checking whether the partial map needed a spec change: it did, but not for the reason expected —
       `docs/openapi.yaml` and `public/openapi.json` never described 4.0 or 5.0 at all, so there was nothing
       for item 15 to extend. A consumer integrating against the published shape was reading a contract three
       versions old while Core accepted five and Render emitted 5.0. Twelve schemas were added and both unions
       extended: `RoundAnalyticsResult` now spans 2.0–5.0 and `StoneMapResult` 1.0–5.0, with the 5.0 stone
       documenting what items 14 and 15 put in it — `outcome: unavailable` beside `llm` and
       `deterministic_fallback`, and `dimensionsWithoutInterpretation` capped at seven entries, because a
       round with no interpretation anywhere is a failure and not a partial map. The fix that outlasts this
       item is the test: it reads the documented versions out of the `StoneMapResult` discriminator and
       compares them against `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` in
       [`ai-contract.ts`](src/lib/ai-contract.ts), then pins each mapped schema's `contractVersion` to the
       version that maps to it. Nothing compared those two lists before, which is how the drift reached two
       versions unnoticed; 6.0 cannot ship undocumented now.

16. [x] **Found out why an adaptation batch is rejected as `invalid_semantic_output`** (2026-07-29, commit
       `6569c4d`). Neither candidate was right, and the two dimensions failed for unrelated reasons — which
       is exactly what one label for every rejection hides. `professional-competence` wrote nine correct
       lines, three summaries with two steps under each, and no `===` anywhere. `certainty` wrote "only one
       respondent in ten" in words, so its summary carried no digit. A third cause appeared once those two
       were fixed: "and the absence of green answers in that item" names a colour with no count beside it,
       and `is_status_consistent` clears a foreign colour only where the sentence carries one of the
       distribution counts in digits. The separator is now a hint — where it fails to cut the answer into
       the expected number of entries, the shape does it, since a step always carries a bullet and a summary
       never does — and the prompt asks for digits and for the count beside any colour it names. Verified
       against the provider on the real refused inputs, then on the deployment: the rerun of 2026-07-30
       07:31:21–07:32:40 UTC produced **24 of 24 recommendations with `adaptationOutcome: llm`**, zero `429`
       and zero fallback lines. `pytest` 203/203 with nine new tests. See item 17 for what remains open.

17. [x] **Decided: refused adaptation copy stays out of the log; its shape goes in** (2026-07-30, commit
       `36d5a1a`). Three reasons, in order of weight. A truncated sample would not have helped — a refused
       batch is nine lines of Hebrew and the defect can be in any of them, so a diagnostic sample means the
       whole answer, and then every bad round writes hundreds of lines into Render. The copy is about one
       school's weakest dimensions, and while that is not respondent identity, the product keeps a boundary
       around it that a log does not; normalising the spill for debugging convenience is not worth it. And
       the reproduction path already exists and works: `why_adaptation_fails.py` rebuilds the exact prompt
       from the database. What cost a day was not the missing text but the missing dimension and gate, and
       those are in the log now. The detail carries `key=value` shape only — which block, blocks and lines
       found against asked for, the code point of a foreign letter, whether the digits landed in the steps
       instead of the summary, and whether a colour read as a count or a verdict. That last pair matters
       because `entry_shape` and `status_inconsistent` each covered two unrelated failures wanting different
       fixes. A test enforces the decision, so reaching for a sample later has to be deliberate.

18. [x] **A non-Hebrew letter could reach the school as long as it was not Latin** (2026-07-30, commit
       `4ace369`). `is_hebrew_only_copy` named the one script it refused and so let every other one through:
       `certainty` wrote `אי وדאות` with an Arabic waw (U+0648) where the vav belongs and it passed twice,
       and a whole sentence in Cyrillic would have passed just as easily, needing only one Hebrew letter
       somewhere in it. The check now refuses any letter outside Hebrew and counts the presentation forms
       (U+FB1D–FB4F) as Hebrew, since a pointed letter written as one character is Hebrew to a reader;
       digits, points and punctuation are not letters and are unaffected. Both halves of the choice were
       taken, and the order matters: `sanitize_model_text` repairs the slip first — word by word, and only
       where the word already carries Hebrew — so the answer becomes correct instead of refused, and a word
       with no Hebrew in it stays untouched for the check to refuse. That keeps the tightening from becoming
       a new way to lose a dimension to catalog copy, which is what items 15 and 16 were about.

20. [x] **The pace was one number and the quotas are per model** (2026-07-30). Not a new discovery — item 13
       recorded it as a known edge and named a per-model queue as the real fix, and `render.yaml` deferred to
       that note beside `LLM_MODEL_HEAVY`. What made it worth closing now is where it lands: `retry_tier`
       switches an *entire node* to the heavy model, so a replayed round sent every problematic dimension to
       `gemini-3.5-flash` back to back at the pace tuned for lite. Measured on the queue at the deployed
       numbers: eight sends 4.29 s apart, all inside 30 s, eight in the worst sixty-second window against a
       limit of five. That is the original `429` relocated into the one path that opens only when the round is
       already in trouble. The queue is now keyed by model name and each tier carries its own rate
       (`LLM_MAX_REQUESTS_PER_MINUTE_HEAVY`, `4` in `render.yaml`), which puts the same eight sends 15 s apart
       and five in the worst window. Keying by name rather than by tier is what makes the alternative free:
       pointing `LLM_MODEL_HEAVY` at the fast model gives one bucket at the stricter pace with no code change.
       The single strict queue was rejected for what it costs the ordinary round — the same seventeen requests
       would take 240 s instead of 68.6 s, to pay for a replay most rounds never make. **Residual risk, and no
       pace fixes it**: the heavy tier allows 20 requests a day, so four replays exhaust it; the service falls
       back, which is the wanted behaviour, but the real fix is for a replay to stop sending a whole node to
       the heavy model at once. **That fix is item 21, done 2026-07-30.**

21. [x] **A replay writes what was rejected, not the round** (2026-07-30). This is the residual risk item 20
       named and could not fix with a pace: `retry_tier` switched the *whole node*, so repairing one refused
       stone rewrote eight interpretations, eight adaptations and the summary — **17 heavy requests against the
       20 a day the heavy tier allows, measured on a graph run and now 1**. Two replays of one bad round
       exhausted the day; the service fell back, which is the wanted behaviour, but it fell back for reasons
       that had nothing to do with the round.
       - The safety validator already knew which dimension it was refusing — the feedback string carried the id
         and nothing read it. It now records the rejection as data: which dimensions' interpretations, which
         dimensions' recommendations, and whether the round summary was among them. The three nodes read that
         plan and skip what is not in it, so an accepted interpretation keeps its text **and its provenance**,
         `attempts` included; a rewritten one starts from the attempt count it had. Interpretation and
         adaptation are targeted separately, because neither reads the other: both are written from the
         aggregates, so a refused rewrite is no reason to write eight interpretations again.
       - **A rejection that names nothing still replays everything.** A narrow replay driven by what the
         validator recorded would otherwise turn a future check that forgets to name its dimension into a loop
         that does nothing three times. The one rejection that cannot be repaired by rewriting — Core's status
         disagreeing with Core's own score — is named too, for the same reason.
       - One regression had to be prevented rather than fixed: the partial map asked whether *this pass* wrote
         anything, which is true of a full round and false of a replay carrying a single dimension. A replayed
         dimension that fails again would have read as a provider that answered nothing and taken the seven
         standing stones down with it. The question is now asked of the whole map.
       - Verification: `pytest` 234/234, six new in
         [`test_replay_targets.py`](ai-analytics-service/tests/test_replay_targets.py); fail-first confirmed —
         five of the six fail against the previous code, and the sixth is the guard that asserts the old
         whole-round replay is still what an untargeted rejection gets. `npm test` 251/251 (the payload shape is
         unchanged, so this is a regression guard, not evidence about the change). `render.yaml` parses,
         `git diff --check` clean. **Not exercised live**, and it cannot be on demand: the heavy tier opens only
         when the safety validator rejects something, which is the same reason item 20 has never run live.
       - Python-only and no contract change, so this deploys in either order — no consumer-first sequencing.
---

## Completed Tasks

- [x] **2026-07-30**: **The repository typechecks itself now — 14 errors had been sitting on a green `main`**:
  - Nothing in the repo ran `tsc`. `npm test` uses `tsx`, which strips types without checking them; `eslint`
    has no type-aware rules; and `next build` typechecks only what the app graph reaches, so `__tests__`
    drifted freely. `npx tsc --noEmit` reported 14 errors on a clean `main`, all in test files.
  - Fixed at the fixtures, not by widening the production types. `contract-3-staging-dryrun.test.ts` handed
    `QuestionAnswerRecord` raw scores like `85` and `88`, outside the `100 | 60 | 0` scale a real answer
    carries; it now rotates over `AnswerValue` and derives the score through `SurveyService.valueToScore`,
    which returns that union. Two `assert.ok` targets got the explicit annotations the narrowing needs
    (TS7022). `openapi.test.ts` dropped a `.ts` extension from a dynamic import. The Prisma mock grew the
    `deleteMany` its own `MinimalPrismaClient` contract requires, backed by the same maps. Two env-swapping
    tests write `NODE_ENV` through a locally cast mutable view, since `next` declares it readonly.
    `types/backend.ts` re-exports `WellbeingDimensionId` beside the `WellbeingStatus` it already re-exported,
    which is what a test importing it from there assumed.
  - **The gate that stops the drift**: `npm run typecheck` (`next typegen && tsc --noEmit`, ~2 s) and a
    matching CI step ahead of the build in `deploy-vercel.yml`. `next typegen` is not optional — the generated
    route types under `.next/types/` are in the tsconfig project, so a bare `tsc` fails on a fresh clone.
    Recorded as the required minimum for any `.ts`/`.tsx` change in `shalomut-verification`.
  - **Verification Evidence**: `npm run typecheck` exit `0` (14 → 0), `npm test` 274/274, `npm run lint`
    clean, `npm run build` 39 routes. Errors reproduced before the fix and each error's file rechecked after.
    CI's new step is **not** exercised — it runs on the next push.

- [x] **2026-07-30**: **One queue per model, because that is the unit the provider counts in** (item 20):
  - `ProviderRateLimiter` keys its bookings by model name instead of holding one `_next_send_at` for the
    process, and `model` is a required keyword on `book`/`wait` — a pace with no name attached is what the
    defect was. `Settings.requests_per_minute_for(model)` answers per name: the fast rate for `LLM_MODEL_FAST`,
    the new `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY` for `LLM_MODEL_HEAVY`, the stricter of the two when one name is
    both, and the strictest positive rate on the key for a name on neither — an unknown quota is not an absent
    one. Zero still means unpaced, and is excluded from the strictest-rate comparison rather than winning it.
  - The heavy default is `5` and deliberately does not inherit the fast setting: inheritance is exactly how the
    defect arose, when the fast pace moved to `14` with lite and the heavy model kept borrowing it.
  - **Verification Evidence**: `pytest` 228/228 (222 before, six new). Fail-first confirmed against the
    previous code — eight of the file's tests failed, the six new ones plus the two whose bare `book()` no
    longer names a model. `npm test` 251/251 and `npm run lint` clean, which is what Core has to say about a
    change that does not touch it. `render.yaml` parses and carries the new key with value `4`.
  - Measured on the queue itself at the deployed numbers, reading the waits `book` returns rather than sleeping
    through them: eight heavy sends went 4.29 s apart, spanning 30 s, eight inside the worst sixty-second
    window against a limit of five; they now go 15 s apart, spanning 105 s, five in the worst window. An
    ordinary round's seventeen fast sends are unchanged at 68.6 s, against the 240 s a single strict
    process-wide queue would have cost them.
  - Not exercised by a deployed round, and it cannot be on demand: the heavy tier is only reached when a safety
    validator rejects a whole node, which no recent live round has done. `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY`
    reaches Render through `render.yaml` on the next deploy.

- [x] **2026-07-30**: **Contracts 4.0 and 5.0 are published shapes now, not just code paths** (item 19):
  - Twelve schemas added to both mirrors: `ScoreDistribution`, `QuestionAggregateV5`, `RoundAnalyticsResultV4`
    and `V5`, `StoneGenerationProvenanceV4` and `V5`, `StoneDetailV4` and `V5`, `StoneMapResultV4` and `V5`,
    `StoneMetricV5`, `StoneInterventionV5`. Both unions and both discriminator mappings were extended, so a
    `oneOf` reader gets 1.0–5.0 for the stone map and 2.0–5.0 for round analytics.
  - The anti-drift test is the point of the item: the documented versions come from the discriminator mapping
    and must deep-equal `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS`, and each mapped schema must pin
    `contractVersion` to the version that reaches it. The synchronized-schema list gained the twelve new names
    so the YAML and JSON mirrors cannot diverge on them either.
  - **Verification Evidence**: `npm test` 251/251 passed. Fail-first confirmed by stashing only the two spec
    files: 249 pass / 2 fail, the new test among them, so it fails for the absence it was written about.
    `npm run lint` clean, `npm run build` compiled 39/39 pages. Structural checks the suite does not do: every
    `$ref` in `public/openapi.json` resolves, with zero dangling refs and zero orphan schemas out of 46, and
    every `required` entry across all 46 schemas exists in that schema's `properties`. `paths` verified
    deep-equal as data before and after the JSON rewrite — the diff showed a `409` moving because JS orders
    integer-like keys ascending on parse, not because a response was dropped.
  - Not visually confirmed in Swagger UI: `/api-docs` sits behind the manager session gate, which needs a
    password I do not enter. The page injects `swagger-ui-dist` from a CDN and fetches `/openapi.json`
    unmodified, so the structural checks above cover what rendering would have caught.

- [x] **2026-07-30**: **One dead dimension no longer discards the seven that answered** (commit `69e2b42`,
  item 15):
  - Most of this was already implemented and left uncommitted in the worktree, written tests first, with the
    Core validator as the missing half. What this commit adds is that half: `unavailable` accepted in the 5.0
    provenance and nowhere below it, the rule that an `unavailable` stone's interpretation must be exactly
    empty while every other outcome's must be Hebrew with 2–5 sentences, and the check that
    `dimensionsWithoutInterpretation` lists precisely the `unavailable` stones. Three Core tests were failing
    without it.
  - The service side: `agent_psychologist_node` keeps the successful dimensions instead of returning on the
    first `ProviderUnavailableError`, the exception carries its attempt count so a gap's provenance reports
    the same numbers a successful stone would, the safety validator judges an unavailable stone on being
    empty rather than on being good Hebrew, and the formatter declares the gaps once — omitting the field
    entirely when the map is whole, so a full round's payload is unchanged by any of this.
  - **Verification Evidence**: `pytest` 222/222 passed, `npm test` 250/250 passed (247/250 with the Core
    validator reverted — the three partial-map tests are what it satisfies), `npm run lint` clean,
    `npm run build` compiled. Cross-boundary check, which neither suite covers: dumped the real
    `final_payload` the Python graph produces for a round failing on `certainty` and `meaning`, then ran it
    through Core's own `validateStoneMapResult` and `applyStoneInsightToDimension` — validation `ok`, and the
    two gapped dimensions arrive with `interpretationUnavailable=true` and zero paragraphs while `balance`
    arrives with its paragraph, all three keeping their metrics.
  - Not yet seen by a deployed round. The rollout is consumer-first and the order matters: Vercel must accept
    a declared gap before Render can emit one, or a partial round's callback fails validation.

- [x] **2026-07-30**: **A refusal now logs its shape, and the refused copy still never leaves the process**
  (commit `36d5a1a`, item 17):
  - The decision and its reasons are in item 17. In short: a sample small enough for a log line diagnoses
    nothing, a sample large enough is the school's own copy in Render, and what actually cost a day was the
    missing dimension and gate rather than the missing text.
  - Each label now carries the fact that picks the next step. `entry_shape` says
    `blocks=2/3 shape_blocks=2 separators=1 lines=6` when the answer split wrong, or `block=1 lines=2/3` when
    the blocks were right and one of them was short — two unrelated failures that shared the label.
    `status_inconsistent` says `colour=red verdict=yes` for a model overruling the score Core owns, or
    `colour=green verdict=no numbers=30` for the uncheckable-but-probably-true case of 2026-07-29, which is a
    prompt problem instead. `no_number` says `digits_in_steps=no`, separating a model that ignored the data
    from one that put it a line lower than the rule wants. `not_hebrew` names the code point.
  - `adaptation_batch_refusal` returns a falsy-when-clean `AdaptationRefusal(label, detail)`, so
    `is_valid_adaptation_batch` still reads as one line.
  - **Verification Evidence**: `pytest` 216/216 passed (was 211). The detail values are asserted exactly, not
    merely for presence, and one test refuses any detail that contains a Hebrew character or a value outside
    counts, indices and code points. Fail-first confirmed against the previous code. Caught a real defect in
    my own change on the way: the first draft used the code-point helper as the `not_hebrew` gate itself,
    which would have admitted a summary of digits with no Hebrew in it at all — the gate is
    `is_hebrew_only_copy` and stays it, with the code points describing only what it saw.
  - The first live reproduction after the change earned the line immediately: `professional-competence` came
    back with a stray `U+091F` (Devanagari) inside otherwise correct Hebrew — a glitch glyph with no Hebrew
    letter it stands for, so refusing rather than repairing is right — named in one token where the old log
    would have said `invalid_semantic_output`. The next run of the same dimension was clean, so this is a
    once-seen glitch that costs a retry, not a systematic confusable for the repair table.

- [x] **2026-07-30**: **The Hebrew-only check refused one script and admitted the rest** (commit `4ace369`,
  item 18):
  - Found while reproducing item 16, not by a test: `certainty` wrote `אי وדאות` with an Arabic waw in place
    of the vav on two separate runs, and `is_hebrew_only_copy` accepted it, because the check was "has Hebrew
    and no `[A-Za-z]`". The reader would have got a broken word inside an otherwise correct paragraph. The
    same hole admitted an entire Cyrillic or Greek sentence carrying one Hebrew letter.
  - The check now asks whether every letter is Hebrew rather than whether any letter is Latin, and treats the
    Hebrew presentation forms as Hebrew — a model may write `שׁ` as one character, and that is the same
    letter to a reader. Nothing that is not a letter is judged.
  - Repair comes before refusal, because a stricter validator is how a dimension loses all three of its
    recommendations to catalog copy. `sanitize_model_text` puts the Hebrew letter back word by word, and only
    where the word already carries Hebrew: a word with no Hebrew in it is another language, not a typo, and
    reaches the check untouched. The confusables table starts at the one letter that was actually observed.
  - **Verification Evidence**: `pytest` 211/211 passed (was 203, eight new tests). Three of them fail on the
    previous validator — the repair, the Arabic word and the Cyrillic word — while the Latin case passes on
    both, which is the regression guard. The catalog is held to the stricter rule by its own test over all
    120 entries' titles, summaries and steps, since `nodes.py` re-runs this check on stored copy including
    the deterministic fallback and a failure there fails a whole round; `source` is excluded because it cites
    institutions in Latin by design and no validator judges it. Re-ran the live reproduction through the
    production prompts and predicate: `meaning`, `certainty` and `professional-competence` still accepted,
    three entries each. Not yet exercised by a deployed round.

- [x] **2026-07-29**: **Six recommendations were lost to a punctuation line and two spelled-out numbers**
  (commit `6569c4d`, item 16):
  - The round of 2026-07-29 rejected the adaptation batches of `certainty` and `professional-competence` and
    logged `invalid_semantic_output` for both. Reproduced by rebuilding the exact prompts those two
    dimensions sent — same aggregates, same catalog entries, same status, pulled from the deployed database —
    and walking the answer through the gates one at a time. The causes were unrelated:
    `professional-competence` returned nine correct lines with no `===` between them, and `certainty` wrote
    "only one respondent in ten" in words, leaving its summary with no digit to check against the map.
  - `parse_adaptation_batch` now falls back to shape when the separators produce the wrong number of entries:
    a step always carries a bullet and a summary never does. An answer opening with a bullet is still
    refused rather than guessed at, since its steps have no summary to belong to.
  - The prompt asks for digits on the line that asks for a number, with examples, and for the count beside
    any colour group it names. The second rule came from a third cause that only surfaced once the first two
    were fixed: "the absence of green answers in that item" is true, useful, and unverifiable —
    `is_status_consistent` clears a foreign colour only where the sentence carries one of the distribution
    counts in digits.
  - `adaptation_batch_refusal` returns one word per cause — `entry_shape`, `not_hebrew`, `no_number`,
    `status_inconsistent` — and the `adaptation=deterministic_fallback` line now carries it along with the
    dimension. One label for four causes is what made this take a day. The refused copy itself still does
    not reach the log; whether it should is item 17.
  - **Verification Evidence**: `pytest` 203/203 passed (was 192, nine new tests, all fail-first on the
    previous code). Against `gemini-3.5-flash-lite` on the real refused inputs, through the production
    prompts and the production acceptance predicate: before the fix `professional-competence` refused with
    `entry_shape` and `certainty` with `status_inconsistent`; after it, `meaning`, `certainty` and
    `professional-competence` were all accepted with three entries each, on two consecutive runs. No
    respondent text left the database — the inputs are aggregates and catalog copy.
  - **Proven by a live round, 2026-07-30 07:31:21–07:32:40 UTC on round `f9c18f1c`** (Render running commit
    `fae2895`, confirmed by `/health`). Seventy-nine seconds from webhook `202` to callback `200`. **24 of 24
    recommendations carry `adaptationOutcome: llm` — not one catalog paragraph left**, against 18 of 24 the
    day before, and all 8 stones are `outcome: llm`. The two dimensions that used to fall back now quote the
    round: `certainty` writes "5 תשובות אדום" and the score 30, and `professional-competence` writes "רק 2
    תשובות ירוקות" and "9 תשובות צהובות" — a foreign colour beside its count in digits, which is exactly what
    the new prompt rule asks for and what `is_status_consistent` can check. The Render log holds 17 accepted
    answers (eight interpretations, one summary, eight adaptations), **one** `outcome=retry`
    (`invalid_semantic_output` on `balance`, which then succeeded on attempt 2), **zero** `429`, and **zero**
    `adaptation=deterministic_fallback` lines. Eighteen requests across 74 seconds is 14.6 a minute against a
    tier that allows 15.

- [x] **2026-07-29**: **Contract `5.0` switched on, proven, and the first live rounds run on the deployment**
  (commits `193cf34`, `5b8f89d`, `1113be7`, `b4afc9c`):
  - Step 3 of E2 closed by the owner: `AI_ANALYTICS_CONTRACT_VERSION` written to Vercel Production and Preview,
    production redeployed as `shalomut-map-demo-1t7fim7ss` holding the alias. Runbook, commands and the two
    corrections it produced are in
    [e2-step3-contract-version-rollout.md](docs/e2-step3-contract-version-rollout.md).
  - Proven twice, since a Sensitive variable can never be read back: `POST /api/mcp/` → `200` with
    `contractVersion: "5.0"`, ten responses, threshold ten, unlocked, eight dimensions, 27 question aggregates
    and `backgroundContext` present — which only crosses the boundary at `4.0`/`5.0` on an unlocked round — and
    `5.0` persisted in the round's own result, so the whole Core → Python → callback → persistence chain
    carried it.
  - Round `f9c18f1c` failed twice with `provider_unavailable`. The Render trace of the second run
    (11:17:14–11:17:56) establishes the cause as `reason=http_429` on three dimensions, with five
    `outcome=llm` lines proving the model itself answers. PR #12's fail-loud behaviour was observed on the
    deployment for the first time.
  - Disproved on the way: the truncation theory for `invalid_finish_reason`. `MAX_TOKENS_PER_DIMENSION` is not
    set in the Render environment, so the `2048` default governs; that check had been open since PR #11.
  - Corrected records: Preview never held the contract variable; the fallback work was already deployed as
    PR #12 rather than local-only.
  - Verification was Markdown-scoped throughout — `git diff --check` and relative-link resolution — since no
    source file changed in this session. Everything else above is deployment evidence, not test evidence.

- [x] **2026-07-28**: **The depth branch is merged, deployed, and the database is empty again**
  (PR [#11](https://github.com/shteynu/shalomut-map-demo/pull/11) → `2be0708`):
  - Squash-merged into `main` at 12:51 UTC with all 36 commits. One merge deployed both halves: Vercel production
    `shalomut-map-demo-2lfgwm6he` `● Ready` in 35s and holding the alias; Render rebuilt the AI service on its
    own, `/health` → `commit: 2be0708`, `env: production`, `privacyThreshold: 10`, versions `1.0`–`5.0`.
  - Read-only smoke after the merge: `/login/` `200`, `/api/rounds/` `401 JSON`,
    `/api/survey/SHALOM-F125/` `404`. The `404` is the point — the owner cleared the database, and empty
    persistence stays empty instead of falling back to a demo round.
  - Database verified empty from a separate read: `0` organizations, `0` rounds, `0` responses, `0` answers,
    `privacy_threshold` default `10`, `prisma migrate status` up to date.
  - Not done, and now the whole of what is left of E2: flip `AI_ANALYTICS_CONTRACT_VERSION` to `5.0` and prove
    `outcome: "llm"` on a live round.
- [x] **2026-07-28**: **One command for the local stack** (commits `9678f4a`, `9d04781`):
  - `npm run local` ([`scripts/local-stack.mjs`](scripts/local-stack.mjs)) starts Next on `:3000` and the Python
    service on `:8000` wired to each other, prefixes their output, passes a provider key through if the
    environment has one, and stops both on Ctrl-C. `--in-memory` runs the core on empty in-process repositories
    and touches no database. Preflight names a busy port or a missing virtualenv instead of failing obscurely.
  - Verified: `/login/` `200` and `/health` `200` from one start; a second start refuses with both busy-port
    messages; `SIGINT` stops Next, uvicorn and the runner.
  - Two local traps found on the way and recorded in the handoff: the producer falls back to contract `3.0`
    when `AI_ANALYTICS_CONTRACT_VERSION` is unset (now set to `5.0` in the gitignored `.env.local`), and
    `SHALOM-F125` is locked at 3 responses so no local run reaches the provider — hence
    [`scripts/local-unlocked-pipeline.ts`](scripts/local-unlocked-pipeline.ts), which builds a 12-response round
    in memory and drives the real Core MCP and the real Python pipeline over it: contract `5.0`, 24 aggregates,
    `status: success`, eight stones, Hebrew summary.
- [x] **2026-07-28**: **The database says ten as well** (commit `2ab601e`, migration
  `20260728120000_privacy_threshold_minimum_ten`):
  - The owner decided the open question in favour of migrating. `prisma/schema.prisma` puts the column default
    back to `10`; the migration raises rounds below ten and the `minimumResponses` their questionnaire snapshot
    quotes. Rounds are only ever raised, so a stricter threshold a manager chose survives.
  - Stale prose that still said "product default 1" corrected in `ROADMAP.md`, `PROJECT_CONTEXT.md`,
    `docs/source-of-truth.md`, `docs/openapi.yaml` and `public/openapi.json`. The OpenAPI schema fields already
    said `10`; only the descriptions disagreed.
  - New guard test: the default declared in `schema.prisma` must equal `MINIMUM_PRIVACY_THRESHOLD`. This drift
    happened once already, quietly, and reads clamp so nothing fails loudly. Fail-first confirmed — the test goes
    red against `@default(1)`.
  - Local gates: `npm test` 232/232, `npm run lint` 0 errors, `npm run build` 39/39 pages, `openapi.test.ts` 5/5,
    `npx prisma validate` and `npx prisma generate` passed, `git diff --check` clean. Python untouched, so pytest
    was not re-run.
  - Applied to the one database after confirming the target in Prisma's own output
    (`aws-1-ap-northeast-2.pooler.supabase.com:5432`, database `postgres`, schema `public`) and recording the
    prior values. `prisma migrate status` then reports up to date. Read-only verification after: default `10`,
    `SHALOM-F125` at `10` in column and snapshot, 3 responses and 3 answers per question unchanged.
    `GET https://shalomut-map-demo.vercel.app/api/survey/SHALOM-F125/` → `200` quoting `minimumResponses: 10`,
    which is the deployed app reading the migrated row.
  - Not done: the branch push (declined at the permission prompt) and the E2 deploy order, which needs the Render
    dashboard and a manager login.
- [x] **2026-07-28**: **Session on branch `feature/ai-insights-depth-v5` — the LLM answers for the first time,
  and the privacy threshold becomes one number** (commits `5f6ad5e`, `e971d33`, `fb85f11`, `3a7d7e7`, `9924c64`,
  `1f2be09`, plus the depth-plan slices `7c50129`…`70276f9`):
  - **Root cause of the eight fallbacks found by live call** — see Current State. `MAX_TOKENS_PER_DIMENSION`
    default raised to `2048`; live run returns `outcome=llm` on the interpretation, the summary and the adaptation.
  - **Validators no longer refuse well-formed Hebrew for its shape**: a period inside a decimal no longer splits a
    sentence, markdown and closing quotes are stripped before validation and the stripped text is what is stored.
    The Latin ban stays — it is what catches an English preamble — but every prompt is Hebrew now, scores print as
    integers and the status reaches the model as a colour-free label. Regression suite
    `ai-analytics-service/tests/test_llm_output_validation.py`.
  - **Privacy threshold 10 everywhere**, including the database column read path, with old rounds raised rather
    than refused.
  - **Distribution shown in the metric blob** (option B of the E3 proposal, owner-approved): counts in the helper
    line, an `aria-hidden` proportional bar repeating them, shown only at ten respondents or more.
  - **Verification**: `npm test` 231/231, `python3 -m pytest` 169/169, `npm run lint` 0 errors,
    `npm run build` 39/39 pages. Live provider call: local, one round's worth of synthetic aggregates, no
    database and no respondent data. Nothing pushed, nothing deployed.

- [x] **2026-07-27**: **Contract 5.0 Rollout (AI Analytics Informativeness)**:
  - Created specification [contracts/ai-analytics-v5.json](file:///Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/contracts/ai-analytics-v5.json) and TS/Python mirrors.
  - Updated Core producer to calculate and send `scoreDistribution` per question aggregate.
  - Updated Python AI service to enrich prompts, generate overall summary via LLM, and relax sentence checks to 2–5 sentences for Contract 5.0.
  - Expanded `interventions_kb.json` to 80 entries and added adaptive ranking in `store.py`.
  - Added dedicated smoke test suite `ai-contract-v5-smoke.test.ts`. All 202 TS tests and 16 Python tests passed. Commits pushed to `origin/main`.

- [x] **2026-07-27**: **Two bugs reported from the deployed app, and the database consolidation**
  (commits `744e7b4`, `af41b38`, `42778ab`, `c6bddae`, `610d951`, `210c213`):
  - **A respondent could answer a round only once per browser, ever.**
    [`survey-flow.tsx`](src/components/survey/survey-flow.tsx) kept the anonymous token in `localStorage` under
    the share code and never cleared it, so the submit endpoint's double-submission guard became a permanent
    device lock: every later attempt got "You have already submitted a response for this survey round."
    The token now belongs to one filling session — [`survey-attempt-token.ts`](src/lib/survey-attempt-token.ts),
    created lazily on submit, held in memory while the flow is mounted. A retry after a failed request is still
    de-duplicated; a new visit is a new response. The public thank-you screen offers an explicit
    "another response" action for a shared computer. Five unit tests plus an API test that persists two attempt
    tokens and rejects a replay of one.
  - **No AI analysis on any stone.** The stone pages already render the interpretation when it exists; the round
    simply had none. Read-only check of the served database: round `3173c065-…` (`SHALOM-F125`) had
    `ai_insights` and `ai_insights_updated_at` both `NULL`, and its single response was submitted
    2026-07-26T17:03:56 — a day before auto-dispatch-on-submit reached production. Nothing re-triggered it since,
    because the only trigger lived on the round screen. The "not created" and error states now offer a generate
    action wired to `POST /api/rounds/{roundId}/trigger-ai`, handling 409 and 504 separately.
    Confirmed later the same day by a read-only check: `SHALOM-F125` now carries 3 responses and a non-null
    `ai_insights`, so both the re-entry fix and the analysis path work end to end on the deployed runtime.
  - **Route loaders.** No segment had a `loading.tsx` while every manager screen renders on the server and reads
    persistence, so a navigation left the previous page frozen. Added
    [`route-loading.tsx`](src/components/layout/route-loading.tsx) and a `loading.tsx` for `/`, `/setup`,
    `/round`, `/survey`, `/dashboard`, the three dashboard sub-pages and `/answer/[shareCode]`.
  - **Missing migration applied to the served database** (explicit user approval). Target confirmed before
    applying: `tpfzhyalaftotljmlont`, `aws-1-ap-northeast-2.pooler.supabase.com:5432`, database `postgres`,
    schema `public`; `prisma migrate status` reported exactly one pending migration. After
    `prisma migrate deploy`, `survey_rounds.privacy_threshold` default went `10` → `1`, round `SHALOM-F125` kept
    its configured threshold `1`, and status reports up to date. DDL only, no row was modified. Rollback:
    `ALTER TABLE "survey_rounds" ALTER COLUMN "privacy_threshold" SET DEFAULT 10;` and delete the row from
    `_prisma_migrations`.
  - **`MANAGER_ORGANIZATION_ID` corrected** (explicit user approval) to `34d05e66-fa4d-4a07-a2af-c9d5c41b6088`
    in Vercel Production as a Sensitive variable, then `vercel redeploy` of the existing production deployment —
    the same `main` source, no local working-tree upload. Deployment
    `shalomut-map-demo-5lx9n5rmn` is Ready and carries the alias. Read-only smoke: `/login/` → 200,
    `/api/rounds/` → 401, `/api/survey/SHALOM-F125/` → 200, and `POST /api/auth/login/` with deliberately wrong
    credentials → `USER_NOT_FOUND` rather than `503 UNCONFIGURED`, which proves the mandatory variables resolve.
    That the value is the right organization can only be proven by a manager login and was not verified.
  - **Gates that were skipping real code.** `npm run lint` reported 37 errors from
    `.claude/worktrees/epic-bassi-a4fe18/.next/**` because the top-level `.next/**` ignore does not cover a
    nested worktree, and `npm test` matched only `*.test.ts`, so the eight component tests in
    `dashboard-semantic-quality.test.tsx` never ran. Both fixed; those eight tests pass.
  - Verified locally: `npm test` 194/194, `npm run lint` 0 errors, `npm run build` 39/39 pages. Local dev server
    on empty in-memory repositories (`DATABASE_URL` empty, no staging write): manager routes `307` to login,
    `/login/` 200, `/answer/NOPE/` 200, zero console and server errors.
  - **One database, and it is the connected one.** Two Supabase projects were reachable from local
    configuration. `tpfzhyalaftotljmlont` (`aws-1-ap-northeast-2`, Seoul) is what the deployed app reads and
    holds every real row; `fvnulyirrqjrnjbahmsn` held one empty organization and zero rounds. Local `.env` and
    `.env.local` pointed at the second one, and [`prisma.config.ts`](prisma.config.ts) reads `.env` through
    `dotenv/config` — that is the mechanism by which a migration with no explicit override reached the database
    the app never serves. `.env` now names the single project and is the only place that defines a database;
    `.env.local` deliberately defines none, because Next.js would let it override `.env` for the app while
    migrations kept reading `.env`. Proven by `npx prisma migrate status` with no override at all: host
    `aws-1-ap-northeast-2.pooler.supabase.com:5432`, "Database schema is up to date!". Previous values were
    kept in gitignored `.env.retired-fvnulyirrqjrnjbahmsn.bak` files. Deleting the retired Supabase project is
    left to the owner.
  - **Vercel Preview organization scope aligned.** Preview still carried `MANAGER_ORGANIZATION_ID=be9f184a-…`
    while `DATABASE_URL` is shared between Preview and Production, so Preview pointed at the one database with
    an organization that does not exist there. Set to `34d05e66-…`; both scopes now match.
  - Open, not addressed: the callback compares a dynamic result against the round only for `3.0`
    ([`ai-insights/route.ts`](src/app/api/rounds/[roundId]/ai-insights/route.ts)), so the `4.0` payload now in
    production skips the questionnaire-hash and Core-score cross-check; and the Python webhook is synchronous
    ([`main.py`](ai-analytics-service/src/main.py)), so a Core timeout at `AI_SERVICE_TIMEOUT_MS=30000` aborts the
    connection and uvicorn cancels the run before any callback is sent.

- [x] **2026-07-27**: **`MANAGER_ORGANIZATION_ID` is mandatory on a deployed runtime**
  ([`manager-auth-service.ts`](src/lib/auth/manager-auth-service.ts)):
  - Deleted the hardcoded fallback `34d05e66-…`, which pointed at an organization removed during an earlier staging
    cleanup. With the variable missing, a manager used to receive a session scoped to a non-existent organization and
    every screen looked empty instead of failing.
  - `resolveManagerOrganizationId()` returns the configured value, `null` on a deployed runtime without it, and
    `"local-dev-organization"` outside a deployed runtime. `isUnconfigured()` now covers it alongside `SESSION_SECRET`
    and `MANAGER_ADMIN_PASSWORD`, so `POST /api/auth/login` answers `503 UNCONFIGURED` even for correct credentials;
    `defaultAccounts()` is fail-closed on the same condition. The production build phase keeps the local fallback.
  - The three demo memberships were module-level constants frozen at import time and are now built per call from the
    resolved organization, which is what makes the variable readable at runtime.
  - Four new tests in [`manager-auth-service.test.ts`](src/lib/auth/__tests__/manager-auth-service.test.ts) cover the
    missing/blank variable (including `VERCEL_ENV=preview`), the trimmed configured value, the local-only fallback
    with a regression guard on the retired UUID, `UNCONFIGURED` when only the organization is missing, and the
    organization a deployed session is scoped to. Confirmed fail-first: the missing-variable case passes login on the
    previous code.
  - Verified locally: `npm test` 180/180, `npm run lint` 0 errors, `npm run build` 39/39 pages. Pushed to `main` as
    `f9b1c50` on 2026-07-27 at the owner's explicit request; Vercel builds every push to `main` automatically.
  - Deployed and smoke-tested: production deployment `shalomut-map-demo-o3os80zm4` is `● Ready` (39s) and carries
    the `shalomut-map-demo.vercel.app` alias. `GET /login/` → 200, `GET /api/rounds/` → 401 JSON, and
    `POST /api/auth/login/` with a deliberately wrong password → `401 INVALID_CREDENTIALS` — not
    `503 UNCONFIGURED`, which proves all three mandatory variables are present in the deployed environment.
  - Residual risk: sessions issued before this change stay valid up to 24h with the stale organization; the gate
    covers new logins only.

- [x] **2026-07-27**: **Deployment, migrations and the contract 4.0 rollout** (explicit user approval):
  - Pushed `9e15732` to `main`; Vercel built production deployment `dpl_EerCv593tZyLTE9kU2SVTAxY4eKX` (Ready, aliased).
  - `npx prisma migrate deploy` on the staging Supabase DB applied the two pending migrations. The DB was missing
    `survey_rounds.background_context` and `survey_rounds.survey_definition` entirely, so the deployed app could not
    save a round. At migration time: 1 organization, 0 rounds, 0 responses. Verified afterwards: both columns present,
    `privacy_threshold` default `1`, both rows in `_prisma_migrations`.
  - Fixed three defects found while preparing the 4.0 flip (`1f76622`): the dynamic parser ignored `4.0`, it rejected
    `privacyThreshold` below 10 (breaking contract 3.0 in production, since Core's default is now 1), and it dropped
    `backgroundContext`. Added Python tests 15 and 16, which fail on the previous code.
  - Added the running commit and accepted contract versions to the Python `/health` (`82c17f2`) so a consumer-first
    rollout can be proven from outside. Render redeployed and answered
    `{"commit":"82c17f2","supportedContractVersions":["1.0","2.0","3.0","4.0"]}`; only then was
    `AI_ANALYTICS_CONTRACT_VERSION=4.0` set in Vercel and the app redeployed.
  - Vercel env cleanup and `MANAGER_ORGANIZATION_ID` correction; six stale origin branches deleted with their tips
    recorded in `docs/shalomut-tracker-handoff.md`.

- [x] **2026-07-26 (evening)**: **Completion plan `docs/completion-plan-2026-07-26-evening.md` executed**:
  - **A1 — auto-trigger survives the response**: `POST /api/survey/[shareCode]/submit` schedules the dispatch with
    `after()` from `next/server` instead of a detached promise (with a try/catch fallback for non-request contexts).
  - **A2 — privacy threshold default 1 everywhere**: `DEFAULT_PRIVACY_THRESHOLD = 1`, `MINIMUM_PRIVACY_THRESHOLD = 1`,
    `prisma/schema.prisma` `@default(1)` plus an unapplied migration. Both manager screens warn explicitly below 5
    (`LOW_PRIVACY_THRESHOLD_WARNING`), because such an average describes individual respondents.
  - **A3 — one run per round + manual rerun**: `claimAiAnalysisRun` / `releaseAiAnalysisClaim` (a 2-minute lease on
    `aiInsightsUpdatedAt`, implemented as a conditional `updateMany`) make concurrent submissions dispatch a single
    webhook; `POST /api/rounds/{roundId}/trigger-ai` answers `409 already_running` while a run is in flight, and
    `/round` got an explicit `רענון ניתוח` button.
  - **B1/B4 — builder**: question cards freeze after the first response (all actions disabled, ids/texts read-only,
    Hebrew freeze notice); a new round starts as an empty draft and is promoted to `active` on save once the
    questionnaire covers all eight dimensions.
  - **B2/B3 — dialog**: full Tab/Shift+Tab focus trap, Escape close, focus restore to the trigger, backdrop close, and
    design-system markup (`question-dialog-*`).
  - **C1 — contract 4.0 consumer-first**: `AI_ANALYTICS_CONTRACT_VERSION` selects the produced version (`3.0` default);
    the school `backgroundContext` reaches the MCP payload and the Python prompt only on `4.0` and never for a locked
    round.
  - **C2/C3/C4**: audience is owned by `/setup` and mirrored read-only into the questionnaire (`src/lib/audience.ts`);
    round reset records a `ROUND_RESET` audit event and clears the persisted analysis; the dead HTTP Basic Auth code
    was deleted and the OpenAPI spec now documents `managerSession` instead of `basicAuth`.
  - **Regression found and fixed during the browser smoke**: with the new empty-draft rounds every manager screen
    crashed (`Invalid round survey definition: Enabled survey questions must cover all eight dimensions`), because
    `AnalyticsService.calculateDynamicRoundAnalytics` parsed strictly. An unfinished questionnaire now returns a
    locked result instead of throwing (two new tests).
  - **Verification (local)**: `npm test` 175/175, `npm run lint` 0 errors, `npm run build` 39/39 pages,
    `python3 ai-analytics-service/run_tests.py` 14/14, `openapi.test.ts` 5/5, plus a browser smoke on a dev server with
    in-memory repositories: empty draft builder → template load → save auto-activates the round → respondent submission
    dispatched exactly one `round_closed` webhook to a local listener (`after()` proven in a real runtime) → two further
    submissions and a manual rerun click produced **no** second webhook and a `409 already_running` note → freeze state,
    dialog focus trap (Tab wraps, Shift+Tab wraps back, Escape restores focus) → reset logged
    `{"audit":"ROUND_RESET",...,"deletedResponseCount":3}` and disabled the refresh button below the threshold.
  - **Not done (owner gates)**: nothing committed, pushed, deployed or migrated; `AI_ANALYTICS_CONTRACT_VERSION` still
    `3.0`.
  - **Follow-up on explicit user instruction**: the threshold `1` was afterwards propagated to *every* layer,
    including the Python fallbacks (`src/config.py` now reads `PRIVACY_THRESHOLD`, default `1`;
    `src/schemas/mcp_types.py`), `surveyInstrument.privacyThresholdDefault`, demo data, `PrivacyTooltip` and the
    OpenAPI / PROJECT_CONTEXT / ROADMAP descriptions. Accepted consequence: a payload without `privacyThreshold`
    no longer locks at 10 by default.

- [x] **2026-07-26**: **Global Privacy Threshold Floor 1 & Automatic AI Analytics Triggering**:
  - Set default & minimum allowed `privacyThreshold` to `1` across Core, setup forms, survey definitions, Python service docstrings, and `.agents/skills/shalomut-map/SKILL.md`.
  - Implemented automatic non-blocking AI analytics trigger in `POST /api/survey/[shareCode]/submit`: when survey response submission causes response count to reach or exceed `privacyThreshold` (for threshold = 1, on the 1st response), AI generation is automatically dispatched.
  - Added reusable server utility `src/lib/server/trigger-ai-analytics.ts` and automated integration test `submit-auto-trigger.test.ts`.
  - Full verification: `npm test` 169/169 passed, `python3 ai-analytics-service/run_tests.py` 13/13 passed.

- [x] **2026-07-26**: **Privacy Threshold Floor Lowered to 1**:
  - Lowered minimum allowed privacy threshold (`minimumResponses` / `privacyThreshold`) from 10 to 1 across `survey-definition.ts`, manager setup API (`route.ts`), `SetupForm`, `SurveyBuilderSettings`, and `survey-definition.test.ts`.
  - Full verification executed: `npm test` 168/168 passed, `npm run lint` 0 errors, `npm run build` 39/39 pages compiled.

- [x] **2026-07-26**: **Session Close — P0 Deployment Recovery & Basic Auth Sunset**:
  - **P0 Lazy Session Provider**: `JwtSessionProvider` instantiated lazily in `session-auth.ts` and `login/route.ts` so module loading never throws when manager secrets are absent. Respondent and machine routes operate without manager secrets.
  - **Vercel Secrets & Redeploy**: Configured `SESSION_SECRET` and `MANAGER_ADMIN_PASSWORD` in Vercel for Production & Preview. Deployed build `334db68` -> **Ready**. Tested live `GET /login/` (`200 OK`).
  - **HTTP Basic Auth Popup Sunset**: Completely removed `WWW-Authenticate: Basic ...` popup challenge header from `middleware.ts`. Set `DISABLE_BASIC_AUTH_FALLBACK="true"` in Vercel. Unauthenticated manager UI requests redirect to `/login` (307); API routes return 401 JSON. Removed dev credentials hint footer from `/login`.
  - **Builder Freeze & Draft Persistence**: Wired `isFrozen` in `SurveyBuilder` & `page.tsx`. Added `allowIncomplete: true` option in `parseSurveyDefinition` and `isSaveable` in `BuilderQuestionnaireValidation` to allow saving draft questionnaires before all 8 dimensions are populated.
  - **Dialog Focus & Accessibility**: Auto-focus on `textarea` and focus return on close in `QuestionEditDialog`.
  - **Full Verification**: `npm test` (168/168), `npm run lint` (0 errors), `npm run build` (39/39 pages), `python3 ai-analytics-service/run_tests.py` (13/13), live HTTP probes on `/login/` (200) and `/setup/` (307).

- [x] **2026-07-26**: **Consolidated to a single deployed environment** (explicit user approval): alias `shalomut-map-demo-ui-redesign.vercel.app` removed via `vercel alias rm` (URL now `404`; its preview deployment `dpl_FystEnZZ5rNPbJevXcNrfQmn83in` was not deleted and stays `READY`). The only product URL is `https://shalomut-map-demo.vercel.app/`, serving as staging for now; a separate production environment will be created later. `docs/openapi.yaml`, `public/openapi.json` and the environments section of `PROJECT_CONTEXT.md` updated accordingly. Verified with `openapi.test.ts` 5/5 and `vercel alias ls`.

- [x] **2026-07-26**: **UI Loading Indicators Added**: Added animated `Loader2` spinners and disabled states across all screens where backend API calls occur upon clicking buttons or forms (`/login`, `ManagerUserBar`, `RoundControls`, `SetupForm`, `SurveyBuilder`, `SurveyFlow`). Executed `npm test` (168/168 passed), `npm run lint` (0 errors), and `npm run build` (39/39 pages compiled).

- [x] **2026-07-26**: **6 Sequential Quality & Security Blocks Completed (P0 Auth, Lint/Build, AI Contract 4.0, UX & OpenAPI)**:
  - **P0 Auth Hardening**: `ManagerAuthenticationService` uses SHA-256 password hashing. Default `manager123` fallback account prohibited in deployed runtime. Returns HTTP status `503` (UNCONFIGURED) if mandatory secrets `SESSION_SECRET` or `MANAGER_ADMIN_PASSWORD` are absent in deployed runtime.
  - **Lint & Build Recovery**: Added `deleteMany` to `MinimalPrismaClient` contract. Removed synchronous `setState` in `useEffect` in `QuestionEditDialog`. `npm run lint` and `npm run build` pass with 0 errors.
  - **AI Context & Contract 4.0**: Added `contracts/ai-analytics-v4.json`. Passed school `backgroundContext` via Python parser, workflow, and `llm_provider`. Fixed `NameError` in `llm_provider.py`. Added `backgroundContextIncluded` flag in `generationProvenance`. Added unit tests in `ai-contract-v4.test.ts`.
  - **Product UX & Builder Improvements**: Setup form CTA redirects to `/survey/`. Survey builder numbers active (enabled) questions sequentially; hidden questions displayed without number (`-`). Implemented empty draft, clear questionnaire, load template, delete confirmation, and freeze state when responses exist. `QuestionEditDialog` updated with Esc key close, inline validation, and respondent preview.
  - **API & OpenAPI Sync**: Added `POST /api/rounds/{roundId}/reset` endpoint to `docs/openapi.yaml` and `public/openapi.json`. Synchronized `openapi.test.ts` integration tests.
  - **Full Verification**: Executed `npm test` (166/166), `npm run lint`, `npm run build`, `python3 ai-analytics-service/run_tests.py` (13/13), `openapi.test.ts` (5/5).

- [x] **2026-07-26**: **GitHub Pages retired, Vercel established as single web deploy target**:
  - `DELETE /repos/shteynu/shalomut-map-demo/pages` -> `204`, `has_pages: false`.

- [x] **2026-07-26**: **Manager UI auth & Basic Auth sunset preparation**:
  - Auth API routes `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - `/login` page and `ManagerUserBar`.
