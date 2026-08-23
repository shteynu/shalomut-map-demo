# An error body says what happened, not where

## Metadata

- Branch: `fix/an-error-body-says-what-happened-not-where`
- Base branch: `main`
- Base commit: `d1ee65a`
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

**This branch carries the two commits of
`fix/a-membership-change-nobody-recorded-did-not-happen` underneath its own.**
See **Exact Git state** for why and what that means for pushing.

## Objective

Close the 2026-08-21 audit's «Несколько API-маршрутов протекают внутренними
сообщениями об ошибках в тела 500/JSON-RPC», anchored at `trigger-ai/route.ts:205`.

## What was wrong

A handler catching its own failure and putting `error.message` in the response.
What surfaces there is a database error, a Prisma constraint name or a
configuration string. On `/api/auth/login` — the one endpoint an
unauthenticated caller can reach — it went to anyone who asked, in a `details`
field beside an otherwise careful constant. On `/api/mcp` it went to whoever
holds the shared secret.

**The audit's count of twenty-one was low**, and how it was low is the useful
part: `error?.message` in the reset route and `(error as Error).message` are the
same leak in spellings that no `error.message` search finds.

**And the fix has a second half.** `onRequestError` fires only for what *escapes*
a handler. Every one of these `catch` blocks was therefore invisible to the
product's error tracking, and the response body was the only trace of the
failure that existed anywhere. Removing the message alone would have traded a
leak for a silence.

## Decisions made

1. **`reportRouteFailure`, added beside `reportRequestError`.** Ten lines: parse
   the path off `Request.url`, hand the rest to the existing reporter, so a
   caught route failure lands where the digest a manager reads off the error
   screen already lands — including the durable sink into `operational_events`.
   The path is parsed defensively, because a report that throws while describing
   a failure replaces the failure with itself.
2. **The check refuses the identifier, not the spelling.** Two rules: a `catch`
   in a route file binds the name `error`, and the argument of
   `NextResponse.json(...)` does not mention it. The first exists to make the
   second complete — `catch (e)` would walk past an identifier rule looking for
   `error`.
3. **Together that is a house rule: in a route handler the name `error` means a
   caught throw and nothing else.** Two places used it for the product's own
   refusal wording — `refuse(code, error)` on the submit route and a local
   holding `result.error` — and were **renamed rather than exempted**. An
   exemption is a place the next leak can hide.
4. **The three admin routes from the previous task moved from `console.error`
   onto the same reporter.** They were written before it existed. Leaving three
   files on a different mechanism is how the next inconsistency starts.
5. **The eight remaining `error.message` references are left alone.** All are
   inside `console.*`, which is exactly where the audit asked for them.

## How the check was arrived at, which is the part worth reading

Its first version matched `error.message`, `String(error)` and `error.stack` as
shapes. It passed on the tree, and then a deliberately planted
`(error as Error).message` walked straight through it — a check that had never
failed on purpose, agreeing with itself.

Refusing the identifier instead surfaced twelve more sites, of which **nine were
false positives**: `produced.error`, `refusal.error`, `parsedDefinition.error`
are fields of our own result objects carrying our own wording. Excluding property
access fixed those and then let `{ ...error }` through, because `...` ends in a
dot. The lookbehind now forgives a dot only when it is not itself preceded by
one.

Of the three that survived, one was a real leak the audit had never counted
(`error?.message`) and two were the locals renamed above.

Every one of those steps is a test in `scripts/check-error-bodies.test.mjs`,
including the gap the check still has.

## Known gap, stated rather than discovered

The check reads the argument region of a literal `NextResponse.json(` call, so a
body assembled into a variable and passed by name is invisible to it. The
script's own doc comment says so and a test asserts it, so the claim stays
accurate rather than modest. Closing it means parsing TypeScript in a fitness
check; every occurrence the audit found is a literal at the call site.

## Changed files

