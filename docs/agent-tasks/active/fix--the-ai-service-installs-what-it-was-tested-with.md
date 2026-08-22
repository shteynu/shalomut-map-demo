# The AI service installs what it was tested with

## Metadata

- Branch: `fix/the-ai-service-installs-what-it-was-tested-with`
- Base branch: `main`
- Base commit: `697109c`
- Current HEAD: `075c4a6` is the work; the tip is the documentation commit that
  carries this file
- Status: complete and verified, committed locally, unpushed
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the supply-chain entry of the 2026-08-21 audit: the Python service that
runs the paid analysis pipeline installed four `>=` bounds with no lockfile, so
every rebuild silently accepted whatever PyPI served that day.

## User-visible outcome

None. The same service answers the same way; what changes is that its packages
are now a decision rather than a date.

## Context

The finding came from the audit's completeness critic and had not been
adversarially checked. It was checked here before anything changed, and the
divergence was real rather than theoretical: the local virtualenv held
`fastapi 0.140.0` and `starlette 1.3.1`, while resolving the same declarations
today gives `0.141.1` and `1.6.0`. Three install paths — a development machine,
two CI gates, the Render image — each resolved independently, and nothing in
the repository recorded what any of them had.

`docs/local-environment.md` opens by promising that a local run which passes
means the deployed one passes. This was the half of that sentence nobody could
keep.

## Scope

- `ai-analytics-service/requirements.txt` — now a generated lock rather than
  four lines of intent.
- `ai-analytics-service/requirements-dev.txt` (new) — the same tree plus the
  test tools.
- `Dockerfile`, `.github/workflows/verify-core.yml`,
  `.github/workflows/deploy-vercel.yml`, `docs/local-environment.md` — install
  from a lock with `--require-hashes`.
- `scripts/check-python-deps.mjs` and its test (new), `package.json` —
  `lint:python-deps`, inside `verify:core`.
- `ai-analytics-service/README.md`, the verification skill's matrix, the audit
  file, `PROGRESS.md`, the handoff, this file.

## Non-goals

- Upgrading anything on purpose. The lock is today's resolution of the floors
  that were already declared; no floor was raised.
- Pinning the Node half. `package-lock.json` already exists and `npm ci` uses it.
- Automating the upgrade cadence. See "Decisions made".

## Acceptance criteria

- No install path can resolve a dependency at build time.
- The versions the suite passes against are the versions the deployment runs.
- A tampered distribution is refused rather than installed.
- The three ways this comes undone are caught by a check rather than by review.

## Relevant repository instructions

`AGENTS.md`: current code and configuration outrank prose, so the four places
that install and the two documents that describe installing had to move
together. Nothing here touches a credential, a secret or a deployment variable.

## Relevant architecture and contracts

None of the AI contracts change. `render.yaml`'s `buildFilter` matters
operationally: `Dockerfile` and `ai-analytics-service/**` are two of its paths,
so landing this rebuilds the Render service. The handoff carries that.

## Decisions made

- **`pyproject.toml` stays the declaration; the locks are generated from it.**
  A hand-maintained `requirements.txt` beside a `[project.dependencies]` array
  is two copies of one list, and they were already identical by hand rather
  than by construction.
- **Two locks, not one.** `requirements-dev.txt` is the runtime lock plus test
  tools at identical versions, so the suite cannot prove something about
  packages the deployment does not run. The check enforces that relation.
- **`--universal`.** One lock resolves across every platform and every Python
  from the `requires-python` floor up, so macOS development, the Linux runner
  and `python:3.11-slim` read the same file with markers rather than three
  files that drift.
- **The editable install is a second command with `--no-deps`.**
  `--require-hashes` is all-or-nothing per file and an editable path cannot be
  hashed. `--no-deps` is what stops it resolving the floors again behind the
  lock's back.
- **No automatic upgrades.** The cadence is written in the service README as a
  decision: dependency change, security advisory, or a deliberate upgrade pass
  that goes through the full suite. A bot that opens version bumps into a paid
  pipeline rebuilds the failure this replaced with better manners.
- **The check does not verify freshness**, and says so. Whether today's pins are
  the right ones cannot be read off the files; that a lock disagrees with the
  declaration can.

## Assumptions

- `uv` is available to whoever regenerates the locks. It is the only new tool,
  it is not needed to install or to run anything, and `pip-compile` produces the
  same format if it is ever absent.

## Completed

