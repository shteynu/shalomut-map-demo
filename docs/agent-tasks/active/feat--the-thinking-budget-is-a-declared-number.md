# The thinking budget is a declared number

## Metadata

- Branch: `feat/the-thinking-budget-is-a-declared-number`
- Base branch: `origin/main`
- Base commit: `dab5ef6`
- Current HEAD: see `git log -1` (commits listed under Completed)
- Status: implementation complete, measurement blocked on provider credit
- Last updated: 2026-08-19
- Last agent/tool: Claude Code (Opus 5)

## Objective

Let the deployment say how much of an answer's token budget the model may spend
on thinking, and measure what that costs on one round.

## User-visible outcome

None directly. The manager's map is unchanged while `LLM_REASONING_EFFORT` is
unset, which is the default. What changes is who decides the largest line on the
provider bill.

## Context

The owner asked why a $50 prepaid Gemini balance was spent so quickly. Reading
the code answered it structurally: thinking tokens bill at the output rate ($9
per million on `gemini-3.5-flash` against $1.50 for input), the interpretation
measured on 2026-07-28 spent 1440 of them against 108 visible ones, and the
request this service sends carried `max_tokens` and `temperature` and nothing
about reasoning. So the biggest half of every bill was the provider's default.

The strategy sweep of 2026-08-10 put "do not optimize LLM cost" in its do-not-do
list and asked only for logging. This task is the owner's explicit instruction of
2026-08-19 and supersedes that item for this one knob; the logging half of it is
extended rather than replaced.

## Scope

- `LLM_REASONING_EFFORT` in the AI service config, validated and forwarded.
- `reasoning_tokens` on the existing usage log line.
- Make a local pipeline run able to show what it cost at all.
- Measure one round before and after, and set the deployed value from it.

## Non-goals

- Aggregation, alerting or any budget feature in the transport. The usage line
  stays one line per billed answer.
- Changing `MAX_TOKENS_PER_DIMENSION`. It answers a different question and its
  measured value of `8192` stands.
- Touching the pace, the model, or `render.yaml`, which gets a value only once
  there is a measurement behind it.

## Acceptance criteria

- Unset variable sends the request the service sent before it existed.
- A configured value reaches the provider verbatim.
- An unsupported value is refused rather than forwarded, and is named in
  `runtime_configuration_errors()`.
- The usage line carries the thinking share of every completion.
- A local run over one round reports its own token totals.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker`, `.agents/skills/shalomut-map`,
`.agents/skills/shalomut-verification` (row: `ai-analytics-service` → full
`pytest`).

## Relevant architecture and contracts

No contract surface is touched. `contracts/` and the versioned manifests are
untouched; the change is confined to the provider transport, its configuration
and its logging.

## Decisions made

- Unset means the field is omitted, not sent empty. A provider that never heard
  of `reasoning_effort` must see the old bytes, and one that has must not be told
  "no effort" by a variable nobody set.
- An unrecognised value fails closed on this side: not forwarded, recorded as a
  configuration error. Forwarded, a typo is a `400` on all ~28 calls of a round —
  every dimension on the deterministic sentence, and a run that reports success.
- `reasoning_tokens` is logged as the split of `completion_tokens`, never added
  to a total. Adding it would double-count what the provider already billed once.
- `render.yaml` is deliberately not touched. That file's own rule is that a
  number is declared beside the evidence for it, and there is no measurement yet.

## Assumptions

- The deployed `GEMINI_API_KEY` is the same key as the local one. Both are
  outside this repository; the local one was probed directly and is depleted.

## Completed

- `ai-analytics-service/src/config.py`: `SUPPORTED_REASONING_EFFORTS`,
  `llm_reasoning_effort`, `llm_reasoning_effort_configuration_error`, surfaced
  through `runtime_configuration_errors()`.
- `ai-analytics-service/src/services/llm_transport.py`: the field travels only
  when configured; `_reasoning_count` reads
  `usage.completion_tokens_details.reasoning_tokens`, and the usage line names
  it.
- `ai-analytics-service/src/pipeline_cli.py`: configures logging on stderr. It
  never did, so every INFO line the service writes — including the usage line —
  was dropped for local runs, and stdout stays the payload its caller parses.
- `scripts/local-unlocked-pipeline.ts`: the child's stderr is inherited instead
  of captured and discarded on success.
- Tests: `ai-analytics-service/tests/test_reasoning_effort.py` (new), plus the
  thinking-share cases in `tests/test_token_usage_logging.py`.
- `ai-analytics-service/README.md`: the knob and the usage line's fields.

## In progress

Nothing.

## Remaining

- Run the before/after measurement once the account has credit again (commands
  under Blocked).
- From that measurement, set `LLM_REASONING_EFFORT` in `render.yaml` beside the
  numbers, in the style of the pace and the token cap already there.

## Changed files

- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/src/pipeline_cli.py`
- `ai-analytics-service/README.md`
- `ai-analytics-service/tests/test_reasoning_effort.py` (new)
- `ai-analytics-service/tests/test_token_usage_logging.py`
- `ai-analytics-service/tests/test_llm_provider.py` (env cleanup only)
- `scripts/local-unlocked-pipeline.ts`
- `docs/shalomut-tracker-handoff.md`
- this file

