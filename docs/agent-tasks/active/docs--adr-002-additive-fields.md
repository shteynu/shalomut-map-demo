# ADR-002 gains an additive-field clause

## Metadata

- Branch: `docs/adr-002-additive-fields`
- Base branch: `main`
- Base commit: `55d1eea`
- Current HEAD: `55d1eea` (nothing committed yet)
- Status: in progress
- Last updated: 2026-08-05
- Last agent/tool: Claude Code

## Objective

Close the open owner decision left by the two amendments published contract
`6.0` took on 2026-08-04. ADR-002 said released semantics do not change; the
amendments changed nothing but added two optional fields. Either ADR-002 states
when that is allowed, or `7.0` is opened.

## User-visible outcome

None. This is a documented rule, not behaviour. No code, schema or payload
changes.

## Context

`supportsPartialMaps` (a capability flag) and
`generationProvenance.unavailableReason` (a gap's cause) were added to `6.0` on
2026-08-04, both recorded in ADR-007 and both already deployed. The handoff
carried the resulting rule conflict as an open gate.

The decision matters beyond bookkeeping: the next AI item — per-narrative
generation provenance, so a stone cannot show model-written paragraphs beside
fallback metric narratives with no label — is exactly the same shape.
Without the clause it waits for `7.0`.

## Scope

- `PROJECT_CONTEXT.md` ADR-002: the clause and its conditions.
- `docs/ai-contract-version-matrix.md`: the operational form, plus the
  `unavailableReason` entry the document never recorded.
- `PROGRESS.md` and `docs/shalomut-tracker-handoff.md`: the item moves from open
  to settled.

## Non-goals

- Opening `7.0`.
- Building per-narrative provenance. It is now unblocked, not started.
- Changing any validator, manifest or payload.

## Acceptance criteria

- ADR-002 states what may be added to a published contract and what may not.
- The rule names the technical property it depends on, so a future change that
  removes that property is recognisable as revoking it.
- No living document still calls the `6.0` amendments a violation.

## Relevant repository instructions

`AGENTS.md` documentation lifecycle: current code outranks prose, and a living
document that disagrees is updated in the same task.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-002 and ADR-007; `contracts/ai-analytics-v6.json`;
`contracts/capabilities.json`; `src/lib/ai-contract.ts`.

## Decisions made

- Owner decision 2026-08-05: amend ADR-002 rather than open `7.0`.
- The clause admits **optional additive fields only**, on five conditions:
  absence keeps the version's prior meaning; no existing field changes type,
  meaning or requiredness and nothing is removed; a consumer written before the
  field keeps working; the addition is recorded in manifest, matrix and owning
  ADR; the sequence stays consumer-first.
- The clause names its own load-bearing property — validation checks known
  fields without enumerating keys — so a validator that starts rejecting unknown
  keys revokes the rule rather than silently invalidating it.

## Assumptions

None that verification did not settle.

## Completed

- ADR-002 amended in `PROJECT_CONTEXT.md`.
- `docs/ai-contract-version-matrix.md`: new "Amending a published version"
  section, the missing `unavailableReason` paragraph under `6.0`, date bumped.
- `PROGRESS.md`: the AI-analytics open list drops from two items to one; the
  per-narrative gap now records that the clause makes it amendable.
- `docs/shalomut-tracker-handoff.md`: the gate is marked settled; the stale
  `origin/main` value `260e84e` corrected to `55d1eea`.

## In progress

Nothing.

## Remaining

Commit, then the owner pushes.

## Changed files

- `PROJECT_CONTEXT.md`
- `PROGRESS.md`
- `docs/ai-contract-version-matrix.md`
- `docs/shalomut-tracker-handoff.md`
- `docs/agent-tasks/active/docs--adr-002-additive-fields.md` (new)

## Verification evidence

### Passed

- Read-only check of the claim the rule rests on: `src/lib/ai-contract.ts`
  validates by field presence and shape (`isValidUnavailableReason`,
  `isValidV5GenerationProvenance`) and never enumerates payload keys. No
  `additionalProperties` in any `contracts/*.json`, and no pydantic `extra=` or
  zod `.strict()` anywhere in the repository — so an unknown field is ignored on
  both sides rather than rejected.
- Both amendments are recorded in machine sources as the clause requires:
  `supportsPartialMaps` in `contracts/capabilities.json` (true for `5.0` and
  `6.0`), `unavailableReason` in `contracts/ai-analytics-v6.json`.

### Failed

None.

### Blocked or not run

- `npm run verify:core`, `verify:db`, `verify:ai` were not run. The diff is
  Markdown only — no source, schema, migration, manifest or test file changed.

### Environment

Local worktree, no database or service touched.

### Residual risk

Low, and it is a rule risk rather than a code risk: the clause widens what may
change in a published contract. It is bounded by the five conditions and by
consumer-first sequencing staying mandatory.

## Failed approaches

None.

## Known risks

A future validator that rejects unknown keys would break the rule's premise.
ADR-002 says so explicitly, which is the mitigation.

## Approval gates

None. Unrelated worktree changes — `.idea/shalomut-map-demo.iml` and
`next-env.d.ts` — are untouched and stay unstaged.

## Questions requiring an owner decision

None open on this branch.

## Next concrete step

Push the branch to `main`; the agent cannot push in this environment:

```bash
git push origin docs/adr-002-additive-fields:main
```
