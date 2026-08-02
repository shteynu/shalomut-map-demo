# Close the version-literal allowlist leak

## Metadata

- Branch: `refactor/version-literal-allowlist`
- Base branch: `origin/main`
- Base commit: `ae3c3c4`
- Current HEAD: merged into `main` by `1bca033`
- Status: complete, verified and merged into `main`
- Last updated: 2026-08-02
- Last agent/tool: Claude Code

## Objective

First slice of the track that finishes the v3 refactoring plan. Make the
architecture fitness function enforce what Definition of Done 12.2 actually
says: contract version literals live in the contract package, its schemas and
tests, and nowhere else.

## User-visible outcome

None. The produced payloads are byte-identical; only where the version is
written down changes.

## Context

`scripts/check-version-literals.mjs` exempted
`src/lib/services/analytics.service.ts`. A domain service spelling out a
contract version is the exact coupling the check exists to catch, so the gate
could not fail on the file whose literals mattered most. The service carried
`contractVersion: '2.0'` twice, on the locked and unlocked branches of
`calculateRoundAnalytics`.

The audit in section 6 of `docs/wellbeing-refactoring-plan-v4-review.md`
records this as the smallest independent slice of the unfinished plan.

## Scope

- Remove the analytics service from the allowlist.
- Give the calculator a typed constant from the contract package to use
  instead.
- Pin both the narrowed allowlist and the "stamped, not compared" literal shape
  in the gate's own tests.

## Non-goals

- Narrowing `AI_ANALYTICS_CONTRACT_VERSION` and its siblings from `string` to
  literal types. That would turn `AiAnalyticsContractVersion` into a real union
  and ripple through every consumer; it belongs with the contract-adapter work
  in stage 2, not here.
- The `AiContractDefinition` strategy interface and per-version adapters, which
  are the rest of stage 2.
- Anything in stages 3 to 5.

## Acceptance criteria

- `npm run lint:literals` passes with the analytics service scanned like any
  other file.
- Restoring either literal makes the gate exit non-zero.
- No behavior change: the same version value reaches the same payload field.

## Relevant repository instructions

`.agents/skills/shalomut-map/SKILL.md` (contract boundaries, immutable `1.0`
and `2.0` semantics) and the AI-TypeScript row of
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Contract `2.0` is immutable and untouched. `LEGACY_ANALYTICS_CONTRACT_VERSION`
holds the same value the v2 manifest declares, and an import-time check fails
the module if the two ever disagree — the pattern
`PRODUCIBLE_ANALYTICS_CONTRACT_VERSIONS` already uses in the same file.

## Decisions made

- The constant lives in `src/lib/ai-contract-version.ts`, which already owns
  version identity and is legitimately on the allowlist.
- It is typed as the literal `'2.0'` rather than reusing
  `AI_ANALYTICS_CONTRACT_VERSION` directly. That one comes from imported JSON
  and widens to `string`, which does not satisfy
  `RoundAnalyticsResult.contractVersion`.
- `isAllowedFile` is exported so the allowlist itself is testable. It was
  private, which is why the leak lived in the gate for as long as it did
  without a test noticing.

## Assumptions

- `src/lib/types/backend.ts` stays on the allowlist. It declares the wire
  types, which is the "schemas" clause of DoD 12.2.

## Completed

- `scripts/check-version-literals.mjs`: analytics service removed from
  `ALLOWED_FILES`, the list documented with the reason, `isAllowedFile`
  exported.
- `src/lib/ai-contract-version.ts`: added
  `LEGACY_ANALYTICS_CONTRACT_VERSION` with its manifest cross-check.
- `src/lib/services/analytics.service.ts`: both literals replaced by the
  constant.
- `scripts/check-version-literals.test.mjs`: two tests added — one for a
  version stamped into a payload rather than compared, one pinning exactly
  which files stay exempt.

## In progress

None.

## Remaining

Nothing in this task's scope. The track continues; see the next step below.

## Changed files

Committed as the single commit on `refactor/version-literal-allowlist`. The
branch is not pushed, so another worktree in this clone can consume it and
another checkout or machine cannot.

- Modified: `scripts/check-version-literals.mjs`,
  `scripts/check-version-literals.test.mjs`,
  `src/lib/ai-contract-version.ts`,
  `src/lib/services/analytics.service.ts`
- Unrelated, still unstaged and preserved: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

- `npm run verify:core`, exit code `0`: the fitness gate with its 5 self-tests,
  prisma generate, `next typegen && tsc --noEmit`, 324 TypeScript tests, ESLint
  and the production build.
- Red-before-green on the gate itself: restoring `contractVersion: '2.0'` in
  the analytics service makes `node scripts/check-version-literals.mjs` print
  the offending line and exit `1`; with the constant it exits `0`.
- Read the Python gate's allowlist for the same leak:
  `ai-analytics-service/scripts/check_version_literals.py` exempts only
  `src/contracts.py`, `src/schemas/contract_registry.py`,
  `src/schemas/mcp_types.py` and tests, so it has no domain-code exemption to
  remove.

### Failed

None.

### Blocked or not run

- `.venv/bin/python -m pytest`: not run. No Python file changed, and the Python
  gate ran unchanged inside `lint:literals`.
- `npm run verify:db`: not run. No Prisma schema, migration or repository
  changed.
- Browser smoke: not run. No component or route changed and no payload value
  differs.

### Environment

Local. `origin/main` at `ae3c3c4`.

### Residual risk

- Section 6 of `docs/wellbeing-refactoring-plan-v4-review.md`, on the
  `docs/refactoring-plan-status` branch, lists this allowlist leak as open.
  Merging both branches makes that sentence stale and it should be updated in
  the same pass.
- The gate is still a regex over source text. It catches literals and named
  constants in comparisons; a version reached through a computed property or a
  helper would pass. Ports and canonical models are what actually remove the
  need for it, not a stricter regex.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. Archived after merge into `main` at `1bca033`; the follow-up
`fix/selective-safety-repair` was merged immediately afterward.
