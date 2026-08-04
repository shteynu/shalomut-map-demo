# Let a 6.0 round report the seven dimensions it did get right

## Metadata

- Branch: `feat/v6-partial-maps`
- Base branch: `main`
- Base commit: `11d3c8b`
- Current HEAD: this branch's commits
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give contract `6.0` back the partial map — and, because the flag alone would
have been dead code, give it something that produces one.

## User-visible outcome

A round where one dimension's copy could not be written no longer disappears.
The manager sees seven dimensions and, on the eighth, the existing "this
dimension was not interpreted in the last round" screen instead of an error
where the whole analysis used to be.

## Context

The previous task asked whether `supportsPartialMaps: false` on 6.0 was lost or
retired. Reading it: **retired**. On ≤ 5.0 the only thing that produces
`unavailable` is `ProviderUnavailableError` from the dimension generator, and
6.0's `generate_structured_summary_result` never raises — it falls back
(ADR-007). So on 6.0 the capability had no producer, and flipping the flag on
its own would have shipped machinery nothing can reach.

What is real is a different loss, and it is not version-specific: when the
repair budget is spent, `graph.py` failed the **whole round** as
`validation_failed` even if seven dimensions were perfect and one kept being
refused. That is what a partial map is for, and it is what this task wires up.

## Scope

- `contracts/capabilities.json`: 6.0 gains `supportsPartialMaps`.
- `graph.py`: `_degrade_to_partial_map`, applied once when the repair budget is
  spent, followed by a second validation pass.
- `safety_node.py` and `stone_map_validation.py`: what a V6 gap looks like.
- Core `isValidV6Stone` and `StoneDetailV6.summary`.
- `contracts/fixtures/callback_corpus.json`: a shared accepted partial 6.0 map,
  plus a `canonical` marker so a refused case's `from` names its source.
- ADR-007, `docs/ai-contract-version-matrix.md`.

## Non-goals

- No change to when 6.0 falls back. A silent provider still produces
  aggregate-derived copy labelled `deterministic_fallback`; that decision was
  taken last task and this one does not reopen it.
- No new UI. The screen for a dimension with no interpretation already exists
  and was built for 5.0; a V6 gap arrives at it unchanged.
- No banner on the map screen for `dimensionsWithoutInterpretation`. It is in
  the payload and nothing reads it yet; that is a separate decision.

## Acceptance criteria

- A 6.0 round with one persistently refused dimension comes back `success`,
  names the gap, and keeps that dimension's score, metrics and recommendations.
- Eight refused dimensions still fail the round.
- A refused overall summary or recommendation still fails the round.
- Both runtimes reach the same verdict on the new shared corpus case.
- `npm run verify:core` and `npm run verify:ai` pass.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: the contract is shared, so a shape
  change is only real when both runtimes agree on it.
- `.agents/skills/shalomut-verification/SKILL.md`: a change to both runtimes
  means both suites, not one.

## Relevant architecture and contracts

- `contracts/capabilities.json` is the single source: Core and Python both read
  it, and there is no second literal to keep in step.
- The gap shape mirrors 5.0's exactly. 5.0 says an `unavailable` stone's
  interpretation must be `''` and any other outcome's must not be; 6.0 now says
  its `summary` must be `[]` and any other outcome's must be three paragraphs.
- **The gap covers the overview only.** Metric narratives stay required at
  every outcome, in the safety node, in the outgoing gate and in Core. A
  dimension can lose its three paragraphs and keep the reading of each of its
  questions.

## Decisions made

- **Repair exhaustion is the producer.** It is the only live path on 6.0, and
  it was throwing away good work on every contract, not just this one.
- **Gated on the capability, so 5.0 gets it too.** Special-casing 6.0 would
  have meant a version check in the graph for no reason; 5.0 gains the same
  improvement and its own shape already describes it.
- **The degraded state is validated, not trusted.** `_degrade_to_partial_map`
  builds a state and the safety validator judges it exactly as it judges any
  other. A degradation that does not actually fix the refusal — a broken metric
  narrative, say — fails the round as it did before.
