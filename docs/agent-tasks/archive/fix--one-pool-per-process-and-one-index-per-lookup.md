# One pool per process, and one index per lookup

## Metadata

- Branch: `fix/one-pool-per-process-and-one-index-per-lookup`
- Base branch: `docs/the-audit-of-2026-08-21-gets-a-file`, itself based on
  `docs/the-tenancy-spec-landed`, itself based on `main`
- Base commit: `bb9fc08`
- Landed as: `f7da423`, `4392c34` and `f8dda5d`, all on `origin/main`, whose tip
  is `f8dda5d`
- Status: done, verified, pushed, deployed and migrated; archived
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the two cheapest findings of the 2026-08-21 audit, chosen by the owner:
the unbounded, per-module-graph Prisma connection pool, and the redundant index
on `question_answers`.

## User-visible outcome

None directly. Both are about what the database costs under load: fewer
connections held per instance, exhaustion that fails instead of hanging, and one
less index to maintain on every answer written.

## Context

Both findings are restored in
[`../../critical-audit-2026-08-21.md`](../../critical-audit-2026-08-21.md). The
pool appears there three times — one medium about the module-graph cache and the
default pool size, and two lows that are the same pool seen from the scale
sections — so one fix closes three entries. The index is one low.

The audit's own words on the pool: the asymmetry gave it away. `composition-root.ts`
documents that Next.js compiles route handlers and RSC into separate module
graphs, and keeps its ephemeral repositories on `globalThis` because of it. The
cheap fallback had been fixed and the expensive resource — a real connection
pool — had not.

## Scope

- `src/lib/repositories/prisma/pool-options.ts` — `resolvePoolConfig`.
- `src/lib/repositories/prisma/prisma-client.ts` — the cache and the pool.
- `scripts/{backfill-round-definitions,clear-db,clear-test-data}.ts` — same
  config.
- `prisma/schema.prisma` and one migration — the index.
- Tests for both, and the two documents that carry the findings.

## Non-goals

- The other forty-five audit entries.
- Persisted analytics for closed rounds, which is the high finding next to this
  one in the same section and is architecture rather than a bound.
- Making migrations part of the deploy path. That is high finding seven, and it
  is what makes the manual step below necessary; fixing it here would have been
  a different task riding on this one.

## Acceptance criteria

- One Prisma client, and therefore one pool, per process rather than per module
  graph.
- The pool has a finite size, a finite wait for a connection and a finite idle
  timeout, and scripts get the same ones.
- The redundant index is gone, and the lookups that used it cost the same.
- Each assertion watched failing against a deliberately broken tree.

## Relevant repository instructions

- `AGENTS.md`: database contents are disposable and applying migrations is
  ordinary work; confirm the environment because a write to the wrong place
  wastes time. The migration was applied to the local database only, and the
  deployed one is named as an outstanding step rather than done quietly.
- Verification proportional to risk: a change to how every request reaches
  Postgres calls for the whole core suite, not a targeted run.

## Relevant architecture and contracts

- `composition-root.ts` holds the `globalThis` precedent and the reason for it.
- `resolvePoolSsl` keeps its own tests; `resolvePoolConfig` wraps it so that the
  SSL decision and the bounds travel together.
- `@@unique([responseId, questionId])` is a product rule — a duplicate answer
  would silently reweight a dimension — and is now also the index every
  `responseId` lookup uses.

## Decisions made

- **Two connections, not one and not ten.** Nothing in the repository opens an
  interactive transaction, so there is no risk of a transaction waiting on a
  pool it is holding; the widest concurrency in the tree is one `Promise.all`
  over two reads in the administrator overview. One would serialise that pair
  for no reason; ten is the default that made the finding.
- **A finite `connectionTimeoutMillis`, chosen at 10 s.** A database round trip
  here is ~180 ms, so ten seconds is far past any healthy wait and still inside
  a serverless function's budget — the point is that exhaustion arrives as an
  error someone can read rather than as a request the platform kills.
- **`idleTimeoutMillis` pinned at `pg`'s current default.** It changes nothing
  today, and it stops this being a decision of whichever `pg` is installed.
- **One config function, used by the scripts too.** A bound that holds for a
  serverless instance and is absent from a script against the same database is
  not a bound.
- **The index dropped, not replaced.** The unique constraint is not an
  optimisation that could later be tuned away, so the schema comment says the
  constraint is now also the index — otherwise the next reader adds the second
  one back.

## Assumptions

- The deployed database still carries `question_answers_response_id_idx`; it has
  every migration up to `20260820160000`, and `20260730120000` created it.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing. Pushed 2026-08-22, and the migration was applied to the deployed
