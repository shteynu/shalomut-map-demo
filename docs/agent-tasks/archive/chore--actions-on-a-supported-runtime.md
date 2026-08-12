# The workflows run on an action runtime that still exists

## Metadata

- Branch: `chore/actions-on-a-supported-runtime`
- Base branch: `main`
- Base commit: `2b88877`
- Landed on `main` as `bb71c00..e9020f8`, five commits
- Status: landed and archived. All three edited workflows green on real runners,
  with the Node 20 annotation gone.
- Last updated: 2026-08-12
- Last agent/tool: Claude Opus 5 (Claude Code), worktree
  `.claude/worktrees/objective-aryabhata-af898c`

## Objective

Move every GitHub Action this repository uses onto a runtime GitHub still
supports, so the deprecation annotation on every run goes away before the forced
migration does it for us — and leave something behind that keeps them there,
because the annotation was visible for months before anybody read it.

## User-visible outcome

None. No product behavior, no build output, no test changes.

## Context

Every workflow run currently carries: "Node.js 20 is deprecated. The following
actions target Node.js 20 but are being forced to run on Node.js 24:
actions/checkout@v4, actions/setup-node@v4, actions/setup-python@v5." GitHub is
already running them on Node 24; the annotation is notice that the compatibility
shim is temporary.

Found while watching the first `Core verification` run in
`chore/python-from-the-service-venv`, which recorded it as a follow-up rather
than doing it there.

## Scope

- Every `uses:` in `.github/workflows/`, across all four workflows.
- `.github/dependabot.yml`, so they do not fall behind again.

## Non-goals

- Pinning actions to commit SHAs. The repository pins major tags; changing that
  convention is a separate security decision.
- Dependabot for the `npm` and `pip` ecosystems. Those pull requests change
  what the product is built from rather than what builds it, and the npm one
  would be a flood; a separate decision.
- The job-level `node-version: 20`. That is the Node the project builds under,
  unrelated to the action runtime, and changing it would change what CI proves.

## Acceptance criteria

- No action left on a major that targets the Node 20 runtime.
- A Dependabot configuration that is actually valid — an unknown key makes the
  whole file invalid and Dependabot then simply does not run.
- Every referenced tag exists, and every input we pass is still valid in the new
  major.
- All four workflows still parse.

## Relevant repository instructions

- `AGENTS.md`, parallel-agent Git safety: this is a separate deliverable from
  the interpreter task, so it takes its own branch and task file.

## Relevant architecture and contracts

None. CI configuration only.

## Decisions made

- **Current majors, not `v5`.** The request was "update to v5", which would have
  been wrong twice: `actions/setup-python@v5` is the version already in the file
  and being flagged — its Node 24 runtime starts at v6 — and the other three are
  now on v7, so v5 would pin them two majors behind and invite the same task
  again. Latest majors were taken after reading each major's release notes.
- **Nothing we pass changed.** Checked input by input: `setup-node` keeps
  `node-version` and `cache`; `setup-python` keeps `python-version`, `cache` and
  `cache-dependency-path` (v7 removed only `pip-install`, which is unused);
  `upload-artifact` keeps `name`, `path` and `retention-days`; `codeql-action`
  keeps `languages`, `build-mode` and `category`. `checkout` is called with no
  inputs anywhere.
- **`codeql-action` goes to v4, not v7.** Its majors are its own; v4 is the
  current one, actively released (4.37.6, 04 Aug 2026).
- **Dependabot monthly, grouped into one pull request.** These versions move
  together — the Node 20 bump touched four actions at once — so one grouped
  request means the runner floor gets checked once instead of four times.
  Monthly rather than weekly because actions do not move fast and a quiet gate
  is one that still gets read. `commit-message.prefix: "ci"` so a merged update
  reads like every other CI change in the log.
- **Only long-established Dependabot keys used.** An unrecognised key
  invalidates the whole file and Dependabot stops silently, which is the same
  failure mode as having no configuration — worse, because it looks configured.
  Tempting newer options were left out rather than guessed at.
- **Runner floor is met.** `setup-python@v6` and `upload-artifact@v6` require
  Actions Runner ≥ 2.327.1. Every job here is `runs-on: ubuntu-latest`; there
  are no self-hosted runners to update.

## Assumptions

- GitHub-hosted `ubuntu-latest` is at or above runner 2.327.1. True for hosted
  runners; the first green run confirms it.

## Completed

Twelve references across four workflows:

- `actions/checkout` v4 → v7 (×4: `codeql.yml`, `verify-core.yml`,
  `deploy-vercel.yml` ×2)
