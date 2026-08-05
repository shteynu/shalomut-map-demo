# Refreshing the mutation baseline after three months of drift

## Metadata

- Branch: `test/refresh-mutation-baseline`
- Base branch: `main`
- Base commit: `297e259` (also `origin/main` and the tip of
  `docs/tip-pointer-closeout`)
- Final commits: `d1d2999`, `6605636`, `fa9fc20`, `74d60c2`, `7a08293` and
  `d1a8899`, all on `main`.
- Status: complete and archived
- Last updated: 2026-08-05
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Make the mutation pilot measure what it claims to measure again. The baseline
was taken on 2026-08-03; since then the mutated file gained rules, one of its
rules moved to another file, and two test files that exercise it were never
added to the runner's list.

## User-visible outcome

None. Test, config and documentation only; no validator behaviour changes.

## Context

- The pilot is `docs/agent-tasks/archive/test--mutation-testing-pilot.md`; the
  survivor classification that produced the refusal suite is
  `docs/agent-tasks/archive/test--classify-surviving-mutants.md`.
- Baseline recorded there on 2026-08-03: 1137 mutants, 787 killed, 281
  survived, 67 no coverage, 2 runtime errors, 69.34% total.
- Between then and now `src/lib/ai-contract.ts` gained roughly 100 lines of new
  rules — `unavailableReason`, `metricInsightsOutcome` and the empty-overview
  gap rule — and lost `statusForScore` to `src/lib/scoring-bands.ts`.

## Scope

The mutation configuration, the one contract test whose name stopped matching
the contract, and the documents that state the pilot's scope and score.

## Non-goals

- No change to `src/lib/ai-contract.ts` or `src/lib/scoring-bands.ts`. A
  survivor is a statement about the tests, not a defect in the subject.
- No payload fixtures for contracts `1.0`–`4.0`. That is still the separate
  deliverable the ROADMAP holds the widening behind.
- No CI gate and no threshold. `thresholds.break` stays `null`.

## Acceptance criteria