## Verification evidence

### Passed

- `ai-analytics-service/.venv/bin/python -m pytest -q` → 548 passed, run with
  `GEMINI_API_KEY` and `LLM_REASONING_EFFORT` stripped from the environment.
- `npm run typecheck` → clean. `npm run lint` → clean.
- Local pipeline without a provider key: the run reaches the model boundary and
  reports `missing_api_key`, which proves the stderr plumbing without spending
  anything.
- One direct request to `generativelanguage.googleapis.com` with the local key,
  to read the error body behind the `429`s.

### Failed

- The first full local run with the key: every call answered `429`. Not a defect
  in this branch — see Blocked.

### Blocked or not run

- **The measurement itself.** The provider answers
  `429 RESOURCE_EXHAUSTED — "Your prepayment credits are depleted"`, so no round
  can reach the model on this key. Both runs are ready and take one command each
  from `ai-analytics-service`, with `GEMINI_API_KEY` exported:
  `npx tsx scripts/local-unlocked-pipeline.ts` with `LLM_REASONING_EFFORT`
  unset, then again with `LLM_REASONING_EFFORT=low`. Read `reasoning_tokens` and
  `completion_tokens` off the `outcome=usage` lines, and read the provenance of
  the eight stones out of the same output — a cheaper round that stops passing
  the Hebrew gate is not a cheaper round.
- No deployed verification. The Render service runs the same depleted key.

### Environment

Local only. No database was read or written. The one deployed read was the
provider probe above, which created nothing.

### Residual risk

- An effort too low fails the way a cap too small does: no usable answer, stones
  on `deterministic_fallback`, and a run that still reports success. This is why
  the deployed value waits on the measurement rather than on the reasoning.
- `reasoning_effort` is sent to whatever provider is configured. Only Gemini and
  OpenRouter are in use; a non-reasoning model would answer `400`, which is why
  the variable is opt-in and unset by default.

## Failed approaches

- Loading the whole `.env` into the local run: it sets `MCP_SHARED_SECRET`,
  which takes the in-process MCP handler out of development mode, and the run
  died on `MCP returned 401`. Only the LLM variables are needed.

## Known risks

Recorded under Residual risk.

## Approval gates

None consumed. No credential, alias or deployment configuration was changed.
Topping up the provider account is the owner's action.

## Questions requiring an owner decision

- Should local development keep using the same key as the deployment? Every
  local pipeline run and every eval-corpus run is billed to the deployment's
  balance, which is part of how the first $50 went.

## Next concrete step

Once the Gemini account has credit, run the two commands under
`Verification evidence → Blocked`, record both totals and the eight stones'
provenance in this file, and then declare `LLM_REASONING_EFFORT` in
`render.yaml` with those numbers beside it.
