# Three small debts the repository owed itself

## Metadata

- Branch: `chore/three-small-debts-the-repository-owed-itself`
- Base branch: `main`
- Base commit: `04f63a4`
- Current HEAD: see `git log --oneline 04f63a4..`
- Status: in progress
- Last updated: 2026-08-25
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Three unrelated small items, asked for in this order and delivered as three
commits. They share only their size and the fact that nothing else in the
backlog is startable without an owner decision or the methodologist's mapping.

1. **The documents catch up with the code.** Four statements were true when
   written and are not true now.
2. **A script for publishing `docs/*.html`.** The transformation is performed by
   hand and re-derived by whoever publishes next.
3. **The last full-JSON read of a school's round list.** ADR-051 moved the
   manager screens to a summary read and left one caller behind.

## User-visible outcome

None from any of the three. (1) and (2) are repository hygiene; (3) is a read on
an administrator write path.

## Context

The question that opened the session was "what is left to do in code". The answer
was: almost nothing that an agent can start. The research instrument's phases 5
and 6 wait on the methodologist's item-to-dimension mapping, and all eight
partly-closed records of the 2026-08-21 audit name remainders that are owner
decisions, environment scope or considered holds. These three are what was left
that needs no one else.

## Scope

- `PROGRESS.md` — the multi-tenancy paragraph said phases 4, 5 and 6 remain; all
  three landed (`2576b99`, `85d5676`, `5089fb2`).
- `docs/shalomut-tracker-handoff.md` — three superseded facts inside a document
  whose own rule is to replace rather than append: an abandoned count of open
  audit records, phase 6 described as deferred and undecided, and the audit-log
  question described as open.
- `docs/multi-tenancy-plan-2026-08-20.md` — phases 4 and 5 annotated as
  implemented, in the same style phase 6 already carried, and the phase-3 bullet
  that called the log-reading question open.
- `docs/agent-tasks/active/feat--the-school-does-not-read-its-own-log.md` — moved
  to `archive/`; it said unpushed and `origin/main` carries it.
- Then: a publishing script under `scripts/`, and `closeOtherActiveRounds` in
  `src/lib/services/round.service.ts`.

## Non-goals

- Rewriting dated plans and the audit's own ledger. `docs/critical-audit-2026-08-21.md`
  was checked and left alone on purpose — its record bodies are dated layers and
  its `Открытых записей N` feed is declared abandoned-and-kept in the document
  itself, so what reads as a contradiction there is the format working.
- Anything gated on the owner or the methodologist.

## Acceptance criteria

- No living document states a fact the code contradicts.
- Publishing a `docs/*.html` page is one command that someone else can repeat.
- A school's active-round check stops reading whole questionnaires.

## Relevant repository instructions

- `AGENTS.md` — documentation lifecycle: current code outranks prose, and dated
  plans are preserved rather than rewritten.
- `.agents/skills/shalomut-tracker/SKILL.md` — memory boundaries; each global
  document is edited only where it owns the state that changed.

## Decisions made

1. **Annotate the plan, do not rewrite it.** Phase 6 already carried an
   `Implemented 2026-08-23` line, so phases 4 and 5 got the same shape.
2. **The handoff stops keeping its own count of audit records.** It now names
   `npm run lint:audit-count` as the authority instead of carrying a second
   ledger, which is the thing that went stale.

## Assumptions

- None yet.

## Completed

- Item (3): the four documents above.

## In progress

- Item (1): the publishing script.

## Remaining

- Item (2): `closeOtherActiveRounds`.

## Changed files

`git diff --stat 04f63a4..HEAD`.

## Verification evidence

### Passed

- Nothing yet.

### Failed

- None.

### Blocked or not run

- Not yet reached.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- Not yet assessed.

## Failed approaches

- None.

## Known risks

- None.

## Approval gates

- None. No secret, credential, authentication configuration or alias.

## Questions requiring an owner decision

- None in this task.

## Next concrete step

Write the `docs/*.html` publishing script under `scripts/`, with a unit test
beside it in the style of the other `scripts/*.test.mjs`.
