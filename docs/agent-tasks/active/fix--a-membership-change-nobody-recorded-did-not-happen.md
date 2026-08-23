# A membership change nobody recorded did not happen

## Metadata

- Branch: `fix/a-membership-change-nobody-recorded-did-not-happen`
- Base branch: `main`
- Base commit: `7b2d93c`
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's «Смена членства администратором отдаёт 500 после
успешной записи, если провалилась вставка аудита», anchored at
`src/app/api/admin/memberships/[membershipId]/route.ts:66`, together with its
twin in the same `catch` — «Несколько API-маршрутов протекают внутренними
сообщениями об ошибках».

## The decision this needed first

The repository was carrying two policies and had never had to choose.
`recordManagerScreenVisit` treats an unrecordable read as a hard failure;
`recordRoundAuditEvent` beside it swallows and warns. The audit proposed
swallow-and-warn here.

**The owner was asked and chose mandatory** (2026-08-23), so the fix is the
opposite of what the audit proposed: the change and its record commit together
or neither does. Recorded as ADR-047 and saved as a standing decision.

## What was wrong, and in how many places

All four administrative writes did the same thing — write, then record, outside
any transaction:

| route | write | record |
| --- | --- | --- |
| `POST /api/admin/schools` | `orgRepo.create` | `SCHOOL_CREATED` |
| `POST /api/admin/people` (no school) | `inviteAdministrator` | `ADMINISTRATOR_INVITED` |
| `POST /api/admin/people` (a school) | `inviteSchoolUser` | `MEMBER_INVITED` |
| `PATCH /api/admin/memberships/{id}` | `setMembershipStatus` | `MEMBER_REVOKED` / `MEMBER_RESTORED` |

The audit named the last one. It is one defect in four places sharing one
mechanism, and fixing one of four would have left the ADR false.

The failure mode is the worst of the three available: the administrator reads
`500` while the row disagrees with them, and nothing downstream can tell that
apart from a write that really did not happen.

## Decisions made

1. **`runInTransaction` at all four sites**, its third caller after ADR-043.
2. **A refusal is returned out of the transaction, never thrown.** Nothing was
   written, so there is nothing to roll back and nothing to record — and a
   thrown refusal would turn every `MEMBERSHIP_NOT_FOUND` into a `500`. Pinned
   by a test that walks a 404 and a 409 and asserts the audit log holds exactly
   the one event that belongs to the write that succeeded.
3. **No new abstraction.** Four `runInTransaction` calls at four entrypoints,
   which is what `check-composition-root.mjs` already allows. A shared
   "write-and-record" helper would have been `runInTransaction` with ceremony,
   since each site calls a different service with different audit arguments.
4. **The `error.message` leak fixed only in the three files being rewritten.**
   The same three `catch` blocks were being replaced anyway. Fourteen other
   files under `src/app/api` still leak, including the MCP route where the leak
   reaches whoever holds the shared secret — that is the audit's own separate
   row and it is left open and re-measured rather than quietly half-closed.
5. **The detail goes to `console.error`**, matching the existing precedent at
   `rounds/[roundId]/route.ts:142`. There is no route-level helper for recording
   a caught error into the operational sink; adding one belongs with the other
   fourteen files.
6. **The audit insert is made to fail with a NUL byte in `details`.**
   PostgreSQL refuses `\u0000` in `jsonb`, and `details` carries names and
   e-mail addresses that arrive from a form — so this is a failure the product
   can actually have, not a stub that throws.

## Changed files

- `src/app/api/admin/memberships/[membershipId]/route.ts`
- `src/app/api/admin/people/route.ts` — both invitation paths.
- `src/app/api/admin/schools/route.ts`
- `src/app/api/admin/__tests__/admin-routes.test.ts` — four new tests.
- New `src/lib/repositories/__dbtests__/postgres-administrative-audit.test.ts`.
- `PROJECT_CONTEXT.md` ADR-047, `docs/critical-audit-2026-08-21.md` (both rows),
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: `/api/admin/*` is not in the published contract,
and the status codes are unchanged — only the body of a `500` is now a constant.

## Exact Git state

See the commits on this branch. The only unstaged file is `next-env.d.ts`, which
is generated and belongs to the owner — stage with
`git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:db` — exit `0`, **88 tests, 88 pass**. Four are new, and the
  first checks the premise rather than assuming it: PostgreSQL really does
  refuse the event the other three fail on. Then a revocation whose record
  cannot be written is undone, an invitation whose record cannot be written
  leaves neither the person row nor the membership, and the same invitation with
  a storable record keeps both.
- `npm run verify:core` — exit `0`, zero `not ok`, production build included.
- `src/app/api/admin/__tests__/admin-routes.test.ts` — 12 tests, 12 pass. The
  eight that existed still pass unchanged; the four new ones cover all four
  routes answering `500` with a constant that does not carry the thrown text,
  the refusal path keeping its own status and writing nothing, and the in-memory
  divergence asserted rather than hidden.

### Blocked or not run

- **Nothing was walked over HTTP.** The route tests drive the real handlers, and
  the rollback is proved at the repository layer against real PostgreSQL. The
  seam neither covers is the two together — the composition root — which did not
  change.
- `npm run test:e2e` — not run. No screen, redirect or role gate changed, and no
  spec covers the administrator console's write paths.
- **The four routes were not exercised against the deployed database.** The
  failure being fixed needs an audit insert to fail, which is not something to
  arrange there.
- The Python suite — not run; nothing on that side changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` via `verify:db`.

### Residual risk

- **The transaction is wider than it was.** `inviteSchoolUser` writes a person
  row and a membership, and the audit insert now joins them, so the row locks
  are held marginally longer. These are single-row writes on an administrator's
  action, and `TRANSACTION_TIMEOUT_MS` already bounds them, but it is a change
  in lock behaviour and is stated rather than assumed away.
- **`recordRoundAuditEvent` was not touched.** Its swallow-and-warn covers a
  different case — a round already updated by a route whose own transaction has
  closed — and whether the owner's decision should reach it is a question they
  have not been asked.
- **The leak is half-closed by count.** Three of seventeen files. The audit row
  says so and names the two worst remaining, so nothing here reads as finished
  when it is not.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin fix/a-membership-change-nobody-recorded-did-not-happen:main
```

There is a second branch waiting as well, unrelated to this one:
`chore/the-finished-tasks-move-to-the-archive`.
