# The audit's small items, and the one that refused to be small

## Metadata

- Branch: `chore/frontend-audit-minor-items`
- Base branch: `chore/stone-page-cascade-cleanup` (a stack on top of `main` at
  `0cff722`; none of the six branches is pushed)
- Base commit: `c2760e2`
- Current HEAD: `c2760e2` (working tree ahead, see Git state)
- Status: four of five items complete and verified; the fifth is measured and
  handed back as an owner decision
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

The remaining items of the frontend UI/UX audit run on 2026-08-08: the skip
link, the header's duplicated classes, the inline styles in
`privacy-tooltip.tsx`, the hardcoded `getPlusPosition`, and the map-stone load
jump.

## User-visible outcome

One: a keyboard user on any manager screen can now reach the content without
tabbing through the six-item navigation. Everything else is invisible by
design.

## Context

These were the "lower priority" tail of the audit — the items that were real
but did not change what a manager sees. Two of them turned out to be load-
bearing in ways reading the code did not show, which is the only interesting
thing in this branch.

## Scope

- `src/components/layout/header-gate.tsx`, `src/app/layout.tsx`,
  `src/lib/navigation.ts` — the skip link.
- `src/components/layout/app-header.tsx` — the duplicated utilities.
- `src/components/ui/privacy-tooltip.tsx` — sixteen inline style declarations.
- `src/lib/dashboard/dimension-presentation.ts` and
  `src/components/dashboard/dashboard-map-interactive.tsx` — the plus geometry.
- `src/app/globals.css`, `design.md`, `PROGRESS.md`.

## Non-goals

