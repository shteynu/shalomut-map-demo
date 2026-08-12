# The Node side asks the service which Python it runs on

## Metadata

- Branch: `chore/python-from-the-service-venv`
- Base branch: `main`
- Base commit: `e75bbb6` (was `164c9ef`; see the rebase note below)
- Current HEAD: the tip of `chore/python-from-the-service-venv`. The last
  functional commit is `36f2bff` (the workflow); everything after it is this
  record.
- Status: the interpreter fix and the lint gate are **on `main`** — the owner
  pushed the first nine commits of this branch while it was still open. What
  remains unpushed is the CI workflow and the documentation for it: three
  commits, rebased onto `e75bbb6`. Visible to another worktree that checks out
  this branch; not visible to another machine until it is pushed.
- Rebase: `chore/skill-lint-discovers-entrypoints` landed on `main` in the
  meantime, so the remaining three commits were rebased from `164c9ef` onto
  `e75bbb6`. No conflicts — that branch touched `AGENTS.md`,
  `scripts/check-agent-skills*` and two archived task files, none of which
  these commits go near. `verify:core` was re-run on the rebased tree and the
  upgraded skills check passes with it: 28 tests, "4 declared entrypoints".
- Last updated: 2026-08-12
- Last agent/tool: Claude Opus 5 (Claude Code), worktree
  `.claude/worktrees/objective-aryabhata-af898c`

## Objective

Make every Node-side caller resolve the AI service interpreter the way
`shalomut-verification` already requires for pytest — the virtualenv, never a
`python3` from PATH — and fail on the missing environment instead of on an
ImportError from inside the service.

## User-visible outcome

`npm test` and `npm run verify:core` complete on a clean checkout whatever
`python3` happens to be on PATH. A checkout without the virtualenv is told
which interpreter is missing and which document creates it, instead of being
handed a Python traceback.

## Context

`src/app/api/__tests__/ai-e2e.test.ts` spawned `python3 -m
tests.stub_pipeline_cli`. On macOS `python3` is often `/usr/bin/python3` (3.9.6,
Command Line Tools), which is below the `requires-python = ">=3.11"` the service
declares, so `ai-analytics-service/src/agents/state.py:1` raises `ImportError:
cannot import name 'NotRequired' from 'typing'` and all three cross-service
tests fail. Because `verify:core` chains `npm test`, the whole core gate could
not finish locally.

**A claim inherited from the spun-off task is false and is corrected here.** It
said no workflow runs `npm test`. `deploy-vercel.yml` runs `npm run verify` on
every push and pull request to `main`, and `verify` chains `verify:core` chains
`npm test`; the earlier claim came from grepping for `npm test` literally. CI
has been green throughout, and could not have caught this in any case: the
runner's `python3` is 3.11 from `setup-python`, new enough for
`typing.NotRequired`, and the stub CLI imports nothing outside the standard
library — verified by running it under a clean 3.14 with no service
dependencies installed, where it reaches contract validation. The trap was
macOS-3.9-only.

`scripts/verify-ai.mjs` and `scripts/local-stack.mjs` already resolved
`.venv/bin/python`. The rule existed; the test harness and two other callers did
not follow it.

Spun off from `docs/agent-tasks/archive/docs--agent-skill-routing-progressive-disclosure.md`,
which recorded the failure and explicitly left it unfixed. It was archived while
this branch was in flight; the correction above belongs here rather than in that
closed record.

## Scope

- One resolver, `scripts/ai-service-python.mjs`, that every Node-side caller
  uses.
- Four call sites moved onto it: the cross-service test, `verify-ai.mjs`, the
  `lint:literals` Python half, and `scripts/local-unlocked-pipeline.ts`.
- A fitness gate, `npm run lint:interpreter`, so the rule survives the next
  person who reaches for `spawnSync('python3', …)`.
- Documentation that disagreed with the code.

## Non-goals

- Anything about the deployed AI service.
- Changing `deploy-vercel.yml`. It remains the gate a deployment waits on, and
  the new core job runs beside it rather than carving work out of it.
- Migrating `scripts/local-stack.mjs` onto the resolver. It spells
  `path.join(aiServiceRoot, ".venv", "bin", "python")` itself, which is correct
  and passes the gate; folding it in would be tidier and is not this task.

## Acceptance criteria

