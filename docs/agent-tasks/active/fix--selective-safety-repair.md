# Safety retry carries a critique

## Metadata

- Branch: `fix/selective-safety-repair`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`
- Current HEAD: tip of `fix/selective-safety-repair`, one commit past `ae3c3c4`
- Status: implementation complete, verified, committed, unpushed
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the P1 defect from section 8 of the v3 refactoring plan: "safety retry без
critique". The safety validator wrote a joined sentence into `safety_feedback`
that nothing read, so a rejected dimension was asked again with a byte-identical
prompt on a costlier model and no idea what had been wrong with the first answer.

## User-visible outcome

None directly. A replay is more likely to produce copy the validator accepts on
the second attempt, so fewer rounds reach a manager with a missing
interpretation or an unadapted recommendation.

## Context

Correction to the earlier audit: selective replay by dimension **already
existed** on `main` (`ReplayPlan` in `node_support.py`, consumed by
`psychologist_node.py` and `intervention_nodes.py`, driven by
`retry_interpretation_dimensions` / `retry_recommendation_dimensions` /
`retry_overall_summary`, and covered by `tests/test_replay_targets.py`). The
audit statement that the loop "повторяет весь pipeline до трёх раз" was wrong.
The genuinely missing piece was only the critique reaching the prompt, which is
what this branch adds. Section 6 of `docs/wellbeing-refactoring-plan-v4-review.md`
on the `docs/refactoring-plan-status` branch needs the same correction.

## Scope

Python analytics service only. The refusals the safety validator already
computes become a structured report; the replay turns that report into one
Hebrew line appended to the prompt of the part that failed.

## Non-goals

- Changing which parts a replay rewrites. The replay plan is unchanged.
- Changing `safety_feedback`. It stays byte-compatible so existing tests and
  logs are untouched.
- Any TypeScript, contract, schema or persistence change. No contract version
  moves; the payload is unchanged.

## Acceptance criteria

- A replayed interpretation, recommendation and round summary each receive a
  Hebrew critique naming what was refused.
- A first attempt's prompt is byte-identical to what it was before.
- A refusal on one dimension never reaches another dimension's prompt, and a
  refusal of one target never reaches another target's prompt.
- Refusals about this service's own bookkeeping never reach a prompt.

## Relevant repository instructions

`AGENTS.md` skill routing (`shalomut-map`, `shalomut-verification`), one branch
= one task file, record only verification that actually ran.

## Relevant architecture and contracts

`ai-analytics-service` LangGraph pipeline: privacy gate → psychologist → RAG
intervention → adaptation → safety validator, with the validator looping back
through a `ReplayPlan` and a `retry_tier` escalation from `fast` to `heavy`.

## Decisions made

- **The critique is a closed set of codes, not the validator's English
  sentence.** `safety_feedback` is diagnostic English written for a log; feeding
  it to the model would put untranslated operator text one step away from a
  manager's Hebrew copy. Each code maps to one reviewed Hebrew line in
  `_CRITIQUES`.
- **Three codes are deliberately excluded**: `provenance_invalid` and
  `unavailable_not_empty` describe our own bookkeeping (which questions fed a
  prompt, whether an absent interpretation was left absent), and
  `v6_intervention_count` describes the catalog. Handing any of them to the
  model would ask it to repair a step it never performed.
- **`retry_count` gates the critique, not the presence of a report.** A state
  that still carries violations from an earlier attempt must not open a first
  prompt with a correction.
- **The critique is appended last**, after the rules it qualifies, and an absent
  critique appends the empty string — so the first-attempt prompt does not
  change at all.

## Assumptions

- The Hebrew critique lines are semantically correct Hebrew. They were written
  to mirror the wording of the existing prompt rules; an owner who reads Hebrew
  should skim `_CRITIQUES` in `src/agents/safety_report.py`.

## Completed

- `src/agents/safety_report.py` (new): `SafetyViolationTarget`,
  `SafetyViolation`, the `_CRITIQUES` table, `violation()` and `critique()`.
- `src/agents/safety_node.py`: eight `violation(...)` records emitted alongside
  the untouched `feedback.append(...)` strings; `safety_violations` returned on
  both the fail and the pass path.
- `src/agents/state.py`: `safety_violations: List[SafetyViolation]`.
- `src/agents/node_support.py`: `_repair_critique(state, target, dimension_id)`.
- `src/services/hebrew_prompts.py`: `repair_section()` plus a `repair_critique`
  parameter on `interpretation_prompt`, `overall_summary_prompt`,
  `v6_structured_summary_prompt`, `v6_metric_insights_prompt` and
  `adaptation_batch_prompt`.
- `src/services/llm_provider.py`: `repair_critique` threaded through the five
  public generation methods and the two prompt builders.
- `src/agents/psychologist_node.py` and `src/agents/intervention_nodes.py`: five
  call sites now pass the critique.
- `tests/test_repair_critique.py` (new, 10 tests) and critique recording in
  `tests/test_replay_targets.py`; `tests/llm_stub.py` accepts and forwards the
  new keyword.

## In progress

None.

## Remaining

Nothing on this branch.

## Changed files

Committed on this branch:

- `ai-analytics-service/src/agents/safety_report.py` (new)
- `ai-analytics-service/src/agents/safety_node.py`
- `ai-analytics-service/src/agents/state.py`
- `ai-analytics-service/src/agents/node_support.py`
- `ai-analytics-service/src/agents/psychologist_node.py`
- `ai-analytics-service/src/agents/intervention_nodes.py`
- `ai-analytics-service/src/services/hebrew_prompts.py`
- `ai-analytics-service/src/services/llm_provider.py`
- `ai-analytics-service/tests/test_repair_critique.py` (new)
- `ai-analytics-service/tests/test_replay_targets.py`
- `ai-analytics-service/tests/llm_stub.py`

Unstaged and unrelated, preserved untouched: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` — 311 passed (301 before this branch, 10 new).
- Red before green, by temporarily neutering `_repair_critique` to return
  `None`: the three end-to-end tests failed
  (`test_a_replayed_interpretation_is_told_what_was_wrong`,
  `..._adaptation_...`, `..._summary_...`); restored, all pass.
