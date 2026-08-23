# A stalled queue says so

## Metadata

- Branch: `feat/a-stalled-queue-says-so`
- Base branch: `fix/the-hygiene-findings-of-the-audit`, itself based on `main`
- Base commit: `026ae50`
- Current HEAD: `960e8dd`; the work is `cea594f` and `960e8dd`
- Status: complete, landed on `main`, archived 2026-08-23
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make Core able to say whether the AI analysis queue is being consumed, so a
stopped worker stops being invisible. Closes the medium finding of the
2026-08-21 audit: *«Живость очереди висит на одном внешнем стороннем пинге; Core
не умеет заметить мёртвого или спящего консьюмера»*.

## User-visible outcome

None for a manager. Operational: two read-only endpoints, and an anonymous one
that answers `503` when the queue has stalled, so a free uptime monitor can
raise the alarm without being taught anything.

## Context

The owner asked why the AI service polls at all when a manager closing a round
is what dispatches the analysis. The research answer was that closure *is*
already the trigger (ADR-016) and the polling is only how the worker learns the
queue is non-empty — cheap, backed off 2 s → 30 s, ~2 880 requests a day per
lane. Replacing it with a push would buy up to 30 s against a three-minute
analysis nobody is notified about, and would not remove the queue or the poll,
since a lost push must not lose a round.

What the research did surface as worth fixing was this finding. The sweep that
expires abandoned leases lives inside `claimNext`, which only a live worker
calls, so the thing that repairs the queue is the thing that may have stopped.
Liveness rested entirely on an external UptimeRobot account knocking on the
Python service every five minutes.

The owner chose point 3 of the five options offered, and chose the public
verdict + secret numbers split when asked.

## Scope

- `src/lib/types/ai-analysis-run.ts` — `AiAnalysisQueueSnapshot`.
- `src/lib/repositories/interfaces.ts`, both repository implementations —
  `readQueueSnapshot()`.
- `src/lib/repositories/prisma/prisma-client.ts` — `count` on the delegate.
- `src/lib/server/ai-analysis-queue-health.ts` — the verdict, pure.
- `src/lib/server/ai-analysis-worker.ts` — `AI_ANALYSIS_QUEUE_STALL_AFTER_MS`.
- `src/app/api/health/ai-queue/route.ts` — public verdict, 200/503.
- `src/app/api/ai-analysis-runs/queue/route.ts` — numbers, `AI_CALLBACK_SECRET`.
- `src/lib/server/basic-auth.ts` — both paths past the manager gate.
- `docs/openapi.yaml` + `public/openapi.json`,
  `scripts/generate-endpoint-surface.mjs` + the generated table.
- `docs/ai-analysis-run-lifecycle.md`, `docs/platform-handbook.md` §7,
  `docs/critical-audit-2026-08-21.md`, `docs/shalomut-tracker-handoff.md`.
- Two test files.

## Non-goals

- Raising `AI_JOB_POOL_SIZE`. That is the throughput half of the same area and
  a separate decision with its own evidence; this branch changes no pace.
- A push hint from Core on enqueue. Argued against in the research above.
- Notifying a manager that their map is ready. Named as the real latency gap
  and still open.
- Alerting itself. This makes the stall readable; whether a monitor watches the
  new path is operational state, and the handoff says it does not yet.
- A collector for the operational metrics. Separate audit finding, untouched.

## Acceptance criteria

- A queue nobody is consuming reads `stalled` and answers `503` anonymously.
- A legitimately long backlog under a live lease never reads `stalled`.
- The anonymous answer carries no depth, no wait and no round.
- Nothing on either path writes to the database.
- No migration.

## Relevant repository instructions

- `AGENTS.md`: never expose respondent identity or detailed results below the
  privacy threshold. Neither endpoint reads a response, a round or a school;
  the public one publishes one word.
