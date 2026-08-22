# A failed re-analysis keeps the map

## Metadata

- Branch: `fix/a-failed-re-analysis-keeps-the-map`
- Base branch: `main`
- Base commit: `ececae6`
- Current HEAD: the commit carrying this file, on top of `85ad5dd`
- Status: code done, verified, **not pushed**
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the 2026-08-21 audit's high finding that a queued, running or failed
re-analysis hid a round's already-saved map.

## User-visible outcome

Pressing "rewrite this dimension" no longer empties the dashboard. The map stays
on screen with a line saying a re-analysis is running, or that one failed and
the map is therefore the previous one. Before this, the map vanished for the
minutes the run took and stayed gone if the run died.

## Context

`readAiInsights` resolved through `findLatestByRoundId`, which prefers an active
run and otherwise takes the newest in any state, and returned that run's own
`result`. A queued run has none. Separately, the callback dual-wrote
`survey_rounds.ai_insights` with whatever validated — and a failure payload
validates — so the round's rollback copy was overwritten by the failure of the
run meant to replace it.

## Scope

- `src/lib/server/ai-insights-service.ts` — the read, and the conditional
  legacy write.
- `src/app/api/rounds/[roundId]/ai-insights/route.ts` — the `{ result, run }`
  envelope.
- `src/lib/ai-insights-client.ts` — the envelope and `AiInsightsRefreshState`.
- `src/components/dashboard/dashboard-ai-insights-state.tsx` and
  `dashboard-map-page.tsx`, plus one style — the manager's sentence.
- `docs/openapi.yaml` and the regenerated `public/openapi.json`.

## Non-goals

- Merging a partial re-analysis into the map it amends. That is the worker's
  business and is unchanged.
- Retrying a failed run. That is the audit's separate resilience finding.
- Showing the note on every dashboard screen — see Decisions.

## Acceptance criteria

- A queued or running re-analysis leaves the previous map readable.
- A failed re-analysis leaves the previous map readable, indefinitely.
- The screen says which of those is happening, in Hebrew.
- A failure payload does not replace the round's stored map.

## Relevant repository instructions

- `AGENTS.md`: current code outranks prose, and a living document that
  disagrees is updated in the same task — `PROGRESS.md`, the handoff and the
  OpenAPI source all described the old response.
- `AGENTS.md`: never expose results below the privacy threshold. Unaffected: a
  `locked_error` map is still a locked map, and it is still what the round has.

## Relevant architecture and contracts

- ADR-033, added by this task.
- The wire contract `StoneMapResult` is unchanged. It moved inside an envelope
  field; nothing about the payload's own shape or version semantics changed.
- `findLatestResultByRoundId` already existed and already meant "the newest
  result this round actually has"; its own doc comment said so.

## Decisions made

- **An envelope, not an extra key inside the payload.** The client validates
  `result` as a contract payload and nothing else. A Core-only field inside a
  versioned contract body would validate today and be wrong tomorrow.
- **One `AiAnalysisRunSummary` schema for the 200 and the 404**, so a map and
  its absence cannot describe the same run differently.
- **`locked_error` counts as carrying a result.** A round below the privacy
  threshold produces a map that is deliberately locked — an answer, not a
  breakdown — and it is what the round has.
- **The note renders on the map screen only.** Its sidebar is already where
  facts about this analysis are stated, and every dashboard screen is reached
  through the map; the same sentence on four screens would be read on none.
- **`role="status"`, not `alert`.** Nothing on that screen is broken: the map is
  readable and its numbers are real.
- **The failure code is not printed.** It names our internals and would be the
  only English on a Hebrew screen. It goes to the log.

## Assumptions

None outstanding. `loadAiInsights` is the only consumer of this endpoint in the
tree, which is what made the envelope affordable; checked by grep before the
change.

## Completed

Everything in Scope, plus ADR-033, `PROGRESS.md`, the handoff and the audit
file. Also the re-check the owner asked for, under Verification evidence.

## In progress

Nothing.

## Remaining

Nothing in the tree. The push is the owner's.

## Changed files

