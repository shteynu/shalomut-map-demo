# One line says what a round costs

## Metadata

- Branch: feat/one-line-says-what-a-round-costs
- Base branch: feat/the-monitor-can-see-a-half-written-map (which is based on `d47a59c`)
- Base commit: `f360d17`
- Current HEAD: `ec847ba`, contained in `origin/main` at `a39ca09`
- Status: landed and deployed. Archived on 2026-08-18
- Last updated: 2026-08-18
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the LLM-cost question permanently, in the shape
`docs/product-strategy-axes-2026-08-10.md` asks for it: its "Do not do" section
estimates $0.31–$1.91 per round, refuses optimization as not worth anyone's
time, and asks for one thing — enough logging that the estimate can be replaced
by a measurement. The provider was answering with its own accounting on every
call and the transport was discarding it, so the estimate had no path to ever
becoming a number.

## User-visible outcome

None. One log line per billed provider answer.

## Context

`_complete_with_retries` parses each 200 response for `choices[0]`, and the
`usage` block beside it was never read. The only token-shaped thing in the
module was `max_tokens` on the way out.

## Scope

- `ai-analytics-service/src/services/llm_transport.py` — the line and two
  helpers.
- `ai-analytics-service/tests/test_token_usage_logging.py` — new.
- `ai-analytics-service/README.md` — how to answer the cost question from it.
- `PROGRESS.md`, this file.

## Non-goals

- No aggregation, no per-round total, no metric, no alert, no budget feature.
  The sweep asks for a measurement and explicitly refuses the optimization work
  that would follow from treating it as a signal.

## Acceptance criteria

- Every billed answer writes one line, refused candidates included.
- A provider that omits or mis-shapes `usage` costs a log field, never the
  answer already in hand.
- Nothing is coerced or defaulted to zero.

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- No contract, no schema, no endpoint. Log output only.

## Decisions made

- **Per HTTP 200, not per conversation.** A 200 is the unit the provider bills.
  This service retries with a critique by design, so a conversation that refused
  two answers and accepted the third was charged for three; a total reported
  from the accepted answer would undercount by exactly the part of the bill the
  question is about.
- **At the parse site, not at the exits.** One place, seen by every billed
  answer, and it cannot be forgotten by a future exit — the same reasoning
  `complete_with_retries` uses for wrapping rather than recording beside each
  return.
- **`unavailable` rather than `0`.** A zero is summable, and summing what the
  provider never sent is how a cost figure becomes confidently wrong. `True` is
  an `int` in Python and is refused for the same reason.
- **The helper never raises.** The answer is already parsed when the line is
  written; losing it to bookkeeping would be an absurd failure.

## Assumptions

- The provider speaks the OpenAI-compatible `usage` shape
  (`prompt_tokens` / `completion_tokens` / `total_tokens`). If it stops, the
  line says `unavailable` and nothing else changes — which is the reason the
  field is defensive rather than trusted.

## Completed

- The line, `_log_usage` and `_usage_count` in `llm_transport.py`.
- Seven tests in `tests/test_token_usage_logging.py`.
- `README.md` — a `What a round costs` subsection under Endpoints.
- `PROGRESS.md`.

## In progress

- Nothing.

## Remaining

- Nothing an agent can do. Reading a real round's lines needs a deployed round.

## Changed files

- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/tests/test_token_usage_logging.py`
- `ai-analytics-service/README.md`
- `PROGRESS.md`
- this file

## Verification evidence

### Passed

- `.venv/bin/python -m pytest tests/test_token_usage_logging.py` — 7 passed,
  0.02s.
- `.venv/bin/python -m pytest` from `ai-analytics-service` — **513 passed**,
  17.59s. The full suite the verification matrix requires for this directory,
  and the count moved by exactly the seven added here.

### Failed

- None.

### Blocked or not run

- Reading the line from a real round on the deployed service: needs the push and
  a round that runs there.

### Environment

- Local, `ai-analytics-service/.venv`.

### Residual risk

- The cost of a round can only be read by summing lines by hand or with a
  filter. That is deliberate and is what "then close it permanently" means; the
  moment it becomes a dashboard it has become the optimization work the sweep
  refused.

## Failed approaches

- None.

## Known risks

- None material. The line is additive and its helper cannot raise.

## Approval gates

- None. Nothing is published, nothing crosses a boundary, no secret is touched.

## Questions requiring an owner decision

- None.

## Findings for whoever picks this up

- **The root `unpaced_provider` fixture only unpaces the fast tier.** Its
  docstring says no suite waits on the deployed pace, but it zeroes
  `llm_max_requests_per_minute` and not `llm_max_requests_per_minute_heavy`, and
  a model named on neither tier is paced by the strictest rate on the key. So a
  second successful provider call inside one test still waits the heavy
  interval — six seconds — and the symptom is a suite that hangs rather than
  fails. This branch worked around it with a local fixture rather than editing
  shared test infrastructure inside an unrelated slice. **Closed on 2026-08-18**
  by `fix/the-unpaced-fixture-unpaces-both-tiers`, the next branch in this stack:
  the fixture now zeroes both tiers, the local workaround here is gone, and the
  full suite dropped from 17.59s to 5.72s — which is the pacing it had been
  paying, and the evidence that nothing was relying on the gap.

## Next concrete step

None. The stack was pushed on 2026-08-18 and the line is deployed. What is
still unread is a real round's worth of these lines, which needs a round on the
deployed service — that is the measurement this branch made possible, not work
this branch owes.