- `AGENTS.md`: current code outranks prose, and a living document that
  disagrees is fixed in the same task. Hence the lifecycle document and the
  handbook in this branch rather than after it.

## Relevant architecture and contracts

- ADR-006 owns the durable queue; this adds a reader, not a state.
- `docs/ai-analysis-run-lifecycle.md` is the implementation-level companion and
  now carries a section for the detector plus the threshold in its numbers
  table.

## Decisions made

- **Two facts, not one.** The audit proposed a queued-age detector. Age alone
  cannot separate a dead consumer from a busy one — ten rounds closing together
  legitimately leave the tenth waiting half an hour — so `stalled` requires
  takeable work past the threshold **and** no live lease anywhere. The lease is
  the liveness signal Core already has and does not have to be told about.
- **Public verdict, secret numbers.** A free monitor cannot send a bearer
  header, and a detector nobody can watch is the failure being fixed. Depth and
  wait say how many schools are measuring right now, so they sit behind
  `AI_CALLBACK_SECRET`. Same split the AI service already makes between
  `/api/v1/provider-status` and `/api/v1/provider-health`.
- **A sibling of `/api/health`, not a field in it.** That endpoint deliberately
  touches no database and must keep answering when the database is what broke.
- **`503` on `unknown` as well as on `stalled`.** An empty queue and an
  unreachable one look identical from outside and mean opposite things;
  reporting the second as `idle` would be the lie this exists to prevent. The
  underlying error is never echoed to an anonymous caller.
- **An abandoned run is waiting work, and its wait starts at the expiry.**
  Counting it as running would report the exact failure being caught as healthy;
  dating it from `queuedAt` would report a run that started promptly and died an
  hour later as having waited an hour.
- **`attemptCount` is not filtered out of the snapshot.** A run that exhausted
  its attempts is still untouched work, and only a live worker marks it
  `lease_exhausted` — excluding it would hide the stall in exactly the case
  where the last rows are all terminal-but-unmarked.
- **Ten minutes.** Poll ceiling 30 s, plus the free Render plan: a sleeping
  instance waits for the monitor's five-minute knock and about a minute of cold
  start. Six and a half minutes is a legitimately slow start.
- **Counted in the database, read-only.** Four index seeks on
  `[state, leaseExpiresAt, queuedAt]`, the index `claimNext` already needs — so
  no migration, and the answer does not get slower as the table grows. Nothing
  sweeps: a reader that repaired what it found would race the claimer.

## Assumptions

- The threshold is a policy number, not a measured one. Nothing has been
  observed sleeping and waking on the deployment with work waiting; the parts it
  is built from are documented (`render.yaml`, `config.py`), the sum is not.

## Completed

Everything in Scope.

## In progress

Nothing.

## Remaining

Nothing in this branch. The owner pushes. Pointing a monitor at
`/api/health/ai-queue` is operational and belongs to the owner's UptimeRobot
account, not to the repository.

## Changed files

Added: `src/lib/server/ai-analysis-queue-health.ts`,
`src/app/api/health/ai-queue/route.ts`,
`src/app/api/ai-analysis-runs/queue/route.ts`,
`src/lib/server/__tests__/ai-analysis-queue-health.test.ts`,
`src/app/api/__tests__/a-stalled-queue-says-so.test.ts`, this file.

Modified: `src/lib/types/ai-analysis-run.ts`,
`src/lib/repositories/interfaces.ts`,
`src/lib/repositories/prisma/prisma-ai-analysis-run.repository.ts`,
`src/lib/repositories/prisma/prisma-client.ts`,
`src/lib/repositories/in-memory/in-memory-ai-analysis-run.repository.ts`,
`src/lib/server/ai-analysis-worker.ts`, `src/lib/server/basic-auth.ts`,
`docs/openapi.yaml`, `public/openapi.json`,
`scripts/generate-endpoint-surface.mjs`,
`docs/ai-analysis-run-lifecycle.md`, `docs/platform-handbook.md`,
`docs/critical-audit-2026-08-21.md`, `docs/shalomut-tracker-handoff.md`.