- Every test file whose subject is a mutated file is in `tap.testFiles`.
- The score/status rule is measured wherever it lives.
- No test asserts a rule the contract no longer has.
- A fresh baseline is recorded, with killed, survived, no-coverage and
  runtime-error mutants separated.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md` — the mutation section, which
  this task extends with the "move `mutate` with the rule" line.
- `AGENTS.md` — branch-scoped task state, documentation lifecycle.

## Decisions made

- **`src/lib/scoring-bands.ts` joins `mutate`.** `8e1906e` moved
  `statusForScore` out of the validator for a good reason — Core and Python
  read one manifest — but the rule left the measurement with it. Following a
  rule into its new home keeps one subject whole. It is not the second-subject
  widening `ROADMAP.md` holds behind the legacy-fixture precondition, and that
  entry now says so explicitly.
- **The `testFiles` list is re-derived, not maintained.** It drifts by
  omission every time a test lands outside `src/lib/__tests__`. The config
  comment and the skill both name the grep that rebuilds it.
- **The stale refusal test was replaced, not deleted.** Its subject — the
  relationship between an empty overview and the outcome that explains it — is
  a live rule; only its direction was wrong.

## Assumptions

- `contract-3-staging-dryrun.test.ts` needs no database or environment: it was
  run standalone (4/4) before being added to the runner's list.

## Completed

- `d1d2999` — `tap.testFiles` gains `ai-contract-v5-smoke.test.ts` and
  `services/__tests__/contract-3-staging-dryrun.test.ts`, both of which call
  `validateStoneMapResult` directly.
- `6605636` — `src/lib/scoring-bands.ts` joins `mutate`,
  `scoring-bands.test.ts` joins `tap.testFiles`, and `ROADMAP.md` plus the
  verification skill record what the pilot's scope now is and why.
- `fa9fc20` — `ai-contract-payload-refusals.test.ts` replaces "a V6 stone may
  not report that it has no interpretation", a ban lifted by `8b75754`, with
  the untested half: an empty overview beside an outcome claiming copy was
  written.
- `74d60c2` — `scoring-bands.test.ts` refuses a band that is not an object.
  The first run over the bands found that branch reached by no test at all.
- The score/status refusal now moves the recommendations with the stone, so
  the payload carries exactly the disagreement the test is named after. A
  mutant deleting the score/status check outright had survived it.

## Findings

- **The two omissions cost 10 survivors and nothing else changed.** With the
  test list corrected and the stale refusal rewritten, `ai-contract.ts` went
  from 787/281/67 to 821/271/67 while gaining 24 mutants from the new rules.
- **The new 6.0 rules are pinned.** `isValidUnavailableReason` — 14 mutants,
  all killed. `isValidMetricInsightsOutcome` — 15 killed, 1 survivor and 1
  uncovered, both on the `isRecord` guard that every caller has already
  passed. The empty-overview gap rule — 54 killed, and the survivors around it
  are guards that a second rule refuses first.
- **40 of the bands' 94 mutants cannot get a verdict.** `SCORING_BANDS` is
  built at import, so any mutant that makes `loadScoringBands` throw takes the
  whole test process down and Stryker records a runtime error, which the score
  excludes. They are detected — loudly — but not counted, which is why the
  bands read 90.74% over 54 mutants rather than over 94.
- **Five bands survivors remain**, all classified and none worth a test: two
  are error-message prose, one is a `typeof` guard the loader re-checks, one
  is the `manifest` truthiness disjunct that `typeof` covers, and one is
  `band.min > band.max` weakened to `>=`, which only differs for a
  single-score band. Whether a band may cover one score is a methodology
  question, not a test gap.
- **The 67 uncovered mutants in `ai-contract.ts` are unchanged** and still sit
  in the `1.0`–`4.0` validators. The ROADMAP precondition is untouched by this
  task.

## In progress

- Nothing.

## Remaining

- Nothing. Pushed to `main` on 2026-08-05; GitHub run `30996388155` passed.

## Changed files

`stryker.config.mjs`, `src/lib/__tests__/ai-contract-payload-refusals.test.ts`,
`src/lib/__tests__/scoring-bands.test.ts`, `ROADMAP.md`, `PROGRESS.md`,
`.agents/skills/shalomut-verification/SKILL.md`, this file.

## Verification evidence

### Passed

- `npx tsx --test src/lib/__tests__/ai-contract-v5-smoke.test.ts` — 1/1;
  `src/lib/services/__tests__/contract-3-staging-dryrun.test.ts` — 4/4;
  `src/lib/__tests__/scoring-bands.test.ts` — 8/8. Run standalone before the
  three were wired into the mutation config.
- `npx tsx --test src/lib/__tests__/ai-contract-payload-refusals.test.ts` —
  22/22 after the rewritten test.
- `npx tsx --test src/lib/__tests__/scoring-bands.test.ts` — 9/9 after the
  non-object band case.
- `npm run test:mutation:ai-contract -- --dryRunOnly` — twice, exit 0: 1161
  mutants over one file with the corrected `testFiles`, then 1255 over two
  files with the bands added.
- `npm run test:mutation:ai-contract` — three full runs, each exit 0:

  | Run | Killed | Survived | No coverage | Errors | Total |
  | --- | --- | --- | --- | --- | --- |
  | 2026-08-03 baseline, one file | 787 | 281 | 67 | 2 | 69.34% |
  | config fixed, bands added, stale refusal rewritten | 863 | 281 | 69 | 42 | 71.15% |
  | after the non-object band case | 870 | 276 | 67 | 42 | 71.72% |
  | after the score/status case was made to prove its rule | 871 | 275 | 67 | 42 | 71.81% |

  Final per file: `ai-contract.ts` 822/270/67/2 over 1161 mutants (70.92%);
  `scoring-bands.ts` 49/5/0/40 over 94 mutants (90.74%).

- `npm run verify:core` — exit 0: `lint:literals`, `lint:composition`,
  `typecheck`, the full TypeScript suite, `lint` and the production build.

### Failed

### Blocked or not run

- `npm run verify:db` and `npm run verify:ai` — the diff is one test file, the
  mutation config and documentation; no repository, schema, route or Python
  change.
- Browser smoke — not applicable.

### Environment

Local.

### Residual risk

- 275 survivors and 67 uncovered mutants remain, classified but not killed.
  The largest block is still the `1.0`–`4.0` validators no fixture exercises.
- Nothing enforces the `testFiles` list. It drifted twice in three months and
  will drift again; the grep is documented in the config and the skill, and
  that is the whole mechanism.
- The bands' 40 runtime-error mutants stay invisible to the score for as long
  as `SCORING_BANDS` is a module-level constant. Making them countable would
  mean changing the module for the benefit of the measurement, which is not a
  trade this task takes.

## Failed approaches

- None.

## Known risks

- The `testFiles` list will drift again. The grep is written down in two
  places, but nothing enforces it.

## Approval gates

- None. Push is an owner action.

## Questions requiring an owner decision

- None.

## Next concrete step

None. The task is closed; the mutation pilot's living state is `ROADMAP.md`,
`PROGRESS.md` and `stryker.config.mjs`.
