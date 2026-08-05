# The living documents say what is true now

## Metadata

- Branch: `docs/roadmap-reconciliation`
- Base branch: `main`
- Base commit: `763e38f`
- Current HEAD: `763e38f` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Reconcile the three living documents with the code, as `AGENTS.md` requires when
prose and code disagree, and shorten the two that had turned into session logs.

## User-visible outcome

None. This is the project's own record.

## Context

Looking for the next backlog item surfaced the real finding: there is no
unblocked one left, and the documents did not say so.

- `ROADMAP.md` still listed five "next product outcomes", every one of which had
  shipped or been decided between 2026-08-02 and 2026-08-05. An agent reading it
  would have started work that already exists.
- `PROGRESS.md`'s "Current state" named `origin/main` as `c63736e`, said nine
  migrations were applied, and said the save-time work "needs the tenth
  migration on the deployed database". Eleven are applied and none is pending.
- `docs/shalomut-tracker-handoff.md` had grown to 496 lines, most of it a chain
  of superseded snapshots and superseded deployment readings — the session
  history that `AGENTS.md` assigns to Git and to archived task files.

## Scope

- `ROADMAP.md`: the five outcomes recorded as shipped, with what is gated rather
  than queued.
- `PROGRESS.md`: "Current state" rewritten to the present.
- `docs/shalomut-tracker-handoff.md`: snapshot refreshed to `763e38f`, a fresh
  read-only deployment reading, and the superseded chains trimmed.
- `docs/product-behaviour-backlog.md`: the header now says which items remain.

## Non-goals

- Deleting history. Everything trimmed is in `git log` and in
  `docs/agent-tasks/archive/`, and the trim says so where it happened.
- Any code change.

## Acceptance criteria

- No living document claims work is open that is already done.
- No living document names a commit, a migration count or a deployment that is
  not current.
- Every approval gate, external blocker and piece of first-hand evidence
  survives the trim.

## Relevant repository instructions

- `AGENTS.md`, documentation lifecycle: current code outranks prose, and a
  disagreement is fixed in the same task. `PROGRESS.md` stays concise product
  milestones; the handoff stays current operational state; Git owns session
  history.

## Decisions made

- **The five roadmap outcomes are recorded as shipped rather than deleted.** A
  deleted list invites the same work from an older copy of the file; a list that
  says where each one landed does not.
- **The trims say that they happened**, and where the content went. A document
  that silently shrinks reads as a document that lost something.
- **The 2026-08-04 signed-in functional check is kept**, because it is real
  first-hand evidence — with a sentence added saying it predates the three
  newest screens, which no human has opened.

## Assumptions

- Nobody needs the superseded snapshot chain in this file. Each entry names a
  commit, and `git log --oneline main` reaches all of them.

## Completed

All of the scope above. The handoff went from 496 lines to 329.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

`ROADMAP.md`, `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/product-behaviour-backlog.md`, and the previous task file moved into
`docs/agent-tasks/archive/`.

Untouched and pre-existing: `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 606 tests, 606 pass. No code changed; this
  proves the documentation edits broke nothing that reads these files (the
  OpenAPI and fitness checks do read repository files).
- Deployment re-read read-only at 18:16Z on 2026-08-05: Render `/health` answers
  `commit: 763e38f`, and the Vercel production deployment
  `dpl_2FNoMKQFGRrzyDsTWdQbCCcT9BAK` is `READY`/`PROMOTED` from `main` at
  `763e38f`, built 18:14:31Z and ready 18:15:10Z. Read through the deployments
  API in the owner's own signed-in Chrome; nothing was clicked and no secret was
  displayed.

### Failed

None.

### Blocked or not run

- `verify:db` and `verify:ai` — no schema, repository or Python change.

### Environment

Local, plus two read-only deployment reads.

### Residual risk

- None to the product. The risk this closes is the one that matters here: a
  document that invites work already done.

## Failed approaches

None.

## Known risks

None.

## Approval gates

None. The open gate this document already carried — rotating the exposed
design-stage credentials before the first real respondents — is untouched and
still recorded.

## Questions requiring an owner decision

The product backlog now has no unblocked implementation item. What is left is a
decision or a request:

- Whether a goal gains an owner, a due date or a plan of steps (backlog §5).
- Whether a goal should be read beside the delta of its dimension (§5).
- A second manager per school (§8) and repeat-measurement reminders (§11), both
  waiting on being requested rather than on being built.
- A signed-in walk of the three newest screens on the deployed endpoint, which
  needs the owner because the agent never types the manager password.

## Next concrete step

The owner pushes: `git push origin docs/roadmap-reconciliation:main`.