- `actions/setup-node` v4 → v7 (×3)
- `actions/setup-python` v5 → v7 (×2)
- `actions/upload-artifact` v4 → v7 (×1)
- `github/codeql-action/init` and `/analyze` v3 → v4
- `render-keepalive.yml` needed nothing — it has no `uses:` at all.

And `.github/dependabot.yml`: `github-actions` only, monthly, all patterns
grouped into a single pull request, at most two open, `ci` commit prefix.

## In progress

None.

## Remaining

One thing, and it is a read rather than work: the repository's Dependabot
settings, which is where an invalid configuration file is reported. Nothing
local can validate one, and the first monthly request is the real proof.

## Changed files

Modified: `.github/workflows/codeql.yml`, `.github/workflows/deploy-vercel.yml`,
`.github/workflows/verify-core.yml`.

Added: `.github/dependabot.yml`, this file.

## Verification evidence

### Passed

- Every target tag resolves on the remote, checked through the API rather than
  assumed: `actions/checkout@v7`, `actions/setup-node@v7`,
  `actions/setup-python@v7`, `actions/upload-artifact@v7` all return
  `refs/tags/v7`; `github/codeql-action@v4` returns `refs/tags/v4`.
- Release notes read for each major crossed. The only input removal anywhere is
  `pip-install` in `setup-python@v7`, which this repository does not use.
- All four workflows parse under `js-yaml` with their jobs intact: `analyze`,
  `validate` + `deploy-prod-manual`, `ping`, `verify-core`.
- `grep` confirms no `uses:` left on a Node 20 major.
- `npm run verify:core` — exit 0, including `lint:interpreter`, which scans
  `.github/workflows/` and therefore reads the edited files.
- `.github/dependabot.yml` parses, and every key in it was checked against the
  documented schema — no unknown keys, which is the failure that would make
  Dependabot ignore the file.
- Dependabot's own pull requests will be verified rather than merged blind, and
  the wiring for that was read rather than assumed: `deploy-vercel.yml` triggers
  on `pull_request: branches: ["main"]`, so its `validate` job runs on them, and
  `verify-core.yml` triggers on `push`, so the branch Dependabot pushes gets that
  too. Neither needs a secret — the only `secrets.*` references sit in
  `deploy-prod-manual`, which is `workflow_dispatch`-gated — so Dependabot's
  restricted token blocks nothing.
- `git diff --check` — exit 0.
- **All three edited workflows green on real runners** at `22832cf`, the commit
  carrying the bump: `Core verification` (run `31582488293`, 1m54s),
  `CodeQL Security Analysis` on `codeql-action@v4` (`31582488284`, 1m33s) and
  `Vercel Deployment & Pipeline Checks` (`31582488268`, `Build & Validate`
  3m45s) — the last being the one that carries seven of the twelve references.
  **And the annotation is gone:** the run has no `ANNOTATIONS` block at all,
  where the previous run on `2b88877` carried the Node 20 deprecation notice.
  That is the acceptance criterion, observed rather than inferred.

### Failed

- None.

### Blocked or not run

- Whether GitHub accepts the Dependabot file. There is no public endpoint that
  validates one; GitHub reports configuration errors in the repository's
  Dependabot settings after the push, and the first monthly run is the real
  proof.

### Environment

- Local worktree `.claude/worktrees/objective-aryabhata-af898c`, plus the GitHub
  API for tag and release-note lookups.

### Residual risk

- `actions/upload-artifact@v7` is still unexercised. It runs only when the
  browser smoke fails, so the green `validate` job did not reach it; v7's own
  change there is an opt-in `archive` input this repository does not set.
- Dependabot is unproven until GitHub parses the file and the first monthly
  request appears.

## Failed approaches

None.

## Known risks

- A monthly grouped pull request only helps if it gets merged. An ignored
  Dependabot request is the same state as no Dependabot, with more noise.
- Dependabot follows tags, so a grouped request may carry a `.0` release that is
  hours old. Both CI gates run on it before merge, which is the mitigation.

## Approval gates

None. No secrets, credentials, deployment alias or database write involved.

## Questions requiring an owner decision

- None outstanding. The Dependabot question this task opened was answered by
  the owner and is implemented.

## Next concrete step

None — the task is landed and archived. The one open read is in Remaining:
confirm in the repository's Dependabot settings that the configuration parsed,
and expect the first grouped pull request within a month. Its companion task is
`docs/agent-tasks/archive/chore--python-from-the-service-venv.md`.
