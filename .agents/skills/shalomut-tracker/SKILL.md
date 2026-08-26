---
name: shalomut-tracker
description: Manage context, continuation of work and handoff for the shalomut-map-demo project. Use when the user asks to start or continue Shalomut, to report status or next steps, to save progress, to prepare a handoff or to close a session. Do not run the full session ritual merely because a specific task happens to mention Shalomut.
---

# Shalomut Tracker

## How to read this skill

Always in force: `Source precedence` — without it an agent trusts stale prose
over code; `Project invariants` — the privacy threshold, the eight dimensions,
the immutability of published contracts, fail-closed.

On condition: `Starting work` and `Context routing` — a session begins or
resumes; `Work and verification` — before recording a result; `Saving progress`
and `Memory boundaries` — the user asks to save progress or hand off;
`Parallel work` — several branches, worktrees or agents;
`Role or model escalation` — silent until a trigger from its own list fires, and
the procedure lives in [references/escalation.md](references/escalation.md).

## Source precedence

On any disagreement, use this order:

1. The user's current request.
2. Current code, `git status`, Git history and the results of checks that
   actually ran.
3. The active task document for the current branch in `docs/agent-tasks/active/`.
4. `docs/shalomut-tracker-handoff.md` — operational snapshot, blockers and
   approval gates.
5. `PROJECT_CONTEXT.md` — stable architectural decisions.
6. `PROGRESS.md` — concise product-level milestones and major completed
   capabilities.
7. `PRODUCT.md`, `design.md` and the specialised documents.

Never treat a stale line in documentation as more reliable than current code or
verifiable state.

## Starting work

1. Determine the repository root with `git rev-parse --show-toplevel` and the
   current branch through Git.
2. Run `npm run agent:context`, or reproduce its read-only Git checks if the
   command is unavailable.
3. Build the task-file path by replacing every `/` in the branch name with `--`:
   `docs/agent-tasks/active/<branch-name>.md`.
4. Read the task file if it exists. If the user has started a new substantial
   task and no file exists, create one from `docs/agent-tasks/TEMPLATE.md`. Do
   not create a task file for a small question, a read-only explanation or an
   incidental search through documentation.
5. Load only the project documents and sections relevant to the task, following
   the routing below. Find the section you need by heading or search first; do
   not read a long global document end to end unless the task needs all of it.
   The global operational handoff is needed only when the work touches the state
   it holds or the gates it names.
6. Check `git status --short`, the full current diff, recent commits and the
   locally available state of upstream/remote refs.
7. Continue from the `Next concrete step` section. Do not reopen settled
   decisions without concrete contradicting evidence, and preserve unrelated
   changes.
8. If there is no task file and the user only said "continue", propose the
   nearest safe unblocked step from the global context.
9. Ask a question only for a genuine product decision, an external dependency or
   an approval gate.

## Context routing

Load only the documents the current task needs:

- UI/UX: `PRODUCT.md`, `design.md` and the relevant components.
- Methodology and the survey: `docs/source-of-truth.md` and
  `src/lib/shalomut-source.ts`.
- Runtime, API and persistence: the task file and the relevant code first;
  specific sections of `PROJECT_CONTEXT.md` only when stable architectural
  context is needed; specific sections of the operational handoff on deployment,
  migrations, a change of environment configuration or alias, and whenever the
  work depends on external state. The condition is stated as a class of task,
  not as "does it touch a blocker": whether a blocker exists is not visible from
  the diff.
- AI analytics: `docs/ai-contract-version-matrix.md`,
  `contracts/capabilities.json`, the relevant versioned manifest and
  `ai-analytics-service/README.md`. `docs/ai-analytics-handoff.md` gives the
  cross-service overview; archived rollout details are not current state.
- Deployment and migrations: the operational handoff, environment configuration
  and migration state.
- Documentation audit: `docs/README.md`, the actual commands/configuration, and
  only those living documents whose owned state the discrepancy touches.
- "What is left to do" and choosing the next piece of work:
  `docs/open-decisions.md` — the index of everything waiting on a person,
  whether an owner decision or an external input. It carries no reasoning and
  points at the document that owns each entry; on any disagreement the source
  wins. Do not answer this question from `PROGRESS.md` alone: it names
  milestones, not what is blocked.

When work moves from status or handoff to implementation, read and follow
`../shalomut-map/SKILL.md`.

## Project invariants

- Leave empty persistence empty; never use demo fixtures as a hidden runtime
  fallback.
- Never expose respondent identity or results below the configured privacy
  threshold. Never allow a partially unlocked dynamic-questionnaire result: one
  analysed question below the threshold locks every detailed metric and stone.
- Keep the eight dimensions as the stable Dashboard taxonomy. The canonical 24
  questions are a default/legacy template, not a mandatory runtime instrument: a
  given round's questions may differ in ID, count and wording as long as they
  are persisted, bound to the eight dimensions and pass the privacy gate.
