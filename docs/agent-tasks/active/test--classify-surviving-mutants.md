# Classifying the surviving AI-contract mutants

## Metadata

- Branch: `test/classify-surviving-mutants`
- Base branch: `docs/single-manager-identity-decision` (itself a fast-forward
  descendant of `main` @ `d588b97`)
- Base commit: `6504838`
- Current HEAD: the commits on this branch
- Status: complete
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Close the last open architecture item: classify the surviving mutants of the
`src/lib/ai-contract.ts` pilot, so the decision to widen mutation scope rests on
what the survivors mean rather than on a score.

## User-visible outcome

None. Test-only; the validator itself is unchanged.

## Context

- The pilot (`6d42f4c`, archived as `test--mutation-testing-pilot.md`) left 350
  survivors and 98 uncovered mutants explicitly unclassified, and warned that
  the baseline must not become a score gate.
- Re-running it on current `main` gave 1137 mutants: 681 killed, 356 survived,
  98 no coverage, 2 runtime errors — 60.00% total, 65.67% covered.

## Scope

Classification, the two fixes it justified, and the documentation of both.

## Non-goals

- No change to `src/lib/ai-contract.ts`. A survivor is a statement about the
  tests, not a defect in the validator.
- No second mutation target and no CI gate. Both stay conditional.
- No attempt to reach a score number. Killing a mutant that stands for nothing
  buys a metric, not a guarantee.

## Acceptance criteria

All met:

- Every survivor is accounted for by category, with the reason it survives.
- The high-value ones are killed by tests that name product rules.
- The condition for widening scope is written down and is not "the score
  improved".

## Findings

### 1. The config, not the tests, produced the largest block of survivors

`stryker.config.mjs` listed five test files. Sixteen import `ai-contract`, and
two of the omitted ones — `hebrew-only-corpus.test.ts` and
`callback-corpus-parity.test.ts` — call `validateStoneMapResult` and
`isHebrewOnlyUserText` directly. They are the mutated file's own tests.

The effect was not a slightly low score. It was that
**`isHebrewOnlyUserText` looked completely untested**: six mutants that delete
the non-Hebrew-letter loop, invert its condition or flip its `return false`
all survived — the exact P1 regression closed on 2026-08-02 by writing that
corpus. A reader of the report would have concluded the rule needed tests it
already had.

Adding the two files: 681 → 710 killed, 356 → 341 survived, 98 → 84 no
coverage. Every Hebrew-rule mutant died except one, analysed below.

### 2. Live contract rules were tested only from the accepting side

The corpus proved valid payloads are accepted. Almost nothing proved an invalid
one is refused, so a mutant could delete a rule and stay green. The rules with
no negative test included: exactly five recommendations per stone; at least one
metric; score and status agreeing through `statusForScore`; the score and
average-score range boundaries; provenance bound to the payload's
`surveyDefinitionHash`; provenance listing exactly the metric question IDs; an
`llm` outcome claiming zero attempts; a metric describing zero responses; the
eight-dimension taxonomy; a successful payload also claiming a privacy lock.

Privacy and provenance are product invariants, so these are the high-value
bucket by definition, not by score contribution.

`ai-contract-payload-refusals.test.ts` closes them — 22 tests, each starting
from one valid V6 payload and breaking exactly one thing: 710 → 787 killed,
341 → 281 survived, 84 → 67 no coverage.

### 3. Roughly three fifths of what remains is older-contract validators

Of the 348 remaining survivors and uncovered mutants, about 216 sit in
`isLegacyMetric`, `isLegacyIntervention`, `isValidLegacyStone`,
`hasValidStoneShape`, `isValidQuestionMetric`, `isValidV2Intervention`,
`isValidV2Stone`, `isValidGenerationProvenance`, `isValidV3GenerationProvenance`
and `isValidV3Stone` — the validators for contracts `1.0`–`4.0`.

Every fixture in the suite is a V6 payload, so those branches are reached
rarely or never. `isLegacyMetric` has 21 mutants and zero coverage. This is a
missing-fixture problem, not a missing-assertion problem, and it is the reason
the score is capped where it is.

It is also the answer to the scope question: adding a second mutation target
now would measure it against the same blind spot.

### 4. The rest is narrative shape, messages and genuinely equivalent mutants

- ~21 in the sentence- and paragraph-counting helpers
  (`hasExactlyThreeHebrewParagraphs`, `hasExactlyTwoCompleteSentences`,
  `hasTwoToFive/FourCompleteSentences`). Killing these means pinning the exact
  regex segmentation, which would freeze an implementation detail rather than a
  rule.
