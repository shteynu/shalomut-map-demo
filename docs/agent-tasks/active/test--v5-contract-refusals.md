# Contract 5.0 gets the refusing half of its tests

## Metadata

- Branch: test/v5-contract-refusals
- Base branch: test/legacy-contract-refusals (not yet on `main`)
- Base commit: cf29f93
- Current HEAD: see `Remaining`; work committed on this branch
- Status: complete and verified, committed locally, unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Give contract `5.0` the negative tests it never had, so a mutant cannot delete
the distribution check, the adaptation outcome or the partial-map rule and keep
the suite green.

## User-visible outcome

None. Test-only; `src/lib/ai-contract.ts` is unchanged.

## Context

Two slices closed the same gap for other versions: `6.0` on 2026-08-03, and
`1.0`–`3.0` on 2026-08-07 (`test--legacy-contract-refusals.md`, this branch's
base). After the second, the largest remaining survivor blocks were `5.0`'s:
`isValidV5GenerationProvenance` 15, `isValidV5Stone` 12,
`validateInterpretationGaps` 10, `validateStatusFields` 9. `5.0` had payloads
that pass and almost nothing proving an invalid one is refused.

`4.0` needed no slice of its own: `contracts/capabilities.json` gives it
`supportsScoreDistribution: false`, so it validates through `isValidV3Stone` —
the path the previous slice already pinned.

## Scope

Negative tests for what `5.0` adds or tightens — the echoed score
distribution, the per-recommendation adaptation outcome, the two-to-five
sentence interpretation, the partial map and its gap reasons — plus the
payload-level rules a `5.0` payload exercises on the way through
(`validateStatusFields`, the eight-dimension taxonomy, `processedAt`).

## Non-goals

- No change to `src/lib/ai-contract.ts`.
- No `6.0` narrative-shape work. The paragraph and sentence helpers
  (`hasExactlyThreeHebrewParagraphs`, `hasTwoToFourCompleteSentences`) were
  left alone on purpose on 2026-08-03: pinning them freezes the regex
  segmentation rather than a product rule.
- No second mutation target and no CI threshold. Both stay as `ROADMAP.md`
  records them.

## Acceptance criteria

All met:

- Every rule `5.0` adds has a test proving a payload breaking it is refused.
- The rules with two sides have the accepting side too.
- `npm run lint:mutation-config` passes with the new file listed.

## Relevant architecture and contracts

`5.0` capabilities: `supportsScoreDistribution`, `supportsPartialMaps`,
`supportsAdaptationOutcome` and `hasOverallSummarySentenceLimit` all true, and
`usesNarrativeMetrics` false — which is why a `5.0` provenance carrying
`metricInsightsOutcome` is refused rather than ignored.

## Decisions made

- **The fixture carries two metrics per stone.** The rules worth breaking are
  about sets — the question IDs a stone reports, the IDs provenance names, the
  dimensions a partial map declares — and a one-element set hides the
  difference between `every` and `some`. `ai-contract-v5.test.ts` builds a
  one-metric payload, which is part of why these mutants survived it.
- **A partial map is built by one helper**, `createPartialV5Payload`. A gap is
  three coordinated facts — the outcome, the empty interpretation and the list
  on the payload — and a fixture producing one without the others would only
  prove that the validator refuses an inconsistent payload.
- **Some survivors are left alive deliberately**, because no payload can reach
  them through the public validator:
  - `isValidScoreDistribution`'s two `Number.isInteger` checks. A single
    fractional band cannot coexist with a sum that equals an integer response
    count, so the sum rule refuses first.
  - the length and uniqueness checks in `isValidV5GenerationProvenance` and
    `isValidV5Stone`, and the two `.sort()` calls: the member-by-member
    comparison that follows already refuses everything they would.
  - the first `?.` in `validateInterpretationGaps`, on a stone the validator
    has already proven exists.

## Assumptions

- `4.0` and `5.0` remain accepted on the callback path. Taken from
  `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` and `contracts/capabilities.json`.

## Completed

- `src/lib/__tests__/fixtures/v5-payload.ts`: a valid `5.0` payload and a
  partial-map builder.
- `src/lib/__tests__/ai-contract-v5-refusals.test.ts`: 28 tests.
- `stryker.config.mjs`: the new suite in `tap.testFiles`.
- `PROGRESS.md` and `ROADMAP.md`: the numbers and what is left unmeasured.

## In progress

- Nothing.

## Remaining

- Owner action only: two branches are waiting locally. Either push them in
  order — `test/legacy-contract-refusals` first, since this branch contains it
  — or push this one alone, which carries both slices:
  `git push origin test/v5-contract-refusals:main`.

## Changed files

Two new test-side files, `stryker.config.mjs`, `PROGRESS.md`, `ROADMAP.md` and
this task file. `.idea/shalomut-map-demo.iml` and `next-env.d.ts` were modified
in the worktree before either slice began and are left alone.

## Verification evidence

### Passed

- `npx tsx --test src/lib/__tests__/ai-contract-v5-refusals.test.ts` — 28/28.
- `npm run verify:core` — exit 0: 722 TypeScript tests, both fitness checks
  (`lint:mutation-config` re-derived 13 test files for 2 mutated modules),
  typecheck, ESLint and the production build.
- `npm run test:mutation:ai-contract` — two full runs, each exit 0:

  | Run | Killed | Survived | No coverage | Errors | Total |
  | --- | --- | --- | --- | --- | --- |
  | this branch's base | 1093 | 101 | 19 | 42 | 90.11% |
  | first pass | 1136 | 71 | 6 | 42 | 93.65% |
  | second pass | 1140 | 67 | 6 | 42 | 93.98% |

  The `5.0` validators specifically: `isValidV5GenerationProvenance` 15 → 3,
  `isValidV5Stone` 12 → 1, `validateInterpretationGaps` 10 → 4,
  `validateStatusFields` 9 → 0.

### Failed

- None.

### Blocked or not run

- `npm run verify:db`, `verify:ai` and the Python suite — not run. The diff is
  two test-side files, the mutation config and documentation: no repository,
  schema, route, contract manifest or Python change.
- Browser smoke — not applicable.

### Environment

Local.

### Residual risk

Low; nothing in the runtime path changed. What remains unpinned is `6.0`'s
narrative shape (`isValidV6Stone` 9, `hasExactlyThreeHebrewParagraphs` 8), the
error-message string literals in `validateStoneMapResult`, and the handful of
comparisons named under `Decisions made` that no payload can reach.

## Failed approaches

- Three cases in the first pass were shadowed by a stronger rule and killed
  nothing: a fragment after two sentences (refused by the sentence count before
  the completeness rule), a declared gap list of the wrong length (refused by
  the length check before the member comparison), and a single fractional band
  (refused by the sum). The second pass replaced the first two with variants
  that reach the rule and left the third documented as unreachable.

## Known risks

- The mutation score is not a gate and should not become one; `ROADMAP.md`
  records why, and this task does not change that.

## Approval gates

- None beyond the standing one: pushing is the owner's action.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the push to the owner:
`git push origin test/v5-contract-refusals:main`.
