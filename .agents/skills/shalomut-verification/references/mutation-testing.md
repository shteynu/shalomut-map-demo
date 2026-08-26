# Mutation testing — rules and commands

Open this file when the matrix row about mutation config or mutated files in
[../SKILL.md](../SKILL.md) fires, or when the user asks for an assessment of
test strength. Otherwise the two consequences named in the skill itself are
enough: `lint:mutation-config` and `lint:contract-refusals` are part of
`verify:core` and fail CI on their own.

## Scope

- The current mutation scope is an opt-in pilot for `src/lib/ai-contract.ts` and
  `src/lib/scoring-bands.ts`, which is where the validator rule "score and
  status must agree" moved; the configuration lives in `stryker.config.mjs`.
- If a product rule moves out of a mutated file into a new module, take `mutate`
  with it in the same change. A refactor must not silently carry a rule out of
  measurement.

## The list of tests

- `tap.testFiles` must contain every test file whose subject is a mutated file,
  including tests outside `src/lib/__tests__`. A missing file does not lower the
  score honestly: it reports as a survivor a mutant a real test would kill. That
  is how, until 2026-08-03, the Hebrew-only rule looked untested while
  `hebrew-only-corpus.test.ts` already existed.
- The list is no longer maintained by hand: `npm run lint:mutation-config`
  re-derives it from the repository and fails in both directions — on a missing
  file and on a file left in the list that no longer calls anything. The check
  is part of `verify:core`, so CI runs it on every pull request. Do not edit
  `tap.testFiles` without running it.

## Negative tests for a new contract version

A new contract version must get a suite of negative tests.
`npm run lint:contract-refusals` groups the versions in
`contracts/capabilities.json` by the capability flags on which
`validateStoneMapResult` picks a stone validator, and fails if some validation
path is named in no `*-refusals.test.ts`. A version that travels an
already-covered path needs no suite of its own: that is how `4.0` goes through
the `3.0` validator. The set of flags is derived from `ai-contract.ts` itself,
so branching on a new flag fails the check too. The check is part of
`verify:core`. It proves that a suite exists, not that it is complete: only a
full mutation run still shows the strength of the tests.

## Running it

- Check the wiring without a full run with
  `npm run test:mutation:ai-contract -- --dryRunOnly`. CI runs the same thing as
  a separate step after `npm run verify`.
- Run the full `npm run test:mutation:ai-contract` when the validator itself,
  the mutation config or the set of tests changed, or when the user asks for
  proof of test strength. It is not part of `npm run verify` and is not a
  blocking CI gate: the score is moved by a function migrating between files and
  by a test file appearing in the list — changes that have nothing to do with
  the strength of the tests.

## Reporting

Do not promise repository-wide mutation coverage. Separate killed, survived,
no-coverage and runtime-error mutants; the HTML/JSON reports under
`reports/mutation/` are local ignored evidence.
