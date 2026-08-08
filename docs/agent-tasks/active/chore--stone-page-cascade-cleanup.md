# The stylesheet stops arguing with itself

## Metadata

- Branch: `chore/stone-page-cascade-cleanup`
- Base branch: `docs/design-md-matches-the-code` (a stack on top of `main` at
  `0cff722`; none of the five branches is pushed)
- Base commit: `4f83491`
- Current HEAD: `4f83491` (working tree ahead, see Git state)
- Status: implementation complete, verified locally, not committed
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Item 4 of the frontend UI/UX audit run on 2026-08-08: `globals.css` defines the
same selector more than once and then reaches for `!important` to settle the
argument. Remove the duplication and the `!important`s that nothing depends on,
without moving a single rendered pixel.

## User-visible outcome

None. That is the acceptance criterion, not a caveat — the whole point of this
branch is that the product renders byte-identically afterwards.

## Context

The audit's original figure — "40 duplicated selectors" — was a grep artifact:
media-query copies and multi-selector lists were counted as separate hits.
Parsing the stylesheet properly gave the real numbers:

- **10** selector groups defined twice at the same nesting level, **8** of them
  with genuinely conflicting property values. The later definition silently won.
- **30** `!important` declarations.
- **57** selectors in the two later override layers ("Stitch iteration 2026-07"
  and "Compact Design for Stone Page") that shadow an earlier `.stone-page`
  rule. Those are the real structural debt and are **not** touched here.

## Scope

`src/app/globals.css` only. No markup, no component, no token.

## Non-goals

- The 57 shadowed `.stone-page` selectors. Collapsing two override layers into
  one is a much larger change and deserves its own branch and its own argument.
- The 67-value type-scale sprawl `design.md` now records as debt.

## Acceptance criteria

A computed-style fingerprint of every element on every screen, at four widths,
is unchanged before and after. Not "looks the same" — measured.

## Relevant repository instructions

- `AGENTS.md` — verify in proportion to risk; a stylesheet touched everywhere is
  high risk despite being a small diff.
- `.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

None touched.

## Decisions made

- **Merge into the winner's value, not the first definition's.** Where two
  definitions conflicted, the later one was already what shipped. Merging up to
  the earlier position while keeping the later values is the only merge that
  changes nothing.
- **`!important` is removed only where it is provably dead.** Three survived the
  harness and were restored with a comment saying which selector they beat:
  - `.survey-builder-metric-stone` `transform: none` — beaten by
    `.stone-variant-*`, one class more specific.
  - `.survey-builder-legend-panel .legend-card` `transform: none` — beaten by
    `.legend-card.option-*`.
  - the shared mobile `border-radius` group — beaten by
    `.stone-page .setup-form`, equally specific but later in the file.
- **Measurement decided this, not reading.** I removed all fifteen, ran the
  harness, and got 89 changed product rows. The three above are in the diff
  because the browser said so.

## Assumptions

None. Every claim below is a harness output.

## Completed

- 10 duplicate selector groups merged into one definition each. A re-parse
  reports `duplicated groups: 0`.
- `!important` count 30 → 18. The twelve removed were: four `hint-*` mobile
  display toggles, the `.site-header` mobile block (five declarations), and
  `.stone-page .workflow-card`'s two, plus one paired `transform: none`. All
  were beating nothing.
- The eighteen that remain are the four `prefers-reduced-motion` overrides,
  `--stone-rotate: 0deg`, the ten in the `.dashboard-map-blob` group that must
  beat inline styles set by `dashboard-map-interactive.tsx`, and the three
  restored above.

## In progress

Nothing.

## Remaining

Nothing in scope. The 57 shadowed `.stone-page` selectors remain, deliberately.

## Changed files

- `src/app/globals.css` — 49 insertions, 81 deletions.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- **Computed-style fingerprint, before vs after.** A throwaway spec captured 44
  CSS properties plus the bounding box of every `body *` on 13 paths × 4 widths
  (1440/980/760/430), plus the live respondent questionnaire in a fresh browser
  context per width, plus the signed-out `/login`: 56 screens, 6732 element
  rows. Final diff: **20 differing rows, 0 of them product elements** — all are
  `SCRIPT` / `NEXT-ROUTE-ANNOUNCER` DOM-index shifts from Next.js's own runtime.
- The intermediate run that caught the regression is the reason this branch is
  trustworthy: stripping all fifteen `!important`s produced 89 changed product
  rows — the builder's metric stones and legend cards regained a rotation
  matrix, and `/setup`'s form panel lost its mobile radius. Restoring three
  declarations took it to zero.
- `npm run verify:core` — exit 0, 739 tests pass.
- `npx playwright test` — all 6 e2e pass.
- `npm run build` clean.
- `git diff --check` clean.

### Failed

None outstanding. See above for the one that was found and fixed.

### Blocked or not run

- `verify:db` and `verify:ai` not run: the diff is one stylesheet.
- Only bundled Chromium was measured. Cascade resolution is not
  engine-dependent, so the risk of a different result elsewhere is low but not
  zero.
- The harness spec was deleted after the run; it is a diff tool, not a test.

### Environment

Local; `npx next start` on port 3100 with the harness's throwaway credentials.

### Residual risk

Low, and bounded by what the harness saw. Any screen state it could not reach —
a hover, an open modal, a validation error — was not fingerprinted. The removed
declarations are all layout and display, none of them state-dependent.

## Failed approaches

- Removing all fifteen non-essential `!important`s at once. Three were doing
  real work. Recorded above rather than quietly reverted, because the next
  agent tempted to delete them needs to know why they are there.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None. All three that were open here have since been answered on later
branches: the 200-instead-of-404 status became its own task and closed as
ADR-021, the restored error-note border is kept, and the audit's minor items
were done on `chore/frontend-audit-minor-items`.

## Next concrete step

Owner runs `git push origin chore/stone-page-cascade-cleanup:main`. This is now
the tip of a five-branch stack, so that single push delivers audit items 1, 2,
3, 4 and 5; none of the earlier branches needs a push of its own.
