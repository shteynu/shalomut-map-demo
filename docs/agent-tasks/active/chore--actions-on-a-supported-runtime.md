# The workflows run on an action runtime that still exists

## Metadata

- Branch: `chore/actions-on-a-supported-runtime`
- Base branch: `main`
- Base commit: `2b88877`
- Current HEAD: the tip of the branch.
- Status: implemented and statically verified, not yet observed on a runner.
  Stacked on the two unpushed documentation commits of
  `chore/python-from-the-service-venv` (`839626c`, `b3a505c`), which this branch
  carries. Pushing this branch lands both.
- Last updated: 2026-08-12
- Last agent/tool: Claude Opus 5 (Claude Code), worktree
  `.claude/worktrees/objective-aryabhata-af898c`

## Objective

Move every GitHub Action this repository uses onto a runtime GitHub still
supports, so the deprecation annotation on every run goes away before the forced
migration does it for us.

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

## Non-goals

- Pinning actions to commit SHAs. The repository pins major tags; changing that
  convention is a separate security decision.
- Adding Dependabot for `github-actions`. It would stop this recurring and is
  the natural follow-up, but it is a new moving part nobody asked for.
- The job-level `node-version: 20`. That is the Node the project builds under,
  unrelated to the action runtime, and changing it would change what CI proves.

## Acceptance criteria

- No action left on a major that targets the Node 20 runtime.
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

## In progress

None.

## Remaining

Watch the first run of each workflow after the push. Nothing else.

## Changed files

Modified: `.github/workflows/codeql.yml`, `.github/workflows/deploy-vercel.yml`,
`.github/workflows/verify-core.yml`.

Added: this file.

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
- `git diff --check` — exit 0.

### Failed

- None.

### Blocked or not run

- The workflows themselves on a runner. Nothing local can execute a GitHub
  Action; only a push proves the new majors resolve and behave. This is the
  whole residual risk of the change.

### Environment

- Local worktree `.claude/worktrees/objective-aryabhata-af898c`, plus the GitHub
  API for tag and release-note lookups.

### Residual risk

- **This edits the workflow a deployment waits on.** `deploy-vercel.yml` carries
  seven of the twelve references, including the Playwright artifact upload,
  which only runs on failure and is therefore the least exercised line in the
  diff. If a bump misbehaves, it shows up as a red `validate` job on `main`
  rather than as a bad deployment — the deploy job `needs: validate` — but the
  first run after the push should be read rather than assumed.

## Failed approaches

None.

## Known risks

- Nothing keeps these current. Without Dependabot the next deprecation arrives
  the same way this one did: as an annotation somebody happens to read.

## Approval gates

None. No secrets, credentials, deployment alias or database write involved.

## Questions requiring an owner decision

- Add `.github/dependabot.yml` for the `github-actions` ecosystem? It would
  replace "somebody notices an annotation" with a monthly PR. Deliberately not
  done here — see Non-goals.

## Next concrete step

Push, then read the first run of each of the three edited workflows:
`Core verification`, `Vercel Deployment & Pipeline Checks` and
`CodeQL Security Analysis`. Push is an owner action:
`git push origin chore/actions-on-a-supported-runtime:main`. That push also
lands the two documentation commits of `chore/python-from-the-service-venv`;
after it, both this file and
`docs/agent-tasks/active/chore--python-from-the-service-venv.md` move to
`docs/agent-tasks/archive/`.
