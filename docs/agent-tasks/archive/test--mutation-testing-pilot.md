# Mutation testing pilot

## Metadata

- Branch: `test/mutation-testing-pilot`
- Base branch: `origin/main`
- Base commit: `ae3c3c4fa8157dd7c0b736e37126da5b6df93856`
- Current HEAD: `6d42f4c` (`test: add AI contract mutation pilot`)
- Status: Complete
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Introduce mutation testing incrementally for deterministic critical rules, starting with the TypeScript AI contract validator.

## User-visible outcome

Maintainers can run a focused, non-blocking mutation-testing pilot for `src/lib/ai-contract.ts`, backed by explicit boundary tests for high-value contract rules.

## Context

- The user supplied `/Users/maxim.berenshtein/Downloads/mutation-testing-plan.md`.
- A different agent is working concurrently, so this task uses its own branch and worktree.
- The supplied plan analyzes `main` at the same base commit used by this branch.

## Scope

- Add missing boundary-value tests for `src/lib/ai-contract.ts`.
- Add and validate a focused StrykerJS TAP-runner configuration for `src/lib/ai-contract.ts` only.
- Add a local command for the report-only pilot.
- Record initial runtime and survivor evidence if the pilot completes within the session.

## Non-goals

- Repository-wide mutation testing.
- A blocking CI mutation gate.
- Analytics, callback cross-check, Python parser, or RAG mutation targets in this first slice.
- Migrating the normal test runner to Jest or Vitest.

## Acceptance criteria

- Focused normal tests cover the plan's important `ai-contract.ts` boundaries or document any intentional gap.
- Stryker runs through the existing `node:test`/`tsx` setup against only `src/lib/ai-contract.ts`.
- The pilot remains opt-in and non-blocking.
- Standard TypeScript verification required by the actual diff passes.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`
- `/Users/maxim.berenshtein/.codex/skills/source-driven-development/SKILL.md`

## Relevant architecture and contracts

- `docs/source-of-truth.md`
- `src/lib/ai-contract.ts`
- `contracts/ai-analytics-v1.json`

## Decisions made

- Start with Stage A/B for `src/lib/ai-contract.ts`; later plan stages stay out of this initial diff.
- Base the branch on current `origin/main` and isolate it in `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo-mutation-testing`.
- Use StrykerJS `9.6.1` with the official TAP runner and the existing `node:test`/`tsx` setup.
- Keep the pilot report-only with `thresholds.break: null`; do not convert the baseline score into a merge gate.
- Generate console, HTML, and JSON evidence locally, but ignore generated `reports/` in Git.

## Assumptions

- The first implementation slice should be independently reviewable before expanding mutation scope.
- Generated mutation reports should not be committed.

## Completed

- Created isolated branch and worktree from `origin/main`.
- Read the supplied plan and relevant repository skills/source-of-truth.
- Added focused V5/V6 boundary tests for narrative lengths, score/status edges, finite score ranges, recommendation counts and uniqueness, canonical dimension coverage, provenance counts/question IDs, zero distribution buckets, deterministic zero-attempt fallback, removed V6 fields, and non-success detail leakage.
- Added exact StrykerJS dependencies, `stryker.config.mjs`, and `npm run test:mutation:ai-contract` for `src/lib/ai-contract.ts` only.
- Validated the TAP/`tsx` sandbox with a dry run and completed the report-only pilot in about 40 seconds.
- Improved the pilot from 666 to 676 killed mutants after classifying and covering ten meaningful survivors.

## In progress

- None; this first report-only pilot is complete.

## Remaining

- None within this closed task. Survivor classification and the analytics target are follow-up work that should use a new branch and task file.

## Changed files

- `.gitignore`
- `package.json`
- `package-lock.json`
- `stryker.config.mjs`
- `src/lib/__tests__/ai-contract-v5.test.ts`
- `src/lib/__tests__/ai-contract-v6.test.ts`
- `docs/agent-tasks/active/test--mutation-testing-pilot.md`

## Git state

- Implementation commit: `6d42f4c` (`test: add AI contract mutation pilot`).
- Base: `ae3c3c4fa8157dd7c0b736e37126da5b6df93856` (`origin/main` before publication).
- Staged: none.
- Unstaged: none before archival documentation update.
- Untracked: none before archival documentation update.
- Ignored local evidence: `reports/mutation/mutation.html`, `reports/mutation/mutation.json`.
- Visibility at task closure: the implementation commit is portable across worktrees in this clone; publication to `origin/main` is the next user-authorized Git operation.

## Verification evidence

### Passed

- `node --import tsx --test src/lib/__tests__/ai-contract.test.ts src/lib/__tests__/ai-contract-semantic-quality.test.ts src/lib/__tests__/ai-contract-v4.test.ts src/lib/__tests__/ai-contract-v5.test.ts src/lib/__tests__/ai-contract-v6.test.ts` — 52 tests passed.
- `npm run test:mutation:ai-contract -- --dryRunOnly` — Stryker TAP dry run passed for five focused test files.
- `npm run test:mutation:ai-contract` — 1126 mutants instrumented; 676 killed, 350 survived, 98 no coverage, 2 mutation-induced runtime errors; total score 60.14%, covered score 65.89%; completed in about 40 seconds. Reports are local under ignored `reports/mutation/`.
- `npm test` — 332 tests passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed with no warnings after naming the exported Stryker config.
- `npm run build` — production build passed; emitted the existing Next.js middleware deprecation warning.
- `npm ls @stryker-mutator/core @stryker-mutator/tap-runner --depth=0` — both resolved to `9.6.1`.
- `git diff --check` — passed.

### Failed

- The first focused test attempt before dependency installation failed with `ERR_MODULE_NOT_FOUND: tsx`; installing the worktree dependencies resolved it and all subsequent runs passed.
- `npm audit --json` reports 12 dependency findings (3 moderate, 9 high, 0 critical). One high `brace-expansion` path is present through Stryker's dev-only `glob`/`minimatch` chain; no dependency remediation was attempted in this task.

### Blocked or not run

- Python tests, database verification, browser smoke, and deployment checks were not run because this slice changes TypeScript test tooling and contract unit tests only.

### Environment

- Local isolated Git worktree.

### Residual risk

- The remaining 350 survivors and 98 uncovered mutants are not classified yet; the baseline must not become a blocking score gate.
- Two top-level arrow-function mutants produce mutation-induced runtime errors while building canonical question constants; these are recorded in the report and do not indicate a normal-test failure.
- Stryker's current dev dependency tree includes a high-severity `brace-expansion` audit finding.

## Failed approaches

- Running focused tests before installing dependencies in the new worktree could not load `tsx`; dependency installation was required first.

## Known risks

- The TAP runner executes TypeScript test files in separate processes, so an overly broad test-file set may make the pilot slow.
- Some mutants may be equivalent or low value and require manual classification rather than a score gate.
- `npm audit` currently reports 12 findings, including one dev-only path introduced through Stryker; this needs dependency-level follow-up, not an automatic `npm audit fix --force`.

## Approval gates

- None for this local test-tooling slice.

## Questions requiring an owner decision

- None currently.

## Next concrete step

Start a new follow-up branch from updated `main` to classify the highest-value surviving `ai-contract.ts` mutants before adding `analytics.service.ts` to mutation scope.
