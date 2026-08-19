# The adaptation call outlives its timeout

## Metadata

- Branch: fix/the-adaptation-call-outlives-its-timeout
- Base branch: claude/priceless-swanson-9cf466 (itself unmerged; `origin/main` is `4bd5b2f`)
- Base commit: 8629363
- Current HEAD: 31bd03d, three commits above the base
- Status: fixed and verified against the provider
- Last updated: 2026-08-20
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

Extended on the owner's request after the fix landed: `scope=` on the provider
log lines, and an error-level signal when an answer is truncated by the token
budget. Both came out of the same question — what happens when the questionnaire
grows — and both are prerequisites for answering it with data instead of a
guess.

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

**And which call it was.** `scope=` now rides the usage, retry and no-answer
lines: `interpretation`, `overall_summary`, `structured_summary`,
`metric_insights`, `question_suggestion`, `adaptation`. Without it a 50.9s call
could not be attributed, and the three kinds of call have very different output
sizes. Measured immediately afterwards on one round: adaptation mean 21.2s,
metric insights 15.0s, structured summary 11.9s, overall summary 8.7s —
adaptation is the longest, which is what made it the one that died.

**Truncation is now an error, not a warning.** `finish_reason=length` means the
budget ran out mid-answer: a configuration fault wearing a provider fault's
clothes, and the only failure here nobody upstream can fix. It has been read as
the round simply being quiet twice — 2026-07-28 at caps of 180 and 420, and
2026-08-19 at 2048, where 25 of 25 calls truncated and the round still reported
success. The log line names `MAX_TOKENS_PER_DIMENSION` and the value in force.

`fallback_reason` deliberately stays `invalid_finish_reason`: that string is what
the health reading and the callers branch on, and it covers safety blocks and
recitation too. What was missing was a level a log filter stops on, not another
label.

## Assumptions

- The tail measured locally stands for the deployed tail. Same model, same token
  cap, same prompts, and the deployed service is the same code — but the network
  path differs, and two rounds are two samples.

## Completed

All of the above.

## Remaining

None on this branch. The follow-on the owner and I identified — deriving the
token budget from the round's question count instead of a fixed 8192 — waits on
the methodologist, because the coefficient is questions-per-dimension and the
new instrument's item-to-dimension mapping is not decided. Recorded under
Questions requiring an owner decision.

## Changed files

- `ai-analytics-service/src/config.py`
- `ai-analytics-service/src/services/llm_transport.py`
- `ai-analytics-service/src/services/llm_provider.py` — the seven call
  sites, each naming its own `scope`.
- `ai-analytics-service/tests/test_llm_provider.py`
- `docs/shalomut-tracker-handoff.md`, and this file.
- `docs/agent-tasks/archive/feat--one-dimension-can-be-analysed-again.md`
  and
  `docs/agent-tasks/archive/feat--the-map-says-which-paragraphs-it-wrote-itself.md`
  — moved out of `active/` on 2026-08-20. Both branches are in `main`
  (`2ad95e9`, `68fd473`) while their files still asked for a push and a
  commit. Housekeeping, unrelated to the timeout; it rode this branch
  because this is the checked-out worktree.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service`: **549 passed**,
  re-run at `31bd03d`. It read 546 before the observability tests.
- The three new tests re-run against the old `20/25/25` values: all three fail.
- **Live `6.0` round at the committed defaults**, deployed settings,
  `LLM_REQUEST_TIMEOUT_SECONDS` and `LLM_RETRY_BUDGET_SECONDS` unset: 28 calls,
  25 `outcome=llm`, **zero `TimeoutError`, zero adaptation fallbacks**, all eight
  stones `llm` on the first attempt. Durations min 13.5s, median 21.0s, max
  50.9s.
- Measurement round with the ceiling lifted: 27 calls, zero timeouts, min 10.8s,
  median 17.8s, p90 22.6s, max 26.0s.
- Round at the 25s ceiling: 10 of 20 calls lost to `TimeoutError`.
- **Live round confirming `scope=`**, after that work: all four scopes present
  and correctly attributed, zero timeouts, zero adaptation fallbacks, zero
  error-level lines. Slowest call 25.6s against the previous round's 50.9s on
  identical settings — the third independent sign that the tail is unstable.
- The three new observability tests pass; the truncation test asserts the error
  line, and a sibling asserts an ordinary refusal is *not* escalated.

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

- When the questionnaire changes, should the token budget scale with the round
  rather than stay a constant? V6 metric insights ask for one 300-500 character
  paragraph **per question**, and the validator requires one for every question
  in the dimension. At today's three questions per dimension the output budget
  already runs at about 87% of 8192 (prompt ~1340, visible ~1300, reasoning
  ~5760). At roughly sixteen questions per dimension that call's output grows
  about fivefold and the constant cannot hold it. The timeout is the lesser
  problem and is already a variable; this one is not.

## Next concrete step

Land this branch — `git push origin fix/the-adaptation-call-outlives-its-timeout:main`,
a fast-forward that carries its base with it. The redeploy then happens on its
own: `render.yaml`'s `buildFilter` lists `ai-analytics-service/**`, and this
stack changes three files under it. No Render variable needs adding, and no
manual redeploy either.
