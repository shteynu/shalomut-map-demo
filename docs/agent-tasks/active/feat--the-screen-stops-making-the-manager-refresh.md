# The screen stops making the manager refresh

## Metadata

- Branch: `feat/the-screen-stops-making-the-manager-refresh`
- Base branch: `main`
- Base commit: `2b88fa5`
- Current HEAD: the commit carrying this work
- Status: complete and verified locally; awaiting the owner's push
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last stretch of the analysis queue: the person who ordered a map.
Everything from the round closing to the worker finishing is durable, retried
and now monitored — and none of it reaches the browser. The screen said the
results would appear in a few minutes and offered a `בדיקה חוזרת` button, which
asked the manager for the one thing they cannot supply: the moment the minutes
are up.

This is point 4 of the five-point list from the polling research of 2026-08-23; points
3 and 2 landed as `cea594f`/`960e8dd` and `ce6d1b0`/`2b88fa5`. Points 1 and 5
were recommendations *not* to act.

## User-visible outcome

While an analysis is being written, the dashboard checks on its own — after 5
seconds, then 10, 20 and every 30 — and stops while the tab is hidden. The copy
changes with it: «אין צורך לרענן — המסך יתעדכן מעצמו». When the map lands the
screen says so, on the screen where the change happened. After twenty minutes of
visible waiting it stops and says it stopped, leaving the button.

The two buttons that order a run now start the watch instead of promising
minutes.

## Context

- No websocket, no push, no server-sent events, and no plan for any: Core is on
  Vercel and the manager screens are static pages behind a session. Polling from
  the page is the only channel that exists.
- `/api/health/ai-queue` (point 3) already answers "is anybody taking the work",
  which is why this page is allowed to give up rather than watch forever.
- The three-lane pool (point 2) is what sizes the ceiling: ten simultaneous
  closures leave the last round about thirteen minutes.

## Scope

- A pure planner for the decision, `src/lib/dashboard/ai-insights-watch.ts`.
- `useAiInsights` acts on it and reports a `watch` status.
- Copy on the overview and the three detail screens.
- The two dispatch buttons re-read after a successful dispatch.
- Documentation of the behaviour and registration of its three numbers.

## Non-goals

- Email or browser notifications. The owner chose in-app self-refresh, which
  keeps the privacy model untouched — no addresses, no external delivery.
- Push from Core to the AI service. That was point 5, explicitly deferred until
  this one exists.
- Any change to the queue, the lease, the worker or the dispatch rules.

## Acceptance criteria

- A round with an analysis in flight updates itself without a manual refresh.
- A hidden tab does not poll, and looks immediately when it is shown again.
- The wait stops at a stated ceiling and says so.
- A re-check never replaces the map with a loading state.
- A map that was already finished when the screen opened announces nothing.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle, the rule that
  code outranks prose.
- `.agents/skills/shalomut-map/SKILL.md` for product behaviour and Hebrew copy.
- `.agents/skills/shalomut-verification/SKILL.md` for what evidence to record.

## Relevant architecture and contracts

- ADR-006 (durable AI execution belongs to Core) and ADR-016 (closing a round
  dispatches analysis) are untouched; this reads the run state they already
  persist.
- The `ai-insights` envelope's `run.state` is the whole input: `queued` and
  `running` are in flight, `succeeded` beside a map qualifies nothing.
- No new endpoint, no new secret, no change to the endpoint surface.

## Decisions made

- **The decision is a pure function.** `planAiInsightsWatch` takes four values
  and returns one of four plans, so the ladder, the pause and the ceiling are
  tested without a browser, a clock or a React renderer — the project's
  component tests render to static markup and could never exercise a timer.
- **Twenty minutes, counting only visible time.** Sized against the queue rather
  than one round. A tab left open over lunch has not been watching.
- **The ceiling outranks the hidden check.** A page that watched to the end and
  was then hidden has given up; reporting it as paused promises a resumption
  that is not coming.
- **A re-check keeps the map it already has.** The hook reports `loading` only
  when it has nothing for this round. Otherwise every check would flash a
  spinner over the map and unmount whatever the manager had just clicked.
- **The watch schedules from the answer, not from the question.** The effect
  depends on the request that landed, so a slow round does not queue checks
  behind each other.
- **The arrival notice is repeated on the detail screens; the standing notices
  are not.** The standing ones are facts about the analysis and are read once on
  the overview. The arrival reports a change that happened in front of the
  reader, and the reader who waited on a dimension screen is the one it is for.
- **A new run retires the previous arrival** by derivation rather than by a
  reset, so the announcement comes back by itself when this run lands too.

## Assumptions

- A manager waiting for a map keeps the tab open or returns to it. Nothing here
  helps somebody who closed it, and nothing here pretends to.
- The `ai-insights` read is cheap enough to repeat every 30 s per open screen.
  It is one indexed read of a stored payload, and the worker's own idle polling
  is the same order of magnitude.

## Completed

- `src/lib/dashboard/ai-insights-watch.ts` — the planner, its three constants
  and the two predicates.
- `src/lib/hooks/use-ai-insights.ts` — the timer, the visibility listener, the
  stale-while-revalidate read, and the `watch` status it returns.
- `src/components/dashboard/dashboard-ai-insights-state.tsx` — three-way copy on
  the running and refresh notices, and `DashboardAiArrivedNotice`.
