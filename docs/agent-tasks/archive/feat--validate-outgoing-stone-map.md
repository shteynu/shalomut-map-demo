# Check the outgoing Stone Map before the callback

## Metadata

- Branch: `feat/validate-outgoing-stone-map`
- Base branch: `origin/main`
- Base commit: `fb7be19`
- Current HEAD: merged into `main` by `1467fdd`
- Status: complete, verified and merged into `main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Wire `stone_map_refusal` into the pipeline — the follow-up the corpus slice
deliberately left open and named in section 6 of the v3 audit.

## User-visible outcome

Fewer rounds die at the callback. A payload Core would refuse for reasons a
second attempt can fix is now rewritten inside the service, where a retry still
exists, instead of being discovered after every model call of the round is
already paid for.

## Context

The safety validator judges the *state* — the copy each node wrote. The payload
is assembled afterwards by `format_stone_map_output_node`, outside the retry
loop, and nothing judged it. So a round could pass every check in the service
and still be refused by `validateStoneMapResult` at the callback, which ends the
run as `contract_validation_failed` with no retry left.

The concrete gap that motivated it: the safety validator has no opinion on the
round summary's sentence count, and Core requires two to four from 5.0 up. A
Hebrew one-sentence summary passed here and was refused there.

## Scope

Python analytics service only. No contract version moves, no payload field is
added or removed, and an accepted payload is byte-identical to what it was.

## Non-goals

- Making the Python validator authoritative. Core stays the judge; this is the
  same question asked one step earlier.
- Covering every rule Core has. The gate covers what the validator implements.

## Acceptance criteria

- A refusal a replay could fix becomes a replay, and the replay carries a
  critique.
- A refusal no replay can fix ends the round at once, naming the rule.
- An ordinary round is unchanged.

## Relevant repository instructions

`AGENTS.md` skill routing, one branch = one task file, record only verification
that actually ran.

## Relevant architecture and contracts

`AnalyticsGraphEngine.ainvoke` in `ai-analytics-service/src/agents/graph.py`;
`validateStoneMapResult` in `src/lib/ai-contract.ts`; the callback route's
`contract_validation_failed` path.

## Decisions made

- **A refusal is classified before it is acted on.** `_REPAIRABLE` maps the six
  copy-level rules to the target that would have to write again. Everything
  else fails immediately. Replaying a missing `surveyDefinitionHash` would buy
  a heavy-tier request to produce the identical refusal — the hash arrived in
  the round data and no amount of regenerating conjures one.
- **A repairable refusal reuses the existing loop** rather than adding a second
  retry mechanism: it writes the same bookkeeping the safety validator writes,
  including the coded violation, so the repair prompt carries a critique.
- **A stone-level rule that cannot name its dimension is treated as
  unrepairable.** A targeted replay with no target would rewrite nothing and
  loop to the retry ceiling.
- **The failure reason is prefixed `outgoing_`.** It is an additive string on a
  non-success payload, which the callback validator already accepts, so an
  operator can tell "we refused our own output" from "Core refused it".

## Assumptions

- The six Hebrew critique lines added for the gate's rules are correct Hebrew.
  They mirror the wording of the existing lines and are unreviewed by a Hebrew
  reader.

## Completed

- `src/schemas/stone_map_validation.py`: `_REPAIRABLE`, `OutgoingRefusal`,
  `outgoing_refusal()` and `_first_refused_dimension()`.
- `src/agents/graph.py`: the gate inside the retry loop, plus
  `_replay_for_outgoing_refusal()`; the loop's trailing `break` became the
  gate's own exits.
- `src/agents/safety_report.py`: six critique lines for the gate's rules.
- `tests/test_outgoing_payload_gate.py`: 5 tests.

## In progress

None.

## Remaining

Nothing on this branch.

## Changed files

Committed on this branch:

- `ai-analytics-service/src/schemas/stone_map_validation.py`
- `ai-analytics-service/src/agents/graph.py`
- `ai-analytics-service/src/agents/safety_report.py`
- `ai-analytics-service/tests/test_outgoing_payload_gate.py` (new)
- `docs/agent-tasks/active/feat--validate-outgoing-stone-map.md` (new)

Unstaged and unrelated, preserved untouched: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` — 354 passed (349 before this branch, 5 new).
- `npm test` — 341 passed; `npm run lint:literals` — passed;
  `ai-analytics-service/scripts/check_version_literals.py` — exit 0.
- Red before green: replacing the gate's verdict with `None` failed the two
  behaviour tests; restored, all pass.

### Failed

None.

### Blocked or not run

- `npm run typecheck`, `lint`, `build`: not run. The diff contains no
  TypeScript.
- No live provider call and no HTTP callback was exercised.

### Environment

Local only. `ai-analytics-service/.venv`, Python 3.14. No database, no
deployment, no environment variable touched.

## Failed approaches

The first draft replayed a refusal with an empty critique. The gate emits the
payload validator's rule names and the critique table only knew the safety
validator's, so `critique()` returned `None` and the replay asked the identical
question on the heavy model — the exact defect the previous slice closed. Caught
by an assertion in the behaviour test, then pinned by
`test_every_repairable_rule_has_something_to_say_to_the_model`, so adding a rule
to `_REPAIRABLE` without a Hebrew line now fails.

## Known risks

- The gate can turn what used to be a delivered-then-refused round into one more
  replay, so a pathological round can now spend up to three extra heavy-tier
  requests before failing. The classification table is what bounds this, and it
  is deliberately small.
- `_first_refused_dimension` re-runs the per-stone check to find the offender.
  It returns the first, so a payload with two bad stones takes two passes.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

Done: merged by `1467fdd`, and section 6 of
`docs/wellbeing-refactoring-plan-v4-review.md` records the gate under stage 4.
The next open items in the v3 audit are stage 3 (canonical internal models) and
the stage 4 ports; the largest independent slice below those is
`AiInsightsRepository`, which mirrors the `IAiAnalysisRunRepository` split
already done.