## Verification evidence

### Passed

- `npm test` — 1465 passed, 0 failed. Thirteen of them are new: seven on the
  verdict without a database or a clock, six driving both routes through the
  in-memory repository on a fake clock.
- `npm run typecheck`, `npm run lint`, `npm run build` — clean. Both routes
  appear in the build output as dynamic functions.
- `npm run openapi:check`, `npm run docs:endpoints:check` (13 endpoints),
  `lint:doc-numbers` (17 claims), `lint:composition`, `lint:literals`,
  `lint:skills` — all pass.
- **Local runtime, production build on port 3210, against the real local
  database.** The full lifecycle, in one sitting:
  - empty-handed start: `GET /api/health/ai-queue/` → `503`
    `{"status":"stalled"}`; the operator path →
    `waitingCount 1, leasedCount 0, oldestWaitSeconds 683618`. That run had been
    queued since 2026-08-15 with no worker ever coming — a real stall, found on
    first contact.
  - `POST /api/ai-analysis-runs/claim/` answered `200` for the same run, so the
    detector's notion of takeable matches `claimNext`'s notion of eligible.
  - immediately after: `idle`, `waitingCount 0`, `leasedCount 1`, public `200`.
  - 90 s later with nothing heartbeating: `draining`, `waitingCount 1`,
    `leasedCount 0`, `oldestWaitSeconds 12` — measured from the lease expiry,
    not from the eight-day-old `queuedAt`.
- The middleware gate was caught by that walk and not by the tests: both new
  paths answered `401 Authentication required.` before `basic-auth.ts` was
  taught about them. Tests call handlers directly and would never have seen it.

### Failed

- None.

### Blocked or not run

- Nothing on the deployment. The branch is unpushed and Core deploys from
  `main`; `verify:core` was not run whole.
- No Python-side check: the diff touches no file under `ai-analytics-service/`.
- The `stalled` → `503` transition has not been observed on the deployment, and
  cannot be without either a real stall or a deliberately queued run there.

### Environment

- local and test.

### Residual risk

- The ten-minute threshold is reasoned, not measured. If the deployment turns
  out to wake more slowly than the parts suggest, the first symptom is a false
  `stalled`, which is visible and cheap to raise.
- `oldestWaitSeconds` on the local database was 683 618 — eight days. Nothing
  overflows, but no test covers a wait that long; the arithmetic is a
  subtraction of two dates and has no ceiling.

## Failed approaches

- None pursued. The queued-age detector the audit proposed was rejected on
  reasoning before it was written, for the false-positive reason above.

## Known risks

- Two repositories now express one definition of "takeable" — Prisma and
  in-memory — plus a third in `claimNext`'s `eligible`. They agree today and the
  local walk proved the first and third agree on real data, but nothing forces
  them to stay in step. A drift would make the detector disagree with the
  claimer about what is waiting.

## Approval gates

- None. No secret, credential, authentication configuration or alias changed.
  `AI_CALLBACK_SECRET` is reused, not introduced.

## Questions requiring an owner decision

- Whether to point the UptimeRobot account at `/api/health/ai-queue` as a second
  keyword monitor. Without it the endpoint is readable but nothing reads it, and
  the finding is only half closed.

## Exact Git state

- Branch `feat/a-stalled-queue-says-so`, based on `026ae50`.
- `origin/main` is `57c9e58`; `026ae50` is itself unpushed, so this branch is
  two commits ahead of the remote.
- Unstaged and unrelated: `next-env.d.ts`, generated by Next.js and left alone.
- Visibility: local only. This handoff is not portable to another checkout until
  the branch is pushed.

## Next concrete step

Push, then read `GET /api/health/ai-queue/` on the deployment anonymously — it
should answer `200 idle` — and decide whether the uptime monitor gets a second
keyword check pointed at it.
