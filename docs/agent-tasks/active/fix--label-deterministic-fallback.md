# Say when the service wrote the analysis instead of the model

## Metadata

- Branch: `fix/label-deterministic-fallback`
- Base branch: `main`
- Base commit: `680bd43`
- Current HEAD: this branch's commits
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the gap the first real eval run exposed: on contract 6.0 a round the
provider never answered is reported `success` and looks, on screen and in the
metrics, exactly like a round the model wrote.

## User-visible outcome

A dimension whose paragraphs were written by the service now says so, in
Hebrew, under the paragraphs. Nothing is hidden and nothing is removed — the
copy stays, only the claim of authorship changes.

## Context

Running the eval corpus for the first time produced a `contradictory` payload
whose `management-support` stone — score 28, red — carried
`outcome: deterministic_fallback` inside a `status: success` map. Reading the
code afterwards:

- `generate_psychological_interpretation_result` (contracts ≤ 5.0) raises
  `ProviderUnavailableError` for yellow and red. Its docstring says why: there
  the fallback would be a guess about a problem.
- `generate_structured_summary_result` and `generate_metric_insights_result`
  (contract 6.0, the deployed one) fall back at every status. So does
  `generate_overall_summary` once `usesStructuredDimensionSummary` is set.

ADR-007 described only the first behaviour, so the living document and the
deployed code disagreed. Separately, `capabilities.json` gives 5.0
`supportsPartialMaps: true` and 6.0 `false`, so making 6.0 raise per dimension
would have failed whole rounds rather than single stones.

## Scope

- `DashboardStone.summaryIsDeterministic` and the mapping that fills it.
- A Hebrew provenance note on the dimension detail screen, and its style.
- `ai_deterministic_summary_ratio_sample`, emitted for every accepted map.
- ADR-007, rewritten to describe 6.0 as well as ≤ 5.0.
- The docstring on the V6 generator that the ADR now points at.

## Non-goals

- **No change to when 6.0 falls back.** The owner chose "show, but label".
- No contract or wire change. `generationProvenance` already carries the
  outcome; nothing new is sent.
- No change to `capabilities.json`. Restoring `supportsPartialMaps` on 6.0 is
  only needed by the option that was not chosen.
- No change to the ≤ 5.0 path, which already raises.

## Acceptance criteria

- A stone with `outcome: deterministic_fallback` renders both its paragraphs
  and the note; one with `outcome: llm` renders neither the note nor a gap.
- Every accepted map emits the share, including the all-`llm` case, so the
  metric has a denominator and can be read as a rate.
- ADR-007 no longer contradicts the deployed code.
- `npm run verify:core` and the full Python suite pass.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: provenance is a product surface, not
  debug output; Hebrew copy on manager screens is product copy.
- `.agents/skills/shalomut-verification/SKILL.md`: a UI change is verified in a
  browser, not asserted.

## Relevant architecture and contracts

- ADR-007 is the decision this task edits. The code was already the decision in
  practice; the ADR had not caught up.
- `toDashboardStone` in `src/lib/ai-insights-view-model.ts` is the only place
  the wire contract becomes a screen, so the flag is derived exactly once.
- The metric is emitted where `recordValidMapSample` already is, on the single
  path that accepts a map.

## Decisions made