database the same day.

## Changed files

Added: `prisma/migrations/20260822120000_one_index_per_lookup_on_question_answers/migration.sql`,
this file.

Modified: `src/lib/repositories/prisma/pool-options.ts`,
`src/lib/repositories/prisma/prisma-client.ts`, their two test files,
`scripts/backfill-round-definitions.ts`, `scripts/clear-db.ts`,
`scripts/clear-test-data.ts`, `prisma/schema.prisma`,
`docs/critical-audit-2026-08-21.md`, `docs/shalomut-tracker-handoff.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1370 / # pass 1370 / # fail 0`, zero `not ok` lines, Python
  `568 passed`. Run twice — once before the mutation pass and once after the
  sources were restored from it.
- **Six mutations, each failing exactly one assertion and nothing else:** the
  pool size back to ten, the wait back to unbounded, the idle timeout to zero,
  the SSL decision dropped from the config, the cache back into one module
  graph, and the client rebuilt on every call. No test is vacuous and none is
  redundant.
- **The index drop measured on the local database** (4576 answer rows).
  `WHERE response_id = $1` before: bitmap index scan on
  `question_answers_response_id_idx`, cost `4.49..62.79`, 3 shared buffers hit.
  After: bitmap index scan on `question_answers_response_id_question_id_key`,
  cost `4.49..62.79`, 3 shared buffers hit. Same plan shape, same cost, same
  buffers — a different index.
- **The cascade checked inside a transaction that was rolled back.**
  `DELETE FROM survey_responses WHERE id = $1` fired
  `question_answers_response_id_fkey` in 0.6 ms, left 0 answers for that
  response inside the transaction, and 24 after the rollback.
- `npm run db:migrate:deploy` against the local database applied the migration;
  `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
  reports "No difference detected" at exit 0, so the migration and the datamodel
  agree.
- `npm run lint:doc-numbers` — exit 0, after the documentation edits.
- **The migration ran against the deployed database on 2026-08-22**, through
  `DIRECT_URL` from `.env.deployed.local` — Supabase Seoul, port 5432. Before:
  `migrate status` named exactly this migration as pending and
  `question_answers` carried three indexes. After: `Database schema is up to
  date!` at exit 0, two indexes, and the row counts unchanged at 288 answers
  across 12 responses.
- **The deployed endpoint answers `commit: f8dda5d`**, which is `origin/main`,
  so the runtime half shipped with it.
- **The composite index serves the lookup on the deployed database too.** Its
  288 rows are too few for the planner to prefer any index — the unforced plan
  is a seq scan — so the check there is `enable_seqscan = off`, under which the
  plan is an index scan on `question_answers_response_id_question_id_key` with 3
  buffers hit. The cost-for-cost comparison stays the local one, where the table
  has 4576 rows.

### Failed

None that survived.

### Blocked or not run

- Nothing outstanding. The deployed migration, which was the one item here, ran
  after the push; its evidence is under Passed.
- No browser walk. Neither change is visible on a screen, and the suite covers
  the paths that touch them.
- The pool bound was not observed under real concurrency. Nothing here can
  produce a serverless fleet, and the assertion is on the configuration the pool
  is built with.

### Environment

Local worktree, local PostgreSQL on `127.0.0.1:5433`, two production builds the
suite starts itself. `GEMINI_API_KEY` was stripped from the child environment of
both `verify:core` runs — nothing in this work calls a provider.

### Residual risk

Low, and the shape of it is a bound that is too tight rather than too loose. If
a future path opens an interactive transaction and issues queries inside it
while another request holds the other connection, two is where that would show
up first — as a wait, then as a 10 s timeout with a readable error. The comment
in `pool-options.ts` names the transaction assumption so that the next person
adding one sees it.

## Failed approaches

- **Restoring mutated sources with `git checkout -- <files>`.** The edits were
  not committed yet, so the restore reverted them to `HEAD` and deleted the
  work rather than the mutation. It was visible immediately — the following
  mutation "failed" three unrelated tests — and both files were rewritten. The
  mutation harness now restores from copies in the scratchpad. Anything that
  mutates an uncommitted tree must not use Git as its undo.

## Known risks

`prisma migrate status` against the deployed database will report one migration
pending until the manual step runs. That is accurate, not a symptom.

## Approval gates

None. Unchanged: `GEMINI_API_KEY` awaits the owner's rotation.

## Questions requiring an owner decision

None open. Which audit finding comes next is a question, not a blocker.

## Next concrete step

None. The work is landed, deployed and migrated, and this file is archived.
Which of the audit's forty-five remaining entries comes next is a question for
the owner, not a step in this task.
