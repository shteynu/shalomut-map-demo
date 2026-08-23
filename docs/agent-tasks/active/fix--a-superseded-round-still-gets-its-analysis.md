# A round its successor closed still gets its analysis

## Metadata

- Branch: `fix/a-superseded-round-still-gets-its-analysis`
- Base branch: `main`
- Base commit: `9d53ea0`
- Current HEAD: the documentation commit at the tip of this branch, whose
  parents are `ed423de` and `7d1c5dd`. A commit cannot name its own hash, so
  read the tip from Git rather than from this line.
- Status: implementation and local verification complete; not pushed
- Last updated: 2026-08-23
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Closing a round is what asks for its analysis (owner decision 2026-08-17,
ADR-016), but only one of the ways a round can close actually asked.
`enqueueAiAnalyticsOnClosure` had a single caller — `PATCH /api/rounds/:id`.
`RoundService.closeOtherActiveRounds`, the sweep that enforces one active round
per school (owner decision 2026-08-03, ADR-014), closed the school's running
round with a direct repository write and returned.

So a manager who started the next round the ordinary way ended the previous one
and it was never analysed — permanently, because `closed → closed` is not an
allowed transition and closing is the only thing that asks. This is the entry
from `docs/critical-audit-2026-08-21.md` §"Пропускная способность,
наблюдаемость и провижининг", medium severity.

## User-visible outcome

Publishing a questionnaire that starts the next round also queues the analysis
of the round it replaced, so that round's dashboard fills in instead of staying
empty forever. Same for a round created live through the public API.

## Context

- Dispatch: `src/lib/server/trigger-ai-analytics.ts`.
- `RoundService.activateRound` already returned `closedRounds` on both branches
  (added 2026-08-22), so the builder path needed no new query.
- `closeOtherActiveRounds` has a second caller, `createAndSaveRound`, which is
  how `POST /api/rounds` creates a round that is born active. That one did not
  report its closures, so its return type changed.

## Scope

- `enqueueAiAnalyticsForSupersededRounds` in `trigger-ai-analytics.ts`.
- Wired into `PUT /api/rounds/:id/survey-definition` and `POST /api/rounds`.
- `createAndSaveRound` returns `{ round, closedRounds }`.
- Route-level tests for both doors.
- ADR-016 paragraph, audit entry closed, lifecycle diagram note.

## Non-goals

- Changing when analysis is dispatched (owner decision 2026-08-17 stands).
- Reporting the superseded round's dispatch outcome in either response body —
  no screen reads it, so it would be an OpenAPI change for a fact with no
  reader. Neither response shape changed, so `public/openapi.json` is untouched.
- The other three audit findings the owner listed: telemetry sink, the
  `resolveOrganizationId` full-table load, the transactionless round reset.

## Acceptance criteria

All four hold, each covered by a test in
`src/app/api/__tests__/a-superseded-round-is-still-analysed.test.ts`:

- A draft published over a running round queues exactly one `closure` run for
  the round that stopped, and none for the round that started.
- A superseded round below its privacy threshold queues nothing.
- A dispatch that throws does not cost the activation.
- An activation that was refused still analyses the round it had closed.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — composition-root boundary: only
  entrypoints call `resolveCoreRepositories()`, so the dispatch is wired at the
  route rather than pushed into `RoundService`.
- `.agents/skills/shalomut-verification/SKILL.md` — `src/app/api` + services and
  repositories rows, plus the unconditional `npm run typecheck`.

## Relevant architecture and contracts

- ADR-016 (closing asks) now says every close asks, and names the two implicit
  doors. ADR-014 (one round at a time) and ADR-008 (composition root) are what
  make the placement the only available one.
- The privacy threshold gate stays inside `enqueueAiAnalyticsOnClosure`.
- `@@unique([roundId, requestKey])` still collapses racing dispatches.

## Decisions made

- The dispatch is wired at the route entrypoints, not inside `RoundService`:
  the service is a Core domain service handed round repositories only, and the
  PATCH route already established that the entrypoint dispatches after a
  confirmed write. The audit's own suggested fix ("dispatch everywhere a round
  transitions to closed") would have put it below that edge.
- Superseded rounds are dispatched even when the activation that closed them
  was then refused. They are closed either way, and that case leaves the school
  with no live round and one round that really did stop collecting.
- A queue write that fails is swallowed per round, matching the PATCH route.

## Assumptions

- At most one round is superseded per activation, because the partial unique
  index allows one active round per school. The helper still takes a list,
  because `closeOtherActiveRounds` returns one.
