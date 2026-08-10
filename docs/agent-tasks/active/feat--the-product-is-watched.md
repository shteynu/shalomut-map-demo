# The product can be watched, and a failure leaves something to find

## Metadata

- Branch: `feat/the-product-is-watched`
- Base branch: `fix/consent-tells-the-truth`
- Base commit: `93e3baa`
- Current HEAD: `93e3baa` plus one commit on this branch.
- Status: complete and verified locally. Waits on a push and on two owner
  actions that live in dashboards, not in this repository.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Axis 5 of `docs/product-strategy-axes-2026-08-10.md`: the product had no error
tracking of any kind, and its health endpoint was unreachable without a manager
session, so nothing external could observe it.

## User-visible outcome

None directly. Support gains the other end of a sentence the error screen was
already making: the digest a manager reads out now exists in a log that can be
searched by it.

## Scope

- `/api/health` reachable anonymously, GET and HEAD only.
- One structured line per uncaught server error, via `onRequestError`.

## Non-goals

- No external service, no DSN, no dependency. Wiring Sentry means replacing one
  sink function; choosing it is an owner decision with a credential attached.
- The sixteen operational metrics keep their existing console sink. Pointing
  both families at a real destination is one task, and it needs the destination
  first.

## Decisions made

- **A classifier, not a path check in the middleware.** `basic-auth.ts` already
  owns which routes escape the manager gate, and the third exception belongs
  beside the other two, under the same tests.
- **GET and HEAD only.** `/api/health` has no other method today. A bypass
  written by path alone would silently cover the first one added.
- **The same line shape as `ai-operational-metrics.ts`** — a marker key first —
  so one filter selects both families and neither needs reformatting when a sink
  arrives.
- **The report is built by a pure function.** A route can throw a string, a
  number or `undefined`, and a reporter that only understands `Error` goes blank
  exactly when something unusual happened.

## Completed

- `src/lib/server/basic-auth.ts` — `isPublicOperationalRoute`.
- `src/middleware.ts` — the third bypass.
- `src/lib/server/request-error-report.ts`, `src/instrumentation.ts`.
- `src/lib/server/__tests__/request-error-report.test.ts` (4),
  `basic-auth.test.ts` (+2), `e2e/health-is-public.spec.ts` (2).
- `PROGRESS.md`.

## Verification evidence

### Passed

- `npm test` — 817 tests, 0 failures.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npx playwright test e2e/` — 11 passed, including an anonymous `GET
  /api/health` answering `200` and `GET /api/rounds` still answering `401`
  through the same middleware.
- The error path proved against a real failure rather than a stub: a production
  server started with `DATABASE_URL` pointing at a closed port, a signed-in
  request to `/round`, and the log then held exactly one
  `shalomut_request_error` line — `digest 2171893713`,
  `PrismaClientKnownRequestError`, the failing invocation and the stack. The
  screen shows that digest; the log now contains it.

### Blocked or not run

- Nothing deployed was touched, and no monitor exists yet.
- `verify:db` and `verify:ai` were not run: no schema, contract, prompt or
  version changed.

### Residual risk

`onRequestError` sees uncaught errors only. A route handler that catches its own
failure and returns a 500 body writes no line — `GET /api/survey/{code}` against
a dead database was confirmed to do exactly that. Those handlers are the ones
that already decided what to say; making them report as well is a separate,
larger pass over every catch block.

## Approval gates

Two, both outside this repository:

- Create an uptime monitor against `/api/health` on the deployed Core endpoint.
  Nothing in the repository can do this, and until it exists the bypass is a
  door nobody walks through.
- Decide where structured lines should land — a log sink or an error tracker —
  and with which alert. The first alert worth having is on the
  `ai_deterministic_*_ratio_sample` metrics: a map quietly written by the
  fallback instead of the model is the failure this product is most likely to
  have and least likely to notice.

## Next concrete step

Push `fix/consent-tells-the-truth`, then this branch. Then the two dashboard
actions above.
