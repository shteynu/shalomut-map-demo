# Visual defects on the manager screens: stones, tooltip, header

## Metadata

- Branch: `fix/stone-corners-and-tooltip-overflow`
- Base branch: `origin/main`
- Base commit: `eb11073`
- Current HEAD: see `git log -1`; the work is on this branch's commits
- Status: implementation and verification complete; awaiting commit and push
- Last updated: 2026-08-25
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the visual defects the owner marked on six screenshots of the manager
screens, find the ones nobody had marked yet, and leave the navigation header
something a manager can read on a phone.

## User-visible outcome

- The mark on each home stone sits inside the stone instead of floating on the
  cream beside it.
- The privacy explanation opens over the page instead of under it.
- A date and a stand-in phrase stay inside the round screen's stones.
- The re-run control on a dimension screen sits inside its blob.
- The progress ring is a ring on a phone, not a rounded square.
- No manager screen scrolls sideways on a phone.
- The header is two short bands — identity, then one line of destinations —
  instead of three ragged rows.

## Context

The owner opened the session with six screenshots and asked for the defects in
them, for whatever else the screens were hiding, and for the navigation panel
to stop being ugly — on mobile as well as desktop.

## Scope

`src/app/globals.css`, the four components the defects live in, and one e2e
guard. No product copy, no methodology, no persistence, no contract.

## Non-goals

- The map screen's decorative `+` marks. They sit outside their blob too, but
  they are identical on all eight stones and read as the map's own scatter
  language rather than as a misplaced icon.
- A mobile project for the manager specs in `playwright.config.ts`. The new
  check resizes inside the existing desktop project, which is seconds rather
  than the minutes that config declines to spend.

## Acceptance criteria

1. Every home stone's mark renders inside the stone's fill at 1440px and 390px.
2. The open privacy tooltip is the topmost element at its own bottom edge.
3. No `.stat-stone` or `.metric-card` copy renders outside its fill.
4. `document.documentElement.scrollWidth` equals `clientWidth` at 390px on
   every manager screen.
5. The header navigation renders on one row at 390px.
6. `.progress-ring` keeps a closed round shape at every viewport.

## Relevant repository instructions

`AGENTS.md` (RTL-first, WCAG AA, warm organic language, prefer existing
components and tokens), `.agents/skills/shalomut-map/SKILL.md` §`Product и UI`,
`.agents/skills/shalomut-verification/SKILL.md` (row: `src/components`, page
TSX, CSS → targeted tests, `npm run lint`, `npm run build`, browser smoke).

## Relevant architecture and contracts

None touched. No dashboard DTO, contract, privacy threshold or scoring change.

## Decisions made

- **The stone mark leads the column instead of sitting in a corner.** An
  `organic-shape-*` radius hollows out the element's bounding-box corners, so
  a corner offset is the one place guaranteed to miss the shape. No offset
  works for all four radii; leaving the corner does.
- **The privacy trigger moved from the mark slot to the label.** Anchored at
  the top of the stone the panel covered the number it explains. Beside the
  label it opens below the words it qualifies — and it is where
  `.metric-card` already puts it on the round screen.
- **The header became two bands.** Eight destinations never fit beside the
  brand and the identity chip; a single row wrapped them into three. One
  scrolling line of pills keeps every label whole at every width.
- **Stone copy is inset by a share of the card, not a fixed step.** A rectangle
  inscribed in an ellipse is about 70% of it across, so `padding-inline: 15%`
  is the general answer where `1rem` was a guess that failed on wide cards.
- **Long values step down in size.** `metric-card.tsx` classifies its own value
  by length; a count keeps the full 2.7rem, a date does not. The card's width
  is the one thing that does not change between them.

## Assumptions

- The owner's screenshot of a full-width re-run button inside a dimension blob
  is the `.dashboard-single-blob-copy` grid stretching its only control. The
  blob renders only for a round that already carries an analysis, and producing
  one costs a provider call, so the fix was reproduced by building the real
  markup inside the real stylesheet on the dimension route (`tmp/rerun.mjs`)
  rather than by paying for a run. Measured 768px wide before, 200px after.

## Completed

