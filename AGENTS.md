# Shalomut Map — instructions for AI coding agents

These instructions apply to every coding agent working in this repository.
Treat the version-controlled skills under `.agents/skills/` as the canonical
agent guidance. Do not prefer user-local or ignored copies of the same skills.

## Required skill routing

Match the task to a skill, open that skill, and follow the reading map in its
own `Как читать этот скилл` section. Every skill states there which of its
sections are always in force and which are opened only when a named condition
holds. That map — not this file — decides how much of a skill a task needs, so
that a client with automatic discovery and a client reading the file directly
end up applying the same rules.

- Changing or reviewing Shalomut product behavior, code, tests, UI, methodology,
  API, persistence, AI integration or documentation →
  `.agents/skills/shalomut-map/SKILL.md`.
- Starting, continuing or resuming work, reporting status, choosing next steps,
  saving progress, closing a session or preparing a handoff →
  `.agents/skills/shalomut-tracker/SKILL.md`.
- Verifying, testing, proving a fix, checking readiness, reviewing evidence, or
  about to claim a substantive change is complete →
  `.agents/skills/shalomut-verification/SKILL.md`.
- When several match, use `shalomut-tracker` first to establish state,
  `shalomut-map` for implementation and `shalomut-verification` for evidence.

Read the always-in-force part before substantial work and open the rest when its
condition actually holds. Loading a section is cheap and skipping a rule is not,
so when a condition is ambiguous, open the section.

### One canonical set for every agent

- `.agents/skills/` is the only source of skills for this repository. It is the
  native skills directory for some clients and a direct-read path for others;
  both are correct, and both read the same files.
- If the active client does not discover skills automatically, open the
  `SKILL.md` files named above directly and follow them as repository
  instructions. Discovery changes how a file is found, never what it says.
- Do not create a client-local copy of a skill — `.claude/skills/`,
  `.gemini/skills/` or otherwise. A copy is a fork that drifts silently, and
  both copies then claim to be canonical.
- A skill's `references/` files are part of that skill. Add them beside their
  `SKILL.md`, never in a client-specific location.
- `npm run lint:skills` checks what a reader cannot: that no skill copy sits
  outside `.agents/skills/`, that every `references/` file is linked from its own
  skill and every link resolves, that each skill's frontmatter name matches its
  directory, that each section is classified by the skill's reading map, and that
  the four declared client adapters still route here. It also sweeps the
  repository for entrypoint files nobody declared — a root `.<client>rules`,
  Markdown under `.<client>/rules/`, `AGENT.md`, `.github/instructions/**` and
  the like — and fails on any that names neither `AGENTS.md` nor
  `.agents/skills/`, because that is a second set of rules no one compared
  against the first. It cannot judge whether an adapter's prose contradicts what
  it points at — that stays a review question.

## Repository-wide safety gates

- The project is at the design stage: two environments and no others — local
  (`docs/local-environment.md`) and deployed — with no real respondents and no
  production data. The Vercel alias named `Production` is an operational
  staging endpoint. Treat database contents as disposable — clearing, reseeding,
  resetting the schema and applying migrations are ordinary work and need no
  approval ritual, backup or PITR checkpoint. Confirm the target environment
  because a write to the wrong place wastes time, not because the data is
  precious.
- Obtain explicit bounded approval before changing credentials, secrets or
  authentication configuration, and before repointing deployment aliases.
- Never expose respondent identity or detailed results below the configured
  privacy threshold. This is a product invariant, not an environment gate.
- Preserve unrelated user changes in a dirty worktree and verify changes in
  proportion to risk.

Direct system, developer and user instructions take precedence over this file.

## Branch-scoped task state

- One independently deliverable task uses one branch and one active task file
  under `docs/agent-tasks/active/`. Derive the filename from the branch by
  replacing every `/` with `--`.
- At session start, inspect both local and locally available remote Git state,
  then read the matching task file before continuing substantial work. Create
  one from `docs/agent-tasks/TEMPLATE.md` when a new substantial task has no
  file; do not create one for small questions or read-only lookups.
- The active task file owns the current implementation state and handoff for
  that branch. Keep durable project architecture in `PROJECT_CONTEXT.md`,
  product milestones in `PROGRESS.md`, and cross-task deployed state, external
  blockers and approval gates in `docs/shalomut-tracker-handoff.md`.
- Before switching agents or stopping with unfinished work, update the task
  file with the exact committed, staged, unstaged and untracked state plus one
  concrete next step. Record only verification that actually ran.
- Visibility follows Git: uncommitted state is visible only in the same
  worktree, another worktree can consume it after a commit exists on the
  branch, and another checkout or machine can consume it after that branch is
  pushed. Never claim a wider handoff boundary than the state actually has.
- The portable step-by-step workflow for every agent is documented in
  `docs/agent-tasks/README.md`; detailed start/save behavior remains owned by
  the `shalomut-tracker` skill.

## Documentation lifecycle

- Use `docs/README.md` to distinguish living documentation, implemented
  specifications, historical plans and branch-local task records.
- Current code, tests, schemas and configuration outrank prose. When a living
  document disagrees with them, update the document in the same task.
- `npm run lint:doc-numbers` enforces that rule for the numbers documents quote
  from configuration, and only for those. It says nothing about prose that
  describes behaviour, so a passing check is not evidence that a document
  survived a change — read it.
- Do not rewrite dated plans or archived task files as if they were current.
  Preserve them as historical evidence and point readers to the living source.
- Keep `PROGRESS.md` to concise product-level milestones and keep
  `docs/shalomut-tracker-handoff.md` to current cross-task operational state,
  external blockers and approval gates. Git and archived task files own the
  detailed session history.

## Mandatory progress handoff

Every agent must perform this protocol before switching agents, handing work to
another agent, or ending a session with substantial work in progress:

1. Inspect the complete diff, current HEAD, staged, unstaged and untracked
   files, recent commits and upstream state.
2. Read `shalomut-verification` and run the checks appropriate to the actual
   diff. Never record a check that did not run.
3. Update the active branch task file first. Record metadata/current HEAD,
   completed/in-progress/remaining work, decisions, assumptions, exact Git
   state, passed/failed/blocked/not-run evidence, risks and approval gates.
4. Leave exactly one clear `Next concrete step` for the replacement agent.
5. Update global documents only when their owned state changed; ordinary
   session details belong only in the branch task file.
6. Never store chats, hidden reasoning, secrets, credentials, private AI
   session URLs or large copied diffs in repository documentation.

Follow the full save-progress and visibility rules in
`.agents/skills/shalomut-tracker/SKILL.md`. Do not call a handoff portable beyond
the Git boundary it has actually reached.

## Parallel-agent Git safety

- Concurrent agents must use separate branches and separate Git worktrees or
  checkouts. Never let two agents edit the same worktree concurrently.
- Never reset, clean, checkout over, discard or overwrite another agent's or
  user's changes. Preserve unrelated changes in a dirty worktree.
- Do not rebase, force-push, rewrite shared history or amend another agent's
  commit without an explicit user request.
- Do not commit chat transcripts, private AI session URLs, secrets, credentials
  or access tokens.