- 8 `StringLiteral` mutants are error-message prose that no test asserts.
  Deliberate: asserting full message text makes a suite brittle. The new tests
  assert short fragments where the message distinguishes one rule from another.
- 5 more `StringLiteral` mutants are `'string'` inside `typeof` checks on
  legacy paths — category 3 again.
- One equivalent mutant is confirmed by hand: `isHebrewOnlyUserText` line 282,
  `value.trim()` → `value`. Removing the trim changes nothing observable. An
  all-whitespace string is rejected either way — with the trim by `!normalized`,
  without it by the Hebrew-character test — and spaces are not `\p{L}`, so the
  loop skips them. No test should be written for it.

## Decisions made

- **The config is part of the measurement, so it was fixed first.** A missing
  test file does not lower the score honestly; it reports mutants as survivors
  that a real test kills. The rule is now written into
  `.agents/skills/shalomut-verification/SKILL.md`.
- **Refusal tests live in their own file**, named for what they assert rather
  than for mutation testing. They are ordinary contract tests; mutation testing
  is only how the gap was found.
- **The older-contract validators are left uncovered in this slice.** Giving
  `1.0`–`4.0` payload fixtures is a separate deliverable, and inventing partial
  fixtures to raise a number is the failure mode this task exists to avoid.
- **No CI gate and no threshold.** `thresholds.break` stays `null`.

## Assumptions

- Contracts `1.0`–`4.0` remain accepted on the callback path, so their
  validators are live code rather than dead code. Taken from
  `AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS` and the OpenAPI discriminator, both
  of which still list all six versions.

## Completed

- `stryker.config.mjs`: two corpus test files and the new refusal suite added to
  `tap.testFiles`, with a comment explaining why omission is not free.
- `src/lib/__tests__/ai-contract-payload-refusals.test.ts`: 22 tests.
- `.agents/skills/shalomut-verification/SKILL.md`: the `tap.testFiles` rule.
- `ROADMAP.md`: "Next architecture outcomes" is now empty; widening mutation
  scope moved to "Conditional, not scheduled" with its precondition.
- `PROGRESS.md`: the Stryker milestone and the architecture list.

## In progress

- Nothing.

## Remaining

- Owner action only: push and fast-forward `main`.

## Changed files

Five files: the config, one new test file, one skill, `ROADMAP.md`,
`PROGRESS.md`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 381 TypeScript tests (359 before this branch,
  plus the 22 new ones), both fitness checks, typecheck, ESLint and production
  build.
- `npx tsx --test src/lib/__tests__/ai-contract-payload-refusals.test.ts` —
  22/22, run before wiring the file into the mutation config.
- `npm run test:mutation:ai-contract` — three runs, each exit 0:

  | Run | Killed | Survived | No coverage | Total score |
  | --- | --- | --- | --- | --- |
  | baseline on current `main` | 681 | 356 | 98 | 60.00% |
  | after the config fix | 710 | 341 | 84 | 62.56% |
  | after the refusal tests | 787 | 281 | 67 | 69.34% |

  2 mutation-induced runtime errors in all three, unchanged from the pilot.

### Failed

- None.

### Blocked or not run

- `npm run verify:db` and `npm run verify:ai` — not run on this branch. The diff
  is one test file, the mutation config and documentation; no repository,
  schema, route or Python change. Both passed at `d588b97`, this branch's base.
- Browser smoke — not applicable.

### Environment

- local.

### Residual risk

- The score is still capped by category 3. Anyone reading 69.34% as "the
  validator is 69% proven" would be wrong in a specific way: the V6 path is
  well covered and the `1.0`–`4.0` paths are barely covered at all.
- Mutation reports under `reports/mutation/` are gitignored local evidence. The
  numbers above are reproducible with the committed config, not attached.

## Failed approaches

- Reading the survivor list as a to-do list. The first pass produced 80 distinct
  guard-disabling mutants; treating each as a test to write would have generated
  dozens of assertions on legacy branches and on regex internals, for a higher
  score and no more safety. Grouping by what the guard protects is what made the
  set actionable.

## Known risks

- `ai-contract-payload-refusals.test.ts` builds every case from one V6 fixture.
  If that fixture ever stops being valid, all 22 fail at once — which is why the
  first test asserts the unmodified fixture is accepted, so the failure names
  the fixture rather than the rules.

## Approval gates

- None.

## Questions requiring an owner decision

- None. Whether to give contracts `1.0`–`4.0` their own payload fixtures is
  recorded in `ROADMAP.md` as conditional work, not as a question.

## Next concrete step

Hand the branch to the owner to push and fast-forward `main`. Visibility today:
the commits exist only in this worktree and are not pushed, so another worktree
on this machine can consume them from the branch, and no other checkout or
machine can.
