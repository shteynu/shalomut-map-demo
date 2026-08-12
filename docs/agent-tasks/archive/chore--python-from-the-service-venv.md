# The Node side asks the service which Python it runs on

## Metadata

- Branch: `chore/python-from-the-service-venv`
- Base branch: `main`
- Base commit: `164c9ef`, rebased mid-task onto `e75bbb6` when
  `chore/skill-lint-discovers-entrypoints` landed first
- Landed on `main` as `219d36a`…`b3a505c`, fourteen commits across three pushes,
  interleaved with that other branch rather than contiguous
- Status: landed and archived. `Core verification` green on a real runner.
- Last updated: 2026-08-12
- Last agent/tool: Claude Opus 5 (Claude Code), worktree
  `.claude/worktrees/objective-aryabhata-af898c`

## Objective

Make every Node-side caller resolve the AI service interpreter the way
`shalomut-verification` already requires for pytest — the virtualenv, never a
`python3` from PATH — fail on the missing environment instead of on an
ImportError from inside the service, and keep the rule enforced.

## User-visible outcome

`npm test` and `npm run verify:core` complete on a clean checkout whatever
`python3` happens to be on PATH. A checkout without the virtualenv is told which
interpreter is missing and which document creates it, instead of being handed a
Python traceback.

## Context

`src/app/api/__tests__/ai-e2e.test.ts` spawned `python3 -m
tests.stub_pipeline_cli`. On macOS `python3` is often `/usr/bin/python3` (3.9.6,
Command Line Tools), below the `requires-python = ">=3.11"` the service
declares, so `ai-analytics-service/src/agents/state.py:1` raised `ImportError:
cannot import name 'NotRequired' from 'typing'` and all three cross-service
tests failed. `verify:core` chains `npm test`, so the whole gate stopped there.

`scripts/verify-ai.mjs` and `scripts/local-stack.mjs` already resolved
`.venv/bin/python`. The rule existed; the test harness and two other callers did
not follow it.

**A claim inherited from the spun-off task is false and is corrected here.** It
said no workflow runs `npm test`; `deploy-vercel.yml` has been running
`npm run verify` — which chains it — on every push and PR to `main` all along.
The claim came from grepping for the literal string. CI was green throughout
and could not have caught this anyway: its `python3` is 3.11, and the stub CLI
imports nothing outside the standard library, checked by running it under a
clean 3.14 with no service dependencies. The trap was macOS-3.9-only. Spun off
from `docs/agent-tasks/archive/docs--agent-skill-routing-progressive-disclosure.md`,
archived mid-flight, so the correction belongs here and not in that record.

## Scope

- One resolver, `scripts/ai-service-python.mjs`, for every Node-side caller.
- Four call sites moved onto it.
- A fitness gate so the rule survives the next `spawnSync('python3', …)`.
- A CI job that runs `verify:core` on every branch.
- Documentation that disagreed with the code.

## Non-goals

- Anything about the deployed AI service.
- Changing `deploy-vercel.yml`. It remains the gate a deployment waits on; the
  new core job runs beside it rather than carving work out of it.
- Migrating `scripts/local-stack.mjs` onto the resolver. It spells
  `path.join(aiServiceRoot, ".venv", "bin", "python")` itself, which is correct
  and passes the gate; folding it in would be tidier and is not this task.

## Acceptance criteria

