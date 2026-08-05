# Make a gap say which cause left it empty

## Metadata

- Branch: `feat/gap-reason`
- Base branch: `main`
- Base commit: `eec0bd0`
- Current HEAD: this branch's commits
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last open question from the partial-map work: two different causes
reached the same sentence on screen.

## User-visible outcome

A dimension with no interpretation now says whether the analysis service did
not answer or whether the copy it wrote was refused, and the two give different
advice — wait a few minutes, or re-run for a different wording. Rounds analysed
before today keep the sentence that claims neither.

## Context

`unavailable` said that words are missing and nothing about why. The two causes
are not the same news for a manager: a silent provider is worth another run in
a minute, and copy this service refused is worth a run for a different wording
and worth suspecting if it keeps happening.

## Scope

- `generationProvenance.unavailableReason` on the wire, plus its rule in Core,
  in Python's safety node and in Python's outgoing gate.
- Both producers label themselves: `psychologist_node` writes
  `provider_unavailable`, `graph._degrade_to_partial_map` writes
  `validation_rejected`.
- `DashboardStone.interpretationUnavailableReason` and
  `DashboardInsightsDto.gapsByReason`.
- The dimension screen and the map notice word each cause.
- `contracts/ai-analytics-v6.json`, ADR-007, the version matrix, the handoff.
- Two refused cases and one amended accepted case in the shared corpus.

## Non-goals

- No new contract version. See the decision below.
- No change to what produces a gap.
- No reason for the round-level failures (`provider_unavailable`,
  `validation_failed`). Those already carry a `failureReason`.

## Acceptance criteria

- A gap produced by a silent provider and one produced by repair exhaustion
  arrive labelled differently, proved through the graph rather than by calling
  the helper.
- A reason on any outcome other than `unavailable` is refused by both runtimes.
- A gap with no reason is still valid.
- Both screens say something different for each cause, and something honest
  when there is none.
- `npm run verify:core` and `npm run verify:ai` pass.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: the contract is shared, so a field is
  only real when both runtimes agree on it.
- `AGENTS.md`: current code and contracts outrank prose, and a living document
  that disagrees is updated in the same task.

## Relevant architecture and contracts

- Neither runtime polices provenance keys exhaustively — both are structural
  predicates — so the field is additive for any reader that ignores it.
- `contracts/ai-analytics-v6.json` enumerates `provenanceFields`, so the
  manifest is part of the change rather than incidental to it.

## Decisions made

- **Amended 6.0 rather than publishing 7.0.** ADR-002 says published contracts
  keep their released semantics, and this is the second amendment to 6.0 in two
  days — the first was turning on partial maps, which the owner chose over a new
  version. Going the other way now would leave the field stranded behind a
  rollout nobody has scheduled. Recorded here because it is a real deviation
  from the stated rule, not because it is invisible.
- **Optional, not required.** Rounds analysed before today carry no reason, and
  a rule demanding one would refuse this product's own history at the callback
  and on replay.
- **Forbidden on any other outcome.** A stone carrying a reason beside `llm`
  would be claiming its copy is both written and missing. That is the half of
  the rule with teeth, and both runtimes enforce it.
- **Grouped for the map, single for the dimension.** The notice can face
  several dimensions with different causes, so the DTO carries
  `gapsByReason` and the notice writes one sentence per non-empty group. The
  dimension screen only ever describes one stone.
- **`unstated` is a group, not a null.** Making absence a third bucket meant
  the notice's shape did not change between a round that knows its causes and
  one that does not.

## Assumptions

- `provider_unavailable` and `validation_rejected` are the only two causes. They
  are, today: those are the only two places an `unavailable` outcome is written.

## Completed

Everything in scope. It also fixed a gap left by the previous slice: 6.0's
manifest had no `partialMap` section at all, so it understated what 6.0 accepts
from the moment partial maps were turned on.

## In progress

None.

## Remaining

The push is the owner's: the agent cannot push here.

## Changed files

- `contracts/ai-analytics-v6.json`, `contracts/fixtures/callback_corpus.json`
- `ai-analytics-service/src/agents/{graph,psychologist_node,safety_node}.py`
- `ai-analytics-service/src/schemas/stone_map_validation.py`
- `ai-analytics-service/tests/{test_contract_v5,test_contract_v6}.py`
- `src/lib/ai-contract.ts`, `src/lib/ai-insights-view-model.ts`
- `src/lib/dashboard/dashboard-insights.ts`
- `src/components/dashboard/dashboard-partial-map-notice.tsx`
- `src/components/dashboard/dashboard-dimension-page.tsx`
- `src/components/dashboard/dashboard-map-page.tsx`
- five test files under `src/`
- `PROJECT_CONTEXT.md`, `docs/ai-contract-version-matrix.md`,
  `docs/shalomut-tracker-handoff.md`
- this file

## Verification evidence

### Passed

- `npm run verify:core`: exit 0, 561 tests, plus lint, typecheck, literals,
  composition and `next build`. 557 before this slice.
- `npm run verify:ai`: exit 0, 439 Python tests.
- Both labels are proved through the real graph, not by calling the writer: the
  5.0 round whose provider fails for two dimensions now asserts
  `provider_unavailable` on both, and the 6.0 round whose copy keeps being
  refused asserts `validation_rejected`.
- Both runtimes judge the rule. The shared corpus gained two refused cases — an
  invented reason and a reason on written copy — and its accepted partial 6.0
  map now states a cause; Python names `unavailable_reason_invalid` for both
  refusals and Core refuses them too.
- Browser: the notice rendered in the real sidebar markup with `globals.css` in
  all three shapes — provider only, validation only, and both at once. The
  mixed case is the longest at five lines and stays readable. The dimension
  screen's refused-copy sentence was read out of the DOM with its `role` and
  computed size intact.

### Failed

None.

### Blocked or not run

- Not seen on a live round; provider quota is still exhausted.
- `verify:db` not run. No schema, migration or repository changed.

### Environment

Local. Nothing deployed was touched. No provider was called.

### Residual risk

- **The amendment is invisible to a deployed reader that predates it.** An
  older Core ignores the field and shows the generic sentence, which is
  correct behaviour but is not the same as being on the same contract. If the
  deployed Core and Python ever run different builds across this change, the
  screens simply say less.
- The mixed-cause notice is dense. It is the rare shape — on 6.0 today only
  `validation_rejected` can occur, since a silent provider falls back instead —
  and if it ever becomes common the answer is a list rather than a paragraph.

## Failed approaches

- Imported Python's reason predicate as `_valid_unavailable_reason` from
  another module. A leading underscore crossing a module boundary is a private
  name being used publicly; renamed to `has_valid_unavailable_reason`.
- Regenerated `contracts/ai-analytics-v6.json` with `json.dumps`. It reflowed
  every inline array in the file and turned a 13-line change into 90. Edited
  the text in place instead.

## Known risks

None beyond the residual risk above.

## Approval gates

None for the code. The 6.0 amendment is a deviation from ADR-002's
consumer-first rule that the owner should know about; it is recorded in the
decision above and in ADR-007.

## Questions requiring an owner decision

One, new and not blocking: two amendments to a published contract in two days
suggests either that ADR-002's immutability rule wants an explicit "additive
optional fields are allowed" clause, or that 7.0 is overdue. Worth settling
before the third amendment rather than after.

## Next concrete step

Hand the push to the owner: `git push origin feat/gap-reason:main`.