- `manager-setup.service.ts` can never close anything through
  `createAndSaveRound`: it passes no questionnaire on purpose, so its round is
  a draft. Its call site changed shape only.

## Completed

- `ed423de` — the builder path: `enqueueAiAnalyticsForSupersededRounds`, wired
  into `PUT /api/rounds/[roundId]/survey-definition`, five tests.
- `7d1c5dd` — the born-active path: `createAndSaveRound` reports `closedRounds`,
  `POST /api/rounds` dispatches from it, two more tests, seven mechanical call
  sites updated.
- Documentation: ADR-016 extended, the audit entry marked `ЗАКРЫТА` with a
  paragraph on why the fix does not sit where the audit's "Фикс" line proposed,
  the running count moved to 32 of 50, and the lifecycle diagram now says the
  PATCH route is not the only door.

## In progress

- Nothing.

## Remaining

- Push, and confirm on the deployment. Nothing here has left this worktree.

## Changed files

Committed in `ed423de`:

- `src/lib/server/trigger-ai-analytics.ts`
- `src/app/api/rounds/[roundId]/survey-definition/route.ts`
- `src/app/api/__tests__/a-superseded-round-is-still-analysed.test.ts` (new)

Committed in `7d1c5dd`:

- `src/lib/services/round.service.ts`
- `src/app/api/rounds/route.ts`
- `src/lib/services/manager-setup.service.ts`
- `src/app/api/__tests__/a-superseded-round-is-still-analysed.test.ts`
- Five test files updated for the new return shape:
  `src/lib/repositories/__dbtests__/postgres-one-active-round.test.ts`,
  `src/lib/repositories/__tests__/repositories.test.ts`,
  `src/lib/services/__tests__/new-round-questionnaire.test.ts`,
  `src/lib/services/__tests__/round-activation.service.test.ts`,
  `src/lib/services/__tests__/share-code.test.ts`

Committed in the documentation commit at the tip:

- `PROJECT_CONTEXT.md`, `docs/critical-audit-2026-08-21.md`,
  `docs/ai-analysis-run-lifecycle.md`, this file.

## Verification evidence

### Passed

- `npx tsx --test src/app/api/__tests__/a-superseded-round-is-still-analysed.test.ts`
  — 7/7.
- Both halves shown to fail without the fix, by disabling each call in turn and
  restoring it: without the builder wiring, tests 1 and 5 fail; without the
  `POST /api/rounds` wiring, test 6 fails. The other tests stayed green in both
  runs, so they are not the ones doing the work.
- `npx tsx --test` on the three neighbouring suites —
  `a-refused-status-write-says-so`, `round-close-dispatches-analysis`,
  `trigger-ai-analytics` — 20/20.
- `npm run typecheck` — exit 0.
- `npm test` — 1491/1491, exit 0.
- `npm run lint` — exit 0.
- `npm run build` — exit 0.
- `npm run lint:composition`, `npm run lint:fixtures`,
  `npm run lint:tenant-chokepoints`, `npm run lint:doc-numbers` — exit 0 each.

### Failed

- None.

### Blocked or not run

- `npm run verify:ai` and the Python suite: not run. The diff touches no
  `ai-analytics-service` file, no contract manifest and no `contracts/`
  capability.
- `npm run openapi:generate`: not run and not needed — no route's request or
  response shape changed.
- Browser smoke and any deployed check: not run. Nothing is pushed, and the
  screens involved are behind `/login`.
- Postgres `__dbtests__`: not run. `postgres-one-active-round.test.ts` changed
  shape only and typechecks.

### Environment

- local and test only.

### Residual risk

- The race ADR-016 already names is untouched: `updateStatus` is not in a
  transaction with the dispatch, so a submission that read `active` just before
  the close can still land after it and make the run fail with
  `round_validation_failed`. This change adds two more places where that window
  exists, at the same width. It is measured from the other end as
  `ai_jobs_failed{failureCode="round_validation_failed"}` — which lands in the
  stdout sink the audit's next open finding is about.
- The dispatch is not visible to the manager who caused it. The builder names
  the round that stopped, and that round's own dashboard is where its map turns
  up, but nothing says "and we have started analysing it".

## Failed approaches

- None.

## Known risks

- `createAndSaveRound` changed its return type. The compiler found every call
  site and `npm test` is green, but any unpushed branch calling it will conflict.

## Approval gates

- None. No secret, credential, auth configuration or deployment alias was
  touched.

## Questions requiring an owner decision

- None for this task.

## Next concrete step

Push the branch — `git push origin fix/a-superseded-round-still-gets-its-analysis:main`
— which is the owner's to run, then read `GET /api/health/` and confirm it
answers the new commit.