- **Degrade once.** Re-entering the loop would regenerate copy the budget has
  already paid for; a single pass cannot loop.
- **`canonical` in the callback corpus.** Adding a second accepted 6.0 payload
  silently changed which one refused cases mutate — one test caught it. The fix
  names the source in the fixture instead of depending on array order.

## Assumptions

- A refusal that carries a `dimensionId` is about that dimension's own copy.
  True of every violation the safety node emits with `target: interpretation`.

## Completed

Everything in scope.

## In progress

None.

## Remaining

The push is the owner's: the agent cannot push here.

## Changed files

- `contracts/capabilities.json`
- `contracts/fixtures/callback_corpus.json`
- `ai-analytics-service/src/agents/graph.py`
- `ai-analytics-service/src/agents/safety_node.py`
- `ai-analytics-service/src/schemas/stone_map_validation.py`
- `ai-analytics-service/tests/{test_contract_v6,test_analytics_output,test_callback_corpus}.py`
- `src/lib/ai-contract.ts`
- `src/lib/__tests__/{ai-contract-v6,ai-insights-view-model,callback-corpus-parity}.test.ts`
- `src/lib/__tests__/fixtures/v6-payload.ts`
- `PROJECT_CONTEXT.md`, `docs/ai-contract-version-matrix.md`
- this file

## Verification evidence

### Passed

- `npm run verify:core`: exit 0, 551 tests, plus lint, typecheck, literals,
  composition and `next build`.
- `npm run verify:ai`: exit 0, 435 Python tests.
- The producer is proved through the real graph, not by calling the helper: a
  6.0 round with one dimension whose overview the validator always refuses now
  returns `success` with `dimensionsWithoutInterpretation: ["balance"]`, an
  empty `summary`, five recommendations and a full metric narrative on the
  gapped stone. The same round with all eight refused still returns
  `validation_failed`.
- Both runtimes judge the new shared corpus case. Confirmed by tampering rather
  than assumed: emptying `dimensionsWithoutInterpretation` on
  `accepted-6.0-partial` turned Core to `# fail 1` and Python to
  `FAILED ...[accepted-6.0-partial]`, and restoring it returned both to green.
- The `canonical` marker is load-bearing and was proved so: before it existed,
  the second accepted 6.0 payload became the mutation source and
  `v6-summary-two-paragraphs` failed.

### Failed

None.

### Blocked or not run

- No provider was called; quota is still exhausted, and nothing here needs one.
- `npm run verify:db` was not run. No schema, migration or repository changed.
- No browser check. The screen a V6 gap lands on is the 5.0 one, unchanged by
  this task and already covered by a rendering test.

### Environment

Local. Nothing deployed was touched.

### Residual risk

- **A gap is now reachable by a route that is about copy quality, not
  availability.** A manager reading "this dimension was not interpreted"
  cannot tell a silent provider from copy that kept being refused. The words on
  the screen are true either way, and the provenance carries `attempts`, but if
  the two need different words that is a follow-up.
- Degrading on any `interpretation` violation includes `status_inconsistent`
  and `provenance_invalid`, which are bugs in this service rather than bad
  copy. They will now surface as a gap instead of a failed round. The second
  validation pass keeps them from producing an invalid map, but they become
  quieter — the log line naming the degraded dimensions is the only signal.

## Failed approaches

- Considered flipping `supportsPartialMaps` alone, as the question in the
  previous task implied. Reading the generator showed nothing on 6.0 can
  produce `unavailable`, so the flag would have enabled a shape no code emits.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched.

## Questions requiring an owner decision

Two, neither blocking:

1. Should the map screen show a banner when `dimensionsWithoutInterpretation`
   is non-empty? Today a manager finds the gap only by opening that dimension.
2. Should a gap say *why* — provider silence versus copy that could not pass
   validation? They are now different causes behind the same sentence.

## Next concrete step

Hand the push to the owner: `git push origin feat/v6-partial-maps:main`.
