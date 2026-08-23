# The counters reach a place that can warn someone

## Metadata

- Branch: `fix/the-counters-reach-a-place-that-can-warn-someone`
- Base branch: `fix/a-superseded-round-still-gets-its-analysis` (which is
  `main` plus three commits — see **Git state** below)
- Base commit: `a596e80`
- Current HEAD: the documentation commit at the tip of this branch, which
  follows `977ffce`, `81a76a2` and `b8570e2`. A commit cannot name its own
  hash, so read the tip from Git.
- Status: implementation and local verification complete; not pushed
- Last updated: 2026-08-23
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Close the 2026-08-21 audit's medium finding *«Вся телеметрия и трекинг ошибок
уходят в несобираемый stdout»*. Eighteen operational counters and the whole of
this product's error tracking were `console` lines with no collector, no
retention and no alert — every one of them written to catch a failure nobody
watches for, and every one of them landing where nobody reads.

## User-visible outcome

None for a manager or a respondent, by design. The reader here is whoever
operates the deployment: a lost submission, a paid provider that stopped
answering, or a payload the contract refuses now turns an anonymous endpoint
`503`, which a free uptime monitor already knows how to shout about.

## Context

- The finding's own «Фикс» line asked for two halves: a durable receiver, and
  thresholds on three or four counters. Both are here.
- The queue-liveness finding, closed 2026-08-22/23, established the delivery
  shape this reuses: anonymous verdict endpoint answering `503`, numbers behind
  `AI_CALLBACK_SECRET`.
- `ai-operational-metrics.ts` named the receiver an open owner decision in its
  own comments, and the operational handoff carried it as numbered action 5.

## Scope

- `operational_events` table, migration, repository (Prisma + in-memory).
- A durable sink slot in `ai-operational-metrics.ts` and
  `request-error-report.ts`, installed by the composition root.
- Four thresholds, `GET /api/health/observability`, `GET /api/observability`.
- `basic-auth.ts` classification, OpenAPI, endpoint-surface registry.
- `docs/observability.md`, ADR-041, audit entry, handoff, this file.

## Non-goals

- A metrics backend. No aggregation over time, no percentile, no dashboard.
- An external collector. Considered and declined by the owner; the store is a
  sink so the decision is one function to revisit.
- Alerting on more than the four readings, or on durations.

## Acceptance criteria

- A counter emitted by real product work reaches the store without the test
  installing the sink itself.
- A caught request error reaches it with its digest and route.
- A sink that cannot write does not break the work it observes.
- A breached threshold answers `503` and names which; a quiet deployment
  answers `200` and names nothing; an unreadable store answers `503 unknown`
  rather than a quiet `200`.
- The numbers need the shared secret.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — composition-root boundary
  (`lint:composition`), OpenAPI single source, fail-closed persistence.
- `.agents/skills/shalomut-verification/SKILL.md` — API/services, repositories,
  Prisma, OpenAPI and auth rows, plus the unconditional `npm run typecheck`.
- `AGENTS.md` — documentation lifecycle: `lint:doc-numbers` covers quoted
  numbers only, so the prose was read rather than assumed.

## Relevant architecture and contracts

- ADR-041 records the decision; ADR-026 is the precedent for a table with no
  foreign keys; ADR-031 is why the migration needs no manual step.
- No contract version, no manifest and no capability was touched.

## Decisions made

- **Receiver: this product's own Postgres**, chosen with the owner. No account,
  no secret, no first third-party SDK. Sentry stays one function away.
- **One table, two families**, told apart by `kind`: they are read together and
  the alert then scans one index.
- **No foreign keys.** An event about a round must outlive the round, and a
  write that could fail on a stale id would let observability break what it
  observes.
- **Sinks installed by the composition root**, not passed to emit sites: a
  repository parameter would put observability in the signature of everything
  it watches.
- **`after()` for the write**, with a plain promise outside a request scope.
- **The console lines stay.** The error family's worst case is a failure caused
  by the database, and then the durable copy cannot land.
- **Four thresholds, three concerns**, and the two windows differ (360 min for
  counts, 1440 min for the ratio) because analysis runs are rare.
- **A mean below its sample minimum reports `null`, not zero.**
- **The retention sweep rides on the public endpoint**, which is the one thing
  called on a schedule; the project owns no scheduler.

## Assumptions

- Event volume at design stage is low enough that a row per metric is free. No
  respondents exist, and the counters fire on job transitions and failures, not
  per request.
- `AI_CALLBACK_SECRET` is the right door for the numbers, matching the queue's
  numbers endpoint. No new variable was introduced.

## Completed

- `977ffce` — the durable half: schema, migration, repositories, composition
  root wiring, sink slots, `observability-sinks.ts`, three wiring tests.
- `81a76a2` — the alerting half: thresholds, both endpoints, `basic-auth`
  classification, OpenAPI, endpoint-surface registry, ten threshold tests and
  four route tests.