- Do not silently change the semantics of published contracts `1.0`–`6.0`.
  Capability policy lives in `contracts/capabilities.json` and runtime status in
  `docs/ai-contract-version-matrix.md`. Incompatible new semantics require a new
  versioned manifest and a consumer-first rollout.
- Keep RTL-first, WCAG AA and the warm design system.
- Preserve the boundary between the Core Data Layer and the external AI
  analytics service.
- Keep AI transport and persistence fail-closed.
- The project is at the design stage: there is no production data and database
  contents are disposable. Do not put an approval gate on clearing, reseeding or
  migrating; explicit bounded confirmation is needed only for secrets,
  credentials, authentication configuration and repointing deployment aliases.
- Never reset, clean, check out over, discard, rebase, force-push or amend
  somebody else's commit without an explicit user request. The rule lives here
  rather than among the parallel-work rules: somebody else's uncommitted changes
  can sit in the working tree while a single agent works alone.
- Work in small verifiable increments, and use `../shalomut-map/SKILL.md` for
  domain implementation. Both rules apply from the first edit, not at the moment
  a result is delivered.

## Work and verification

- Before recording a result or handing off, use
  `../shalomut-verification/SKILL.md`.
- Record only verification evidence that was actually produced.

## Role or model escalation

By default continue with the current agent and model without discussing the
choice. Do not escalate because a task is large, because an edit is local or
documentation-only, because a test fix is clear, because a refactor is
mechanical, or because a big task has already been broken into verifiable steps.

Consider escalation only when:

- the change crosses several architectural or service boundaries, or requires
  following a large cross-service flow;
- the safety of privacy, auth, authorization, persistence, contracts,
  migrations or deployment is at stake;
- repository evidence contradicts itself, or two reasonable approaches have
  already failed;
- the agent is losing established context, or the remaining context or visible
  usage limit is not enough to implement and verify safely;
- an important architectural or security-sensitive diff needs independent
  review.

The policy stays silent until a trigger fires. When one does, open
[references/escalation.md](references/escalation.md): it holds the procedure,
the output format and the block for the task file. Never switch model
automatically, and never assert a model's availability, superiority or remaining
usage without evidence from the client.

## Parallel work

- One independently deliverable task uses one branch and one task file.
- Two agents never work in the same worktree at once. For parallel work use
  separate Git worktrees or separate checkouts, different branches and different
  task files.
- Check local and available remote/upstream state before continuing.
- Before handing off uncommitted work, record in the task file exactly what is
  committed, staged, unstaged and untracked.

The ban on reset, clean, discard, rebase, force-push and amending somebody
else's commit lives in `Project invariants`, because it holds for solo work too.

## Memory boundaries

- The active task document — current implementation state of one branch or task.
- `docs/shalomut-tracker-handoff.md` — cross-task operational state, deployed
  state, external blockers and approval gates, and nothing else.
- `PROJECT_CONTEXT.md` — stable architecture, product invariants and long-lived
  decisions.
- `PROGRESS.md` — concise product-level milestones and major completed
  capabilities.
- `docs/README.md` — the lifecycle index: which documents are living, which
  freeze an implemented contract and which are historical plans.

A task file is a current snapshot, not an append-only session journal. When
updating it, replace stale state, delete detail that no longer applies, and
point at commits or files instead of copying large diffs. If a task file grows
past roughly 12 KB, compress its finished history into short summaries before
handing off.

Do not spread ordinary session detail across every global document. Update a
global document only when the state it owns has changed.

## Saving progress

Do not modify project-memory files automatically after every task. Update them
when the user explicitly asks to save progress, or when a handoff is part of the
task:

1. Inspect the full current diff, `git status` and commits, choose the checks
   through `../shalomut-verification/SKILL.md`, and then run them.
2. Update the active task file first. Record only checks that actually ran,
   completed and remaining work, decisions, assumptions, failed approaches,
   risks and approval gates.
3. Leave exactly one clear `Next concrete step`. Record the current HEAD and the
   exact committed, staged, unstaged and untracked state; never call a worktree
   clean without checking.
4. Update `PROGRESS.md` only if a product-level milestone or a major completed
   capability changed.
5. Update `docs/shalomut-tracker-handoff.md` only if cross-task
   operational/deployment state, an external blocker or an approval boundary
   changed.
6. Change `PROJECT_CONTEXT.md` only when stable architecture or a long-lived
   decision changed.
7. Do not duplicate existing history, and never record secrets, chat transcripts
   or private AI session URLs.
8. If a global document's owned state did not change, leave it alone.
9. State the handoff's visibility boundary explicitly: uncommitted state is
   available only in the same worktree; another worktree sees a commit on the
   branch; another checkout or machine sees only a published branch after a
   push. Do not commit or push without the user asking, and do not call an
   uncommitted handoff cross-worktree or cross-machine.
10. Propose a commit message only when a real diff exists.