All met, each proven rather than argued — see Verification evidence. `npm test`
green with `python3` at 3.9.6; a virtualenv-less checkout told what is missing
and where the instructions are; no `python3` spawned by name outside the two
venv-creation commands; a gate that fails on the pre-fix tree and passes here;
`verify:core` running in CI on a push.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md`, `Python и AI boundary`:
  «Именно интерпретатор из `.venv`, а не `python3`». This task makes the harness
  obey the rule the skill already stated.
- `AGENTS.md`, documentation lifecycle: current code outranks prose, and the
  living document is updated in the same task.

## Relevant architecture and contracts

None touched. The diff is test/tooling wiring, CI and documentation.

## Decisions made

- **One resolver, not three copies.** The rule is short enough to duplicate and
  exactly the kind of thing that then drifts.
- **`.mjs` with a hand-written `ai-service-python.d.mts`.** Two kinds of caller:
  scripts run by bare `node`, and TypeScript that `tsc` typechecks.
  `tsconfig.json` excludes `scripts/` and sets `allowJs: false`, so the
  declaration file is what lets a `src/**` test import it and still typecheck.
- **The test fails rather than skips when the virtualenv is absent.** A silently
  skipped cross-service test is how this class of breakage hides.
- **Resolve inside `runPythonPipeline`, not at module load**, so each test that
  needs Python reports the missing environment itself.
- **The gate matches command position, not any mention.** Its first draft failed
  on the resolver's own error message, which is several sentences about why a
  system `python3` will not do; a gate that fails on its own explanation gets
  switched off. A lone `'python'` counts only as a spawn's argv[0], because it
  is also the last segment of `path.join(…, '.venv', 'bin', 'python')`.
- **The CI job runs on every branch, overlapping `deploy-vercel.yml` on
  `main`.** An earlier draft excluded `main`, which would have made it almost
  never fire: work is landed here by pushing a branch straight onto `main`. The
  overlap buys a first signal in ~1.5 minutes instead of ~4.

## Assumptions

- Every developer and agent has, or can create, the service virtualenv. It was
  already required by `npm run local`, `npm run verify:ai` and the
  `shalomut-verification` matrix; this adds `npm test` to that list.

## Completed

- `scripts/ai-service-python.mjs` and its `.d.mts` — the resolver.
  `requireAiServicePython(purpose)` names the missing path, the creation command
  and why a system `python3` is not a substitute.
- Callers moved onto it: `src/app/api/__tests__/ai-e2e.test.ts`,
  `scripts/verify-ai.mjs`, `scripts/local-unlocked-pipeline.ts`, and
  `lint:literals` via the new `scripts/check-version-literals-python.mjs`, which
  runs from the repository root because the Python checker walks
  `ai-analytics-service/src` relative to the working directory.
- `scripts/check-python-interpreter.mjs` and `.test.mjs`, wired as
  `npm run lint:interpreter` inside `verify:core`. Scans `scripts/`, `src/`,
  `e2e/`, `package.json` and `.github/workflows/`; allows `python3 -m venv`;
  excludes its own fixtures by exact filename, not a `*.test.mjs` pattern. It
  also fails if the resolver is deleted or gutted — the direction the main rule
  cannot see.
- `.github/workflows/verify-core.yml` — `verify:core` on every push plus
  `workflow_dispatch`, per-ref concurrency, Node 20 and Python 3.11 matching
  `deploy-vercel.yml` and the `python:3.11-slim` in `Dockerfile`. No Postgres,
  no browsers, no seed, no `DATABASE_URL`. The venv step is the verbatim command
  from `docs/local-environment.md`, so a green run also proves that setup.
- **Second defect, found by following the documentation:** `pip install -e .`
  never installs `pytest`, which lives in the `[dev]` extra, so a virtualenv
  built exactly as documented answered `No module named pytest` to
  `npm run verify:ai`. Corrected to `pip install -e ".[dev]"` in
  `docs/local-environment.md`, `ai-analytics-service/README.md`,
  `scripts/local-stack.mjs` and the resolver's error message.
- Documentation: a new bullet in `docs/local-environment.md`; in
  `ai-analytics-service/README.md`, why a system `python3` cannot load the
  service on macOS and the boundary test's real entry point
  (`ai-analytics-service/tests/stub_pipeline_cli.py`, not `src.pipeline_cli`);
  the Node-side gate beside the pytest rule in
  `.agents/skills/shalomut-verification/SKILL.md`; and two handoff entries — the
  CI job, and that every worktree now needs its own `.venv`.

## In progress

None.

## Remaining

Nothing. What is left is bookkeeping: one unpushed commit, and this file's move
to `docs/agent-tasks/archive/` once it is on `main`.

## Changed files

Modified: `package.json`, `src/app/api/__tests__/ai-e2e.test.ts`,
`scripts/verify-ai.mjs`, `scripts/local-unlocked-pipeline.ts`,
`scripts/local-stack.mjs`, `docs/local-environment.md`,
`.agents/skills/shalomut-verification/SKILL.md`,
`docs/shalomut-tracker-handoff.md`, `ai-analytics-service/README.md`.

Added: `scripts/ai-service-python.mjs`, `scripts/ai-service-python.d.mts`,
`scripts/check-version-literals-python.mjs`,
`scripts/check-python-interpreter.mjs`,
`scripts/check-python-interpreter.test.mjs`,
`.github/workflows/verify-core.yml`, this file.

## Verification evidence

Every local command ran with `/usr/bin/python3` (3.9.6) deliberately shadowing
the Homebrew 3.14 on `PATH`, reproducing the reported machine rather than one
that happened to be configured well.

### Passed

- **`npm run verify:core` as a single chain — exit 0.** The thing the task
  existed to restore. Covers `npm test` 878/878, `typecheck`, `lint`, `build`
  (42 pages) and all seven `lint:*` gates, so those are not itemised here.
- **`Core verification` on a real runner — run `31581252165`, `main`, success in
  1m38s.** Its log shows the venv step installing the `[dev]` extra
  (`pytest-9.1.1` among 28 packages), `Python interpreter fitness check passed`
  inside CI, 878 tests, a compiled build — and it finished while
  `Vercel Deployment & Pipeline Checks` on the same commit was still running at
  3m35s, which is the fail-fast overlap the workflow exists for.
- `npm run verify:ai` — 480 passed, exit 0, after `pip install -e ".[dev]"`.
- Reproduction of the reported "before": `echo '{}' | /usr/bin/python3 -m
  tests.stub_pipeline_cli` from `ai-analytics-service` → `ImportError: cannot
  import name 'NotRequired' from 'typing'` at `src/agents/state.py:1`. Same
  interpreter, same import, same line as reported.
- Negative proof for the resolver, taken rather than assumed: with `.venv`
  renamed away, `npm run verify:ai` and all three cross-service tests fail with
  the message naming `ai-analytics-service/.venv/bin/python`, the creation
  command and `docs/local-environment.md`. Restored afterwards.
- Negative proof for the gate: with the three pre-fix call sites restored from
  `164c9ef`, `lint:interpreter` exits 1 naming
  `src/app/api/__tests__/ai-e2e.test.ts:181`,
  `scripts/local-unlocked-pipeline.ts:149` and the `lint:literals` script —
  exactly the set this branch repaired, at the reported line numbers. Restored
  afterwards.
- `npm run typecheck` exit 0 is what proves the `.d.mts` resolves: the test
  importing `scripts/ai-service-python.mjs` is inside the `tsc` program.
- After the rebase, `verify:core` was re-run whole on the new base; the upgraded
  skills check passes alongside this branch's `SKILL.md` edit (28 tests, "4
  declared entrypoints"). Docs-only final diff: `git diff --check` and
  `lint:skills` exit 0, every repository path named here resolves.

### Failed

- None outstanding. `npm run build` failed at first inside this worktree —
  Turbopack cannot infer the workspace root where there is no local
  `node_modules` and resolution goes upward. Environmental, not this diff: a
  stashed baseline produced the identical error. A symlink did not help ("points
  out of the filesystem root"); a real `npm install` here did.

### Blocked or not run

- Playwright e2e, browser smoke, deployed checks: not applicable. No route,
  component, contract or runtime behavior changed.
- Mutation testing: not applicable. `src/lib/ai-contract.ts`,
  `src/lib/scoring-bands.ts` and `stryker.config.mjs` are untouched.

### Environment

- Local worktree `.claude/worktrees/objective-aryabhata-af898c`, plus CI on
  `main`. `ai-analytics-service/.venv` was created here during the task (Python
  3.14.6, `[dev]`); it is gitignored and local to this worktree.

### Residual risk

- The suite now hard-requires the virtualenv. Intended — a clear stop beats
  three confusing failures — but any environment that used to run `npm test`
  without one now fails until it creates one.
- `lint:interpreter` reads source with regular expressions, not a parser. It
  blanks comments before looking inside string literals, so a `//` inside a
  string could truncate a line and hide a spawn behind it. The failure mode is a
  miss, never a false alarm — chosen deliberately, because a gate that cries
  wolf gets deleted.

## Failed approaches

None. The `.d.mts` shape was checked against `npm run typecheck` before the rest
of the change was built, and the CI job's trigger was corrected from
`branches-ignore: [main]` before it was committed, once it was clear that
branches here are pushed straight onto `main`.

## Known risks

- The runner warns that `actions/checkout@v4`, `actions/setup-node@v4` and
  `actions/setup-python@v5` target a deprecated Node 20 action runtime and are
  forced onto Node 24. Not introduced here — `deploy-vercel.yml` and
  `codeql.yml` pin the same majors and carry the same annotation — but
  `verify-core.yml` is a third place that will need the bump. Unrelated to the
  job's own `node-version: 20`, which is the Node the project builds under.

## Approval gates

None. No secrets, credentials, authentication configuration, deployment alias or
database write is involved.

## Questions requiring an owner decision

- Is the overlap on `main` worth its minutes? Both workflows run `verify:core`
  there, in parallel, for a faster first signal. The alternative is to make
  `deploy-vercel.yml`'s `validate` job `needs:` this one and drop `verify:core`
  from its `npm run verify` — cleaner, but it restructures the workflow a
  deployment waits on. Left alone because that was not asked for.

## Next concrete step

Push the remaining commits — they fast-forward `main` from `2b88877` — and then
move this file to `docs/agent-tasks/archive/`. Push is an owner action:
`git push origin chore/python-from-the-service-venv:main`.

Do not archive this file before that push lands. Archiving is a claim that the
work is on `main`, and one commit is not there yet.
