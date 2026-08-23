# The audit counts itself, and the count is checked

## Metadata

- Branch: `docs/the-audit-counts-itself-correctly`
- Base branch: `main`
- Base commit: `d407eb4`
- Current HEAD: the tip of `docs/the-audit-counts-itself-correctly`
- Status: implemented and verified locally; not on `main`
- Last updated: 2026-08-23
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Finish the bookkeeping of `docs/critical-audit-2026-08-21.md`: verify the
records that were fixed but never marked, correct the ones whose status was
wrong, give the document one vocabulary for a partial closure, and make its own
summary a checked number instead of a claim.

## User-visible outcome

None. This is a documentation task about a dated audit.

## Context

The document had drifted from itself twice over. Its running feed of «Открытых
записей N» stopped being updated on 2026-08-23 while the marks in the records
kept moving — nineteen records apart by the evening — and three records whose
fixes were already on `main` still read as open. A fourth was recorded as
superseded by the 2026-08-20 identity decision, which turned out not to be true.

## Scope

- Verify and mark the three unmarked-but-fixed records.
- Re-state two records whose status was wrong rather than missing.
- One vocabulary for partial closure, and a `Счёт` section that states the
  numbers.
- `npm run lint:audit-count`, wired into `verify:core`.
- The handoff's own copy of the count.

## Non-goals

- No code fix for the one open finding. The password door is authentication
  configuration and needs the owner's explicit bounded approval.
- No rewriting of the audit's original wording. The record's text stays as it
  was written on 2026-08-21; everything added is below it and dated.
- The abandoned «Открытых записей N» feed is left in place as history rather
  than deleted or back-filled.

## Acceptance criteria

- Every finding carries a status line that classifies it without reading prose.
- The document's stated numbers equal the numbers derived from those lines, and
  a gate says so.
- Each partial closure names its remainder in place.

## Relevant repository instructions

`AGENTS.md` documentation lifecycle, `.agents/skills/shalomut-tracker/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

None touched. The new gate reads one Markdown file.

## Decisions made

- **Verify against the code, not the commit message.** All three unmarked
  records were re-read in the current tree before being marked: the builder's
  `activationFailure` path, `updateStatus(id, status, expectedCurrent)` with its
  named outcomes, and `hasConfiguredSharedSecret` calling `isDeployedRuntime`.
- **One spelling for a partial closure.** `ЗАКРЫТА ДЛЯ ПУЛА pg` and `ЗАКРЫТА ДЛЯ
  ЭКРАНА РАУНДА` became `ЗАКРЫТА В ЧАСТИ …`, so the status line alone classifies
  a record. The gate refuses the old spelling by name, because it counts as a
  full closure while leaving the remainder unnamed.
- **The gate checks arithmetic and vocabulary, and says so.** It cannot tell
  whether a record marked closed is actually closed — that is the code read
  which took most of this task.
- **The critical finding's italic severity is read rather than restyled.** The
  document is a restored artifact and its formatting is evidence.

## Assumptions

- None load-bearing.

## Completed

- Marked `12980ca` on the builder-success and status-transition records — one
  defect written down twice, in two clusters — and `9619ab7` on the machine-door
  fail-open.
- Onboarding of hundreds of schools is now `ЗАКРЫТА В ЧАСТИ ЭКРАНА`: ADR-052
  delivered the search and paging half, and the bulk path is what remains.
- The password door is restated as `ОТКРЫТА, СУЖЕНА ДО PREVIEW` with evidence,
  replacing the claim that the identity decision superseded it.
- Two stale sentences corrected in place: the queue-liveness record still said
  raising the pool was open, and the worker record's non-goal read like a
  remainder.
- New `Счёт` section, `scripts/check-audit-count.mjs` with six tests,
  `npm run lint:audit-count` in `verify:core`, a line in `AGENTS.md`, and the
  handoff pointed at the document instead of carrying its own copy of the
  number.

## In progress

- Nothing.

## Remaining

- Land on `main`; the push is the owner's.

## Changed files

`docs/critical-audit-2026-08-21.md`, `docs/shalomut-tracker-handoff.md`,
`AGENTS.md`, `package.json`, `scripts/check-audit-count.mjs`,
`scripts/check-audit-count.test.mjs`.

## Verification evidence

### Passed

Local, 2026-08-23:

- `npm run verify:core` — exit 0, with `lint:audit-count` in the chain.
- `node --test scripts/check-audit-count.test.mjs` — 6 tests. Two of them are
  the ones worth having: a summary that agrees with itself but not with the
  marks fails, and the old partial spelling fails even when the arithmetic is
  made to add up around it.
- `node scripts/check-audit-count.mjs` against the real document — 50 findings,
  41 closed, 8 closed in part, 1 open.
- The three markings were verified by reading the current code, named in
  `Decisions made`.

### Failed

- None.

### Blocked or not run

- `verify:db`, `test:e2e`, deployed walk: nothing here reaches a database, a
  screen or a deployment.

### Environment

Local worktree.

### Residual risk

The gate proves the document is consistent with itself, not that a record marked
closed is closed. That distinction is written into the script's own header so a
future reader does not mistake a green check for a re-audit.

## Failed approaches

- The first parser recognised a record by the bold severity and missed the
  critical finding, which is italic. Caught by the total disagreeing with the
  summary — the failure mode the gate was built for, on its first run.

## Known risks

- None.

## Approval gates

- The password door needs the owner's decision before any code moves; it is
  authentication configuration.

## Questions requiring an owner decision

- **The temporary password door.** Production refuses a password before reading
  it, because the `OIDC_*` variables are set there. They are scoped to Production
  only — a preview URL cannot be registered with Google — so Preview still opens
  on `MANAGER_ADMIN_PASSWORD` with no strength requirement. Either require
  strength there (the code is written and unpushed on the local branch
  `fix/manager-password-must-be-strong`) or take the door off Preview and accept
  that preview builds cannot reach the manager screens.

## Next concrete step

Hand the push over:
`git push origin docs/the-audit-counts-itself-correctly:main`.
