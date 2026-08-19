# The thinking budget is a declared number

## Metadata

- Branch: `feat/the-thinking-budget-is-a-declared-number`
- Base branch: `origin/main`
- Base commit: `dab5ef6`
- Current HEAD: see `git log -1` (commits listed under Completed)
- Status: implementation and measurement complete; deployed value declared
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
- `render.yaml`: `LLM_REASONING_EFFORT=low`, with the measurement beside it.

## In progress

Nothing.

## Remaining

- Run `evals/run_corpus.py` against `low` before trusting it on a harder round.
  One fixture is not the corpus, and the corpus is this project's instrument for
  exactly this question — it is what rejected `flash-lite` on 2026-08-09.
- Decide the adaptation defect below. It is not this branch's work, but it is
  where roughly half of a round's calls go.

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
- **The measurement.** One round — the local unlocked fixture, `gemini-3.5-flash`
  at the deployed settings — run three times on 2026-08-19 after the top-up:

  | | billed answers | thinking | visible | cost | map |
  | --- | --- | --- | --- | --- | --- |
  | unset | 19 | 58,885 (89% of output) | 6,928 | $0.6226 | 8/8 `llm`, first attempt |
  | `medium` | 19 | 59,845 (90%) | 6,814 | $0.6301 | 8/8 `llm`, first attempt |
  | `low` | 31 | 24,742 (68%) | 11,677 | $0.3817 | 8/8 `llm`, first attempt |

  Three things this says. Unset *is* `medium`, within 2% on every count, so the
  knob only does something below it. `low` costs 39% less while returning the
  same map, and the saving is a floor: the unset run lost four answers to the
  20-second client timeout, which this service cannot see the bill for and `low`
  did not incur. And `low` sends more requests, not fewer — 31 against 19 —
  because the adaptation retries that used to time out now actually complete.

  Thinking is not itemised by this provider. `reasoning_tokens` reads
  `unavailable` on every line, and the figures above are
  `total_tokens - prompt_tokens - completion_tokens`.

### Failed

- The first full local run of 2026-08-19, before the account was topped up:
  every call answered `429 RESOURCE_EXHAUSTED`. Not a defect in this branch.

### Blocked or not run

- `evals/run_corpus.py` against `low`. Not run: it is seven cases rather than
  one and spends accordingly, and the owner has not been asked.
- `minimal` and `none` were not measured. `low` already returned the whole map,
  so the cheaper settings were not worth the risk of a round nobody would trust.
- No deployed verification. `render.yaml` now declares `low`, and nothing has
  been pushed or redeployed.

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

Recorded under Residual risk, plus one found by the measurement and belonging to
no branch yet:

**The question-adaptation step failed on every dimension of every run.** All
three runs ended with `adaptation=deterministic_fallback` for all eight
dimensions, refused as `refusal=status_inconsistent` — the model's adapted
wording disagreed with the dimension's own colour and counts — after two or
three attempts each. It is independent of `LLM_REASONING_EFFORT`: identical at
unset, `low` and `medium`. In the `low` run that is 14 of 31 billed answers,
close to half the round's bill, spent on text that is then thrown away for the
deterministic sentence. The stones themselves are unaffected and the round
reports `success`, which is why it has gone unnoticed. Worth its own task.

## Approval gates

None consumed. No credential, alias or deployment configuration was changed.
Topping up the provider account is the owner's action.

## Questions requiring an owner decision

- Should local development keep using the same key as the deployment? Every
  local pipeline run and every eval-corpus run is billed to the deployment's
  balance, which is part of how the first ₪50 went — ₪21 of it on 2026-08-11
  alone, the day of the deployed walks.
- **Answered 2026-08-19: a free tier does not replace this key.** Read from AI
  Studio, the free tier allows 20 requests a day on `gemini-3.5-flash` against
  the ~28 one round needs, and 500 a day on `gemini-3.5-flash-lite`, whose
  Hebrew this project rejected on 2026-08-09. The full numbers are in
  `docs/shalomut-tracker-handoff.md`. So the measurement below waits on credit
  rather than on a cheaper account.

## Next concrete step

Push the branch, then run `evals/run_corpus.py` with `LLM_REASONING_EFFORT=low`
and compare its graders against
`evals/baselines/2026-08-05-gemini-3.5-flash-lite.json`. If refusals appear,
move `render.yaml` back to unset; the value is one line and the reasoning for
moving it is already beside it.
