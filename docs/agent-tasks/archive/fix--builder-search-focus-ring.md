# The builder's search gets its focus ring back

## Metadata

- Branch: `fix/builder-search-focus-ring`
- Base branch: `fix/login-inside-the-design-system` (a stack on top of `main` at
  `0cff722`; the whole stack landed on `main` as one push on 2026-08-08)
- Base commit: `6c434bb`
- Current HEAD: `213e59b`, which is also `origin/main`. This task's own
  commits are `6a9b947`.
- Status: closed — pushed to `main` on 2026-08-08 and live on the
  deployed endpoint.
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Item 3 of the frontend UI/UX audit run on 2026-08-08.

## User-visible outcome

A keyboard user who reaches the builder's search field — by Tab or by the `/`
shortcut the field advertises — now sees the same navy outline every other
control in the product draws.

## Context

`.survey-builder-search input:focus` set `outline: none`, and the only thing
left to mark focus was `:focus-within` changing the wrapper's border colour
from `--border-soft` to `--accent-dark`. That is a tint on a 1px border, on the
one text field in the builder, which is a WCAG 2.4.7 problem and an odd island
in a product whose global `:focus-visible` is a 3px navy outline.

## Scope

`src/app/globals.css`, one rule added and two commented.

## Non-goals

Any other audit item. No markup changed.

## Acceptance criteria

- Keyboard focus on the search draws the product's outline.
- The field still reads as active on a pointer click.
- Focus behaviour matches an ordinary product input.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — WCAG AA.
- `design.md` — the product's own focus treatment.

## Relevant architecture and contracts

None touched.

## Decisions made

- **The outline moves to the wrapper, it is not restored on the input.** The
  input has no chrome of its own — the pill around it is the field — so an
  outline on the input would be drawn inside a border it does not own. The
  `outline: none` on the input stays, now with a comment saying where the
  outline went.
- **`:has(input:focus-visible)` rather than `:focus-within`.** The wrapper is
  the thing that must show the ring, but the condition should be the input's
  own focus-visible state, not "something inside me has focus".
- **The border tint stays on `:focus-within`.** Active-field feedback and
  keyboard-focus feedback are different signals and should not collapse into
  one.

## Assumptions

- `:has()` is available in the browsers this product targets. Where it is not,
  the result is today's behaviour, not something worse.

## Completed

The fix, verified.

## In progress

Nothing.

## Remaining

Nothing in scope.

## Changed files

- `src/app/globals.css` — `.survey-builder-search:has(input:focus-visible)`
  added; comments on the two neighbouring rules.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 739 tests pass.
- `npx playwright test` — all 6 e2e pass.
- Browser walk on a production build, throwaway spec deleted afterwards: signed
  in, opened `/survey`, pressed `/` to focus the search. Computed style on the
  wrapper: `rgb(45, 48, 126) solid 3px`, offset `3px`, border tinted to
  `rgb(159, 101, 0)`; `el.matches(':has(input:focus-visible)')` true. A
  screenshot shows the ring around the pill.
- On a pointer click the search resolves to `outlineStyle: solid`, and so does
  a plain `input` on `/setup` — asserted equal rather than assumed. Chrome
  matches `:focus-visible` on any element that takes keyboard input, so this is
  the product's existing behaviour for every field, and the search now shares
  it instead of being the exception.

### Failed

None.

### Blocked or not run

- No browser other than the bundled Chromium was checked, so the `:has()`
  assumption above is untested elsewhere.
- `verify:db` and `verify:ai` not run: CSS-only diff.

### Environment

Local; e2e against `npx next start` on port 3100 with the harness's throwaway
credentials.

### Residual risk

Very low. One added rule, scoped to one selector.

## Failed approaches

None. An early assertion that a pointer click should draw no ring was wrong
about `:focus-visible`, not about the fix; the check was rewritten to compare
against a plain product input.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The work is in `main` and this file is archived.