- `npm test` passes with `python3` resolving to 3.9.6. Met — 878/878.
- A checkout with no virtualenv fails with a message naming
  `ai-analytics-service/.venv/bin/python` and `docs/local-environment.md`. Met.
- No non-comment `python3` left in code or `package.json` except the two
  venv-creation commands, which must use the system interpreter. Met.
- A gate that fails on the pre-fix tree and passes on this one, without failing
  on prose about `python3` or on the correct `.venv/bin/python`. Met — both
  directions run, not reasoned about.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md`, `Python и AI boundary`:
  «Именно интерпретатор из `.venv`, а не `python3`». This task makes the harness
  obey the rule the skill already stated.
- `AGENTS.md`, documentation lifecycle: current code outranks prose, and the
  living document is updated in the same task.

## Relevant architecture and contracts

None touched. No contract, schema, route, privacy or persistence behavior
changes; the diff is test/tooling wiring plus documentation.

## Decisions made

- **One resolver in `scripts/`, not three copies.** The rule is short enough to
  duplicate and exactly the kind of thing that then drifts.
- **`.mjs` implementation with a hand-written `ai-service-python.d.mts`.** The
  module has two kinds of caller: scripts run by bare `node` (`verify-ai.mjs`,
  the literals runner) and TypeScript run by `tsx` (the test, which `tsc`
  typechecks). `tsconfig.json` excludes `scripts/` and sets `allowJs: false`, so
  the declaration file is what lets a `src/**` test import it and still pass
  `npm run typecheck`. Verified: `typecheck` exits 0.
- **The test fails rather than skips when the virtualenv is absent.** A silently
  skipped cross-service test is how this class of breakage hides.
- **Resolve inside `runPythonPipeline`, not at module load.** Throwing at import
  time would fail the whole file; this way each test that needs Python reports
  the missing environment itself.
- **`lint:literals` runs its Python half through the resolver too.** The checker
  is pure standard library and would survive 3.9, but a machine with no
  `python3` at all failed the gate with `sh: python3: command not found`.

## Assumptions

- Every developer and agent working on this repository has, or can create, the
  service virtualenv. It is already required by `npm run local`,
  `npm run verify:ai` and the `shalomut-verification` matrix; this change adds
  `npm test` to that list rather than introducing a new dependency.

## Completed

- `scripts/ai-service-python.mjs` — new. `repositoryRoot`, `aiServiceRoot`,
  `findAiServicePython()`, `requireAiServicePython(purpose)`. The error names the
  missing path, the creation command and why a system `python3` is not a
  substitute.
- `scripts/ai-service-python.d.mts` — new. Declarations for TypeScript callers.
- `scripts/check-version-literals-python.mjs` — new. Runs
  `ai-analytics-service/scripts/check_version_literals.py` under the resolved
  interpreter, from the repository root (the checker walks
  `ai-analytics-service/src` relative to the working directory).
- `src/app/api/__tests__/ai-e2e.test.ts` — spawns the resolved interpreter;
  dropped its own `process.cwd()`-based roots for the resolver's.
- `scripts/verify-ai.mjs` — same resolver, same message; its inline copy of the
  check is gone.
- `scripts/local-unlocked-pipeline.ts` — same, for `-m src.pipeline_cli`.
- `package.json` — `lint:literals` calls the new runner instead of `python3 …`.
- **Second defect found while verifying, fixed:** the documented setup
  `pip install -e .` never installs `pytest`, which lives in the `[dev]` extra,
  so a virtualenv built exactly as `docs/local-environment.md` says answers
  `No module named pytest` to `npm run verify:ai`. Corrected to
  `pip install -e ".[dev]"` in `docs/local-environment.md`,
  `ai-analytics-service/README.md`, `scripts/local-stack.mjs` and the new error
  message.
- `scripts/check-python-interpreter.mjs` + `.test.mjs` — new, and
  `npm run lint:interpreter` in `verify:core`. Fails on `python3` in command
  position across `scripts/`, `src/`, `e2e/`, `package.json` and
  `.github/workflows/`; allows `python3 -m venv`. Three rules earn their keep:
  command position rather than any mention, so the resolver's own explanatory
  error message does not fail the gate; a lone `'python'` only where a spawn
  reads it as argv[0], because it is also the last path segment of the correct
  interpreter; and the gate's own fixtures excluded by exact filename, not by a
  `*.test.mjs` pattern. It also fails if the resolver is deleted or gutted,
  which is the direction the first rule cannot see.
- `.github/workflows/verify-core.yml` — new. `npm run verify:core` on every
  push to any branch, plus `workflow_dispatch`, with a per-ref concurrency group
  so only the newest push holds a runner. Node 20 and Python 3.11, matching
  `deploy-vercel.yml` and the `python:3.11-slim` in `Dockerfile`. No Postgres
  service, no browsers, no seed, no `DATABASE_URL` — `verify:core` needs none of
  them. It builds the virtualenv with the exact command in
  `docs/local-environment.md`, so a green run also proves the documented setup.
  The overlap with `deploy-vercel.yml` on `main` is deliberate: parallel jobs,
  and this one reports first.
- `docs/shalomut-tracker-handoff.md` — the new workflow, what it does not carry
  and why it overlaps the deploy job.
- `.agents/skills/shalomut-verification/SKILL.md` — the `Python и AI boundary`
  section now names the Node-side gate beside the pytest rule it enforces, and
  the `[dev]` extra.
- `docs/local-environment.md` — new bullet under "Things that have bitten this
  project before"; `[dev]` in the one-time setup.
- `ai-analytics-service/README.md` — why a system `python3` cannot load this
  service at all on macOS; the boundary test names
  `tests/stub_pipeline_cli.py`, which is what it actually runs (the text said
  `python3 -m src.pipeline_cli`); the `[dev]` extra and what omitting it costs.

## In progress

None.

## Remaining

Nothing, beyond watching `verify-core.yml`'s first run on a real runner. It is
the one piece of this branch that local rehearsal cannot finish proving.

## Changed files

Modified: `package.json`, `src/app/api/__tests__/ai-e2e.test.ts`,
`scripts/verify-ai.mjs`, `scripts/local-unlocked-pipeline.ts`,
`scripts/local-stack.mjs`, `docs/local-environment.md`,
`.agents/skills/shalomut-verification/SKILL.md`,
`docs/shalomut-tracker-handoff.md`, `ai-analytics-service/README.md`.

Added: `scripts/ai-service-python.mjs`, `scripts/ai-service-python.d.mts`,
`scripts/check-version-literals-python.mjs`,
`scripts/check-python-interpreter.mjs` and its `.test.mjs`,
`.github/workflows/verify-core.yml`, this file.

## Verification evidence

All commands below ran with `/usr/bin/python3` (3.9.6) deliberately shadowing
the Homebrew 3.14 on `PATH`, so they reproduce the reported machine state rather
than a machine that happened to be configured well.

### Passed

- Reproduction of the reported "before": `echo '{}' | /usr/bin/python3 -m
  tests.stub_pipeline_cli` from `ai-analytics-service` →
  `ImportError: cannot import name 'NotRequired' from 'typing'` at
  `src/agents/state.py:1`. Same interpreter, same import, same line as reported.
- `npx tsx --test src/app/api/__tests__/ai-e2e.test.ts` — 3/3 pass, exit 0.
- `npm test` — 878/878 pass, exit 0.
- `npm run typecheck` — exit 0. This is what proves the `.d.mts` resolves: the
  test importing `scripts/ai-service-python.mjs` is inside the `tsc` program.
- `npm run lint` — exit 0.
- `npm run lint:literals` — 5 unit tests, "Architecture fitness check passed",
  Python half green through the resolver, exit 0.
- `npm run lint:interpreter` — 14 unit tests, repository check passed, exit 0.
  Negative proof taken, not assumed: with the three pre-fix call sites restored
  from `164ce9f` into the worktree, the gate exits 1 and names
  `src/app/api/__tests__/ai-e2e.test.ts:181`,
  `scripts/local-unlocked-pipeline.ts:149` and the `lint:literals` script —
  exactly the set this branch repaired, at the reported line numbers. The
  worktree was restored from HEAD afterwards.
- `npm run lint:composition`, `lint:fixtures`, `lint:skills`,
  `lint:mutation-config`, `lint:contract-refusals` — all exit 0.
- `npm run verify:ai` — 480 passed, exit 0, after `pip install -e ".[dev]"`.
- `npm run build` — exit 0, 42 static pages.
- **`npm run verify:core` as a single chain — exit 0.** This is the thing the
  task existed to restore, and it now completes with `python3` resolving to
  3.9.6.
- Negative path, taken rather than assumed: with `.venv` renamed away,
  `npm run verify:ai` and all three cross-service tests fail with the message
  naming `ai-analytics-service/.venv/bin/python`, the creation command and
  `docs/local-environment.md`. The virtualenv was restored afterwards.
- `node --check` on all three `scripts/*.mjs` — exit 0.
- `git diff --check` — exit 0.
- `verify-core.yml` rehearsed locally as a job body, from a tree with the
  virtualenv deleted and `node_modules` rebuilt: `npm ci` exit 0 (614
  packages), then the workflow's verbatim
  `python3 -m venv .venv && .venv/bin/python -m pip install -e ".[dev]"` exit 0,
  then `npm run verify:core` exit 0. The YAML parses under `js-yaml` with the
  expected name, triggers, concurrency group and six steps, and
  `npm run lint:interpreter` — which scans `.github/workflows/` — passes on it.
  Not the same as a runner: see Known risks.

### Failed

- None outstanding. `npm run build` failed at first with exit 1 — Turbopack
  cannot infer the workspace root inside a nested agent worktree that has no
  `node_modules` of its own and resolves upward: "We couldn't find the Next.js
  package (next/package.json) from the project directory:
  …/objective-aryabhata-af898c/src/app". That was environmental, not this diff:
  a `git stash push -u` baseline build produced the identical error. Symlinking
  `node_modules` did not help ("points out of the filesystem root"); a real
  `npm install` in the worktree did, and the build and the whole `verify:core`
  chain then passed. `next build` rewrites `next-env.d.ts` to the production
  route types; that churn was reverted rather than committed.

### Blocked or not run

- Playwright e2e, browser smoke, deployed checks: not applicable. No route,
  component, contract or runtime behavior changed.
- Mutation testing: not applicable. `src/lib/ai-contract.ts`,
  `src/lib/scoring-bands.ts` and `stryker.config.mjs` are untouched.

### Environment

- Local, worktree
  `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo/.claude/worktrees/objective-aryabhata-af898c`.
- `ai-analytics-service/.venv` was created in this worktree during the task
  (Python 3.14.6, `pip install -e ".[dev]"`). It is gitignored and local to this
  worktree; the parent checkout has its own.

### Residual risk

- The suite now hard-requires the virtualenv. That is the intended trade — a
  clear stop beats three confusing failures — but any environment that ran
  `npm test` without one, including a future CI job, now fails until it creates
  it.

## Failed approaches

None. The `.d.mts` shape was checked against `npm run typecheck` before the rest
of the change was built out, rather than after.

## Known risks

- `verify-core.yml` has never executed on a runner. Its job body was rehearsed
  locally step by step from a clean tree — `npm ci`, the venv command,
  `npm run verify:core`, all exit 0 — and the YAML parses, but the GitHub
  runner itself is unverified until the branch is pushed. Watch the first run.
  The likeliest difference is Python: CI pins 3.11, the rehearsal used the
  3.14 available on this machine.
- CI would not have caught the trap this branch fixes, and the new workflow
  would not have either. Both runners install a `python3` new enough for
  `typing.NotRequired`. What protects against a recurrence is
  `lint:interpreter`, which now runs in both jobs — a macOS-only failure caught
  by a rule rather than by a machine that happens to reproduce it.
- `lint:interpreter` reads source with regular expressions, not a parser. It
  reports command position inside string literals after blanking comments, so a
  `//` inside a string could truncate a line and hide a spawn behind it. The
  failure mode is a miss, never a false alarm — chosen deliberately, because a
  fitness gate that cries wolf gets deleted.

## Approval gates

None. No secrets, credentials, authentication configuration, deployment alias or
database write is involved.

## Questions requiring an owner decision

- Is the overlap on `main` worth its minutes? `verify-core.yml` and
  `deploy-vercel.yml` both run `verify:core` there, in parallel, for a faster
  first signal. The alternative is to make the deploy workflow's `validate` job
  `needs:` this one and drop `verify:core` from its `npm run verify` — cleaner,
  but it restructures the workflow a deployment waits on. Left as it is because
  that restructuring was not asked for.

## Next concrete step

Push the three remaining commits, which now fast-forward `main` from `e75bbb6`.
Push is an owner action:
`git push origin chore/python-from-the-service-venv:main`. Then watch the first
`Core verification` run — it is the one thing on this branch that local
rehearsal cannot finish proving. Everything else is done: `verify:core` passes
end to end on the rebased tree, and the open items above are decisions, not
work.