- Home stone mark moved into flow (`stat-stone.tsx`, `page.tsx`, CSS).
- Privacy trigger moved to the stone's label; the sky stone gained a
  `ShieldCheck` mark so all four stones still carry one.
- `.stat-stone` raised while its tooltip is open, the way `.metric-card`
  already was.
- Round-screen stones: percentage inline padding, taller minimum, and a
  length-based value size.
- `.dashboard-single-blob-copy > button` centres instead of stretching.
- `.progress-ring` removed from the mobile rule that flattens organic radii.
- Header rebuilt as two bands; identity bar shrinks, truncates by content
  direction, and keeps its role pill on one line.
- Two guards added to `e2e/smoke.spec.ts`: the tooltip's foot is not painted
  over, and the header holds one navigation row with no sideways scroll at
  390px.

## In progress

Nothing.

## Remaining

Hand the push over — `git push` is an owner action here.

## Changed files

- `e2e/smoke.spec.ts`
- `src/app/globals.css`
- `src/app/page.tsx`
- `src/components/layout/app-header.tsx`
- `src/components/layout/manager-user-bar.tsx`
- `src/components/ui/metric-card.tsx`
- `src/components/ui/stat-stone.tsx`

## Verification evidence

### Passed

- `npm run typecheck` — clean.
- `npm test` — 1654 pass, 0 fail.
- `npm run lint` — clean.
- `npm run test:e2e` — 31 passed, on a build made after the last edit.
- Negative check on the two new guards: with `.stat-stone`'s raise, the
  identity bar's `flex: 0 1 auto` and `.top-nav`'s `nowrap` temporarily
  removed and the app rebuilt, both fail with the message they promise
  ("something on the page paints over the open privacy tooltip at y=708",
  "the header navigation stacked into rows instead of scrolling sideways").
  A guard that passes on the broken code is not a guard.
- Browser measurement, local, Chromium via Playwright, signed in as the seeded
  manager:
  - before: `documentElement.scrollWidth` 420 against `clientWidth` 390 on
    `/`, `/round/`, `/setup/`, `/breakdown/`, `/goals/`, `/activity/`,
    `/survey/`; culprit `.manager-user-bar-logout` at `left: -30`. After: no
    screen over.
  - before: the element at the open tooltip's bottom-centre was a `P` from the
    action card below. After: the tooltip itself.
  - before: `.progress-ring` computed `border-radius: 18px` at 390px against
    `48% 52% 43% 57% / …` at 1440px. After: the organic radius at both.
  - re-run button inside `.dashboard-single-blob-copy`: 768px wide with the
    rule off, 200px with it on, in the same injected markup.

### Failed

None.

### Blocked or not run

- `npm run verify:core` in full was not run: this diff is CSS, component TSX
  and one e2e spec, and the rows it selects are covered above. `npm run build`
  runs inside `npm run test:e2e`.
- The dimension blob was never rendered from a stored analysis, for the reason
  in `Assumptions`.

### Environment

Local. `next dev` on `:3000` with `MANAGER_ORGANIZATION_ID=local-dev-organization`
and no `GEMINI_API_KEY` in the child environment, so nothing in this session
could reach the paid provider. Database reseeded with
`npx tsx scripts/seed-local.ts --reset` under the same organization id — the
one `playwright.config.ts` and `docs/local-environment.md` both name.

### Residual risk

- `.top-nav` now scrolls sideways. A pointer user with no trackpad gesture has
  no visible scrollbar; the partially shown next pill is the only affordance.
  All eight fit without scrolling at 1180px, so this only applies below that.
- `padding-inline: 15%` scales with the card. A future one-column stone layout
  would give the copy a wide gutter it does not need.

## Failed approaches

- Keeping the stone mark absolutely positioned and moving it inward. Each of
  the four organic radii hollows a different corner, so no single inset is
  inside all four.

## Known risks

None beyond the residual risk above.

## Approval gates

None. Nothing here touches secrets, credentials, authentication configuration
or a deployment alias. The database was reseeded, which this project treats as
ordinary work.

## Questions requiring an owner decision

None.

## Next concrete step

Ask the owner to run `git push origin fix/stone-corners-and-tooltip-overflow:main`.
Nothing else is outstanding on this branch.
