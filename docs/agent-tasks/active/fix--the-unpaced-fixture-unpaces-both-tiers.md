# The unpaced fixture unpaces both tiers

## Metadata

- Branch: fix/the-unpaced-fixture-unpaces-both-tiers
- Base branch: feat/one-line-says-what-a-round-costs (stack based on `d47a59c`)
- Base commit: `ec847ba`
- Current HEAD: the single commit on this branch
- Status: done and verified locally
- Last updated: 2026-08-18
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make the root `unpaced_provider` fixture do what its own docstring says. It
promised that no suite waits on the deployed pace, and it zeroed one of the two
tiers the pace is read from.

## User-visible outcome

None. Test infrastructure only; no product code is touched.

## Context

`settings.requests_per_minute_for(model)` resolves a rate per model name and
gives a name matching neither configured tier the strictest rate on the key —
`min` over the positive rates of both tiers. The fixture set
`llm_max_requests_per_minute` to `0.0` and left
`llm_max_requests_per_minute_heavy` at its default, so a test model named on
neither tier was still paced by the heavy default.

The cost of that was not slowness but a wrong diagnosis: a test making two
successful provider calls sits six seconds inside the second one with no output,
which reads as a deadlock. It cost a debugging cycle on
`feat/the-monitor-can-see-a-half-written-map`, where the window tests were
rewritten to avoid the transport partly for this reason, and a local workaround
fixture on `feat/one-line-says-what-a-round-costs`.

## Scope

- `ai-analytics-service/conftest.py` — one line and the docstring that was
  describing behaviour the code did not have.
- `ai-analytics-service/tests/test_token_usage_logging.py` — the local
  workaround fixture is removed, since the shared one now covers it.
- `ai-analytics-service/tests/test_provider_health.py` — a comment that gave
  pacing as its reason and would now be false.
- The two task files carrying the finding.

## Non-goals

- No change to the rate limiter, to `requests_per_minute_for`, or to any
  deployed pace. `render.yaml` still sets `60` and `30`, and this touches
  nothing outside tests.
- Not rewriting the window tests on the earlier branch to drive the transport
  now that they could. Their reason for recording directly outlives the pacing
  and is now stated as that.

## Acceptance criteria

- The full Python suite passes with both tiers zeroed.
- No test was relying on the heavy tier being paced by default.

## Relevant repository instructions

- `AGENTS.md`, `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

- None touched.

## Decisions made

- **Fix the fixture rather than each test.** Two branches had already worked
  around it in two different ways, which is the signal that the workaround is
  the wrong layer.
- **Tests that own the pace still set their own.** `test_provider_rate_limit.py`
  configures both tiers explicitly in every case that measures pacing, which is
  what the fixture's docstring already told them to do and is why this is safe.

## Assumptions

- None.

## Completed

- The fixture zeroes both tiers, and its docstring records why the second one
  was missing and what the symptom looked like.
- The local workaround and the now-false comment are gone.

## In progress

- Nothing.

## Remaining

- Nothing.

## Changed files

- `ai-analytics-service/conftest.py`
- `ai-analytics-service/tests/test_token_usage_logging.py`
- `ai-analytics-service/tests/test_provider_health.py`
- `docs/agent-tasks/active/feat--the-monitor-can-see-a-half-written-map.md`
- `docs/agent-tasks/active/feat--one-line-says-what-a-round-costs.md`
- this file

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — **513 passed**, and
  the wall clock went from **17.59s to 5.72s**. The same 513 tests: nothing was
  relying on the gap, and the twelve seconds were the pacing being paid.
- `.venv/bin/python -m pytest tests/test_token_usage_logging.py` — 7 passed,
  0.02s with the local fixture removed, which is what proves the shared one now
  covers it.

### Failed

- None.

### Blocked or not run

- Nothing. This change cannot be observed outside a test run.

### Environment

- Local, `ai-analytics-service/.venv`.

### Residual risk

- A future test that *wants* the deployed pace without configuring it will now
  get none. That was already the documented contract of this fixture, and the
  suite that measures pacing sets its own rates in every case.

## Failed approaches

- None.

## Known risks

- None.

## Approval gates

- None.

## Questions requiring an owner decision

- None.

## Next concrete step

Nothing here. This is the third branch of a stack; the push that lands it is
`git push origin fix/the-unpaced-fixture-unpaces-both-tiers:main`, and it
carries the two below it.
