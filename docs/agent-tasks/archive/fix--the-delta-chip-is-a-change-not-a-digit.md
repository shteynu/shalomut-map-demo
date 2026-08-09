# The delta chip reads as a change, not as part of the percentage

## Metadata

- Branch: `fix/the-delta-chip-is-a-change-not-a-digit`
- Base branch: `feat/a-new-round-arrives-with-its-questionnaire`
- Base commit: `3b19adb`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `90a507c`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

The `Minor` item of the 2026-08-09 deployed end-to-end smoke, in
`docs/deployed-e2e-smoke-findings-2026-08-09.md` on
`test/deployed-e2e-smoke-2026-08-09`: the delta chip sits tight against the
large percentage, and a zero delta renders as a small low-contrast `0`.

**Sixth and last in the stack.** Pushing it lands all six, and closes every
finding from that smoke.

## User-visible outcome

On the map, the change since the previous round reads as a change rather than as
digits of the percentage beside it, and it is legible on every stone.

## Context

Looked at rather than taken on trust, and it was worse than written down. The
chip is beside the percentage, not under it, and with no separation the two ran
together: a stone at `90%` with `+17` next to it read as **`+1790%`**.

Measuring turned the second half into an accessibility finding rather than a
matter of taste. The chip is `0.9rem` at weight `800` — 14.4px, which is not
large text, so it needs 4.5:1. On the green stone, which is most of the map:

| ink | on `--pastel-green` | verdict |
| --- | --- | --- |
| `--success-ink` `#1e7b17` | 4.25:1 | below AA |
| `--muted` `#6f674f` (the zero delta) | 4.45:1 | below AA |
| `--danger-ink` `#a8203d` | 5.64:1 | passes |

So the rises — the common case — and the unchanged ones were the two that
failed, on the bed they appear on most.

## Decisions made

- **The chip gets its own bed, and that is what fixes both halves.** A pill of
  `--surface` separates it from the percentage, and puts every ink on a
  background where it clears 5.1:1 — wherever the chip lands, green stone, pink
  stone or sidebar. One change, and the contrast stops depending on which stone
  a dimension happens to be.
- **No new colour.** `--surface` and `--radius-control` are the palette's own,
  so this adds nothing to the design system.
- **`±0` rather than `0`.** Every other delta carries a sign; the unchanged one
  now does too, and is read the same way.
- **The zero delta is kept, not dropped.** The other half of the finding's
  suggestion was to omit it. A dimension that held its ground is something the
  manager measured, and omitting it would make "no change" look like "not
  compared".
- **`describeDelta` is untouched.** The screen reader already hears
  `ללא שינוי`; only the printed glyph was ambiguous.

## Non-goals

- The sidebar line pairs the chip with `describeDelta` — `+3` beside
  `עלייה של 3 נקודות` says the same thing twice. It reads fine and predates
  this; not this task's business.

## Changed files

- `src/lib/dashboard/round-comparison.ts` — `formatDelta` returns `±0`
- `src/lib/dashboard/__tests__/round-comparison.test.ts` — the zero case, and
  that every delta carries a sign
- `src/app/globals.css` — `.round-delta` becomes a pill

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 772 TypeScript tests (771 before, one new), all
  five fitness checks, `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 — the committed suite is unchanged.
- **Looked at in a browser, before and after**, on a round with a real
  comparison. Before: `+1790%`. After: the pill is plainly a separate thing and
  the percentage reads as a percentage, on the green, pink and yellow stones and
  in the sidebar.
- **The zero delta was put on a real stone and measured**, since this data has
  none: it renders `±0`, and the computed contrast of the rendered chip is
  **5.41:1** against its own background, up from 4.45:1 as bare text on the
  green stone. Both readings are from `getComputedStyle` on the live element,
  not from the stylesheet.

### Not run, and why

- No browser test is committed. The committed e2e suite has no round with a
  comparison to assert against, and giving it one means writing rounds. What is
  guarded permanently is `formatDelta`; the pill is CSS, checked by looking.
- `verify:db`, `verify:ai`, the Python suite and the mutation run: no schema,
  repository, contract, Python or mutated module is in this diff.

### Environment

local

### Residual risk

- The pill reads as an interactive control at a glance, and it is not — the
  whole stone is the link. Nothing in the walk suggested confusion, but it is
  the thing to watch if the map's affordances are ever reviewed.
- `--success-ink` and `--muted` still fail AA as bare text on `--pastel-green`.
  This change moved the one place that did that; anything else placing small
  text of those inks on a green stone would fail the same way.

## Approval gates

None.

## Next concrete step

Push, then look at the map on the deployed endpoint — `ff5625a8` has rounds with
a comparison — and confirm the chips read as separate from the percentages.
