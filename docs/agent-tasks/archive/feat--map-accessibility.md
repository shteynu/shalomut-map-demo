# Keyboard and reduced-motion support for the map

## Metadata

- Branch: `feat/map-accessibility`
- Base branch: `main`
- Base commit: `0d93f20`
- Current HEAD: the branch's own commits; not pushed
- Status: implementation complete, awaiting the owner's push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close backlog `docs/product-behaviour-backlog.md` §4: the map is the product's
core interaction and could only be rearranged with a pointer.

## User-visible outcome

A focused stone moves with the arrow keys, one step per press and a large step
with Shift, and stops at the edge of the stage. Pressing reset moves focus to
the map and announces that the stones went back, instead of dropping focus to
the document body. Under `prefers-reduced-motion` a stone arrives instead of
sliding.

## Context

WCAG AA is a project invariant (`PROJECT_CONTEXT.md`, development invariants
1 and 4). The drag was pointer-only and the reset button deleted itself from
under the keyboard.

## Scope

- Arrow-key movement for stones, bounded by the stage.
- Focus and announcement after reset.
- A reduced-motion path for stone and reset-button motion.
- A `.visually-hidden` utility, which the repository did not have.

## Non-goals

- Announcing every nudge.
- Keyboard rearrangement on mobile, where dragging is disabled anyway.
- The builder's keyboard work, which is §3.

## Acceptance criteria

- Arrow keys move a focused stone and nothing else on the page scrolls.
- Two presses in quick succession both count.
- A stone cannot be moved off the stage.
- Focus is never lost when the reset control disappears.

## Relevant repository instructions

`AGENTS.md` skill routing; branch-scoped task state; `git push` is the owner's
action in this environment.

## Relevant architecture and contracts

None affected. No contract, schema or service boundary changed.

## Decisions made

- Plain arrows rather than a modifier chord. They are consumed only while a
  stone has focus, so the page still scrolls everywhere else, and a screen
  reader in browse mode takes the arrows before the page sees them.
- The nudge maths live in `src/lib/dashboard/map-nudge.ts` rather than inside
  the component, so the geometry is testable without a DOM.
- The step is computed inside the `setOffsets` updater from the offset React is
  holding. Reading the ref instead lost a step when two presses landed in one
  render — caught in the browser, not in review.
- Reduced motion drops the transform transition only. Colour and shadow fades
  are not motion and stay.

## Assumptions

- Rearranging the map is cosmetic, so per-nudge announcements would be noise
  rather than information. Recorded as remaining work in §4 if that changes.

## Completed

All of the scope above, with tests.

## In progress

Nothing.

## Remaining

Nothing on this branch. §4 keeps the per-nudge announcement question and the
fact that no screen reader has actually been listened to.

## Changed files

- `src/lib/dashboard/map-nudge.ts` — new: `isNudgeKey`, `nextNudgeOffset`,
  the two step sizes.
- `src/components/dashboard/dashboard-map-interactive.tsx` — `onKeyDown`, the
  shared `boundsFor` helper the drag now uses too, focus and `role="status"`
  after reset.
- `src/components/dashboard/dashboard-map-page.tsx` — the hint names the keys.
- `src/app/globals.css` — `.visually-hidden`, stage `:focus-visible`, the
  reduced-motion block for the stone and the reset button.
- `src/lib/dashboard/__tests__/map-nudge.test.ts` — new, 4 cases.
- `PROGRESS.md`, `docs/product-behaviour-backlog.md` §4.

## Verification evidence

### Passed

- `npm run verify:core`: passed, 467 TypeScript tests.
- Browser, local dev server and the owner's authenticated session, on
  `/dashboard?round=round_local_1785676013225`:
  - Two `ArrowUp` presses dispatched in one tick accumulated to `y = -32`, which
    is the bug described under Decisions, verified fixed.
  - `Shift+ArrowLeft` stopped the stone at `leftGap: 0` — the stage edge —
    rather than at the full 64-pixel step.
  - Reset: focus went from `.map-reset-button` to the map stage, the status line
    read "סידור המפה אופס. האבנים חזרו למקומן המקורי.", offsets returned to zero.
  - The loaded stylesheet carries the reduced-motion rules for
    `.dashboard-map-blob` and `.map-reset-button`, and `.visually-hidden`
    computes to `inset(50%)`.

### Failed

None.

### Blocked or not run

- Reduced motion was verified as loaded CSS, not by rendering with the
  preference actually set — the browser tooling here cannot emulate it.
- No screen reader was run; the announcement was verified as DOM text.
- Mobile viewport not checked, as in the previous two slices.
- `npm run verify:db` and `npm run verify:ai`: not run, nothing they cover
  changed.

### Environment

Local: `next dev` on `:3000`, Docker PostgreSQL on `127.0.0.1:5433`. The
disposable round `סבב אביב 2026` from the previous slice is still there.

### Residual risk

Keyboard events were dispatched programmatically rather than typed, so the
handler is verified but the browser's own key handling around it is not.

## Failed approaches

The first version read the current offset from `offsetsRef` before calling into
the state updater. Two arrow presses inside a single render then computed from
the same starting point and the second overwrote the first.

## Known risks

None beyond the residual risk above.

## Approval gates

`git push` is blocked for the agent in this environment.

## Questions requiring an owner decision

None.

## Next concrete step

Owner runs:

```bash
git push origin feat/map-accessibility:main
```
