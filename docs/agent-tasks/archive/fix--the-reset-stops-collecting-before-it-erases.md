# The reset stops the round before it erases it, and erases it as one write

## Metadata

- Branch: `fix/the-reset-stops-collecting-before-it-erases`
- Base branch: `main`
- Base commit: `34e6755`
- Current HEAD: `124f661`, an ancestor of `main`. The branch is `d259732`, `5186ba3`, `124f661`,
  oldest first.
- Status: complete, landed on `main`; archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the fourth finding the owner picked out of
`docs/critical-audit-2026-08-21.md`: *«Сброс раунда — шесть последовательных
записей без транзакции, и гонится с идущим сабмитом»*. The audit's own fix line
is «`$transaction` над шестью записями; сначала вывести раунд из `active`», and
that is what was done, in that order.

## User-visible outcome

A manager who resets a round sees no difference when everything works. What
changed is the two failures:

- A reset that cannot return the round to draft now erases nothing, instead of
  answering with a count of what it had already destroyed.
- A reset that crashes halfway erases nothing, instead of leaving a round whose
  saved analysis describes responses that no longer exist.

And a respondent can no longer submit into a round that is in the middle of
being erased, except in the one window named under *Known risks*.

## Context

`POST /api/rounds/[roundId]/reset` made six writes in a row with nothing holding
them together, and wrote the status **last**. Two consequences at once: a crash
in the middle left two internally-valid halves that disagreed with each other,
and the round advertised itself as `active` for the whole duration of its own
erasure.

## Scope

- The status write moves to the front and commits before anything is deleted.
- The five deletes move into `RoundResetService.eraseCollectedData` and run
  inside one transaction.
- A new composition-root seam, `runInTransaction`, is what makes a transaction
  possible across five repositories without breaking the entrypoint rule.
- `npm run lint:composition` learns that the new seam is a resolution too.

## Non-goals

- **No lock on the respondent's write.** Closing the race completely means the
  submit path taking a share lock on the round row inside a transaction, and
  this handler taking it exclusively. That puts a transaction on the product's
  only unauthenticated write to serialise it against something a manager does by
  hand. Not paid; named in *Known risks* and in the route's own comment.
- No other multi-write path was converted. The audit lists more of them; each is
  its own finding.
- The questionnaire's version history is still deliberately kept.

## Acceptance criteria

- The status write is provably the first write the handler makes.
- A failure inside the erasure leaves all five tables as they were, proved
  against real PostgreSQL and against a negative control.
- A refused status write erases nothing and audits nothing.
- `verify:core` and `verify:db` pass.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle, the handoff
  protocol, and never recording a check that did not run.
- `.agents/skills/shalomut-verification/SKILL.md` — this diff touches a data-loss
  path and adds a database primitive, so both suites ran and the transaction is
  proved against PostgreSQL rather than reasoned about.

## Relevant architecture and contracts

- ADR-008 — the composition root, now extended: `runInTransaction` is a second
  resolution and carries the same entrypoint rule, enforced by the same lint.
- ADR-026 — the durable audit log. `ROUND_RESET` is recorded only after an
  erasure that actually happened, and its counts are the rows that actually went.
- `docs/openapi.yaml` — the reset endpoint's description now states the ordering,
  and its `500` says which of the two halves happened.

## Decisions made

- **Status first, committed, not inside the transaction.** Putting all six
  writes in one transaction would have been atomic and would *not* have closed
  the race: under `READ COMMITTED` a concurrent submit keeps reading `active`
  until the commit, so it can still insert beside the delete. Committing the
  status first is what makes the share code refuse.
- **`runInTransaction` rather than a fat repository method.** The erasure spans
  five repositories. A method that deleted from five tables would have put four
  other repositories' business inside one adapter.
- **The lint covers the new name.** A seam that hands out a repository set is a
  resolution; without the lint entry a service could resolve its own
  dependencies through the back door.
- **The sinks are not re-pointed inside a transaction.** A counter recording work
  that later rolls back would vanish with it, and the sink would be left holding
  a client that is finished at commit.
- **One sweep, not a loop.** After the erasure commits, the response count is
  read once; a straggler is erased by running the same idempotent work again. It
  cannot be followed by a third, because by then the round has been `draft` for
  the whole duration of the first transaction.
- **The erasure has its own `catch`.** The handler's outer catch also covers the
  steps before the status write, where "the round was returned to draft" would
  be a lie.
- **The success payload re-reads the round.** The row the status write returned
  was fetched before the erasure and still carries the published analytics the
  request has since cleared.

## Assumptions

- `TRANSACTION_TIMEOUT_MS = 20_000` and `TRANSACTION_MAX_WAIT_MS = 5_000` are
  chosen against a pool bounded at two connections: generous for one round's
  rows, short enough that a stuck transaction fails rather than parking half the
  deployment's connections until the function times out. Not measured against a
  large round — there are no large rounds yet.

## Completed

