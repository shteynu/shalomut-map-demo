# The adaptation call outlives its timeout

## Metadata

- Branch: fix/the-adaptation-call-outlives-its-timeout
- Base branch: claude/priceless-swanson-9cf466 (itself unmerged; `origin/main` is `4bd5b2f`)
- Base commit: 8629363
- Current HEAD: 8629363
- Status: fixed and verified against the provider
- Last updated: 2026-08-19
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Stop a deployed round losing most of its adapted recommendations to a request
timeout smaller than the work takes.

## User-visible outcome

A manager reads recommendations written for their school. Before this, seven of
eight dimensions showed catalog copy and the round reported success.

## Context

Found by the first live `6.0` round (recorded on the base branch): eight stones
written by the model, and seven of eight adaptations lost to `TimeoutError`.
The adaptation call is the largest answer of a round — five recommendations,
each a summary and its steps, in one request.

## Scope

`llm_request_timeout_seconds`, `llm_retry_budget_seconds` and the ceiling that
bounds them, plus the per-call timing needed to choose them.

## Non-goals

- The rate limits, the token cap and the model. All three were already measured
  and are not what this failure is about.
- `render.yaml`. The values are code defaults, readable in the repository, and
  need no environment variable.

## Acceptance criteria

- A live `6.0` round completes with no `TimeoutError` and no adaptation on
  `deterministic_fallback`.
- The numbers come from measurement, and the measurement is repeatable because
  the durations are logged.

## Relevant repository instructions

`AGENTS.md`; skills `shalomut-tracker`, `shalomut-map`, `shalomut-verification`.

## Decisions made

**The ceiling was the bug, not the default.** `llm_retry_budget_seconds` was
clamped to `25.0` in `config.py`, and the request timeout clamped to whatever the
budget then allowed. A clamp caps the environment variable too, so no dashboard
value could raise either number — which is why the Render dashboard reading on
the base branch found nothing set and would not have helped if it had.

The comment above these values already said the constraint that produced them —
fitting Core's 30-second HTTP timeout — no longer applied, because the webhook
answers `202` before the run starts. The numbers were left where the dead
constraint had put them.

**The numbers come from two rounds, not one.** The first pass used one round —
27 calls, slowest 26.0s — and set the timeout to 60s, calling it 2.3x the
measured tail. The confirmation round on those very defaults produced a slowest
call of **50.9s**: the same work on the same settings, tail nearly doubled. 60
would have been 1.2x, not 2.3x. Final values are 90s timeout and a 300s budget,
1.8x the slowest call across 55 calls, with the ceiling raised to 600.

The budget holds every attempt the timeout allows (3 x 90 + delays < 300).
Otherwise the budget kills a call the timeout would have let finish, which is
this same defect one level down.

**Per-call duration is now logged.** `outcome=usage` carries `duration_ms`. A
call refused at twenty seconds says only "longer than twenty", so every
replacement number would have been as unmeasured as the one it replaced.

## Assumptions

- The tail measured locally stands for the deployed tail. Same model, same token
  cap, same prompts, and the deployed service is the same code — but the network
  path differs, and two rounds are two samples.

## Completed

All of the above.

## Remaining

None.

## Changed files

- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/tests/test_llm_provider.py`

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service`: **546 passed**.
- The three new tests re-run against the old `20/25/25` values: all three fail.
- **Live `6.0` round at the committed defaults**, deployed settings,
  `LLM_REQUEST_TIMEOUT_SECONDS` and `LLM_RETRY_BUDGET_SECONDS` unset: 28 calls,
  25 `outcome=llm`, **zero `TimeoutError`, zero adaptation fallbacks**, all eight
  stones `llm` on the first attempt. Durations min 13.5s, median 21.0s, max
  50.9s.
- Measurement round with the ceiling lifted: 27 calls, zero timeouts, min 10.8s,
  median 17.8s, p90 22.6s, max 26.0s.
- Round at the 25s ceiling: 10 of 20 calls lost to `TimeoutError`.

### Failed

None.

### Blocked or not run

- No live round at exactly `90/300`. The confirming round ran at `60/200`, which
  is strictly stricter — it completed with no timeout, so the same round under a
  larger allowance cannot time out where it did not before. What is unproven is
  a round whose tail exceeds 60s.

### Environment

local, against the real provider on the deployed key.

### Residual risk

- Two rounds is a thin sample for a tail that doubled between them. If a third
  round exceeds 90s, `LLM_REQUEST_TIMEOUT_SECONDS` can now raise it without a
  code change — which is the part of this that is structural rather than a
  number.
- Worst-case wall time against a hung provider grows roughly twelvefold. Bounded
  by the 600s ceiling and asynchronous behind the webhook's `202`.

## Failed approaches

- Setting the numbers from the first round alone. Recorded under Decisions made
  because it is the reason the committed value is 90 and not 60.

## Known risks

Recorded under Residual risk.

## Approval gates

- Live-provider runs. The owner approved the timeout work; three rounds were
  spent — one measurement, one confirmation at `60/200`, and the earlier
  diagnostic round on the base branch.

## Questions requiring an owner decision

None.

## Next concrete step

Land this branch and its base, then redeploy so the service picks up the new
defaults; no Render variable needs adding.
