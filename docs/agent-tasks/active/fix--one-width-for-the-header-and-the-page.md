# One width for the header and the page

## Metadata

- Branch: `fix/one-width-for-the-header-and-the-page`
- Base branch: `main`
- Base commit: `a2c2b98`
- Current HEAD: this file's own commit, on top of `33858f6`
- Status: done locally. Nothing is pushed.
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

## Decisions made

- **The gutter converges upward, never downward.** At every step both the
  header and the page take the *narrower* of the two gutters that used to
  disagree, so the header widens by two pixels a side below 768px and by four
  below 430px and no content box ever gets smaller. Narrowing the page instead
  would have been the same alignment and a real risk: the identity row already
  overflowed once at 390px, and the fix for that was more room, not less.
- **The 768px step keeps its number.** The header's phone rule already lived at
  768px and `.page`'s at 760px. One had to go, and 768 is the one the header's
  other mobile properties are already written against.
- **The history slot is `width: 100%`, not a token.** It is a child of `.page`
  and has no opinion of its own to express; a second `min()` there is what
  subtracted the gutter twice.

## Completed

- `--shell-width` / `--shell-gutter` in `:root`, with steps at 768px and 430px.
- `.site-header` and `.page` read them; four scattered width declarations gone.
- `.survey-builder-history-slot` is as wide as its parent.
- `e2e/shell-width.spec.ts` — four tests.

## In progress

Nothing.

## Remaining

Nothing on this branch. The two things it deliberately left, and why, are in
Non-goals above.

## Changed files

- `src/app/globals.css` — the tokens, the two consumers, the slot, and the
  removal of the per-breakpoint overrides.
- `e2e/shell-width.spec.ts` — new.
- `docs/agent-tasks/active/fix--one-width-for-the-header-and-the-page.md` — this
  file.

## Verification evidence

### Passed

- The measurements in the table above, taken signed in against a production
  build on eight screens at 1440 and on `/round` and `/survey` at six widths.
- `npx playwright test e2e/shell-width.spec.ts` — 4 passed after rebuilding.
- `npm run verify:core` — 1654 tests and 587 Python tests, 0 failures.
- `npm run test:e2e` — 41 passed, the whole suite in one clean run.
- `npm run lint:skills`, `npm run lint:doc-numbers`, `npm run lint:audit-count`
  — all clean.
- Read visually, signed in at 1440 and 390 on `/survey`: the header card's edges
  and the content's edges are one line at both widths.

### Failed

None.

### Negative check

Free, and taken by accident before the fix was built: the first run of the new
spec served the existing `.next`, so it measured the old stylesheet and failed
naming the exact numbers this branch exists to remove — `the header starts at
10 and the content at 8` at 760px, `10 and the content at 6` at 390px, and `the
header starts at 130 and the history at 146` on the builder. Rebuilding turned
all four green. The same trap cost the previous branch a session; here it paid.

### Blocked or not run

Nothing on the deployment. The branch is not pushed.

### Environment

The Playwright harness's own production build and servers on 3100/3101, against
the local Postgres on 5433. `GEMINI_API_KEY` stripped from every child
environment.

### Residual risk

A fifth width declaration can still be added beside the tokens; the guard is
what notices. It watches `/round` and `/survey` only — a screen that grows a
container of its own is not covered.

## Failed approaches

- A scratch measurement spec, `e2e/zz-width-probe.spec.ts`, was committed by an
  over-broad `git add -A` alongside the first documentation commit and removed
  in the next one. It exists in this branch's history and in no working tree.

## Known risks

None known.

## Approval gates

None reached. Nothing pushed, nothing on the deployment changed.

## Questions requiring an owner decision

Whether `.dashboard-page` should join the shell at 1180px or stay at 1240px.
The dashboard has no header, so nothing forces the answer; it is the only
screen family that is 60px wider than the rest of the product.

## Next concrete step

Hand the branch to the owner to push.
