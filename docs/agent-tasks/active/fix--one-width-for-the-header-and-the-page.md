# One width for the header and the page

## Metadata

- Branch: `fix/one-width-for-the-header-and-the-page`
- Base branch: `main`
- Base commit: `a2c2b98`
- Current HEAD: `a2c2b98`
- Status: in progress
- Last updated: 2026-08-25
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make the sticky header and the page content agree on one width, at every
breakpoint, on every screen that has a header.

## User-visible outcome

The floating header card and the content below it share the same left and right
edges instead of missing each other by a few pixels on a phone, and the survey
builder's history list stops sitting inset from the columns above it.

## Context

The previous branch recorded the mismatch as "the header (1180px) is narrower
than `.survey-builder-history-slot` (1240px)". Measured, that is not what is
happening, and the 1240 is not reachable at all: the slot is a child of `.page`,
so its `calc(100% - 2rem)` resolves against 1180 and gives 1148 — the slot is
*inset* 16px per side, not overhanging.

The real disagreement is on phones, and it comes from `.site-header` and `.page`
being sized by four rules in three different media blocks that nobody compared:

| viewport | header | `.page` | difference per side |
| --- | --- | --- | --- |
| 1440 | 130 → 1310 | 130 → 1310 | 0 |
| 900 | 16 → 884 | 16 → 884 | 0 |
| 760 | 10 → 750 | 8 → 752 | 2px |
| 600 | 10 → 590 | 8 → 592 | 2px |
| 430 | 10 → 420 | 6 → 424 | 4px |
| 390 | 10 → 380 | 6 → 384 | 4px |

The header's phone width comes from a second `@media (max-width: 768px)` block
seven hundred lines below the first — `width: calc(100% - 1.25rem)` — while
`.page` narrows its gutter to `1rem` at 760px and `0.75rem` at 430px. Three
gutters, no shared source.

## Scope

`src/app/globals.css` only, plus a guard.

## Non-goals

- `.dashboard-page` (1240px). The dashboard and everything under it renders
  without a header (`headerlessRoutes` in `src/lib/navigation.ts`), so there is
  no header for it to line up with. Whether the dashboard should be as wide as
  the rest of the shell is a layout decision, not this fix.
- The stones' overhang. `.metric-card` carries `transform: rotate(...)`, so its
  bounding box measures about 3px past `.page` on each side. That is the organic
  design drawing itself, not a container disagreeing about its width.
- `.action-card-glow` on the home page, which reaches 79px past the shell. It is
  a 48px-blurred halo at `opacity: 0.55`, deliberately offset by `-5rem` inside
  its own card.

## Acceptance criteria

- Header and `.page` share left and right edges to within a pixel at 1440, 760
  and 390.
- The survey builder's history slot shares them too.
- No page-level horizontal overflow at any of those widths.
- `verify:core` and the Playwright suite stay green.

## Relevant repository instructions

- `AGENTS.md`: `git push` stays the owner's; verify in proportion to risk.
- `.agents/skills/shalomut-verification`: record only checks that ran.

## Verification evidence

### Passed

- The measurements in the table above, taken signed in against a production
  build on eight screens at 1440 and on `/round` and `/survey` at six widths.

### Failed

None yet.

### Blocked or not run

The rest, until the change exists.

## Next concrete step

Replace the four width declarations with one token pair and guard the result.
