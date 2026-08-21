# Results open when the round closes

## Metadata

- Branch: `fix/results-open-when-the-round-closes`
- Base branch: `main`
- Base commit: `c40fb94` (also `origin/main`)
- Current HEAD: the commit carrying this file
- Status: implemented and verified; awaiting the owner's push
- Last updated: 2026-08-21
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
round now say which of the four reasons it is.

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
- **`lockReason` is Core-side, so no contract changed.** It sits on
  `CanonicalRoundAnalytics` next to `measurementSnapshotHash`, which is
  documented as Core-only for the same reason: `encodeAnalyticsInput` names the
  keys that cross the wire. No versioned manifest and no consumer-first rollout.
- **The screens are told the reason rather than deriving it.** Each of the three
  worked the cause out by comparing the count to the threshold, which was sound
  while the count was the only cause. A round at seventeen answers out of ten
  would have been told it needs another zero — the exact sentence
  `dashboard-map-locked.tsx` already carried a comment warning against.
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

## In progress

Nothing.

## Remaining

Nothing. The owner pushes.

## Changed files

Added: `src/lib/privacy/__tests__/one-basis-of-calculation.test.ts`, this file.

Modified — behaviour: `src/lib/services/analytics.service.ts` (the gate),
`src/lib/types/canonical-analytics.ts` (`RoundLockReason`),
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

- `npm run verify:core`, unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1365 / # pass 1365 / # fail 0`, no `not ok`, all fitness checks
  passing.
- `npx playwright test` — the whole browser suite, all three projects:
  **23 passed**, 0 failed, including `the dashboard renders a map or says why it
  is locked` and the respondent walk.
- **The gate was watched failing.** With `publishesResults` forced to `true`,
  four of the six new privacy checks fail and the end-to-end repository workflow
  fails with them; the two that still pass are the two about closed rounds,
  which is what they claim to be about. The tree was restored and re-run clean.
- **Browser walk, signed in on `:3210` against the local database** (a
  production build, password door, `local-dev-organization`):
  - the active round holding **24 answers against a threshold of 10** renders
    `המפה עדיין נעולה`, the count as "24 received so far" rather than "24 of 10
    required", and the sentence about closing the round;
  - a closed round in the same school renders the full map — overall 76, eight
    stones with their scores — so publication itself is unregressed;
  - the home screen's two status stones show a dash and `ייפתח בסגירת הסבב`
    instead of the red/green counts they used to publish live.

### Failed

None that survived. The five suites that failed on first run were fixtures
asserting that an open round publishes; each was corrected to say which status
its subject needs, not to work around the gate.

### Blocked or not run

- The breakdown screen's locked state was not reached in the browser: the
  seeded canonical questionnaire carries no background question, so that screen
  short-circuits to its own empty state. It is covered by a component test
  instead, which asserts both the new sentence and the absence of the table.
- Nothing on the deployed endpoint. This branch changes runtime behaviour and
  has not been deployed.
- Python suite not run: no file under `ai-analytics-service` changed, and
  `verify:ai` inside `verify:core` passed.

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

`git push origin fix/results-open-when-the-round-closes:main` — the owner's
action. A deploy check is worth doing after it: this branch changes runtime
behaviour, so `/dashboard` on the deployed alias should show a locked map for
any round that is still collecting.