- `MinimalPrismaClient` declares an optional `$transaction`.
- `runInTransaction` in `src/lib/composition-root.ts`, with
  `TRANSACTION_TIMEOUT_MS` / `TRANSACTION_MAX_WAIT_MS`.
- `scripts/check-composition-root.mjs` checks both resolution names and names
  the one the author wrote in its message; its own test covers the new case.
- `RoundResetService.eraseCollectedData` — the five deletes and the count, with
  the reasoning that used to sit inline in the route.
- The route rewritten: status first, erasure in a transaction, conditional
  sweep, a scoped failure branch, and a re-read round in the answer.
- `src/app/api/__tests__/the-reset-stops-collecting-before-it-erases.test.ts` —
  four tests: the status write is first, the answer carries no stale analytics,
  a straggler is swept and counted, and the sweep is conditional.
- `src/lib/repositories/__dbtests__/postgres-round-reset.test.ts` — five tests
  against real PostgreSQL, including the negative control that shows the same
  crash without a transaction erases all five tables.
- `src/lib/__tests__/composition-root.test.ts` — three tests for the seam.
- `a-refused-status-write-says-so.test.ts` — the reset case rewritten: it used to
  assert the answer carried the count of what it had destroyed; it now asserts
  nothing was destroyed.
- Documentation: the audit entry closed (30 → 29 open) plus the three earlier
  2026-08-23 entries corrected — they still said their branches were not on
  `main` — ADR-008 extended, and the OpenAPI description and `500`.

## In progress

Nothing.

## Remaining

Nothing on this branch.

## Changed files

Modified:

- `src/app/api/rounds/[roundId]/reset/route.ts`
- `src/lib/composition-root.ts`
- `src/lib/repositories/prisma/prisma-client.ts`
- `src/lib/services/index.ts`
- `src/app/api/__tests__/a-refused-status-write-says-so.test.ts`
- `src/lib/__tests__/composition-root.test.ts`
- `scripts/check-composition-root.mjs`
- `scripts/check-composition-root.test.mjs`
- `PROJECT_CONTEXT.md`
- `docs/critical-audit-2026-08-21.md`
- `docs/openapi.yaml`
- `public/openapi.json`

Added:

- `src/lib/services/round-reset.service.ts`
- `src/app/api/__tests__/the-reset-stops-collecting-before-it-erases.test.ts`
- `src/lib/repositories/__dbtests__/postgres-round-reset.test.ts`
- this file

`next-env.d.ts` is modified in the worktree and belongs to the owner; it is
excluded from every commit on this branch.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1658 tests across 13 runs, 0 failures, plus
  every fitness gate, `typecheck`, `verify:ai`, `eslint`, `next build` and the
  OpenAPI mirror check.
- `npm run verify:db` — exit 0. 65 tests, 0 failures, including the five new
  ones.
- The rollback is proved with its own negative control: the same work and the
  same crash against a client with `$transaction` proxied away erases all five
  tables, and with it erases none. Without that control the rollback test would
  pass on a round that had nothing to lose.

### Failed

None.

### Blocked or not run

- Nothing was checked on the deployed runtime. This branch is not pushed.
- The residual race was not reproduced. Making a real submission land between
  the status commit and the sweep needs two processes and a scheduler; the sweep
  is tested with a store that inserts a row at that moment instead, which proves
  the sweep and not the timing.
- No measurement of how long the transaction takes on a large round. There are
  no large rounds.

### Environment

Local only (`docs/local-environment.md`). `verify:db` used its own disposable
`shalomut_test` on `127.0.0.1:5433`.

### Residual risk

Moderate and named. The integrity half is closed and proved. The race is
narrowed from the whole duration of the reset to one in-flight submission, and
the sweep catches the ordinary case of that; a submission that commits after the
sweep's count read still survives. See *Known risks*.

## Failed approaches

- **All six writes in one transaction.** The obvious reading of the audit line,
  and it does not close the race: a concurrent submit reads committed state, so
  it keeps seeing `active` until the commit and can insert beside the delete.
  Committing the status first is the part that matters, and the transaction is
  what makes the rest atomic.

## Known risks

- **The residual race.** A submission already past its status check when the
  round leaves `active` can commit a response after the sweep's count read. The
  complete fix is a share lock on the round row in the respondent's write and an
  exclusive one here. If real respondents arrive before that is paid for, this is
  the entry to re-open.
- **Interactive transactions hold a pooled connection.** The pool is two
  connections. A reset now holds one for the duration of the erasure, where
  before it held one per statement. On the deployment that is one manager action
  at a time and the timeout bounds it.

## Approval gates

- `git push` is the owner's. This branch fast-forwards from `origin/main`
  (`34e6755`).

## Questions requiring an owner decision

- None blocking. One worth raising when respondents become real: whether to pay
  for the lock that closes the residual race, at the cost of a transaction on
  the only unauthenticated write.

## Next concrete step

Push this branch to `main` (it fast-forwards), or pick the next audit finding —
29 remain, and none of the four the owner listed on 2026-08-23 is still open.
