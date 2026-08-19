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
dimension of a `5.0` round, and stop it spending half that round's provider
answers on retries that cannot succeed.

## User-visible outcome

On `5.0`, a manager reads recommendations written against this school's own
numbers instead of the catalog wording, and the round stops paying for the
retries.

Not on the deployment as it stands. Production selects `6.0`, which takes the v6
adaptation branch and never had this failure, so deployed rounds read the same
before and after and cost the same. What changes is the unset default, the
documented rollback value, and every run of
`scripts/local-unlocked-pipeline.ts` — see Context.

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

Those runs were on `5.0`, not on what the deployment produces. The script pins
itself to `"5.0"` at `scripts/local-unlocked-pipeline.ts:68` and reads no
`.env`, so "deployed settings" in that measurement means the key and the model
and not the contract. The log format says the same independently: `refusal=` and
`detail=` exist only on the pre-6.0 branch. Production explicitly selects `6.0`.

That is the correction to the first version of this file and of the handoff
entry, both of which read as though every round were affected. The fix is still
worth having — `5.0` is the rollback value and the version the cost-measuring
script actually runs, so the instrument used to measure what a round costs was
wrong about the thing being measured — but it buys the deployment nothing.

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

- ~~The 126-item instrument gives each dimension many more aggregate lines, so
  the prompt shows many more colour groups and the model names one nearly every
  time.~~ **Withdrawn 2026-08-19.** The runs that measured this used **24**
  question aggregates — three per dimension — printed by the script's own `MCP:`
  line. `scripts/local-unlocked-pipeline.ts` builds its round from
  `createCanonicalSurveyDefinition`, which is the canonical 24 and not whatever
  the default instrument is now. So the failure needs no amplifier: three
  colour-group lines per dimension were enough, every time.

## Completed

- `AI_ANALYTICS_CONTRACT_VERSION` is now required by
  `scripts/local-unlocked-pipeline.ts` and has no default; the run prints the
  version it resolved. Only the unset case is checked in the script — an
  unproducible value is already refused when `analytics.service.ts` is
  imported, and repeating that check would read as the guard without being it.
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
- `scripts/local-unlocked-pipeline.ts` — the contract version is required, and
  the run prints the one it resolved.

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
- `npm run typecheck` exit 0, `npm run lint` exit 0, after making the contract
  version required in the pipeline script.
- The script itself, three ways: unset prints the usage message and exits `1`;
  `AI_ANALYTICS_CONTRACT_VERSION=2.0` is refused at import by
  `analytics.service.ts` with Core's own wording; `=6.0` with no provider key
  runs end to end — `Contract: producing 6.0`, `MCP: contract 6.0 … 24 question
  aggregates`, `Python: status success … 8 stones`, every stone
  `deterministic_fallback (attempts 0)`, so nothing was billed.
- **Live round on `6.0`, deployed settings, 2026-08-19.** `gemini-3.5-flash`,
  `MAX_TOKENS_PER_DIMENSION=8192`, `ONLY_LLM_FOR_PROBLEMATIC=false`,
  `LLM_REASONING_EFFORT` unset. 15 provider calls, 65,033 total tokens, zero
  truncations, 14 `outcome=llm`. Seven of eight stones written by the model;
  `meaning` fell back on `TimeoutError`. Of eight adaptations, one succeeded
  (`organizational-climate`) and seven fell back, every one of them on
  `TimeoutError`. **Zero `status_inconsistent` anywhere in the run**, which
  confirms live what had until now only been read off the branch: `6.0` does not
  have the defect this task fixed.
- A first live round the same day was run on the config default
  `MAX_TOKENS_PER_DIMENSION=2048` instead of the deployed `8192` — my mistake,
  and about 74,000 tokens spent on measuring a setting nothing runs. It is
  recorded because of what it showed: 25 of 25 calls ended `finish_reason=length`
  and not one answer survived, which is exactly what the comment beside that
  variable in `render.yaml` already says 2048 does.
- `git diff --check` clean.

### Failed

None.

### Blocked or not run

- The `5.0` half of the before/after. The fix was proven on `5.0` only against a
  stubbed transport; no live `5.0` round has been run, so how often
  `gemini-3.5-flash` actually writes an acceptable counted-colour summary is
  still unmeasured.

### Environment

local

### Residual risk

- Every acceptance here is proven against a stubbed transport, not against the
  provider. What is proven is that an answer shaped the way the 5.0 prompt asks
  for is now accepted; what is not proven is how often `gemini-3.5-flash`
  actually writes one. The before/after that closes this is a live run.
- The saving is bounded by what the measurement showed — 14 of 31 answers in the
  `low` run — it applies to `5.0` only, and no run has yet demonstrated it.
- `6.0` being unaffected is now measured, not inferred: a live round produced no
  `status_inconsistent` at all.
- The script's round is the canonical 24 questions, not the questionnaire the
  product now uses. So it under-samples the prompt in a second way, independent
  of the contract version, and a cost measured on it is a floor rather than the
  real figure.
- 1.0-4.0 keep the flat blacklist and 6.0 is untouched, so no published contract
  changes meaning. 5.0 gets the rule its own manifest already declares.

## Failed approaches

None.

## Known risks

Recorded under Residual risk, plus one found by the live round and belonging to
no task yet:

**On `6.0` the adaptation step still ends on catalog copy, for an unrelated
reason.** Seven of eight dimensions fell back on `TimeoutError`. The adaptation
call is the largest answer of the round — five recommendations, each a summary
and its steps, in one request — and `llm_request_timeout_seconds` defaults to
`20.0`, capped by a `25.0` retry budget. Neither
`LLM_REQUEST_TIMEOUT_SECONDS` nor `LLM_RETRY_BUDGET_SECONDS` is declared in
`render.yaml`, and the Render dashboard was read directly on 2026-08-19: they
are not set there either, there are no linked environment groups and no secret
files, so the deployment runs the same twenty seconds and a real round loses the
same seven. Not fixed here: raising a timeout without measuring where the wall
actually is is guesswork, and the budget cap means the two numbers have to move
together. Recorded in the operational handoff.

## Approval gates

- Live-provider runs (about $0.4 per round) need the owner's approval. Not
  consumed.

## Questions requiring an owner decision

- Whether to spend one round on the before/after measurement, and on which
  contract. `5.0` proves this fix; `6.0` is what the deployment runs. They are
  different questions and only one of them is about production cost.
- Whether `scripts/local-unlocked-pipeline.ts` should build its round from the
  current default instrument instead of `createCanonicalSurveyDefinition`. It is
  the same class of problem as the version default just removed — the instrument
  used to measure cost is not the instrument in use — but changing it touches
  the item-to-dimension mapping the methodologist owns and has not yet answered
  on, so it is left as a question rather than done.

## Next concrete step

Open a separate task for the adaptation timeout under Known risks: time one
adaptation call on `6.0` with the timeout raised well past the wall, find where
it actually lands, and move `LLM_REQUEST_TIMEOUT_SECONDS` and
`LLM_RETRY_BUDGET_SECONDS` together to a measured number. This task's own work
is finished.
