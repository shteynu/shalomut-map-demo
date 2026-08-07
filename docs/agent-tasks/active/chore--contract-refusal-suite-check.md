# A contract version cannot ship with accepting tests only

## Metadata

- Branch: chore/contract-refusal-suite-check
- Base branch: main
- Base commit: 85f8e89
- Current HEAD: the branch tip; the code commit is the first of two
- Status: complete and verified, committed locally, unpushed
- Last updated: 2026-08-07
- Last agent/tool: Claude Code (Opus 5)

## Objective

Keep the refusal suites written on 2026-08-07 from decaying: fail the build
when a contract version reaches a stone validator that no refusal suite
exercises.

## User-visible outcome

None. A repository fitness check.

## Context

The owner asked whether a coverage or mutation-score percentage belongs in CI.
Both were declined, with reasons recorded in `ROADMAP.md` and in this session:
the mutation score moves for reasons unrelated to test strength, and a line
coverage threshold would have been green throughout the exact period when
~90 validator rules could be deleted silently — the legacy validators *were*
executed by the corpus, they were simply never asserted against.

What was missing is a check of a different kind: not a number, but the fact
that each way a payload can be validated has a suite proving an invalid one is
refused.

## Scope

`scripts/check-contract-refusal-suites.mjs`, its own test file, the
`lint:contract-refusals` script, its place in `verify:core`, and the
documentation of what it does and does not prove.

## Non-goals

- No coverage tooling and no percentage gate, for the reasons above.
- No claim that a suite is complete. This proves existence, not thoroughness.

## Acceptance criteria

All met, each demonstrated by running the check rather than by reading it:

- Deleting `ai-contract-v5-refusals.test.ts` fails the check naming `5.0`.
- Deleting `ai-contract-legacy-refusals.test.ts` fails it naming `1.0`, `2.0`
  and `3.0 / 4.0`.
- A hypothetical `7.0` on a new combination of dispatch flags fails it.
- A hypothetical `7.0` sharing an existing path passes, as `4.0` does.
- A validator that starts branching on a fifth capability fails it with the
  flag named.

## Decisions made

- **The unit is a validation path, not a version.** `validateStoneMapResult`
  picks a stone validator from four capability flags, so two versions that
  answer them identically run the same code. `4.0` therefore needs no suite of
  its own — it reaches the validator `3.0` reaches — and a check that demanded
  one per version would push someone to write a fixture that proves nothing.
- **The flag list is derived from the validator, not trusted.** Otherwise the
  check has a silent way to go stale: on the day the validator branches on a
  fifth capability, a version differing only in that flag would share a
  signature with an existing one and report as covered. The check now reads the
  stone-selection block of `ai-contract.ts` and fails if the two disagree.
- **Comments do not count as coverage.** The first draft read them and passed
  with the `5.0` suite deleted, because the `6.0` suite's header prose mentions
  `5.0` while explaining its own history. Sources are stripped of comments
  before any version is read as a claim, and a regression test holds it.

## Assumptions

- `contracts/capabilities.json` remains the capability policy source and lists
  every supported version. Stated in `AGENTS.md` and unchanged here.

## Completed

- `scripts/check-contract-refusal-suites.mjs` and its test file (12 tests).
- `package.json`: `lint:contract-refusals`, added to `verify:core` — so CI runs
  it on every push and pull request through `npm run verify`.
- `.agents/skills/shalomut-verification/SKILL.md` and `PROGRESS.md`.

## In progress

- Nothing.

## Remaining

- Owner action only: `git push origin chore/contract-refusal-suite-check:main`.

## Changed files

Two new scripts, `package.json`, the verification skill, `PROGRESS.md` and this
task file. `.idea/shalomut-map-demo.iml` and `next-env.d.ts` were already
modified in the worktree and are left alone.

## Verification evidence

### Passed

- `node --test scripts/check-contract-refusal-suites.test.mjs` — 12/12.
- `node scripts/check-contract-refusal-suites.mjs` — exit 0: 3 suites cover 5
  validation paths across 6 contract versions.
- The five negative cases under `Acceptance criteria`, each run by temporarily
  moving a suite, adding a `7.0` to `contracts/capabilities.json` or editing
  the validator's dispatch, and each restored afterwards (`git status` clean
  apart from the two pre-existing worktree files).
- `npm run verify:core` — exit 0: 733 TypeScript tests, all fitness checks
  including the new one, typecheck, ESLint and the production build.

### Failed

- None.

### Blocked or not run

- `npm run verify:db`, `verify:ai`, the Python suite and the full mutation run
  — not run. No runtime file, schema, contract manifest or test of a mutated
  module changed.
- Browser smoke — not applicable.

### Environment

Local.

### Residual risk

The check is satisfied by a suite that names a version and asserts little. It
guards against forgetting, not against half-doing; the mutation report remains
the only thing that answers whether the rules are actually pinned. Recorded
here and in the script's own header so nobody reads a green build as proof of
test strength.

## Failed approaches

- Counting a version mentioned in a comment. Written deliberately as an
  over-generous read, and disproved by running the check with a suite deleted:
  it passed. The negative case is now a unit test.

## Known risks

- None beyond the residual risk above.

## Approval gates

- None beyond the standing one: pushing is the owner's action.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the push to the owner:
`git push origin chore/contract-refusal-suite-check:main`.
