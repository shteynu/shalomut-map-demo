# Branch-aware multi-agent handoff

## Metadata

- Branch: `chore/branch-aware-agent-handoff`
- Base branch: `origin/main`
- Base commit: `f3dbce4e22afb8cfdfc66df3989d7351afeb1a9f`
- Current HEAD: `f3dbce4e22afb8cfdfc66df3989d7351afeb1a9f`
- Status: Verified; publication to `origin/main` authorized
- Last updated: 2026-07-30
- Last agent/tool: Codex

## Objective

Extend the existing Shalomut agent system with branch-scoped durable task state
so work can move between Claude Code, Codex and Gemini/Antigravity-style tools
without chat-history transfer or collisions between parallel tasks.

## User-visible outcome

No runtime product behavior changes. Developers and agents gain a documented
branch-aware handoff workflow, a read-only context command and one canonical
full verification entry point reused by CI.

## Context

The repository already uses `AGENTS.md`, thin tool adapters, canonical skills,
`PROJECT_CONTEXT.md`, `PROGRESS.md` and an operational handoff. Those sources
remain in place; this task narrows active implementation state to one file per
branch instead of creating a competing global current-task document.

## Scope

- Add `docs/agent-tasks/` template, active/archive lifecycle and worktree rules.
- Teach `shalomut-tracker` and `AGENTS.md` to resolve branch-scoped task state.
- Keep Claude and Gemini-compatible adapters thin.
- Add a read-only `npm run agent:context` command.
- Add canonical `verify:core`, `verify:ai` and `verify` commands and reuse the
  full gate in CI.
- Add an ADR and fix clearly accidental developer-local documentation links.

## Non-goals

- Product, API, persistence, Prisma or AI contract behavior.
- Deployments, aliases, credentials, authentication or external state changes.
- An external synchronization service or checked-in chat history.
- A broad rewrite of historical progress and operational evidence.

## Acceptance criteria

- Each substantial branch resolves to an independent task file.
- Replacement agents can find scope, decisions, state, evidence and one next
  step from repository files.
- Parallel agents are directed to different branches and worktrees.
- `npm run agent:context` is read-only and handles normal, missing-task,
  no-upstream, dirty and detached states.
- `npm run verify` covers the current complete TypeScript/ESLint/build/Python
  gate, and CI reuses it without weakening deploy dependencies.
- Repository docs contain no developer-specific absolute filesystem links.

## Relevant repository instructions