- `src/lib/server/request-error-report.ts` — `reportRouteFailure`.
- Ten route handlers: `auth/login`, `manager/setup`, `mcp`, `ai-insights` (×2),
  `goals` (×2), `goals/[goalId]` (×2), `trigger-ai`, `rounds/[roundId]/reset`.
- `survey/[shareCode]/submit` — the two renames.
- The three `admin/*` routes — onto `reportRouteFailure`.
- New `scripts/check-error-bodies.mjs` and its test; `package.json`
  (`lint:error-bodies`, wired into `verify:core`).
- `src/lib/server/__tests__/request-error-report.test.ts`,
  `src/app/api/admin/__tests__/admin-routes.test.ts`.
- `PROJECT_CONTEXT.md` ADR-048, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`: the spec describes these `500`s in prose that is
still accurate, and the only removed field — `details` on the login `500` — was
never documented.

## Exact Git state

`main` moved to `d1ee65a` while the previous task sat unpushed, so its branch was
no longer a fast-forward. Both branches were rebased onto `d1ee65a`, and this one
was built on top of the other because the check added here fails on the three
admin files until that task's constants land.

- `fix/a-membership-change-nobody-recorded-did-not-happen` — 2 commits on
  `d1ee65a`.
- `fix/an-error-body-says-what-happened-not-where` — those 2 plus 2 of its own.

**Push the membership branch first.** Pushing this one alone lands both, which is
not wrong — they are both wanted — but the history reads better in order.

The rebase needed `-c merge.directoryRenames=false`: the archive commit moved
eleven files from `active/` to `archive/`, and Git inferred the same move for a
new task file being added to `active/`.

The only unstaged file is `next-env.d.ts`, which is generated and belongs to the
owner — stage with `git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`, production build included,
  with `lint:error-bodies` now inside it.
- `npm run verify:db` — exit `0`, **88 tests, 88 pass**. Run because the previous
  task's commits are underneath this branch, not because this change touches the
  database.
- `scripts/check-error-bodies.test.mjs` — 15 tests, 15 pass.
- **The check was run against three planted regressions after it was rewritten**
  — `` `${(error as Error).message}` ``, `error?.message ?? "x"`, and
  `{ ...error }` — and caught all three. Before the rewrite it caught none of
  them, which is recorded above.
- `src/lib/server/__tests__/request-error-report.test.ts` — 6 tests, two new: a
  caught failure reaches the report with its message and its path, and a report
  survives having no request or an unparseable one.
- `src/app/api/admin/__tests__/admin-routes.test.ts` — 12 tests, and the
  failing-audit test now also asserts the sink received the message the body
  stopped carrying. Without that, a handler could return a constant and report
  nothing and every other test would pass.

### Blocked or not run

- **Nothing was walked over HTTP.** The bodies are asserted through the real
  handlers in the route tests, and the shape is enforced statically.
- `npm run test:e2e` — not run. No screen, redirect or role gate changed; the
  respondent specs assert on refusal `code`s, which are untouched.
- The Python suite — not run; nothing on that side changed.
- **The MCP route's `500` body was not exercised.** It needs the shared secret
  and a throwing dependency behind it; the change there is one literal and the
  static check covers it.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433` for `verify:db`.

### Residual risk

- **The check's gap is real**, and a handler that builds its body first is not
  covered. See above.
- **`reportRouteFailure` now runs on paths that previously did nothing**,
  including a durable write into `operational_events`. `reportRequestError`
  already guards that write with its own `try`, and the console line is emitted
  first — so the worst case for a database-caused failure is the durable half
  being lost, which is the case that guard was written for. But these routes now
  do more work while failing than they used to.
- **Eight `console.*` references to `error.message` remain** and are not covered
  by the check, which only reads response bodies. They are correct today; nothing
  stops one being moved into a body except the check catching it there.

## Next concrete step

Hand the owner the pushes, which are theirs to run, in this order:

```
git push origin fix/a-membership-change-nobody-recorded-did-not-happen:main
```

```
git push origin fix/an-error-body-says-what-happened-not-where:main
```
