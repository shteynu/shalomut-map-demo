# Marks that sit outside the shapes they decorate

## Metadata

- Branch: `fix/marks-outside-their-shapes`
- Base branch: `main`
- Base commit: `1f75ff4`
- Current HEAD: this file's own commit, on top of `cef3220`
- Status: in progress
- Last updated: 2026-08-25
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Finish, on the two screens the previous branch could not reach, the defect that
branch was opened for: a decoration anchored to the corner of a bounding box
rather than to the shape that box contains.

`fix/stone-corners-and-tooltip-overflow` fixed it on the KPI stones of the
manager home and on the survey builder's metrics. This branch fixes the same
class on the שלומות map, whose eight stones carry two such marks each, and
narrows the single dimension blob, which was as wide as its container and as
short as its copy.

## User-visible outcome

On the map every "+" and every ordinal badge is painted on its stone instead of
on the page behind it, on the desktop map and in the stacked phone column
alike. A dimension screen with a short analysis shows a stone rather than a
flat lens with the text in a thin band down its middle.

## Context

The owner signed in to the deployment in the connected Chrome so that the
manager screens — which sit behind the organizational account and could not be
walked anonymously — could finally be looked at. That walk is what found these:
both were invisible to the previous branch, which verified against the screens
it could render locally.

The map defect had a second half worth recording. `plusPosition` in
`dimension-presentation.ts` gives every dimension its own offsets, tuned by eye
against that dimension's own `border-radius`, and they were being shipped to
the browser as `--plus-top` / `--plus-left` on every stone. Only the stacked
layout read them. The desktop rule used one fixed pair for all eight, which is
both uniform where the design asked for variety and outside the fill.

## Scope

- `.dashboard-map-blob::after` and `.dashboard-map-blob-plus`, at both layouts.
- `.dashboard-single-blob` width, inline padding and minimum height.
- One stone's `plusPosition`, nudged by 0.2rem so that the whole mark — not
  only its visible glyph — clears the curve.
- A spec that recomputes the shape and can therefore see this class of defect.

## Non-goals

- The KPI stones, the header and the privacy tooltip: `1f75ff4` and its
  predecessors, already on `main` and deployed.
- Anything about what the dimension screen says. Only the shape it says it in.

## Acceptance criteria

- Every corner of every mark lies inside the stone's rounded shape, at the map
  layout and at the stacked one.
- The dimension blob reads as a stone with three short paragraphs in it, and a
  long analysis stays clear of the curve.
- `verify:core` and the full Playwright suite pass.

## Relevant repository instructions

- `AGENTS.md`: verify in proportion to risk; record only verification that ran.
- `.agents/skills/shalomut-verification/SKILL.md`: a change a browser can see
  needs a browser to have seen it.

## Relevant architecture and contracts

None touched. The change is presentational: one stylesheet, one presentation
constant, one new spec.

## Decisions made

- The guard tests the mark's **box**, not its glyph. A stricter rule than the
  eye needs, and the reason to prefer it is that it is stateable: "the mark is
  inside the shape" needs no fudge factor, and one stone needed 0.2rem to meet
  it.
- The stacked layout drops the per-stone variation and places both marks by a
  share of the width. Eight identical full-width shapes want one placement, and
  a fixed inset cannot work for them: their top corners fall away far sooner
  than the map's do.
- The dimension blob gets a width cap rather than a `fit-content` width.
  `fit-content` with percentage inline padding is a cycle, and the percentage
  padding is what keeps a long analysis off the curve.

## Assumptions

- The seeded closed round stays above the privacy threshold, so its map opens.
  `seed-local.ts` says that is deliberate, and CI seeds with the same script.

## Completed

- Both map marks placed against the shape, at both layouts.
- Stone 01's `plusPosition` nudged from `1.4rem/2.0rem` to `1.6rem/2.2rem`.
- `.dashboard-single-blob`: `width: min(46rem, 100%)`, `min-height: 18rem`,
  inline padding as a share of the width.
- `e2e/dashboard-map.spec.ts`, two tests, negative-checked.

## In progress

Nothing.

## Remaining

Nothing on the branch. The push is the owner's.

## Changed files

- `src/app/globals.css`
- `src/lib/dashboard/dimension-presentation.ts`
- `e2e/dashboard-map.spec.ts` (new)
- `docs/agent-tasks/active/fix--marks-outside-their-shapes.md` (this file)

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1654 Node tests, 587 Python tests, every
  documentation and skill lint, `lint:doc-numbers` 26 claims, `lint:audit-count`
  50 findings.
- `npm run test:e2e -- dashboard-map.spec.ts` — both tests pass against a
  production build.
- Negative check: with the three map rules reverted to what `main` carries,
  both tests fail, naming seventeen stray corners on the map and nineteen in
  the stacked column. The guard sees the defect it was written for.
- `npx tsc --noEmit` — exit 0. `npx eslint` on the changed sources — exit 0.
- The deployed manager screens, walked signed in at 1560, 900 and 500 px: home,
  round, map, dimension, survey builder, setup, breakdown, goals, activity. No
  console errors, no sideways scroll, the privacy tooltip readable to its last
  line over the cards below it, `לא נקבע` inside its blob, the header on two
  bands with all eight destinations on one line.
- Both fixes on this branch were proved on the deployed page under the deployed
  stylesheet with the candidate rules injected, and photographed before and
  after — the map at four widths, the dimension blob with the seeded copy and
  with a long analysis pasted in.

### Failed

None.

### Blocked or not run

- The dimension blob could not be rendered from local data: the local closed
  round has no analysis, and producing one is a paid provider call. That is why
  its evidence is the deployed page rather than a local screenshot.

### Environment

Local Next dev on 3000 against the disposable PostgreSQL in `shalomut-local-db`,
seeded by `seed-local.ts`; Playwright against `next start` on 3100/3101. The
deployed walk used the owner's signed-in Chrome.

### Residual risk

The map guard reads `border-radius` as the computed value. If a stone ever gets
its radius from a shorthand the browser reports differently, the parser would
have to learn that form; today all eight are percentage pairs.

## Failed approaches

- A fixed inset for the stacked layout. At full column width a stone is flat
  enough that even 2.4rem from the edge is outside the fill; the inline inset
  has to be a share of the width.

## Known risks

None known.

## Approval gates

`git push` is the owner's.

## Questions requiring an owner decision

None.

## Next concrete step

Push `fix/marks-outside-their-shapes` to `main` and confirm the deployment
answers the new commit.
