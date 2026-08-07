# The closed contracts get the refusing half of their tests

## Metadata

- Branch: test/legacy-contract-refusals
- Base branch: main
- Base commit: a7b6c13
- Current HEAD: f48e616
- Status: complete and verified, committed locally, unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give contracts `1.0`, `2.0` and `3.0` the negative tests they never had, so a
mutant cannot delete one of their validator rules and keep the suite green.

## User-visible outcome

None. Test-only; `src/lib/ai-contract.ts` is unchanged.

## Context

The 2026-08-03 classification
(`docs/agent-tasks/archive/test--classify-surviving-mutants.md`) wrote one
refusal test per rule for `6.0` and left the older versions alone, concluding
that their survivors were a missing-fixture problem: every fixture in the suite
was a V6 payload.

That has since stopped being true — `contracts/fixtures/callback_corpus.json`
carries `1.0`–`4.0` payloads as of 2026-08-05 — and the survivors stayed. The
report from 2026-08-05 still showed ~90 survivors in the two generation-
provenance validators, 28 in `hasValidStoneShape` and 21 uncovered mutants in
`isLegacyMetric`. So the remaining diagnosis was the same one the V6 work
fixed: the older contracts were tested only from the accepting side.

`isLegacyMetric`'s zero coverage had a second, simpler cause: the only valid
`1.0` payload in the suite (`ai-contract.test.ts`) carries `metrics: []` and
`recommendedInterventions: []`, so `.every()` short-circuits and neither
validator is ever entered.

## Scope

Negative tests for the validators of contracts `1.0`–`3.0`, the valid payload
fixtures they need, and the mutation config entry for the new suite.

## Non-goals

- No change to `src/lib/ai-contract.ts`. A survivor is a statement about the
  tests, not a defect in the validator.
- No second mutation target. Widening `mutate` beyond the AI-contract validator
  stays conditional in `ROADMAP.md`.
- No CI threshold. `thresholds.break` stays `null` for the reasons `ROADMAP.md`
  records.
- No `4.0`/`5.0` refusal suite. That is the natural next slice, not this one.

## Acceptance criteria

All met:

- Every rule the `1.0`–`3.0` validators enforce has a test proving a payload
  breaking it is refused.
- The mutation report shows the legacy validators' survivors gone, not merely
  a higher number.
- `npm run lint:mutation-config` passes with the new file listed.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md`: a test file whose subject is
  a mutated module belongs in `tap.testFiles`, and the list is re-derived by
  `npm run lint:mutation-config` rather than trusted.
- `AGENTS.md`: closed contracts `1.0`–`6.0` do not change semantics silently.

## Relevant architecture and contracts

`validateStoneMapResult` dispatches per version through
`contracts/capabilities.json`: `1.0` is structural (`isValidLegacyStone`),
`2.0` is the first semantic one (`isValidV2Stone`, canonical questions),
`3.0` carries the round's own questionnaire (`isValidV3Stone`, provenance bound
to `surveyDefinitionHash`). All six versions remain in
`AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS`, so these are live paths.

## Decisions made

- **The valid payloads live in `fixtures/legacy-payloads.ts`,** beside
  `v6-payload.ts` and for the same reason: importing a builder from a test
  module would re-run that module's tests in every borrowing suite.
- **The `1.0` fixture carries real metrics and interventions.** The existing
  empty-array payload is what kept `isLegacyMetric` at zero coverage.
- **Accepting cases are included where the rule has two sides** — range ends
  (score `0` and `100`), a deterministic fallback that never called the model,
  two attempts with one retry, reordered `sourceQuestionIds`. Without them the
  boundary and equality mutants survive, and a suite that only refuses would
  pass a validator that refuses everything.
- **Some survivors are left alive deliberately.** They are shadowed by a
  stronger rule downstream and cannot be reached through the public validator:
  the uniqueness check in `isValidV3Stone` (provenance rejects duplicate
  question IDs first), `typeof value.score === 'number'` in
  `hasValidStoneShape` (`Number.isFinite` already refuses non-numbers), and the
  `.sort()` calls in `isValidGenerationProvenance` (the canonical question IDs
  are already in sorted order). Writing tests for these would mean testing the
  mutant, not the rule.

## Assumptions

- Contracts `1.0`–`3.0` remain accepted on the callback path. Taken from
  `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` and `contracts/capabilities.json`.

## Completed

- `src/lib/__tests__/fixtures/legacy-payloads.ts`: valid `1.0`, `2.0` and `3.0`
  payload builders.
- `src/lib/__tests__/ai-contract-legacy-refusals.test.ts`: 48 tests.
- `stryker.config.mjs`: the new suite added to `tap.testFiles`.
- `PROGRESS.md` and `ROADMAP.md`: the mutation numbers and the widening
  precondition, which named a blind spot that no longer describes the report.

## In progress

- Nothing.

## Remaining

- Owner action only: commit is local; `git push origin
  test/legacy-contract-refusals:main` is the owner's to run.

## Changed files

Two new test-side files, `stryker.config.mjs`, `PROGRESS.md`, `ROADMAP.md` and
this task file. `.idea/shalomut-map-demo.iml` and `next-env.d.ts` were already
modified in the worktree before this task and are left alone.

## Verification evidence

### Passed

- `npx tsx --test src/lib/__tests__/ai-contract-legacy-refusals.test.ts` —
  48/48.
- `npm run verify:core` — exit 0: 694 TypeScript tests, both fitness checks
  (including `lint:mutation-config`, which re-derived 12 test files for 2
  mutated modules), typecheck, ESLint and the production build.
- `npm run test:mutation:ai-contract` — two full runs, each exit 0:

  | Run | Killed | Survived | No coverage | Errors | Total |
  | --- | --- | --- | --- | --- | --- |
  | baseline (2026-08-05, `PROGRESS.md`) | 871 | 275 | 67 | 42 | 71.81% |
  | first pass | 1062 | 131 | 20 | 42 | 87.55% |
  | second pass | 1093 | 101 | 19 | 42 | 90.11% |

  The legacy validators specifically: `isLegacyMetric` 21 uncovered → 0,
  `isLegacyIntervention` 16 → 0, `hasValidStoneShape` 28 → 1,
  `isValidGenerationProvenance` 41 → 2, `isValidV3GenerationProvenance` 36 → 5,
  `isValidQuestionMetric` 19 → 1.

### Failed

- None.

### Blocked or not run

- `npm run verify:db`, `verify:ai` and the Python suite — not run. The diff is
  two test-side files, the mutation config and documentation: no repository,
  schema, route, contract manifest or Python change.
- Browser smoke — not applicable, nothing user-visible changed.

### Environment

Local.

### Residual risk

Low. Nothing in the runtime path changed. The remaining survivors now sit
mostly in the `5.0`/`6.0` stone rules and in the payload-level helpers
(`isValidV5GenerationProvenance` 15, `validateStoneMapResult` 13,
`isValidV5Stone` 12, `validateInterpretationGaps` 10), which this slice did not
set out to cover.

## Failed approaches

- None. Two cases written in the first pass turned out to be shadowed by a
  downstream rule — an empty `metrics` array and duplicate question IDs are
  both refused by the provenance comparison before the rule under test is
  reached — so the second pass added the variants that reach the rule.

## Known risks

- The mutation score is not a gate and should not become one; the reasons are
  in `ROADMAP.md` and unchanged by this task.

## Approval gates

- None beyond the standing one: pushing is the owner's action.

## Questions requiring an owner decision

- None.

## Next concrete step

Commit the six files and hand the push to the owner:
`git push origin test/legacy-contract-refusals:main`.