- The 57 shadowed `.stone-page` selectors, still deliberately untouched.
- The other twelve files that hold inline styles. This branch moved the one the
  audit named; the rest set values a stylesheet cannot know (a stone's rotation,
  a blob's colour) and are not the same kind of debt.

## Acceptance criteria

Nothing but the skip link renders differently, proved by the same computed-style
fingerprint the previous branch used.

## Relevant repository instructions

- `AGENTS.md` — verify in proportion to risk; never record a check that did not
  run.
- `design.md` — the product's focus treatment and RTL rules.

## Decisions made

- **The skip link belongs to the header, not the document.** It is rendered by
  `HeaderGate`, which already knows which screens have navigation, so it appears
  on exactly the screens that have something to skip. On the respondent
  questionnaire the content is already the first tab stop, and an extra one
  there would be noise in a flow that is deliberately bare.
- **`<main>` suppresses its own focus ring.** It needs `tabIndex={-1}` to
  receive focus at all, but a 3px outline around the entire page reads as an
  error rather than as an arrival.
- **The tooltip's new classes are scoped to `.custom-tooltip-content`.** See
  the failure below; unscoped classes were the wrong answer and the harness
  said so.
- **`getPlusPosition` became data, not a lookup.** The switch listed the eight
  dimensions and a default that the `WellbeingDimensionId` union makes
  unreachable. As a field on `DimensionPresentation` it sits with the geometry
  it belongs to, and a new dimension cannot be added without it.
- **The map-stone jump is not fixed, and is not pretended to be.** See
  "Questions requiring an owner decision".

## Assumptions

None.

## Completed

1. **Skip link.** `.skip-link` off-screen at `inset-inline-start: -100vw`,
   brought to `1rem` on `:focus-visible`, on a new `--z-skip-link: 100` so it
   clears the sticky header. Hebrew label in `navigationLabels`. Target is
   `<main id="main-content" tabIndex={-1}>`.
2. **Header duplication.** `className="site-header flex items-center
   justify-between gap-4"` → `className="site-header"`. All four utilities
   restated what `.site-header` already sets, and lost to it anyway: Tailwind's
   utilities are layered and this stylesheet is not.
3. **Tooltip inline styles.** Sixteen declarations across six elements moved to
   six classes.
4. **`getPlusPosition`.** Gone; the eight values are now `plusPosition` on each
   `DimensionPresentation`.

## In progress

Nothing.

## Remaining

Nothing. The map-stone load jump was raised as an owner decision and closed as
one: on 2026-08-08 the owner chose not to add a blocking inline script, so the
stones keep assembling twice and the code stays as it was.

## Changed files

- `src/app/globals.css` — `--z-skip-link`, `.skip-link`, the `main` focus
  suppression, and the six scoped `.privacy-tooltip-*` rules.
- `src/app/layout.tsx`, `src/components/layout/header-gate.tsx`,
  `src/lib/navigation.ts` — the skip link.
- `src/components/layout/app-header.tsx` — four utilities removed.
- `src/components/ui/privacy-tooltip.tsx` — inline styles → classes.
- `src/lib/dashboard/dimension-presentation.ts`,
  `src/components/dashboard/dashboard-map-interactive.tsx` — `plusPosition`,
  plus a comment recording what was measured about the load jump.
- `design.md` — component 11, and an Accessibility Guidance bullet.
- `PROGRESS.md` — one bullet.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- **Computed-style fingerprint, before vs after** — the same throwaway harness
  as the previous branch: 56 screens, 6732 element rows, 44 properties and a
  bounding box each. After removing the one new element (the skip link, which
  appears on 24 of the 56 captures and shifts every DOM index after it), the
  diff is **104 rows that differ only in their `class` attribute and zero rows
  with a different computed style or box**. The skip link appears on exactly
  the screens that carry the header, which is the intended rule.
- **Skip link, in a browser**: first Tab focuses it; off-screen beforehand at
  `x = 2560` on a 1280 viewport and the document gains no horizontal scroll;
  `z-index` 100 over the sticky header's 20; `rgb(228, 153, 2)` on
  `rgb(56, 56, 56)`, `999px`, `9.6px 22.4px` — the product's accent pill;
  Enter lands `document.activeElement` on `#main-content`. The respondent
  questionnaire has none.
- **Tooltip, in a browser**, opened inside a `.stat-stone` on `/`:
  14.08 / 14.08 / 13.44 / 12.8 / 12.8px — identical to the inline values.
- `npm run verify:core` — exit 0, 739 tests pass, lint clean.
- `npx playwright test` — all 6 e2e pass.
- `npm run build` clean; `npx tsc --noEmit` clean.

### Failed

Both were found by measurement and fixed; both are recorded under "Failed
approaches" because the reasoning that produced them was wrong, not just the
code.

### Blocked or not run

- `verify:db` and `verify:ai` not run: no server, schema or AI code changed.
- Only bundled Chromium. The skip link uses `inset-inline-start`, which is not
  new to this stylesheet, and `:focus-visible`, which the product already
  depends on.
- The frame measurement below is a local production build on one machine. The
  absolute numbers are not portable; the comparison between two builds on the
  same machine is what it is being used for.

### Environment

Local; `npx next start` on port 3100 with the harness's throwaway credentials.
The map measurements used the closed round `round_local_1785676013225`, whose
map is unlocked — the active round has 0 of 10 responses, so `/dashboard`
renders the locked screen and has no stones to measure.

### Residual risk

Low. The skip link is additive; the other three changes are proved inert.

## Failed approaches

- **Unscoped `.privacy-tooltip-*` classes.** The inline styles were not only
  verbose, they were winning a fight nobody had written down: `PrivacyTooltip`
  is planted inside other components, and `.stat-stone strong` (2.9rem) and
  `.stat-stone span` (1.05rem) are defined *later* in `globals.css` than
  `.custom-tooltip-content strong`. At equal specificity the later rule wins,
  so plain classes rendered the privacy explanation at headline size on the
  home screen — 46.4px where 14.08px belonged. The harness caught it on the
  first run. Scoping each class to `.custom-tooltip-content` makes it two
  classes, which beats one class plus one element.
- **`useLayoutEffect` for the map-stone jump.** The reasoning was sound and the
  result was noise: 35 frames at the default position before, 32-36 after, over
  four runs. The jump is hydration latency, not the frame the effect waited
  for. Worse, removing the `requestAnimationFrame` breaks
  `react-hooks/set-state-in-effect`, which is what the frame was there for in
  the first place. Reverted to the original code, with a comment recording the
  measurement so the next agent does not spend the same hour.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

1. **Answered 2026-08-08 — the map-stone load jump stays.** Closing it would
   mean putting the saved offsets on the stones before React runs: a blocking
   inline script in the layout, or writing the layout to a cookie so the server
   can render it. The owner declined both; not worth the architecture for a
   cosmetic half-second on one screen. Recorded in the component comment too,
   so it is not re-proposed.
2. Still open from earlier branches: whether the 200-instead-of-404 status
   deserves its own task, and whether to keep the restored error-note border.
3. The `impeccable` design hook flags `rgba(87, 79, 58, 0.2)` in the new
   `.privacy-tooltip-note` rule as outside the palette. It is not new — it is
   the dashed border that was already in the inline style, moved verbatim. Left
   as found rather than silently recoloured or suppressed.

## Next concrete step

Owner runs `git push origin chore/frontend-audit-minor-items:main`. This is now
the tip of a six-branch stack, so that single push delivers the whole audit.