- **Show the copy, label the authorship** (owner's choice among three).
  Refusing would throw away a round whose scores, metrics and recommendations
  are all real, and the V6 fallback names no cause, no diagnosis and no
  person — it is not the guess that 5.0 refuses to make.
- **The flag is `summaryIsDeterministic`, not a second `unavailable`.** The two
  states need different words: one dimension has no paragraph, the other has a
  paragraph nobody generated.
- **The metric is emitted on success too, with value 0.** A ratio that only
  appears when something went wrong has no denominator and cannot be read as a
  rate.
- **`outcomes` is a plain `string[]`, not a contract type.** The metric module
  should not learn the payload's shape to count one label.

## Assumptions

- The provenance outcome on a V6 stone describes the three summary paragraphs.
  It does: `generation_provenance` in `psychologist_node.py` is built from the
  structured-summary generation.

## Completed

Everything in scope.

## In progress

None.

## Remaining

The push is the owner's: the agent cannot push here.

## Changed files

- `src/lib/dashboard/dashboard-insights.ts`
- `src/lib/ai-insights-view-model.ts`
- `src/components/dashboard/dashboard-dimension-page.tsx`
- `src/app/globals.css`
- `src/lib/server/ai-operational-metrics.ts`
- `src/lib/server/ai-insights-service.ts`
- `src/lib/__tests__/ai-insights-view-model.test.ts`
- `src/lib/server/__tests__/ai-operational-metrics.test.ts`
- `src/app/api/__tests__/ai-e2e.test.ts`
- `src/components/dashboard/__tests__/dashboard-dto-rendering.test.tsx`
- `src/components/dashboard/__tests__/dashboard-semantic-quality.test.tsx`
- `ai-analytics-service/src/services/llm_provider.py` (docstring only)
- `PROJECT_CONTEXT.md`
- this file

## Verification evidence

### Passed

- `npm run verify:core`: exit 0. 548 Core tests pass, plus lint, typecheck,
  literals, composition and `next build`.
- `.venv/bin/python -m pytest` from `ai-analytics-service`: 432 passed, 1
  warning. No Python behaviour changed; the run proves the docstring edit broke
  nothing.
- The e2e assertion runs against the payload Python actually produces, not a
  hand-built one: `two dynamic questionnaires cross Core MCP -> Python ->
  callback` now asserts the accepted map emits the share with
  `dimensions: '8'` and the round's own id. Confirmed executing rather than
  skipped by temporarily asserting `'9'` and watching the suite go to
  `# fail 1`.
- Browser: the real `DashboardDimensionDetail` was rendered with a red
  `deterministic_fallback` stone into a page carrying `globals.css`, served
  statically and opened in the preview. Computed styles: note `14.72px`
  against body copy `16px`, so the selector wins on specificity;
  `direction: rtl`; `role="note"` present. Screenshot reviewed — the note sits
  below a hairline rule inside the blob and reads as an aside, not a paragraph
  of the analysis.
- Contrast measured in the page, not estimated: at the first value, `0.72`,
  the note computed **4.57:1** on the red surface — inside AA by 0.07. Raised
  to `0.82`, which measures **6.02:1** and is still visibly quieter.

### Failed

None.

### Blocked or not run

- **The note was not seen on a real round in the running app.** That needs a
  round with responses plus a completed AI run whose provider went silent, and
  provider quota is exhausted. What was verified in the browser is the real
  component and the real stylesheet on a synthetic page, which covers
  specificity, direction and contrast but not the surrounding page state.
- No DB work; `npm run verify:db` was not run and no schema, migration or
  repository changed.

### Environment

Local. Nothing deployed was touched. No provider was called.

### Residual risk

- **The metric narratives are not covered by the flag.** On V6 each metric
  paragraph has its own outcome, and the contract does not carry it — only the
  dimension's summary provenance is on the wire. A stone can therefore show
  model-written paragraphs beside fallback metric narratives with no note. This
  is a contract gap, not an oversight here; closing it means a wire change.
- The note is one more block of Hebrew on a screen that is already dense. If it
  proves noisy in use, the fix is placement, not deletion.

## Failed approaches

- Styled the note as a bare `.dashboard-blob-provenance`. `.dashboard-single-blob-copy p`
  is more specific, so the font size never applied; the first fix reached for
  `!important` before the selector was simply qualified with the parent.

## Known risks

None beyond the residual risk above.

## Approval gates

None. No secrets, credentials, authentication configuration or deployment
alias is touched.

## Questions requiring an owner decision

One, not blocking: whether 6.0 should regain `supportsPartialMaps`. It is
`true` on 5.0 and `false` on 6.0, and the machinery to render a partial map is
already in the view model and the detail screen. Nothing in this task needs it,
but the capability looks lost rather than retired.

## Next concrete step

Hand the push to the owner:
`git push origin fix/label-deterministic-fallback:main`.
