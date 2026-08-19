# Adaptation validates a 5.0 round against 2.0 rules

## Metadata

- Branch: claude/priceless-swanson-9cf466
- Base branch: main
- Base commit: 4bd5b2f
- Current HEAD: c1dfed0
- Status: fixed and verified locally; live before/after still owed
- Last updated: 2026-08-19
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Stop the question-adaptation step falling back to catalog text on every
dimension, and stop it spending half a round's provider answers on retries that
cannot succeed.

## User-visible outcome

A manager reads recommendations written against this school's own numbers
instead of the catalog wording, and a round costs roughly half the provider
answers it costs today.

## Context

Measured 2026-08-19 on three full local pipeline runs
(`npx tsx scripts/local-unlocked-pipeline.ts`, `gemini-3.5-flash`, deployed
settings, `LLM_REASONING_EFFORT` unset / low / medium). Every run ended
`adaptation=deterministic_fallback` for all eight dimensions with
`reason=invalid_semantic_output refusal=status_inconsistent`, e.g.
`detail=[block=1 colour=green verdict=no numbers=50,6,6]`. Each dimension burnt
2-3 attempts; in the `low` run that was 14 of 31 billed answers. The stones were
unaffected and the round reported `status: success`, which is why it went
unnoticed. The measurement itself is recorded on the branch of
`docs/agent-tasks/archive/feat--the-thinking-budget-is-a-declared-number.md`.

## Scope

The legacy (non-6.0) adaptation batch path in `ai-analytics-service`: the
acceptance predicate, the refusal reporter and the contract version that reaches
them.

## Non-goals

- Changing the adaptation prompt's wording or the 5.0 rule itself.
- The 6.0 (`usesStructuredDimensionSummary`) adaptation branch, which is
  internally consistent — see Decisions made.
- Any live-provider run. Those cost money and need the owner's approval.

## Acceptance criteria

- A batch that names a colour group with one of the round's own bucket counts is
  accepted on a 5.0 round.
- Contracts 1.0-4.0 keep the flat blacklist byte for byte.
- The Python suite passes from `ai-analytics-service`.

## Relevant repository instructions

`AGENTS.md`; skills `shalomut-tracker`, `shalomut-map`, `shalomut-verification`.

## Relevant architecture and contracts

`contracts/capabilities.json` — `supportsScoreDistribution` is true for 5.0 and
6.0 only. `contracts/ai-analytics-v2.json` is the manifest whose version string
backs `AI_ANALYTICS_CONTRACT_VERSION` (`"2.0"`), which is the default used
wherever a contract version is not threaded.

## Decisions made

Root cause: the validator is stricter than the contract requires, because it is
never told which contract it is validating.

- `hebrew_validation.adaptation_batch_refusal` calls `is_status_consistent`
  with `contract_version=AI_ANALYTICS_CONTRACT_VERSION`, i.e. the literal
  `"2.0"`, and takes no version parameter at all.
- `LLMProviderService.adapt_interventions_result` defaults `contract_version` to
  the same `"2.0"`, and `intervention_nodes` passes the round's version only
  when `usesStructuredDimensionSummary` holds — that is, only on 6.0.

So a 5.0 round renders the score distribution into the prompt and asks the model
to name a colour group with its count in digits, and is then judged by the 2.0
rule under which naming any foreign colour is a contradiction. The
`distribution_counts` set is computed, threaded through three call layers and
then discarded by the capability gate.

The 6.0 branch is left alone deliberately: its prompt never names a colour group
and its validator forbids visible digits, so the flat rule is the correct rule
there. Fixing it "for symmetry" would loosen a gate nothing is pushing against.

The interpretation (stones) path already threads `contract_version` into
`is_valid_provider_output`. That is why the stones are unaffected, and it is the
shape the fix copies.

## Assumptions

- The 126-item instrument gives each dimension many more aggregate lines, so the
  prompt now shows many more colour groups and the model names one nearly every
  time. Treated as an amplifier of an existing defect, not as its cause: the
  defect is present for any 5.0 round whose aggregates carry distributions.

## Completed

- Diagnosis, reproduced offline with no provider call.
- The round's contract version now reaches the legacy adaptation validator:
  `agent_adaptation_node` sends it for every round, `adapt_interventions_result`
  passes it on, and `adaptation_batch_refusal` takes it instead of the module
  constant.
- `_status_inconsistency_detail` now reports a verdict in preference to a bare
  colour mention. One sentence can hold both, and with 5.0 accepting the
  mention the old reporter would have named the colour the gate had just
  allowed — the same misleading-log-line cost that made 2026-07-29 an
  investigation.
- Regression tests at all three levels, each confirmed to fail without the fix.

## In progress

None.

## Remaining

- The live before/after run, which is an approval gate rather than work.

## Changed files

All committed in `c1dfed0`.

- `ai-analytics-service/src/agents/intervention_nodes.py`
- `ai-analytics-service/src/services/hebrew_validation.py`
- `ai-analytics-service/src/services/llm_provider.py`
- `ai-analytics-service/tests/test_contract_v5.py`
- `ai-analytics-service/tests/test_llm_output_validation.py`
- `ai-analytics-service/tests/test_replay_targets.py` — the shared adaptation
  double now spells out `contract_version`, because the node sends it for every
  round rather than only on the 6.0 branch.

## Verification evidence

### Passed

- Offline reproduction before the fix: a batch obeying the prompt is refused
  `status_inconsistent` with `detail=block=1 colour=green verdict=no
  numbers=50,6,6` — the reported string, byte for byte. Same text:
  `is_status_consistent(..., contract_version="2.0")` false,
  `contract_version="5.0"` true.
- `.venv/bin/python -m pytest` from `ai-analytics-service`: **543 passed** in
  5.79s.
- `npm test`: **1219 pass, 0 fail**, including the local Next.js → Python →
  callback boundary.
- The three new tests were each re-run with the fix reverted and fail there, on
  `invalid_semantic_output` — the production symptom. They are not vacuous.
- `git diff --check` clean.

### Failed

None.

### Blocked or not run

- Any live-provider before/after measurement. Needs the owner's approval and a
  funded account.

### Environment

local

### Residual risk

- Every acceptance here is proven against a stubbed transport, not against the
  provider. What is proven is that an answer shaped the way the 5.0 prompt asks
  for is now accepted; what is not proven is how often `gemini-3.5-flash`
  actually writes one. The before/after that closes this is a live run.
- The saving is bounded by what the measurement showed — 14 of 31 answers in the
  `low` run — and no run has yet demonstrated it.
- 1.0-4.0 keep the flat blacklist and 6.0 is untouched, so no published contract
  changes meaning. 5.0 gets the rule its own manifest already declares.

## Failed approaches

None.

## Known risks

Recorded under Residual risk.

## Approval gates

- Live-provider runs (about $0.4 per round) need the owner's approval. Not
  consumed.

## Questions requiring an owner decision

- Whether to spend one round on the before/after measurement once the fix lands.

## Next concrete step

Ask the owner to approve one live round (about $0.4, and the provider account
needs credit) and re-run `npx tsx scripts/local-unlocked-pipeline.ts` with the
deployed settings, to record the adaptation outcome and the billed answer count
against the 2026-08-19 baseline of eight dimensions on `deterministic_fallback`
and 14 of 31 answers spent on the retries.
