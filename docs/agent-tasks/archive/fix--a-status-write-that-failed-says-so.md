# A status write that failed says so

## Metadata

- Branch: `fix/a-status-write-that-failed-says-so`
- Base branch: `main`
- Base commit: `83890d6`
- Current HEAD: the commit carrying this file, on top of `12980ca`
- Status: code done, verified, **not pushed**
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the fail-open cluster of the 2026-08-21 audit: two entries, five findings,
all on the path that writes a round's status.

## User-visible outcome

A manager whose status change did not happen is told so, and told which of the
four reasons it was. Before this, the API answered `success: true, round: null`
and the screen showed nothing wrong. A school can no longer end up with a
questionnaire that says it went live, no running round, and no sentence naming
the round that stopped.

## Context

`IRoundRepository.updateStatus` answered `SurveyRound | null` and caught every
database error into that `null`, so four outcomes were one: the round is gone,
the partial unique index refused a second active round, another request moved
the status first, the connection dropped. Every caller read it as none of them.

## Scope

- `src/lib/repositories/interfaces.ts` — `RoundStatusWrite` and the required
  `expectedCurrent` parameter.
- `src/lib/repositories/prisma/prisma-round.repository.ts` — conditional
  `updateMany`, the constraint reader, the two explaining reads.
- `src/lib/repositories/in-memory/in-memory-round.repository.ts` — the same
  semantics, including one running round per school.
- `src/lib/services/round.service.ts` — `RoundActivation`.
- `src/lib/server/round-status-write.ts` — one mapping from outcome to answer.
- The three routes: `rounds/[roundId]`, its `reset`, its `survey-definition`.
- `survey-builder.tsx` and `survey-builder/types.ts` — the manager's sentence.

## Non-goals

- Transactions. The builder still closes the previous round and then activates
  the new one as two writes; the repository interface has no transaction
  primitive. What changed is that a jam between them is reported.
- The other four open high findings of the audit.

## Acceptance criteria

- A refused write produces no audit row, no analysis dispatch and no
  `success: true`.
- A transition validated against a stale read is refused by the database.
- The manager is told which refusal it was, in Hebrew, on the screens that can
  meet it.
- A partial outcome — erasure done and status write missed, questionnaire saved
  and round not started — is reported as both halves.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk. This is a write path with four
  routes and two repository implementations, so both the mutation passes and
  the PostgreSQL suite were run.
- `AGENTS.md`: when a living document disagrees with the code, update it in the
  same task — `PROGRESS.md` and the handoff both described the old behaviour by
  implication.

## Relevant architecture and contracts

- ADR-030: one basis of calculation per round. A failed close that still queued
  the analysis broke it from the other end.
- The partial unique index `survey_rounds_one_active_per_organization`, owned by
  the 2026-08-04 migration and absent from `schema.prisma`.
- ADR-032, added by this task.

## Decisions made

- **`expectedCurrent` is required, not optional.** An omitted expectation is
  exactly the unconditional write being replaced, and an optional parameter is
  one that will be left out.
- **`updateMany` rather than `update`**, because only `updateMany` accepts a
  non-unique `where`, and the `where` is the whole mechanism.
- **The in-memory repository enforces one running round per school.** Nearly
  every test of a refused activation runs against it; a repository that cannot
  refuse proves the handling works by never reaching it.
- **An unrecognised `P2002` stays `write_failed`.** Answering an unknown
  constraint with "another round is active" would explain a real defect away in
  the manager's own words.
- **Driver messages are not forwarded to the screen.** One mapping produces the
  manager's sentence; `write_failed` carries its reason to the log only.
- **A failed close of a sibling is not raised in `closeOtherActiveRounds`.** It
  still holds the school's active slot, so the activation that follows meets the
  index and reports it — one report from the write that actually failed.

## Assumptions

- The column list `['organization_id']` identifies this index because it is the
  only unique constraint on that column. Checked against the migration.

## Completed

Everything in Scope, plus ADR-032, `PROGRESS.md`, the handoff and the audit
file.

## In progress

Nothing.

## Remaining

Nothing in the tree. The push is the owner's.

## Changed files

Added: `src/lib/server/round-status-write.ts`,
`src/app/api/__tests__/a-refused-status-write-says-so.test.ts`,
`src/lib/repositories/__tests__/round-status-write.test.ts`, this file.

Modified: the three routes, both round repositories, `interfaces.ts`,
`round.service.ts`, `survey-builder.tsx`, `survey-builder/types.ts`, four
existing test files, `PROJECT_CONTEXT.md`, `PROGRESS.md`,
`docs/shalomut-tracker-handoff.md`, `docs/critical-audit-2026-08-21.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1385 / # pass 1385 / # fail 0`, zero `not ok`, and the build
  completed.
- `npm run verify:db` against real PostgreSQL: `REAL_EXIT=0`, 39 of 39,
  including the two cases added here.
- **Six mutation passes, each restored from a scratchpad copy** and each
  producing exactly the expected failures:
  1. the PATCH guard removed → the three route tests that hold it fail;
  2. `where: { id, status }` reduced to `where: { id }` → the conditional-write
     test fails;
  3. the adapter branch of the constraint reader removed → its test fails;
  4. the in-memory expectation check removed → its test fails;
  5. the in-memory one-active-round rule removed → the route test and the
     repository test fail;
  6. the builder's `activationFailure` assignment removed → its test fails.
- **The first version of mutation 2 caught nothing**, because the mock's
  `updateMany` ignored its `where`. The mock was rewritten to honour it and the
  pass was repeated; without that, the clause the whole fix rests on had no test.
- **The first constraint reader was wrong, and the database said so.** It looked
  for `constraint.index`; the adapter reports `constraint.fields` as
  `['organization_id']` with the index named only inside `originalMessage`. Found
  by `verify:db` failing, then by printing the real error object, then fixed —
  and the unit test now carries the recorded shape rather than an invented one.

### Failed

None outstanding.

### Blocked or not run

- No browser walk. The changed screens are behind `/login`, and every changed
  behaviour is a failure path that needs a refused database write to reach; the
  route tests exercise the same responses the screens read. The Hebrew sentences
  themselves are pinned by a unit test, not by a screenshot.

### Environment

Local worktree; local PostgreSQL on `127.0.0.1:5433` for `verify:db`.
`GEMINI_API_KEY` was not needed and no provider call was made.

### Residual risk

The multi-write paths are still not atomic — see Non-goals. A crash between
closing the previous round and activating the new one leaves the school with no
running round; it is now visible rather than silent, but nothing repairs it
automatically.

## Failed approaches

Two, both recorded above under Passed because each is the reason a claim is now
trustworthy: a mock that ignored its `where`, and a constraint reader written
from a plausible shape instead of a measured one.

## Known risks

`describeRefusedStatusWrite` is the only place the outcomes become answers. A
new outcome added to `RoundStatusWrite` without a branch there is a TypeScript
error today, because the switch is exhaustive; keeping it exhaustive is what
keeps the mapping honest.

## Approval gates

None. No credentials, secrets, aliases or authentication configuration were
touched.

## Questions requiring an owner decision

None. Which audit finding comes next is a question, not a blocker: 42 entries
remain open, four of them high.

## Next concrete step

The owner pushes `fix/a-status-write-that-failed-says-so` to `main`; Vercel
builds it and `GET /api/health/` should then answer the pushed tip. After that,
archive this file and pick the next audit entry.