- `AGENTS.md`
- `.agents/skills/shalomut-tracker/SKILL.md`
- `.agents/skills/shalomut-map/SKILL.md`
- `.agents/skills/shalomut-verification/SKILL.md`

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md`
- `docs/shalomut-tracker-handoff.md`
- `.github/workflows/deploy-vercel.yml`
- No application or AI contract is changed.

## Decisions made

- Use `docs/agent-tasks/active/<branch-with-slashes-as-double-dashes>.md`.
- Number the collaboration ADR as 008 because ADR-007 already exists.
- Use a small Node wrapper for Python verification so a missing `.venv` fails
  with the supported setup document instead of an opaque shell error.

## Assumptions

- `origin/main` at session start (`f3dbce4`) is the intended base.
- The supported verification environment is Unix-like, matching local macOS
  and the Ubuntu GitHub Actions runner.

## Completed

- Fetched/pruned origin and confirmed local `main` equals `origin/main`.
- Created this dedicated branch and task document.
- Read the required agent, architecture, progress, operational, package and CI
  context before editing.
- Added the task template, active/archive lifecycle, worktree guidance and
  ADR-008 without replacing the existing agent system.
- Updated `AGENTS.md`, `GEMINI.md` and `shalomut-tracker` with branch-aware
  resolution, memory ownership and collision prevention rules.
- Added the read-only context command and exercised normal, existing-task,
  dirty, missing-task, no-upstream, detached-HEAD and Git-failure states.
- Added a tool-neutral start/save workflow and explicit Git visibility boundary
  so agents do not mistake same-worktree uncommitted state for a portable
  cross-worktree or cross-machine handoff.
- Made the save-progress checklist mandatory in root `AGENTS.md`, so every
  adapter-importing agent applies it without relying on a previous chat.
- Audited instruction context size, corrected the handoff trigger from tool
  switching to agent switching, made large global documents section-scoped and
  added compaction guidance for branch task files above roughly 12 KB.
- Added canonical Core/AI/full verification scripts and changed CI to call the
  full command after both environments are installed.
- Removed developer-specific filesystem paths from the relevant Markdown while
  preserving the historical engineering facts.
- Ran the complete local verification gate successfully.

## In progress

- Publishing the verified snapshot requested by the owner.

## Remaining

- Commit the verified snapshot, archive this completed task handoff and push
  both commits directly to `origin/main`.

## Changed files

- Committed: base `f3dbce4`; no task commits.
- Staged: none.
- Unstaged modified: `.agents/skills/shalomut-tracker/SKILL.md`,
  `.github/workflows/deploy-vercel.yml`, `AGENTS.md`, `GEMINI.md`,
  `PROGRESS.md`, `PROJECT_CONTEXT.md`, `README.md`,
  `docs/shalomut-tracker-handoff.md`, `docs/source-of-truth.md`, `package.json`.
- Untracked: `docs/adr/008-branch-aware-agent-handoff.md`,
  `docs/agent-tasks/README.md`, `docs/agent-tasks/TEMPLATE.md`, this task file,
  `docs/agent-tasks/archive/README.md`, `scripts/agent-context.mjs`,
  `scripts/verify-ai.mjs`.

## Verification evidence

### Passed

- `node scripts/agent-context.mjs` and `npm run agent:context`: resolved this
  branch to this existing task file, printed upstream/divergence, dirty state,
  changed-file buckets, recent commits and the next step.
- Temporary worktrees: missing task + branch without upstream and detached HEAD
  were reported correctly; temporary worktrees and branch were removed.
- Invocation outside a Git repository failed with a useful `git rev-parse`
  diagnostic.
- `node --check scripts/agent-context.mjs` and
  `node --check scripts/verify-ai.mjs`.
- `npm run verify`: `npm run typecheck`; 274/274 TypeScript tests; ESLint;
  production build with 40 generated routes; 269/269 Python tests.
- The same complete `npm run verify` gate passed again immediately before the
  owner-authorized publication to `origin/main`.
- `package.json` JSON parse and required-script assertions; workflow YAML parse.
- `git diff --check`; Markdown local-path scan and scoped secret/private-link
  scan returned no findings.
- Preservation audit against `origin/main`: the complete 1184-line progress
  history is retained with only three developer-local path spellings replaced,
  and the complete 1458-line operational handoff is retained with only one
  local backup path replaced.
- Structural handoff audit: root `AGENTS.md` contains every mandatory save
  step, both tool adapters import it, `shalomut-tracker` owns the detailed
  protocol, and the portable agent guide contains start/save/visibility
  sections.
- Context-budget audit: the always-loaded common rules are about 5.6k
  characters; resume/implementation/verification instructions plus this task
  file remain roughly 21k/26k/33k characters before task-specific source. Large
  global history is no longer a default runtime/API dependency.

### Failed

- None.

### Blocked or not run

- GitHub Actions was not run because nothing was pushed.
- Browser/runtime and deployed smoke were not run because runtime behavior and
  deployment are outside scope.

### Environment

- Local macOS checkout; Node `v22.23.1`, npm `10.9.8`, Python `3.14.6` from the
  project `.venv`. The only external contact was `git fetch origin --prune`.

### Residual risk

- The Ubuntu/Node 20/Python 3.11 CI environment has not executed the new wrapper
  until the branch is pushed, although it invokes the same underlying commands.
- The context script intentionally targets the Unix-like local and CI
  environments already supported by this repository.

## Failed approaches

- None.

## Known risks

- Documentation drift if future agents skip task-file updates; the context
  command and tracker protocol make the expected file explicit.

## Approval gates

- No deployment, alias, secret, credential or authentication changes are in
  scope. Any such mutation requires separate explicit approval.

## Questions requiring an owner decision

- None.

## Next concrete step

Commit the verified implementation snapshot.
