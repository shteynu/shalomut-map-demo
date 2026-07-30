# ADR-008: Branch-aware agent handoff

- Status: Accepted
- Date: 2026-07-30

## Context

Shalomut already keeps durable architecture, product progress and deployed
operational state in the repository. Those global files are useful across
tasks, but they cannot safely represent several active branches or several AI
tools at once: one agent's session update can overwrite another task's current
state. Chat histories are temporary, vendor-specific and unavailable after a
tool switch.

## Decision

- Repository files are authoritative for durable engineering context.
- Root `AGENTS.md` and canonical `.agents/skills/` remain the shared
  instructions; tool-specific adapters remain thin.
- Current implementation state is stored in one task document per branch or
  independently deliverable task under `docs/agent-tasks/active/`.
- Global documents have narrow ownership: stable decisions and architecture in
  `PROJECT_CONTEXT.md` or ADRs, product milestones in `PROGRESS.md`, and
  cross-task operational/deployed state and approval gates in the operational
  handoff.
- Parallel agents use separate branches, worktrees/checkouts and task files.
- Verification evidence is recorded only after the command or scenario actually
  ran, with failed, blocked and not-run evidence kept distinct.

## Alternatives considered

- Copying chats between tools: incomplete, manual and not durable.
- One global current-task file: parallel branches would overwrite each other.
- Full separate instructions per agent: creates drift and conflicting rules.
- External synchronization service: adds infrastructure and another source of
  truth without solving repository reviewability.
- Session transcripts in Git: noisy, potentially sensitive and unsuitable as
  engineering documentation.

## Consequences

Benefits include vendor-neutral handoff, reviewable branch-local state,
parallel-work isolation and explicit verification provenance. A replacement
agent can resume from repository state without the previous chat.

Costs include maintaining one small task file per substantial branch, updating
it before handoff, archiving it after completion and occasionally reconciling a
stale task document against the more authoritative code and Git state.

## Migration and rollout

Adopt the convention for new substantial tasks. Existing history remains in
the global documents; it is not bulk-migrated. Move a completed active task file
to `archive/` and retain its final evidence and merge reference.

## Related tasks and commits

- Archived task: `docs/agent-tasks/archive/chore--branch-aware-agent-handoff.md`
- Base commit: `f3dbce4e22afb8cfdfc66df3989d7351afeb1a9f`
- Implementation commit: `c0bf93d4a8e88dd65cf21d08280bf091bca62472`
