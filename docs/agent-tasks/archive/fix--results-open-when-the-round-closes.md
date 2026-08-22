# Results open when the round closes

## Metadata

- Branch: `fix/results-open-when-the-round-closes`
- Base branch: `main`
- Base commit: `c40fb94` (also `origin/main`)
- Final commit: `66707ae`, which is also `origin/main` and the deployed sha
- Status: complete, verified locally and on the deployed endpoint, landed on
  `main`
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the one critical finding of the 2026-08-21 audit: an open round
republished its full aggregates on every read, so a manager could subtract two
reads taken either side of one submission and recover that respondent's whole
answer sheet.

## User-visible outcome

A round that is still collecting no longer shows its map, its dimension scores,
its per-question numbers or its demographic breakdown. It shows the response
count, the funnel and how the round was filled, as before. Closing the round
publishes everything, as it always did. The three screens that report a locked
round now say whether it is the round still being open or the privacy threshold,
which they read from the round's own status rather than from the count.

## Context

`AnalyticsService.calculateDynamicRoundAnalytics` gated detail on the privacy
threshold alone, and `/api/rounds/[roundId]/analytics` had no round-status gate,
so every read of an open round past `k=10` published exact per-question
green/yellow/red integers and exact group sizes — over one more person each
time. ADR-022 had already done this arithmetic for the case where a *manager*
picks the second basis, measured the leak at roughly 171 bits about one person,
and refused the exclusion feature over it. It did not close the case where the
second basis costs nobody a decision, only a refresh.

## Decisions made

- **The gate is inside the calculation, not on the route.** ADR-022 closes by
  naming the paths any such decision must reach — the MCP route, the callback
  verifier in `ai-insights-service`, and `buildBackgroundBreakdown` on a third
  path of its own — and warns that filtering one and not the others makes Core
  reject its own analysis or makes two screens disagree. `SurveyRound` was
  already a parameter of the calculation, so one condition there reaches all
  seven consumers and none of them had to learn about it.
- **`closed` and `archived` publish; `draft` and `active` do not.** Archived has
  to publish: the callback verifier recomputes the round it is checking, and an
  archived round read as locked would make Core reject a correct result.
- **Nothing was added to the wire, so no contract changed.** The gate only
  changes what `dimensionScores` and `questionAggregates` hold, and both are
  already allowed to be empty on a locked round. No versioned manifest and no
  consumer-first rollout.
- **The screens read the round, they do not derive the reason from the count.**
  Each of the three worked the cause out by comparing the count to the
  threshold, which was sound while the count was the only cause. A round at
  seventeen answers out of ten would have been told it needs another zero — the
  exact sentence `dashboard-map-locked.tsx` already carried a comment warning
  against. The fourth commit cut the `lockReason` field that first carried the
  answer back from the analysis: the screens hold `selectedRound` already, so
  they call `isRoundCollecting(status)` — the same predicate the gate calls —
  and the domain model keeps one field fewer.
- **The seed grows a second round.** One round cannot demonstrate both halves
  any more: the respondent route needs `active`, an open map needs `closed`. The
  seed's own summary had also been claiming the AI analysis could be triggered
  from an active round, which stopped being true at ADR-016.
- **`below-threshold` copy now describes a round that closed short**, because
  after this change that is the only way to reach it, and "another N answers and
  the map opens" is false once collection has stopped.

## Assumptions

- Live movement of the map during collection is not a requirement. The AI
  narrative already only existed after closure (ADR-016), so what is removed is
  the computed half of the dashboard for an open round.

## Completed

Everything in Scope. `ADR-030` records the decision; ADR-022 gained a short
amendment pointing at it, since it is the document that left this axis open.

A fourth commit then cut the `lockReason` field the first three introduced. The
owner judged it machinery the change did not need, and it was: the screens hold
`selectedRound` already, so `isRoundCollecting(status)` — the predicate the gate
itself calls — answers the same question without a field on the domain model,
without a case the encoder has to ignore, and without a way for the explanation
to disagree with the verdict. `planned-end.ts` had the same predicate inline and
now shares it.

## In progress

Nothing.

## Remaining

Nothing. The owner pushed on 2026-08-22; Vercel built `66707ae` and the walk
below was done against it.

## Changed files

Added: `src/lib/privacy/__tests__/one-basis-of-calculation.test.ts`, this file.

Modified — behaviour: `src/lib/services/analytics.service.ts` (the gate),
`src/lib/rounds/round-status.ts` (`isRoundCollecting`),
`src/lib/rounds/planned-end.ts` (same predicate, was inline),
`src/components/dashboard/dashboard-map-locked.tsx`,
`src/components/dashboard/dashboard-map-page.tsx`,
`src/components/breakdown/breakdown-board.tsx`,
`src/lib/dashboard/status-stone-value.ts`, `src/app/dashboard/page.tsx`,
`src/app/breakdown/page.tsx`, `src/app/page.tsx`, `scripts/seed-local.ts`.

