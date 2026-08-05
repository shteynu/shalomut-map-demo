# Say on the map that the map is partial

## Metadata

- Branch: `feat/partial-map-banner`
- Base branch: `main`
- Base commit: `0a1b529`
- Current HEAD: merged into `main`; `origin/main` is `260e84e`
- Status: landed on `main` as 673b85b, ffd61e8, eec0bd0
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the first of the two questions the previous task left: a partial map told
the truth only on the dimension screen, which is the screen a manager who
trusts the map never opens.

## User-visible outcome

When a round has no interpretation for one or more dimensions, the map sidebar
carries a notice naming them and saying what is still intact. A whole map looks
exactly as it did.

## Context

Eight stones with eight scores read as a complete analysis. The dimension whose
paragraphs are missing looks like the seven that are not until someone opens
it. `dimensionsWithoutInterpretation` has been in the payload since 5.0 and
nothing read it.

## Scope

- `DashboardInsightsDto.dimensionsWithoutInterpretation`, derived in
  `toDashboardInsights`.
- `DashboardPartialMapNotice`, rendered in the map sidebar beside the
  organization summary.
- `.map-partial-notice`, shaped like the privacy note it sits above.

## Non-goals

- No change to what produces a gap, to the contract, or to the dimension
  screen's own wording.
- No marker on the individual stone in the map stage. The stones are draggable
  objects with a score and a status dot; adding a third state to them is a
  bigger design question than this notice.
- The notice does not distinguish a silent provider from copy that failed
  validation. That is the second open question from the previous task and it is
  still open.

## Acceptance criteria

- A whole map renders no notice at all — not an empty container.
- One gap reads in the singular and several read in the plural, all the way
  through the sentence.
- Dimensions are named the way the map captions them.
- `npm run verify:core` passes.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md`: Hebrew on a manager screen is product
  copy, and the eight dimensions have several Hebrew names — the screen's own
  is the one that belongs on the screen.
- `.agents/skills/shalomut-verification/SKILL.md`: a UI change is verified in a
  browser.

## Relevant architecture and contracts

- No contract change. The gap is already on the wire and already validated.
- `toDashboardInsights` stays the single translation from wire to screen, so
  the new field is derived there and nowhere else.

## Decisions made

- **Derived from the stones, not read from the payload's list.** Both carry the
  same answer and the contract requires them to agree. Deriving it means the
  banner and the dimension screen cannot contradict each other even if a
  payload ever arrived saying otherwise.
- **Named with `conceptLabel`.** That is the caption on the stone. `label` and
  the instrument's own Hebrew differ for several dimensions —
  `management-support` reads `עוגן` as `label` and `עורף מקצועי` as
  `conceptLabel` — and a notice naming a stone the map does not would send a
  manager looking for something that is not there. The first draft used
  `label`; the rendering test caught it.
- **Two sentences written out rather than spliced.** Hebrew changes the
  subject, the pronoun and the demonstrative between one and many, so a
  template with an interpolated count produces text no one would write.
- **Not an error, and shaped like the privacy note.** Nothing failed for the
  manager: the score, the questions and the recommendations of that dimension
  are real, and the notice says so. Same padding, radius and icon column as the
  privacy note; yellow instead of sky so two notices in one sidebar stay
  distinguishable.

## Assumptions

- The sidebar is where a manager reads the analysis, so it is where a fact
  about the analysis belongs. If the notice proves too easy to miss there, the
  alternative is above the map stage.

## Completed

Everything in scope.

## In progress

None.

## Remaining

The push is the owner's: the agent cannot push here.

## Changed files

- `src/components/dashboard/dashboard-partial-map-notice.tsx` (new)
- `src/components/dashboard/__tests__/dashboard-partial-map-notice.test.tsx` (new)
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/dashboard/index.ts`
- `src/lib/ai-insights-view-model.ts`
- `src/lib/dashboard/dashboard-insights.ts`
- `src/app/globals.css`
- `src/lib/__tests__/ai-insights-view-model.test.ts`
- `src/components/dashboard/__tests__/dashboard-semantic-quality.test.tsx`
- `src/components/round/__tests__/round-threshold-next-step.test.tsx`
- this file

## Verification evidence

### Passed

- `npm run verify:core`: exit 0, 557 tests, plus lint, typecheck, literals,
  composition and `next build`. 551 before this slice plus 6.
- Browser: the real component rendered inside the real sidebar markup with
  `globals.css`, one-gap and three-gap variants side by side above the privacy
  note. Computed styles confirm the two notices are geometrically identical —
  padding `16px 19.2px` and radius `24px 38px / 32px 24px` on both — and differ
  only in background. Body text measures **10.40:1** on the yellow surface.
- Checked at the mobile preset as well: the notice wraps and stacks exactly as
  the privacy note beside it does.

### Failed

None.

### Blocked or not run

- Not seen on a live round. That needs a round whose analysis actually has a
  gap, which needs provider quota; the harness renders the real component and
  the real stylesheet but not the surrounding page state.
- `npm run verify:db` and `verify:ai` were not run. Nothing outside
  `src/` changed and no Python file was touched.

### Environment

Local. Nothing deployed was touched. No provider was called.

### Residual risk

- The notice sits below the organization summary, which on a long summary
  pushes it down the sidebar. It is the same position the privacy note has
  lived in, but if managers miss it the answer is placement above the map
  stage, not louder colour.
- `conceptLabel` is presentation data with no test tying it to the contract's
  dimension ids beyond the lookup's fallback. A renamed dimension id would show
  the raw id rather than crash — visible, but ugly.

## Failed approaches

- Named the dimensions with `DimensionPresentation.label`. It is not what the
  map shows; `dashboard-map-interactive.tsx` captions each stone with
  `conceptLabel`, so the notice would have used a name that appears nowhere on
  the screen it points at.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

Still one, carried over and unchanged: should a gap say *why* — provider
silence versus copy that could not pass validation? Both now reach the same
sentence.

## Next concrete step

None. This task is closed; the branch is fully contained in `main`.