- Red before green on the stale-report guard, by removing only the
  `retry_count` check: `test_a_stale_report_cannot_leak_into_a_first_pass`
  failed; restored, it passes.
- `npm run lint:literals` — architecture fitness check passed (3/3 gate tests).
- `ai-analytics-service/scripts/check_version_literals.py` — exit 0.

### Failed

None.

### Blocked or not run

- TypeScript checks (`npm run typecheck`, `npm run verify:core`) were not run:
  the diff contains no TypeScript, no contract manifest and no schema change.
- No live provider call was made. Every test stubs the provider, so the Hebrew
  critique has never been sent to a real model.

### Environment

Local only. `ai-analytics-service/.venv`, Python 3.14. No database, no
deployment and no environment variable was touched.

## Failed approaches

None on this branch. The one thing worth recording is a near miss: the first
draft of the tests would have passed against unwired nodes, which is why the
`_repair_critique` neutering above was run explicitly.

## Known risks

- The Hebrew critique lines are unreviewed by a Hebrew reader.
- A future safety check that appends to `feedback` without also appending a
  `violation` will silently produce a critique-free replay — the same class of
  defect this branch closes. Nothing enforces the pairing.

## Approval gates

None. No credential, deployment alias, schema or privacy-threshold change.

## Questions requiring an owner decision

- Merge order for the five unpushed branches of this track.

## Next concrete step

Owner action: push `fix/selective-safety-repair` along with the other four
branches of the track, then decide the merge order. After the merge, section 6
of `docs/wellbeing-refactoring-plan-v4-review.md` needs two corrections in one
pass: the selective-replay claim above, and the sentences about the allowlist
leak and the Hebrew corpus, which go stale once their branches land.
