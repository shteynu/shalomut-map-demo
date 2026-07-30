# Agent task handoffs

This directory stores durable implementation state for substantial work. It
extends the repository's existing agent system; `AGENTS.md` and the canonical
skills under `.agents/skills/` remain the instructions every tool follows.

## Main idea

Git and repository files carry durable engineering state; chats are temporary
execution context. Stable project knowledge stays global, while unfinished
implementation state belongs to one branch and one task file. A replacement
agent first reconciles the task document with the more authoritative current
code and Git state, then continues from one explicit next step.

This workflow is tool-neutral. Claude Code, Codex, Gemini CLI and
Antigravity-style clients follow the same root `AGENTS.md`, canonical skills and
branch task file. If a client does not discover skills automatically, it opens
the `SKILL.md` files named by `AGENTS.md` directly.

## One branch, one task file

Use one file per independently deliverable branch. Replace every `/` in the
branch name with `--`:

- `feature/comparative-analytics` →
  `active/feature--comparative-analytics.md`
- `fix/privacy-lock` → `active/fix--privacy-lock.md`

Create new files from [TEMPLATE.md](TEMPLATE.md). Do not create one global
current-task file: parallel branches would overwrite each other's state.
Task files contain durable engineering context, not chat transcripts, hidden
reasoning, private AI links, secrets, temporary speculation or copied diffs.

## Start or continue work

Every agent uses the same sequence:

1. Read root `AGENTS.md`. For session start/continuation, read
   `.agents/skills/shalomut-tracker/SKILL.md`; before implementation or final
   readiness claims, follow the other skills routed there.
2. Run `npm run agent:context`. It is read-only and prints the repository root,
   branch, HEAD, upstream/divergence, working-tree buckets, expected task path,
   recent commits and `Next concrete step`.
3. Open the reported task file. For a new substantial branch with no file,
   create it from [TEMPLATE.md](TEMPLATE.md). Do not create task files for tiny
   questions or read-only lookups.
4. Compare the task document with current code, `git status`, the complete diff
   and recent commits. Git and executed evidence outrank stale prose.
5. Confirm scope, non-goals and approval gates, preserve unrelated changes and
   continue from the documented next step.

No chat export is part of this process.

## Save progress before switching agents

1. Inspect the complete diff, current HEAD, staged, unstaged and untracked
   files, recent commits and upstream state.
2. Select and run verification through `shalomut-verification`. Record only
   commands and scenarios that actually ran; keep passed, failed, blocked and
   not-run evidence separate.
3. Update the active task file first: metadata, decisions, assumptions,
   completed/in-progress/remaining work, exact changed-file state, failed
   approaches, risks, approval gates and verification environment.
   Keep it as a current snapshot rather than an append-only session log:
   replace stale detail and compact it when it grows beyond roughly 12 KB.
4. Leave exactly one clear `Next concrete step`.
5. Update global documents only when their owned state changed: milestones in
   `PROGRESS.md`, cross-task operational/deployed state in the operational
   handoff, and stable architecture or decisions in `PROJECT_CONTEXT.md`/ADRs.
6. Never save chats, hidden reasoning, secrets, credentials, private session
   URLs or large copied diffs in repository documentation.

## Visibility boundary

- Same worktree: another agent can see committed and uncommitted files.
- Different worktree in the same clone: the handoff is visible after the work
  and task file are committed on the branch.
- Different clone, computer or remote agent: the handoff is visible after the
  branch is pushed.

Commit and push remain explicit user-authorized actions. Until they happen,
record the actual visibility boundary and do not describe an uncommitted task as
portable to another worktree or machine.

## Ownership

- `active/<branch>.md`: current implementation and handoff state for one task.
- `docs/shalomut-tracker-handoff.md`: cross-task operational/deployment state,
  external blockers and approval gates.
- `PROJECT_CONTEXT.md`: stable architecture, product invariants and long-lived
  decisions.
- `PROGRESS.md`: concise product milestones and major completed capabilities.

Update a global document only when the state it owns actually changes.

## Parallel work

Concurrent agents use separate branches, separate worktrees and separate task
files. For example:

```bash
git fetch origin

git worktree add ../shalomut-comparative \
  -b feature/comparative-analytics origin/main

git worktree add ../shalomut-ui-review \
  -b review/comparative-analytics-ui origin/main
```

Those worktrees resolve to `feature--comparative-analytics.md` and
`review--comparative-analytics-ui.md`; neither agent edits the other's task
state or worktree.

## Handoff and archive

After a task is complete, move its final file from `active/` to `archive/`.
Preserve final verification evidence and link the merged pull request or final
commit when known. Do not reuse or keep editing an archived file for new work.
