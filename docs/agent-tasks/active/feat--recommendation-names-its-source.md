# A recommendation names the source it came from

## Metadata

- Branch: `feat/recommendation-names-its-source`
- Base branch: `main`
- Base commit: `e624101`
- Current HEAD: one commit on top of `e624101`
- Status: implementation complete, verified locally, waiting on the owner's push
- Last updated: 2026-08-11
- Last agent/tool: Claude Opus 5, Claude Code

## Objective

Cheap win 11 in `docs/product-strategy-axes-2026-08-10.md`: carry the
intervention `source` through to the rendered recommendation.

## User-visible outcome

Under each recommendation in the goals panel, a quiet line reads
`מבוסס על: <source>` — the ISO 45003 clause or OECD TALIS guideline the advice
came from, as `ai-analytics-service/data/interventions_kb.json` names it. It is
the product's cheapest available answer to "is this AI making things up".

## Context

`StoneIntervention.source` has been in the contract since `1.0` and is checked
by `validateStoneMapResult`, but `toDashboardRecommendations` dropped it while
building `DashboardRecommendation`, so no screen could show it. The catalog
carries 192 interventions across ten distinct sources, all Hebrew citations.

## Scope

- `source` on `DashboardRecommendation` and on `GoalRow`.
- The rendered attribution in the goals panel.

## Non-goals

- The recommendation blobs. Their text is auto-fitted to the blob shape by
  `useBlobFit`, so a citation inside one would shrink the advice to make room
  for its footnote. The goals panel lists the same recommendations directly
  below them, with an existing pattern for provenance notes.
- Any change to the contract, the catalog or the Python service.
- `adaptationOutcome` (5.0), which says whether the *wording* was rewritten by
  the model. `מבוסס על` is true either way; distinguishing them is a separate
  question and a separate decision.

## Acceptance criteria

- A recommendation carrying a source shows it.
- A payload carrying none shows nothing — no empty citation line.
- A goal the current analysis no longer recommends claims no source: the goal
  copied the title and body when it was chosen, never the attribution.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: RTL-first, WCAG AA, reuse existing
  components and tokens.
- `.agents/skills/shalomut-verification/SKILL.md`: view-model and component
  changes need targeted tests, `npm test`, `npm run lint`, `npm run build`, and
  a browser smoke for the user-visible flow.

## Decisions made

- The source is trimmed in the view model and rendered verbatim after a colon.
  Whitespace is not an attribution, so it collapses to `''` and the line is
  omitted rather than printed empty.
- `GoalRow.source` is `''` for a row from an earlier analysis, and a test says
  why: claiming a source there would be the screen citing itself.
- The note reuses `quiet-note dashboard-goal-provenance`, the class the
  earlier-analysis note already uses. No new styling.

## Assumptions

- Every current payload version carries `source` as a required string; older
  persisted results that predate it would render no line rather than break.

## Completed

- `src/lib/dashboard/dashboard-insights.ts` — `source` on the DTO.
- `src/lib/ai-insights-view-model.ts` — carries and trims it.
- `src/lib/dashboard/goal-rows.ts` — `source` on `GoalRow`.
- `src/components/dashboard/dashboard-goals-panel.tsx` — renders the note.
- Tests updated/added in `src/lib/__tests__/ai-insights-view-model.test.ts`,
  `src/lib/dashboard/__tests__/goal-rows.test.ts`, and fixtures in
  `src/components/dashboard/__tests__/dashboard-dto-rendering.test.tsx`.

## In progress

Nothing.

## Remaining

The push. `git push origin feat/recommendation-names-its-source:main` is the
owner's command.

## Changed files

- `src/lib/dashboard/dashboard-insights.ts`
- `src/lib/ai-insights-view-model.ts`
- `src/lib/dashboard/goal-rows.ts`
- `src/components/dashboard/dashboard-goals-panel.tsx`
- `src/lib/__tests__/ai-insights-view-model.test.ts`
- `src/lib/dashboard/__tests__/goal-rows.test.ts`
- `src/components/dashboard/__tests__/dashboard-dto-rendering.test.tsx`
- `docs/agent-tasks/active/feat--recommendation-names-its-source.md` (this file)

## Verification evidence

### Passed

- `npm test` — 869 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.
- Browser walk on a local production build (`next start` on port 3210, the
  `playwright.config.ts` throwaway fixtures, a temporary Playwright script
  since removed), on
  `/dashboard/self-expression/recommendations/?round=round_local_...`: five
  recommendations, five attribution lines reading
  `מבוסס על: OECD TALIS — הנחיות להשתתפות מורים ולהשפעה מקצועית`, RTL and the
  existing quiet-note styling. One recommendation was then tracked as a goal
  and the page reloaded: the tracked row keeps its attribution.

### Failed

None.

### Blocked or not run

- Deployed verification. Not run: the deployed database is empty, so no round
  has an analysis to attribute.
- A payload carrying no source at all was exercised in tests, not in the
  browser: the catalog gives every intervention a source.

### Environment

local. The local database was reseeded earlier in the session, and this task
additionally wrote a locally computed AI result onto the seeded round and left
one tracked goal behind. Both are disposable; `npx tsx scripts/seed-local.ts
--reset` returns the database to the plain seeded state.

### Residual risk

Low. `source` is additive on two internal types; every construction site was
found by `npm run typecheck` and updated.

## Failed approaches

The first attempt to produce a local analysis ran the Python pipeline with the
environment files loaded as-is, which reached the real Gemini provider — one
retry and four timeouts before it was stopped. The rerun strips the provider
key from the child environment, and the deterministic fallback produces the
same catalog interventions with the same sources, which is all this screen
needed.

## Known risks

None open.

## Approval gates

None.

## Questions requiring an owner decision

Whether a recommendation whose wording was rewritten by the model
(`adaptationOutcome: 'llm'`) should say so beside its source. Not blocking:
`מבוסס על` is true in both cases.

## Next concrete step

Owner pushes the branch onto `main`:
`git push origin feat/recommendation-names-its-source:main`.