- `b8570e2` — the PostgreSQL suite for the store: eight cases, three of which
  exist because SQL disagrees with an array (a `_sum` of nulls, an absent
  group, a `round_id` naming no round).
- Documentation commit at the tip: `docs/observability.md` (new living doc),
  ADR-041, three numbers registered in `check-doc-numbers` with claims, the
  audit entry closed (`ЗАКРЫТА`, count to 31 of 50), the handoff's numbered
  action 5 answered and action 4 widened to three endpoints, `docs/README.md`.

## In progress

- Nothing.

## Remaining

- Push. Then the owner action: point an UptimeRobot monitor at
  `GET /api/health/observability`. Until that exists the alert is as unread as
  the queue's, which is the same half-finding twice.

## Changed files

Read the three commits; the shape is: `prisma/**` and
`src/lib/repositories/**` for the store, `src/lib/composition-root.ts` and
`src/lib/server/observability-sinks.ts` for the wiring,
`src/lib/server/observability-alerts.ts` and `src/app/api/{health/,}
observability/route.ts` for the alert, and `docs/observability.md` for the
whole of it in prose.

## Verification evidence

### Passed

- `npx tsx --test` on the three new suites — `observability-alerts` (10),
  `the-counters-reach-a-durable-store` (3), and
  `a-crossed-threshold-reaches-a-monitor` (4).
- The wiring shown to fail without it: with `installObservabilitySinks` removed
  from the composition root, both storage tests fail and the four endpoint
  tests stay green, which is the correct split.
- The doc-number gate shown to bite: changing
  `OBSERVABILITY_COUNT_WINDOW_MINUTES` from 360 to 361 failed both places
  `docs/observability.md` quotes it, by name.
- `npm run typecheck` — exit 0.
- `npm test` — 1509 tests, exit 0.
- `npm run verify:core` — exit 0 (which is typecheck, the full suite,
  `verify:ai`, lint, build and all twelve `lint:*` gates).
- `npm run verify:db` — 56 tests, exit 0, against the disposable local
  PostgreSQL on `127.0.0.1:5433`. Run twice, because the plan assertion had
  been flaky and the second run is what proves it is not.
- `npx prisma validate` and `npx prisma generate` — exit 0.
- `npm run openapi:generate` and `npm run docs:endpoints`, both committed.

### Failed

- None.

### Blocked or not run

- No browser or deployed check. Nothing is pushed, and neither endpoint has a
  screen.
- The migration has not been applied to the local development database or to
  the deployment. `verify:db` applies migrations to its own disposable
  database, which is where the suite above ran; the deployment applies its own
  on build (ADR-031).

### Environment

- local and test only.

### Residual risk

- **`after()` has never run inside a real request scope.** Under `tsx` it
  throws and every test took the fallback path, so the branch that matters on
  the deployment — the one that keeps the write from racing a frozen function —
  is the one branch nothing has exercised. Its failure mode is a lost row
  rather than a broken request, and the first deployed read of
  `/api/observability` is what would show it.
- The endpoints have not been read on the deployment. A wrong answer there
  alerts rather than hides — `unknown` is a `503` — but it would alert about
  the wrong thing.
- A request error caused by the database cannot record itself durably. Named in
  the code, in ADR-041 and in `docs/observability.md`; the `console` line is
  what covers it.
- Storing error messages and stacks moves content that a development build can
  fill with query text out of a log window and into a table. No endpoint
  returns it, and the exposure class is unchanged from the `console.error` line
  that already carried the same fields.

## Failed approaches

- None. Two designs were weighed and one was declined by the owner (an external
  collector), which is recorded above rather than here.

## Known risks

- `CoreRepositories` gained a member. Any unpushed branch constructing that
  object literally will fail to typecheck until it adds `operationalEventRepo`.

## Approval gates

- None was needed: no secret, credential, authentication configuration or
  deployment alias was touched, and the new endpoint reuses the existing shared
  secret.
- One **owner action** remains, which is not a gate on this branch: pointing a
  monitor at the new endpoint.

## Questions requiring an owner decision

- None. The receiver and the thresholds were both decided on 2026-08-23.

## Git state

This branch is stacked on `fix/a-superseded-round-still-gets-its-analysis`, so
it carries that task's three commits (`ed423de`, `7d1c5dd`, `a596e80`) below its
own. Pushing this branch to `main` lands both tasks, in order. Nothing is
pushed; both task files are visible only in this worktree until a push exists.

## Next concrete step

Push the branch — `git push origin fix/the-counters-reach-a-place-that-can-warn-someone:main`
— which is the owner's to run, and which lands the superseded-round fix with
it. Then read `GET /api/health/observability` on the deployment: it should
answer `200 {"status":"ok","alerting":[]}` with the new commit. That is the
first proof the deployed write path works at all — `after()` has run nowhere
but a fallback so far — and after it, the monitor is the owner's to create.