Everything in scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `ai-analytics-service/requirements.txt`, `ai-analytics-service/requirements-dev.txt` (new)
- `Dockerfile`, `.github/workflows/verify-core.yml`, `.github/workflows/deploy-vercel.yml`
- `scripts/check-python-deps.mjs` (new), `scripts/check-python-deps.test.mjs` (new), `package.json`
- `ai-analytics-service/README.md`, `docs/local-environment.md`
- `.agents/skills/shalomut-verification/SKILL.md`
- `docs/critical-audit-2026-08-21.md`, `PROGRESS.md`,
  `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

- **The finding was reproduced first.** `requirements.txt` was four `>=` lines,
  no lockfile anywhere, and `pip install` in the `Dockerfile` carried no hash
  flag. The three environments held different packages: the local virtualenv
  `fastapi 0.140.0` / `starlette 1.3.1` / `uvicorn 0.51.0`, against `0.141.1` /
  `1.6.0` / `0.52.4` from resolving the same declarations today.
- **The image builds on the interpreter the deployment uses.** `docker build`
  of the real `Dockerfile`, `python:3.11-slim`, `--require-hashes`: `REAL_EXIT=0`,
  22 packages installed at the pinned versions.
- **The suite passes on those versions, on 3.11.** The whole service suite run
  inside that image over a bind mount, because `.dockerignore` keeps `tests/`
  out of it: **576 passed**, the same count as the baseline. This is the
  evidence that matters most — a development machine here runs 3.14, and no
  3.11 interpreter could be provisioned locally (see "Failed approaches").
- **And on the development interpreter.** The local virtualenv was reinstalled
  from `requirements-dev.txt` with `--require-hashes` and re-run: 576 passed on
  Python 3.14 at the pinned versions. Local and CI now hold the same packages.
- **`--require-hashes` has teeth, not just a presence in a line.** Every hash of
  one package was altered in a copy of the lock and the install re-run in the
  image: pip refused with `THESE PACKAGES DO NOT MATCH THE HASHES FROM THE
  REQUIREMENTS FILE`, naming expected and received digests.
- **`npm run verify:core`, unpiped, `REAL_EXIT=0`.** 1435 Node tests, 576 Python
  tests, build included. `npm run lint:skills` separately, `REAL_EXIT=0`, for
  the verification-skill edit.
- **`lint:python-deps`: 15 unit tests, and three mutations of the real files,
  each caught.**
  1. `--require-hashes` removed from the `Dockerfile` → `Dockerfile:29` named.
  2. A floor raised in `pyproject.toml` above the pin → both locks named, with
     the version and the specifier that now disagree.
  3. A requirement's hashes removed from the lock → the line named, with why the
     whole file becomes unusable.
  The tree was restored from a scratchpad copy after each, and the check passes
  again on the restored files.

### Failed

None.

### Blocked or not run

- **Nothing was deployed.** The Render service still serves `e69a5eb`; the
  rebuild happens when this lands. The build was exercised locally instead,
  which is the same `Dockerfile` and the same base image but not the same
  builder.
- No `verify:db` run: this branch touches no repository, schema or query.

### Environment

Local. Docker 29.5.2 for the 3.11 half. `uv 0.11.32` to compile the locks. No
network access to anything but PyPI and Docker Hub; nothing was written to any
database, deployed or local.

### Residual risk

Low, and it is a build risk rather than a runtime one: if Render's builder
resolves the image differently from this machine's, the build fails loudly
rather than deploying something unexpected — which is the property being added.
The versions themselves are today's resolution of floors that were already in
force, and the suite passes on them on both interpreters.

## Failed approaches

- **A local Python 3.11 virtualenv.** `uv venv --python 3.11` downloads a
  managed interpreter from GitHub, and that download fails here with
  `invalid peer certificate: UnknownIssuer` — this machine's proxy. Hence the
  Docker route, which is a better proof anyway: it is the image the deployment
  actually runs.
- **Tampering one hash to test `--require-hashes`.** The install succeeded, and
  the reason is worth keeping: a requirement carries a hash per distribution —
  sdist and wheel — and the list is a set of *permitted* artifacts, so one bad
  entry changes nothing. The mutation only means something when every hash of
  the package is altered.

## Known risks

The lock has to be regenerated when `pyproject.toml` changes, and `uv` is the
tool that does it. `lint:python-deps` fails the build when somebody forgets, so
the risk is a blocked commit rather than a silent divergence.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

- **When to take an upgrade pass.** The cadence is deliberately manual. Nothing
  in this branch is stale today; the question is who decides that in a month.
- Standing: rotate `GEMINI_API_KEY` before any paid round; the server-issued
  attempt token; pagination and server-side search in the administration
  console; the unverified `prisma migrate deploy` path from ADR-040.

## Git state

Read 2026-08-22, not remembered:

- Branch `fix/the-ai-service-installs-what-it-was-tested-with`, based on
  `697109c` — which is `main` plus the documentation commit that closed the
  previous task. `075c4a6` is the work; the tip is the documentation commit
  carrying this file.
- Worktree clean apart from ` M next-env.d.ts`, which is generated and belongs
  to the owner. Nothing staged. `git ls-files -o --exclude-standard` is empty,
  which is the check that matters here because this repository's untracked
  cache has hidden a new file before.
- Nothing is on `origin`. Both commits are visible only in this worktree until
  the branch is pushed; another checkout or machine sees none of it.
- `origin/main` is `8af02ab`, so this branch is two commits ahead of the
  deployment.

## Next concrete step

Land it, which is the owner's action:

```bash
git push origin fix/the-ai-service-installs-what-it-was-tested-with:main
```

That push rebuilds two things, not one: Vercel builds Core as always, and
Render rebuilds the AI service because `Dockerfile` and `ai-analytics-service/**`
are in its `buildFilter`. On the free plan the old container stops before the
new one answers, so expect a few minutes of `502` and an uptime-monitor alert.
Afterwards read the service's `/health` and expect a commit that is no longer
`e69a5eb`.