Added: `src/lib/server/__tests__/a-failure-does-not-overwrite-the-map.test.ts`,
`src/components/dashboard/__tests__/dashboard-ai-refresh-notice.test.tsx`, this
file.

Modified: `ai-insights-service.ts`, the `ai-insights` route,
`ai-insights-client.ts`, `dashboard-ai-insights-state.tsx`,
`dashboard-map-page.tsx`, `globals.css`, `docs/openapi.yaml`,
`public/openapi.json`, five existing test files, `PROJECT_CONTEXT.md`,
`PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/critical-audit-2026-08-21.md`.

Not this task's: `next-env.d.ts` is generated and belongs to the owner.

## Verification evidence

### Passed

- `npm run verify:core` unpiped with its exit code captured: `REAL_EXIT=0`,
  `# tests 1393 / # pass 1393 / # fail 0`, zero `not ok`, build completed.
- **Three mutation passes, each restored from a scratchpad copy:**
  1. the read put back on `findLatestByRoundId` → both new read tests fail;
  2. the legacy write made unconditional again → both non-overwrite tests fail;
  3. the client's `refreshStateOf` call replaced with `undefined` → the note
     test fails.
- `npm run openapi:check` — the generated mirror matches the source.
- The manager's Hebrew sentences are pinned by a render test rather than by a
  screenshot: the running and failed notices, the empty render when nothing is
  replacing the map, `role="status"` and not `alert`, and the absence of the
  failure code from the visible text.
- **The audit re-check the owner asked for.** Twelve open entries were opened at
  their anchors and read against current code: the per-screen analytics
  recompute (`analytics.service.ts:449` still loads every response with all
  answers, no `take`, no cache), the administrator overview's N+1
  (`manager-administration-service.ts` still awaits three queries per school in
  a `for` loop), the worker's missing retry (`ai_job_worker.py` still calls
  `fail` on the first exception), unpinned Python dependencies (`>=` and no
  lockfile), breakdown cell suppression (`dimensionScoresFor` still publishes a
  dimension average with no per-cell rule and counts answers, not respondents),
  the login open redirect (`resolveLoginRedirect` still rejects only `//` and
  `/\`), TLS (`resolvePoolSsl` still returns `rejectUnauthorized: false`), the
  shared secret's fail-open (`return !process.env.VERCEL_ENV`), the attempt
  beacon (no rate limit), the share-code alphabet (31 characters, so
  `256 % 31 = 8` and the comment's uniformity claim is false), `clear-db.ts`
  (five tables, no `managers`, no `audit_events`), and Swagger's unpkg script
  (no `integrity`). None had closed on its own.

### Failed

None outstanding. Seven existing tests failed on the envelope and were updated;
one of them, `a run without a result explains its own absence`, encoded the rule
this task reverses and now pins the new one with the reason written down.

### Blocked or not run

- No signed-in browser walk. The changed screen is behind `/login`, and the
  state it renders needs a round with a stored map plus a run in flight against
  it. The render test covers the copy and the roles; what it cannot cover is how
  the band sits in the sidebar at real width.

### Environment

Local worktree. No database and no provider call was needed; `GEMINI_API_KEY`
was not used.

### Residual risk

The band's placement in the map sidebar is unverified visually — see Blocked.
Low: it reuses the panel tokens and the sidebar's existing notice pattern.

## Failed approaches

None. The envelope was weighed against adding a Core field inside the contract
payload and against a response header; the reasoning is in Decisions rather than
here, because nothing was built and reverted.

## Known risks

`refreshStateOf` treats `succeeded` as "nothing to report", which is correct
only because a succeeded run is the one that produced the map being returned. If
the read ever returns a map older than the newest succeeded run, that assumption
turns into a silent wrong label.

## Approval gates

None.

## Questions requiring an owner decision

None. 41 audit entries remain open, three of them high.

## Next concrete step

The owner pushes `fix/a-failed-re-analysis-keeps-the-map` to `main`. After that,
archive this file and pick the next audit entry — the three remaining high ones
are the analytics recompute, the administrator overview's N+1, and the worker's
missing retry.
