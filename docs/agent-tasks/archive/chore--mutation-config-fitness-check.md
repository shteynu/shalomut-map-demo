# Enforcing the mutation config instead of remembering it

## Metadata

- Branch: `chore/mutation-config-fitness-check`
- Base branch: `test/refresh-mutation-baseline`, not `main`. That branch was
  still unpushed at the time, and this one depends on the two-file `mutate`
  list it introduced. Both have since landed on `main`.
- Base commit: `d1a8899`
- Final commits: `b76cbfb`, `105efa7` and `a038881`, plus the follow-up fix
  `c3a8c19` and `4773800` from `fix/mutation-sandbox-venv`. All on `main`.
- Status: complete and archived
- Last updated: 2026-08-05
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Close the residual risk left by `test/refresh-mutation-baseline`: nothing
compared `tap.testFiles` against the repository, so the list drifted twice by
omission in three months.

## User-visible outcome

None. Tooling, CI and documentation.

## Context

- The drift and the refreshed baseline are in
  `docs/agent-tasks/archive/test--refresh-mutation-baseline.md`.
- CI runs `npm run verify` in the `validate` job of
  `.github/workflows/deploy-vercel.yml`, so anything inside `verify:core` runs
  on every pull request without a workflow change.

## Scope

One fitness check with its own tests, one CI step, and the documents that state
what CI enforces about mutation testing.

## Non-goals

- **No mutation score threshold.** Argued in `ROADMAP.md` under "Conditional,
  not scheduled" and recorded there as closed rather than pending, so it is not
  reopened by habit.
- No full mutation run in CI. A weekly scheduled run was considered and left
  out: the drift it would surface is already surfaced by the fitness check, at
  a second rather than four minutes.
- No change to the mutated files or to any test of them.

## Acceptance criteria

- The check fails on the exact historical omission and passes on the current
  repository.
- It runs in CI without a workflow change.
- CI proves the mutation runner starts.
- No check anywhere reads the score.

## Decisions made

- **The rule is "calls a function a mutated module exports", not "imports a
  mutated module".** Import-based would pull in every file that reads
  `AI_ANALYTICS_DIMENSION_IDS` — roughly twice the list — and each one costs a
  process per run while deciding no mutant. The call-based rule is the one the
  config already documented.
- **The check fails in both directions.** A missing file inflates the survivor
  count. A listed file that stopped calling anything is dead weight whose
  presence still claims it is a test of the subject.
- **The dry run is a blocking CI step.** It is pass/fail on whether the
  instrument runs, which is a fact about the repository, not a judgement about
  test quality.
- **The exported-name list is derived, not hardcoded.** A new exported
  validator joins the rule automatically; a hardcoded list would be the same
  kind of hand-maintained state this task exists to remove.

## Assumptions

- `stryker.config.mjs` stays a plain ESM module with a literal default export,
  so the check can import it rather than parse it.

## Known limits

- A test that reaches a mutated module only through a helper module is
  invisible to the check, exactly as it is to the grep the config names.
  Seeing it would need import-graph analysis, and a fitness check nobody can
  read by hand is a worse trade than a known gap. Recorded in the script's own
  comment.

## Completed

- `b76cbfb` — `scripts/check-mutation-config.mjs` and its 8 unit tests, wired
  as `npm run lint:mutation-config` inside `verify:core`.
- `105efa7` — the `--dryRunOnly` step in the `validate` job.
- The `docs(mutation)` commit — `ROADMAP.md` records the score threshold as
  closed and why, `PROGRESS.md` names the two checks, and the verification
  skill tells agents to run `lint:mutation-config` rather than hand-edit the
  list.

## In progress

- Nothing.

## Remaining

- Nothing. Both branches and the follow-up fix are on `main`; GitHub run
  `30997233881` passed every step, including the dry run.

## Changed files

`scripts/check-mutation-config.mjs`, `scripts/check-mutation-config.test.mjs`,
`package.json`, `.github/workflows/deploy-vercel.yml`, `ROADMAP.md`,
`PROGRESS.md`, `.agents/skills/shalomut-verification/SKILL.md`, this file, and
`stryker.config.mjs` in the follow-up fix.

## Verification evidence

### Passed

- `node --test scripts/check-mutation-config.test.mjs` — 8/8.
- `node scripts/check-mutation-config.mjs` — exit 0, "11 test files for 2
  mutated modules", which is the current list exactly.
- Negative case, run by hand: with `hebrew-only-corpus.test.ts` removed from
  `tap.testFiles`, the check exits 1 and names that file. The config was
  restored and `git diff` confirmed clean before continuing.
- `npm run verify:core` — exit 0 with the new step in the chain.
- `.github/workflows/deploy-vercel.yml` parsed as YAML; the `validate` job's
  steps end with `npm run test:mutation:ai-contract -- --dryRunOnly`.
- `npm run test:mutation:ai-contract -- --dryRunOnly` — exit 0 locally, the
  same command the new CI step runs.

- GitHub run `30996895975` on `main`: `Run canonical verification` succeeded,
  so `lint:mutation-config` passes in CI.
- GitHub run `30997233881` after the fix below: every step succeeded,
  including the dry run.

### Failed, then fixed

- Run `30996895975`'s `Check that the mutation runner still starts` failed with
  `EISDIR ... copyfile ai-analytics-service/.venv/lib64`. Stryker sandboxes
  the project by copying it, and a Linux virtual environment contains `lib64`
  as a symlink to a directory. macOS venvs do not, so no local dry run could
  have shown it.

  Fixed by `ignorePatterns: ['**/.venv']` on branch `fix/mutation-sandbox-venv`
  (`c3a8c19`), verified by running the dry run with `--cleanTempDir false` and
  confirming the sandbox holds `ai-analytics-service` without a `.venv` inside
  it. Landed on `main` the same day; run `30997233881` passed every step,
  with the dry run instrumenting 1255 mutants and running the 11 test files
  in 4 seconds. `main` was red for seven minutes, 10:18 to 10:25 UTC.

  The step did what it was added to do on its first real run: it caught a
  mutation config that does not start.

### Blocked or not run

- `verify:db` and `verify:ai` — no repository, schema, route or Python change.

### Environment

Local.

### Residual risk

- The helper-module gap above.
- CI now spends about fifteen seconds per run starting Stryker. If that stops
  being worth it, the step is one deletion.

## Failed approaches

- None.

## Approval gates

- None. Push is an owner action.

## Questions requiring an owner decision

- None.

## Next concrete step

None. The task is closed; what CI enforces about mutation testing is recorded
in `ROADMAP.md` and `.agents/skills/shalomut-verification/SKILL.md`.
