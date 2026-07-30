# Shalomut Map — instructions for AI coding agents

These instructions apply to every coding agent working in this repository.
Treat the version-controlled skills under `.agents/skills/` as the canonical
agent guidance. Do not prefer user-local or ignored copies of the same skills.

## Required skill routing

- For every task that changes or reviews Shalomut product behavior, code,
  tests, UI, methodology, API, persistence, AI integration or documentation,
  read `.agents/skills/shalomut-map/SKILL.md` fully before substantial work.
- When the user asks to start, continue or resume work, report project status,
  choose next steps, save progress, close a session or prepare a handoff, read
  `.agents/skills/shalomut-tracker/SKILL.md` fully.
- When the user asks to verify, test, prove a fix, check readiness or review
  evidence, or before claiming a substantive change is complete, read
  `.agents/skills/shalomut-verification/SKILL.md` fully.
- When multiple skills apply, use `shalomut-tracker` first to establish state,
  `shalomut-map` for implementation and `shalomut-verification` for evidence.
- If the current agent does not implement automatic Agent Skills discovery,
  open the matching `SKILL.md` files directly and follow them as repository
  instructions.

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
