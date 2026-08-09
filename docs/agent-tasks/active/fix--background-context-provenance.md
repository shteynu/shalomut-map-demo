# `backgroundContextIncluded` can say no again

## Metadata

- Branch: `fix/background-context-provenance`
- Base branch: `docs/outgoing-gate-docstring` (itself based on
  `fix/v6-adaptation-repair-critique`, based on `main` at `79a6d39`; neither is
  pushed)
- Base commit: `e385b09`
- Current HEAD: the commit that carries this file
- Status: complete on this branch, not yet on `main`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 3 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
the provenance flag `backgroundContextIncluded` was `True` on every 4.0+ round,
including rounds where no school had written anything.

## User-visible outcome

None on screen. A manager reading provenance — and any later work that budgets
background context as an available AI input — now gets an answer that can be
`False`.

## Context

`_background_context_for_prompt` fell back to `state["org_context"]`, which
`AnalyticsRunner` seeds with `{"organizationId": <uuid>}` on every round because
Core always sends the id. The flag is `bool(...)` of that, so it was always
true. The 4.0 manifest defines the field as the inclusion of
`RoundBackgroundContext`, so this is the code disagreeing with the published
contract, not a contract change.

Checked before changing: the id never reached a reader.
`background_context_lines` renders only the named `RoundBackgroundContext`
fields, so `{"organizationId": ...}` produced no prompt lines. The one place
that would have dumped it verbatim is the 6.0 adaptation prompt, which
`json.dumps`es whatever it is given; removing the fallback closes that too.

The fallback's other theoretical source, `organizationContext` from MCP, is not
sent by Core — only `mock_server.py` sets it — so nothing real is lost.

## Scope

- `ai-analytics-service/src/agents/node_support.py` — the fallback and the now
  unused `state` parameter.
- Its five call sites in `psychologist_node.py` and `intervention_nodes.py`,
  and two in `tests/test_service_integration.py`.
- `ai-analytics-service/tests/test_contract_v5.py` — the regression test.

## Non-goals

- Any change to what Core sends or to the 4.0/5.0/6.0 manifests.
- Items 4–7 of the findings file. They remain deferred by owner decision.

## Acceptance criteria

- A round whose state carries only the organization id reports
  `backgroundContextIncluded: False` on every dimension.
- A round with a real `backgroundContext` still reports `True` and still puts
  the context in the prompt.
- The full Python suite stays green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

`contracts/ai-analytics-v4.json` lists `backgroundContextIncluded` among the
provenance fields and describes the capability as passing
`RoundBackgroundContext`. Core's `ai-contract.ts` accepts the field as an
optional boolean and validates nothing about which value it takes, so no
Core-side change follows from this.

## Decisions made

- Remove the fallback rather than teach the flag to ignore it. One rule, at the
  point where the context is resolved, instead of two places that must agree.
- Drop the `state` parameter along with it. An argument no longer read is the
  same drift item 4 of the findings file describes.

## Assumptions

- Core does not send `organizationContext` over MCP. Verified by grep across
  `src/lib` and the contract artifacts; only the mock server sets it.

## Completed

- The fallback, the parameter and its call sites.
- `test_the_organization_id_is_not_a_school_context` in `test_contract_v5.py`.
- The findings file: item 3 marked closed, status paragraph updated.

## In progress

None.

## Remaining

- Push onto `main`. This branch contains items 1, 2 and 3; pushing it lands all
  three.

## Changed files

Committed together with this file:

- `ai-analytics-service/src/agents/node_support.py`
- `ai-analytics-service/src/agents/psychologist_node.py`
- `ai-analytics-service/src/agents/intervention_nodes.py`
- `ai-analytics-service/tests/test_contract_v5.py`
- `ai-analytics-service/tests/test_service_integration.py`
- `docs/ai-service-incidental-findings-2026-08-09.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 466 passed.
- Guard check: with `ai-analytics-service/src` stashed back to the pre-fix
  state, `test_the_organization_id_is_not_a_school_context` is the only failure
  in `tests/test_contract_v5.py` (1 failed, 42 passed); stash popped after.

### Failed

None.

### Blocked or not run

- TypeScript suite, lint, build: not run. No contract artifact, manifest or
  Core-side type changed, and the field stays an optional boolean there.

### Environment

local

### Residual risk

The flag's new `False` has not been observed on a deployed round, only in the
suite. If some future consumer reads `backgroundContextIncluded` as "we had any
context at all", it will now read fewer trues — which is the point, but it is a
change in the values Core receives.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

Hand the push to the owner: `git push origin
fix/background-context-provenance:main`, which lands items 1, 2 and 3 together.