Modified — fixtures that had been relying on an open round publishing:
`src/lib/services/__tests__/analytics.service.test.ts`,
`src/lib/repositories/__tests__/repositories.test.ts`,
`src/app/api/__tests__/mcp-integration.test.ts`,
`src/lib/__tests__/ai-contract-v5-smoke.test.ts`,
`src/lib/__tests__/analytics-encoder.test.ts`,
`src/lib/privacy/__tests__/background-answers-stay-in-core.test.ts`,
`src/components/dashboard/__tests__/dashboard-map-lock.test.tsx`,
`src/components/breakdown/__tests__/breakdown-board.test.tsx`,
`src/lib/dashboard/__tests__/status-stone-value.test.ts`.

Modified — documentation: `PROJECT_CONTEXT.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner; it is
left uncommitted.

## Verification evidence

### Passed

All of the below was re-run after the `lockReason` cut, not carried over.

- `npm run verify:core`, unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1366 / # pass 1366 / # fail 0`, no `not ok`, all fitness checks
  passing.
- `npx playwright test` — the whole browser suite, all three projects:
  **23 passed**, 0 failed, including `the dashboard renders a map or says why it
  is locked` and the respondent walk.
- **The gate was watched failing.** With `isRoundCollecting` forced to return
  `false`, seven tests fail: four of the six new privacy checks, the end-to-end
  repository workflow, and the two `planned-end` checks that now share the
  predicate. The two privacy checks that still pass are the two about closed
  rounds, which is what they claim to be about. The tree was restored and
  re-run clean at 1366/1366.
- **Browser walk, signed in on `:3210` against the local database** (a
  production build served from `next start`, password door, the admin
  organization). A seeded round carrying a background question was set to
  `active` for the walk and set back to `closed` afterwards, which is what
  reached the breakdown's locked state that the earlier walk could not:
  - the active round holding **41 answers against a threshold of 10** renders
    `המפה עדיין נעולה`, the count as `41 תשובות התקבלו עד כה` rather than "41 of
    10 required", and the sentence about closing the round;
  - `/breakdown` on the same round renders `תוצאות הסבב ייפתחו כשהוא ייסגר` with
    the count, and no table;
  - the home screen's two status stones show `ייפתח בסגירת הסבב` instead of the
    red/green counts they used to publish live;
  - a closed round in the same school still renders the full map, so publication
    itself is unregressed.

### Failed

None that survived. The five suites that failed on first run were fixtures
asserting that an open round publishes; each was corrected to say which status
its subject needs, not to work around the gate.

### Blocked or not run

- `npm run db:seed:local` fails partway on this database: `SHALOM-LOCAL` is
  already taken by an earlier seeding under a different organization, so the
  active round it wants to write hits the unique constraint on `share_code`.
  The walk used the rounds already in the database instead. Worth fixing, but
  it is a seed-script defect and not this task's.
- The breakdown screen's locked state was not reached on the deployed endpoint:
  the demo round's questionnaire carries no background question, so that screen
  short-circuits to its own empty state there. It was reached locally, on a
  round that has one, and is covered by a component test.
- Python suite not run: no file under `ai-analytics-service` changed, and
  `verify:ai` inside `verify:core` passed.

- **Deployed walk on `shalomut-map-demo.vercel.app`, signed in by the owner in
  the connected Chrome.** The Vercel production deployment reports `● Ready`
  with `gitSource.sha` `66707ae14d313cb7ab398eee7d7d6fd1676a5e06` on `main`,
  and all three aliases point at it. The deployed database held one round —
  `סבב הדגמה`, `closed`, 12 responses — so it was set to `active` for the walk
  and set back to `closed` afterwards:
  - `closed`, before and after: `/dashboard` renders the full map, overall 76,
    eight stones. Publication is unregressed on the deployed endpoint.
  - `active`: `/dashboard` renders `המפה עדיין נעולה`, `12 תשובות התקבלו עד כה`
    and the ADR-030 sentence — no dimension scores, no per-question numbers.
  - `active`: the home screen's two status stones show a dash and
    `ייפתח בסגירת הסבב`, while the response count `12/20` and the privacy
    threshold `10` stay visible, which is the line ADR-030 draws.
  - The first `/dashboard` load after the flip served the Next.js client router
    cache and still showed the map; a fresh URL showed the lock. Worth knowing
    for the next deployed check — it is a client-side cache, not the gate.

### Environment

Local, against the loopback development database and production builds.

### Residual risk

- **A closed round can be reopened** (`closed → active` is an allowed
  transition), which now also withdraws its published numbers until it is closed
  again. That is the rule working, but no screen explains that particular
  disappearance.
- **The local database used for the walk** gained one closed round
  (`round_local_closed_1787336408230`) with twelve responses, created through
  the repositories. It is disposable; `db:seed:local --reset` clears it.
- The audit's other 56 findings are untouched by this branch.

## Known risks

The product loses the live map during collection. If the owner wants live
feedback back, the shape ADR-030 permits is a count-only surface — not detail
republished in batches, which ADR-022's argument rejects for the same reason it
rejects exclusion.

## Approval gates

None. Unchanged: `GEMINI_API_KEY` awaits the owner's rotation.

## Questions requiring an owner decision

- Does any school need the map to move during collection? The answer does not
  reopen the leak either way, but it decides whether a count-only "how the round
  is going" surface is worth building.

## Next concrete step

None. The work is landed as `66707ae`, deployed and verified there; this file is
archived. The one open question above is a product question for the owner, not a
step in this task.
