# Why the provider was unavailable reaches Core

## Metadata

- Branch: `feat/provider-failure-reason-reaches-core`
- Base branch: `fix/background-context-provenance` (a chain on top of
  `docs/outgoing-gate-docstring` and `fix/v6-adaptation-repair-critique`, based
  on `main` at `79a6d39`; none of them pushed)
- Base commit: `93de052`
- Current HEAD: the commit that carries this file
- Status: complete on this branch, not yet on `main`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 4 of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
`provider_failure_reason` was written on every provider failure and read by no
production code.

## User-visible outcome

None for a manager — the Hebrew unavailability copy is unchanged, and no screen
renders a failure code. For whoever operates the service, a failed run now says
whether the key was missing, the provider answered 429, the retry budget ran
out or the copy never passed validation.

## Context

Owner decision on 2026-08-09, asked as a choice between deleting the dead key
and carrying it out: carry it out.

No contract bump is involved. `failureReason` is additive and free-form —
`encode_failure`'s own docstring says so — Core's `ai-contract.ts` does not
declare it, and `ai-insights-service.ts` stores whatever string arrives as the
run's `failureCode`.

Checked before changing: `REARMABLE_FAILURE_CODE` is `round_validation_failed`,
which Core writes itself, so a more specific provider code cannot accidentally
become retryable. No component renders `failureCode`; it reaches
`ai-operational-metrics.ts` as a label and the round's API response.

## Scope

- `ai-analytics-service/src/agents/graph.py` — `_provider_failure_code` and the
  one call that built the failure payload.
- `ai-analytics-service/tests/test_langgraph_flow.py` — the end-to-end
  assertion and a unit test for the code builder.
- `src/lib/server/__tests__/trigger-ai-analytics.test.ts` — a specific provider
  code must not re-arm.
- `ai-analytics-service/README.md`, `PROJECT_CONTEXT.md` (ADR-007) — both
  stated the flat `provider_unavailable`.

## Non-goals

- Any change to the manager-facing Hebrew copy.
- Any change to `generationProvenance.unavailableReason`, which is a different
  field about a single stone and keeps its two values.
- Items 5–7 of the findings file. They remain deferred by owner decision.

## Acceptance criteria

- A round that fails with no key reports
  `failureReason: provider_unavailable_missing_api_key`.
- A run that learned no reason still reports plain `provider_unavailable`.
- Every produced code satisfies Core's `isValidFailureCode`: `^[a-z0-9_]+$`,
  at most 64 characters.
- Python and TypeScript suites stay green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

ADR-007 in `PROJECT_CONTEXT.md` — provider failure is visible, not disguised.
The decision is unchanged; what changed is how precisely the code says it. No
versioned manifest or `contracts/capabilities.json` entry is touched.

## Decisions made

- Keep the `provider_unavailable` prefix. Anything grouping by category still
  groups, and the value stays greppable.
- Normalise the detail: lowercase, `[^a-z0-9]` to `_`, capped at 40 characters
  so the whole code fits Core's 64. Some reasons are exception class names and
  one is `http_<status>`; a metric label is a bad place for arbitrary text.
- Compose the code in `graph.py`, where the failure payload is built, rather
  than at the two nodes that write the state key.

## Assumptions

- The set of reasons stays small enough for a metric label. It is bounded by
  the transport's own vocabulary plus exception class names.

## Completed

- `_provider_failure_code` and its use in the provider-unavailable exit.
- Tests on both sides, documentation on both sides.
- The findings file: item 4 marked closed, status paragraph updated.

## In progress

None.

## Remaining

- Push onto `main`. This branch carries items 1, 2, 3 and 4.

## Changed files

Committed together with this file:

- `ai-analytics-service/src/agents/graph.py`
- `ai-analytics-service/tests/test_langgraph_flow.py`
- `ai-analytics-service/README.md`
- `src/lib/server/__tests__/trigger-ai-analytics.test.ts`
- `PROJECT_CONTEXT.md`
- `docs/ai-service-incidental-findings-2026-08-09.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- `.venv/bin/python -m pytest` from `ai-analytics-service` — 467 passed. The
  end-to-end case is real: no key configured, and the payload comes back
  `provider_unavailable_missing_api_key`.
- `npm test` — 739 passed.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npx tsx --test src/lib/server/__tests__/trigger-ai-analytics.test.ts` — 10
  passed, including the new non-re-arming code.

### Failed

None.

### Blocked or not run

- `npm run build`: not run. No application code changed on the Core side, only
  a test.
- Deployed verification: not run. No deployed round has produced one of the new
  codes.

### Environment

local

### Residual risk

The operational metric's `failureCode` label now takes more values than before.
The set is bounded by the transport's vocabulary, but a dashboard that
enumerated the old single value will need to group by prefix.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

Owner decision recorded above: carry the reason to Core rather than delete the
state key. No further gate.

## Questions requiring an owner decision

None.

## Next concrete step

Hand the push to the owner: `git push origin
feat/provider-failure-reason-reaches-core:main`, which lands items 1–4.