- The overview and the three detail screens render the arrival notice.
- `DashboardDimensionRerun` and `GenerateAnalysisButton` re-read on a successful
  dispatch, with copy that matches what the screen now does.
- `docs/ai-analysis-run-lifecycle.md` — a new section, and the false sentence
  «nothing here tells a manager their analysis finished» removed.
- `docs/platform-handbook.md` §7 — the plain-language paragraph.
- `scripts/check-doc-numbers.mjs` — the three watch constants and the queue
  stall threshold are now checked claims rather than prose.

## In progress

Nothing.

## Remaining

Nothing in this task. Point 5 of the research list — pushing a wake to the AI
service on closure instead of waiting for its next poll — was deferred until
this existed, and is now unblocked. It buys about thirty seconds and adds a
failure mode; it stays a recommendation against, not a plan.

## Changed files

- `src/lib/dashboard/ai-insights-watch.ts` (new)
- `src/lib/dashboard/__tests__/ai-insights-watch.test.ts` (new)
- `src/lib/hooks/use-ai-insights.ts`
- `src/components/dashboard/dashboard-ai-insights-state.tsx`
- `src/components/dashboard/dashboard-dimension-rerun.tsx`
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/dashboard/dashboard-dimension-page.tsx`
- `src/components/dashboard/dashboard-metrics-page.tsx`
- `src/components/dashboard/dashboard-recommendations-page.tsx`
- `src/components/dashboard/__tests__/dashboard-ai-refresh-notice.test.tsx`
- `scripts/check-doc-numbers.mjs`, `scripts/check-doc-numbers.test.mjs`
- `docs/ai-analysis-run-lifecycle.md`, `docs/platform-handbook.md`
- `docs/agent-tasks/active/feat--the-screen-stops-making-the-manager-refresh.md`
  (this file); the two landed task files moved to `archive/`

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. That is `lint:literals`, `lint:interpreter`,
  `lint:composition`, `lint:deploy-migrations`, `lint:tenant-chokepoints`,
  `lint:fixtures`, `lint:skills`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `lint:doc-numbers`,
  `lint:python-deps`, `typecheck`, `npm test`, `verify:ai`, `lint`, `build`.
- `npm test` — 1484 passed, 0 failed. 12 new planner tests and 7 new component
  tests.
- `npm run lint:doc-numbers` — 21 claims across 3 documents, up from 17.
- Browser walk, Playwright against `next start -p 3210` with the local password
  door, round `round_local_closed_1787343794009`:
  - **The screen checks on its own.** With a run queued and no worker, the
    network log showed the initial `ai-insights` read plus three more inside 40
    seconds — the 5 s / 10 s / 20 s ladder.
  - **The map arrives without a refresh.** The AI worker was started against
    local Core; the dimension screen replaced its own content and rendered
    «הניתוח הושלם, והמפה שמוצגת כאן היא התוצאה שלו.» with no navigation and no
    reload.
  - **No spinner flash.** A `MutationObserver` counting appearances of «טוענים
    את ניתוח השלומות» across the whole walk reported 0.
  - **The dispatch button starts the watch.** Clicking «ניתוח מחדש לממד הזה»
    with the worker stopped left «הבקשה נקלטה … והמסך יתעדכן מעצמו בסיומו» on
    screen, and `/api/ai-analysis-runs/queue` confirmed `waitingCount: 1`.
  - **A new run retires the old announcement.** Ordering a re-run from a screen
    that had just announced an arrival removed that sentence.
- The Browser pane reports `document.hidden: true` for its tab, and the watch
  correctly paused there — an accidental but real check of the `paused` branch
  against a browser.

### Failed

None.

### Blocked or not run

- Playwright screenshots timed out twice at the font-loading step. Evidence is
  the DOM text instead, read from the live page.
- Nothing was verified on the deployed environment; this branch is unpushed.

### Environment

Local only. Core built and served with `next start -p 3210`; the AI service run
from `ai-analytics-service/.venv` on port 8099 with `AI_JOB_POLLING_ENABLED=true`
and **no** provider key, so every round took the deterministic fallback path and
nothing reached the paid provider. The local database was used and left drained:
`/api/ai-analysis-runs/queue` reports `idle` with `waitingCount: 0`.

### Residual risk

- The ladder and the ceiling are correct by test; what a real thirteen-minute
  queue wait feels like on a real screen is unproven, because no local run takes
  that long.
- One open dashboard screen now costs Core a read every 30 s while a run is in
  flight. Cheap per screen, unmeasured in aggregate — and only ever during a
  run, never idle.

## Failed approaches

- Resetting the watch bookkeeping in an effect keyed on `roundId`, then in an
  all-state session object, then by clearing `arrived` inside the arrival
  effect. Each tripped `react-hooks/set-state-in-effect` or
  `react-hooks/refs`. What holds: the verdict carries its round and is compared
  in render, and the retirement of an arrival is derived rather than written.
- Verifying the active path in the Browser pane. It reports its tab as hidden,
  so the watch pauses there by design.

## Known risks

- `WATCH_CEILING_MS` is sized against a three-lane pool. Raising or lowering
  `AI_JOB_POOL_SIZE` changes what a normal wait is; the doc-numbers gate keeps
  the documents honest about the value but cannot notice that the reasoning
  behind it moved.

## Approval gates

None. No credentials, no secrets, no deployment aliases, no schema change.

## Questions requiring an owner decision

None.

## Next concrete step

Push the branch: `git push origin feat/the-screen-stops-making-the-manager-refresh:main`.
