# The order of question IDs is not part of the contract

## Metadata

- Branch: `test/question-id-order-is-not-a-rule`
- Base branch: `main`
- Base commit: `2048f42`
- Current HEAD: `b780cc2`
- Status: ready to land
- Last updated: 2026-09-06
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Pin the rule that every provenance validator already implements and no test
held: the question IDs a stone reports are a set, so a provider may list them
in any order.

## User-visible outcome

None directly. The change protects an accepting behaviour: a callback whose
metrics or `sourceQuestionIds` arrive in a different sequence must still be
accepted, and a future refactor must not turn that into a refusal.

## Context

A full mutation run on 2026-09-06 (1273 mutants, 95.29%, 52 survivors) reported
survivors on two rules of the provenance validators.

Three of them delete a `.sort()` from a comparison of question IDs: every
fixture in the suite happened to build its metrics and its `sourceQuestionIds`
in the same already-sorted order, so no test could tell a sorted comparison from
an unsorted one.

One more, on `2.0`, turns "does any of them differ?" into "do all of them
differ?". A refusal test for that rule already existed — it substitutes one
foreign ID — but the substitute it chose sorts to the front and shifts every
position, and a shifted list is refused by both comparisons. Only a partial
mismatch separates them.

The same run also reported three survivors on the rule "a stone's metrics carry
no duplicate question ID". Those turned out to be equivalent mutants — see
`Decisions made`.

## Scope

- One new accepting test file covering contracts `3.0` and `5.0`.
- One refusal case added to the existing `2.0` provenance test.
- The `tap.testFiles` entry that puts the new file in the mutation denominator.

## Non-goals

- Widening mutation scope to a second subject.
- Any change to `src/lib/ai-contract.ts` itself. The validators were already
  correct; only the tests were blind.
- A mutation score threshold in CI, which stays closed per `ROADMAP.md`.

## Acceptance criteria

- The reordering payloads are accepted and the partial-mismatch payload is
  refused.
- The four killable mutants of the two rules are killed by the next full
  mutation run.
- `npm run lint:mutation-config` passes with the new file listed.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/references/mutation-testing.md` — the
  test list is re-derived, not hand-maintained; a full run is the only evidence
  of test strength.
- `.agents/skills/shalomut-map/SKILL.md` — published contracts `1.0`–`6.0` keep
  their semantics; this task adds no rule and changes none.

## Relevant architecture and contracts

`isValidGenerationProvenance` (`2.0`), `isValidV3GenerationProvenance` (`3.0`,
and `4.0` through it) and `isValidV5GenerationProvenance` (`5.0` and `6.0`)
each compare the IDs a stone's provenance names against the IDs its metrics
carry, sorting both sides first.

## Decisions made

- **One order mutant is equivalent and gets no test.** The `2.0` validator's
  expected side comes from the canonical questions of a dimension, named
  `<dimension>-1` to `-3`, so that list is sorted the moment it is built and
  removing its `.sort()` changes nothing. An equivalent mutant is a fact about
  the code, not a missing test.
- **`2.0` needed no reordering case.** Its provenance test already ends with
  one; only `3.0` and `5.0` were blind.
- **The three duplicate-metric survivors are equivalent too, and no test was
  written for them.** A stone whose metrics repeat a question ID can never
  satisfy its own provenance: the provenance requires as many distinct
  `sourceQuestionIds` as there are metric IDs *and* an element-wise match with
  the sorted metric IDs, and a list of distinct values cannot match a list with
  a repeat. So the duplicate-metric guard is already implied, in all three of
  `isValidV3Stone`, `isValidV5Stone` and `isValidV6Stone`. The guard stays —
  it states the rule locally and survives any future change to provenance — but
  it cannot be killed from the payload side.
- **The accepting cases share a file, the refusal stays where refusals live.**
  "Order is not a rule" spans two validators and is one rule, so `3.0` and `5.0`
  sit together in a file named for it. The `2.0` partial mismatch is a refusal
  and belongs in the suite that already holds every other `2.0` refusal, beside
  the case it corrects.

## Assumptions

- `6.0` needs no case of its own: it travels `isValidV5GenerationProvenance`,
  which the `5.0` case already covers, and its fixture carries one metric per
  stone, where order cannot be expressed.

## Completed

- `src/lib/__tests__/ai-contract-question-id-order.test.ts` — two accepting
  cases, `3.0` and `5.0`.
- `src/lib/__tests__/ai-contract-legacy-refusals.test.ts` — one refusal case in
  the existing `2.0` provenance test: a single wrong ID that still sorts last.
- `stryker.config.mjs` — the new file added to `tap.testFiles` with the comment
  saying what it covers.

## In progress

None.

## Remaining

None. The branch is ready to land.

## Changed files

All three are committed in `b780cc2`; nothing is staged or unstaged for this
task, and `next-env.d.ts` carries an unrelated local modification that belongs
to no commit here.

- `src/lib/__tests__/ai-contract-question-id-order.test.ts` (new)
- `src/lib/__tests__/ai-contract-legacy-refusals.test.ts` (modified)
- `stryker.config.mjs` (modified)

## Verification evidence

### Passed

- `npx tsx --test` on the new file and on `ai-contract-legacy-refusals.test.ts`
  — 50/50 pass, exit 0.
- `npm test` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm run lint:mutation-config` — exit 0, 14 test files for 2 mutated modules.
- `npm run lint:contract-refusals` — exit 0, 3 suites cover 5 validation paths
  across 6 contract versions.
- `npm run test:mutation:ai-contract` — 1273 mutants, 95.61% (was 95.29%), 48
  survivors (was 52), 6 no-coverage, 42 runtime errors. The four targeted
  mutants are `Killed`; the survivors named in `Decisions made` remain, as
  predicted.

### Failed

None.

### Blocked or not run

- `npm run build`: not run. No application-graph file changed; `typecheck`
  covers the test files that `build` would not see.
- Browser and Python checks: not run, and not selected by the matrix for a
  test-only diff.

### Environment

local

### Residual risk

The duplicate-metric guard is unprovable from the payload side. If provenance
validation is ever loosened, that guard becomes the only thing enforcing the
rule and nothing will notice if it is removed at the same time.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
aliases are touched.

## Questions requiring an owner decision

None.

## Next concrete step

Land the branch: `git push origin test/question-id-order-is-not-a-rule:main`.
That command is the owner's to run. Until it does, this work is visible only in
this worktree's branch — the branch has never been pushed.
