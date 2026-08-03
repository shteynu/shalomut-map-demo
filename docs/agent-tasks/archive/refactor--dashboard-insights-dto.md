# DashboardInsightsDto and the end of demo-data.ts

## Metadata

- Branch: `refactor/dashboard-insights-dto`
- Base branch: `main`
- Base commit: `44982f0`
- Current HEAD: this documentation commit, directly on top of `906f2ba`
- Status: closed; merged into `main` on 2026-08-03
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Give the Dashboard a named, stable presentation contract that does not change
when a wire contract does, and stop `src/lib/demo-data.ts` from owning
production types.

## User-visible outcome

None intended. The same screens render the same Hebrew copy from the same
analysis; what changed is which type the components hold.

## Context

- Stage 5 of the refactoring plan (`docs/wellbeing-refactoring-plan-v4-review.md`
  §6): `DashboardInsightsDto` as an explicit presentation contract, plus moving
  production types out of `demo-data.ts`.
- The plan's claim that "the UI does not know contract versions" was too kind:
  components held `StoneMapResult` in state and `dashboard-map-page.tsx:85` read
  `overallPsychologicalSummary` — a payload field name — on screen.
- `WellbeingDimension` conflated the permanent presentation of a dimension with
  the result of one round, which is why ~500 lines of hardcoded Hebrew demo
  analysis sat in a production module. No screen rendered it: a missing stone
  shows the AI state instead.

## Scope

Delivered as described in `Completed`.

## Non-goals

- No change to the wire contracts, the API, persistence or the Python service.
- No visual redesign and no copy change. Labels keep their current values even
  where they differ from `surveyInstrument` (`self-expression` is "קול אישי" in
  the presentation config and "ביטוי עצמי" in the canonical source); reconciling
  those two is a product decision.

## Acceptance criteria

All met:

- No component imports `@/lib/ai-contract` or reads a wire field name.
- The Dashboard's types are named in one module and mention no contract version.
- `src/lib/demo-data.ts` no longer exists.
- `npm run verify:core` passes, and the ready state of each detail screen is now
  asserted directly from a DTO stone.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: demo data is never a hidden runtime
  fallback; the eight dimensions stay the Dashboard taxonomy; RTL and WCAG AA
  hold.

## Relevant architecture and contracts

- New `PROJECT_CONTEXT.md` ADR-011 records the DTO boundary. ADR-003 no longer
  promises demo scores as "visual metadata" — there are none left.

## Decisions made

- `DashboardInsightsDto` keeps the `Dto` suffix the plan and roadmap use, so the
  delivered type is traceable to the item that asked for it.
- `overallSummary` is a plain string, empty when absent, rather than an optional
  field. The screens already treated a blank summary as "missing".
- Each detail screen's ready body is exported separately
  (`DashboardDimensionDetail`, `DashboardMetricsStage`,
  `DashboardRecommendationsStage`). The page still owns the fetch; the split is
  what makes the DTO path renderable in a test, since a server render never runs
  the effect that would load insights.
- `stone-map.tsx` deleted. It was exported from the barrel, rendered nowhere,
  and was the only consumer that forced score/status/summary into the static
  presentation config.

## Assumptions

- None outstanding.

## Completed

- `src/lib/dashboard/dashboard-insights.ts`: `DashboardInsightsDto`,
  `DashboardStone`, `DashboardMetric`, `DashboardRecommendation`,
  `getDashboardStone`.
- `src/lib/ai-insights-view-model.ts`: `toDashboardStone` and
  `toDashboardInsights` replace `applyStoneInsightToDimension`/`getStoneInsight`;
  all metric formatting, the distribution privacy gate and the
  status-matched intervention filter moved with them unchanged.
- `src/lib/ai-insights-client.ts` returns the DTO for `ready` and `locked`.
- `src/lib/dashboard/dimension-presentation.ts`: `DimensionPresentation`, the
  eight entries, `getDimensionPresentation`, `getDimensionStaticParams`,
  `statusSurfaces`, `getDimensionSurface(status)` and the `statusLabels`
  re-export.
- `src/lib/demo-data.ts` and `src/components/dashboard/stone-map.tsx` deleted;
  every importer moved to the presentation module or `shalomut-source`.
- Components updated: three detail pages, the map page, the interactive map, the
  identity chip, the metric blob, the status badge and five survey-builder
  files.
- Tests updated to the DTO, plus new
  `src/components/dashboard/__tests__/dashboard-dto-rendering.test.tsx`.
- Documentation: `PROJECT_CONTEXT.md` (ADR-011, ADR-003), `PROGRESS.md`,
  `ROADMAP.md`, `docs/source-of-truth.md`, the plan review §6 stage 5 and its
  `Чем закрыто` table, and the `shalomut-map` skill.

## In progress

- Nothing.

## Remaining

- Nothing on this branch; it is merged.
- Optional owner check: a visual pass over the dashboard with `npm run local`
  (manager surfaces need a signed-in session, see `Blocked or not run`).

## Changed files

Commit `906f2ba` (34 files, +467/−1114). The commit on top of it adds the
review's `Чем закрыто` row and this task file.

## Verification evidence

### Passed

- `npm test` — 356 tests, 0 failures (352 before this branch; the four new ones
  render the ready detail screens from a DTO stone).
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm run build` — exit 0, all routes compiled.

### Failed

- None.

### Blocked or not run

- Browser smoke of the dashboard: not run. Every screen this touches is behind
  the manager session gate, and signing in means handling the local manager
  password, which an agent does not do. What a smoke would look at — summary
  paragraphs, the unavailable-interpretation notice, question text with its
  average and split, preservation versus goal language — is now asserted as
  rendered markup in `dashboard-dto-rendering.test.tsx`.
- `npm run verify:db` and `npm run verify:ai`: not run. No repository, schema or
  Python change is in the diff.

### Environment

- local.

### Residual risk

- Layout and CSS were not exercised in a browser. No class name, style attribute
  or DOM structure changed in this diff, so the risk is limited to what a type
  change cannot cause.
- `dashboard-map-interactive.tsx` lost its `liveDimension` object in favour of
  `score`/`status` locals. Pure rename; the rendered attributes are identical.

## Failed approaches

- None.

## Known risks

- The presentation config still duplicates dimension labels that
  `surveyInstrument` also owns, and one of them disagrees. Deliberate: changing
  a displayed Hebrew label is a product decision, not a refactor. Worth closing
  separately.

## Approval gates

- None.

## Questions requiring an owner decision

- Whether the Dashboard's `label` for `self-expression` should become the
  canonical "ביטוי עצמי", or the canonical source should adopt "קול אישי".

## Next concrete step

Nothing. Merged into `main` on 2026-08-03 (merge `16510d7`, with the DTO itself
in `906f2ba`). The merged `main` has not been pushed; that is the owner's
action. The open product question above stands.
