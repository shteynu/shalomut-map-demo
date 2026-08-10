# A split staff room is visible on the map

## Metadata

- Branch: `feat/a-split-staff-room-is-visible`
- Base branch: `fix/comparison-reads-the-questionnaire` (stacked, not `main` —
  it imports nothing from that branch, but it was cut after its commit and its
  `index.ts` exports `DashboardRoundComparison`, so land that one first)
- Base commit: `37960c4`
- Current HEAD: this branch's commit
- Status: implemented, tested and walked in the browser; ready to land
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the second and last remaining item of axis 6 in
`docs/product-strategy-axes-2026-08-10.md`: the dimension score is a mean, and a
mean cannot tell one staff room from two. Thirty yellow answers and eighteen
green plus twelve red both score 60 — same number, same colour, same headline —
while in the second school four teachers in ten said the aspect requires action.

## User-visible outcome

Where a dimension's answers split between the two ends, the map says so: a
`דעות חלוקות` mark on the stone itself and a `דעות חלוקות בצוות` note in the
sidebar naming each divided dimension with both shares
(`איזון — 40% אדום מול 60% ירוק`). The stone's accessible name carries the same
fact. Scores, colours and statuses are untouched.

## Context

The distribution has always been computed —
`CanonicalQuestionAggregate.scoreDistribution` carries green/yellow/red counts —
and only the mean was reaching the screen. No new data, no new column, no
contract version.

## Scope

- `src/lib/dashboard/dimension-division.ts` — the rule, and the only place the
  threshold is written.
- Sidebar notice component, stone mark, and the prop threaded from
  `app/dashboard/page.tsx` through `DashboardMapPage` to
  `DashboardMapInteractive`.
- Two style blocks in `globals.css`.

## Non-goals

- **Changing the status or the score.** Owner decision, 2026-08-10: this is a
  second fact beside the score, not a correction of it. Moving a band on a split
  room would change what the AI service validates a status against, which is a
  contract question rather than a display one.
- The dimension detail screens, the AI prompt and the report. This slice is the
  map.

## Decisions made

- **A dimension is divided when at least a fifth of its answers are green and at
  least a fifth are red.** A fifth is a product judgement, not a statistic, and
  it is documented as one at its single definition site. Two things recommend
  it: one colleague in five at the opposite end is a group rather than a mood,
  and — because the privacy threshold is ten respondents and each respondent
  answers every question of a dimension — one person is worth at most a tenth of
  a dimension's answers, so a fifth can never be one teacher having a bad week.
- **Named, not counted.** The band-edge note beside it is a fact about the
  sample and is true of most stones at once, so it is said once as a count. A
  division is true of few, and which ones is the whole content.
- **On the stone as well as in the sidebar**, for the same reason, and in words
  rather than by colour alone.

## What the browser walk changed

The walk found two real defects that no test could have caught, both now fixed
in this branch.

1. **The mark had nowhere to live on the stone.** It was first drawn as a
   fourth row in the stone's centred stack, which overlapped the score by 7px:
   a stone is 152px tall and icon, caption and score already fill it. Appending
   it to the status line instead wrapped that line onto two rows on five of
   eight stones, which then climbed back into the score. It now sits beside the
   score — a short number in a wide box — which was measured intact on all eight
   stones with a delta chip present, the widest that row ever gets.
2. **Naming every divided dimension was the wallpaper this notice exists to
   avoid.** A test round whose answers are near random has all eight dimensions
   split, and the note listed all eight. It now names the three widest splits
   and counts the rest. The "true of few" premise the design rests on is true of
   a real school and not of every round, and the copy had to survive both.

## Completed

- `dividedDimensions(questionAggregates)`, returning both shares per divided
  dimension in the instrument's order.
- `DashboardDividedDimensionsNotice` in the sidebar.
- The stone mark and its accessible name.
- Six unit tests on the rule, six render tests on the notice.

## Remaining

- Nothing.

## Changed files

- `src/lib/dashboard/dimension-division.ts` (new)
- `src/lib/dashboard/__tests__/dimension-division.test.ts` (new)
- `src/components/dashboard/dashboard-divided-dimensions-notice.tsx` (new)
- `src/components/dashboard/__tests__/dashboard-divided-dimensions-notice.test.tsx` (new)
- `src/components/dashboard/dashboard-map-page.tsx`
- `src/components/dashboard/dashboard-map-interactive.tsx`
- `src/components/dashboard/index.ts`
- `src/app/dashboard/page.tsx`
- `src/app/globals.css`

## Verification evidence

### Passed

- `npx tsx --test src/lib/dashboard/__tests__/dimension-division.test.ts` — 6/6.
- `npx tsx --test src/components/dashboard/__tests__/dashboard-divided-dimensions-notice.test.tsx`
  — 6/6.
- `npm test` — 844 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.

Environment: local.

- **Browser walk, signed in, against a production build served on port 3210.**
  The owner signed in on `localhost:3000`; the session cookie is not scoped by
  port, so a `next start` on 3210 served the same session. This was necessary
  rather than incidental: the dev server on 3000 belongs to another session and
  was serving a CSS chunk one edit behind for most of the walk, which is worth
  remembering — a layout that looks broken there may only be stale.
- Round `1` (active, n=10, all eight dimensions divided): every stone renders
  `דעות חלוקות · <score>` on a single line, clear of the caption above and the
  status below — measured, minimum gap 2px, and confirmed by screenshot at
  1440px and at 390px. Sidebar note names the three widest and counts five more.
- Round `סבב שני, שאלון מנוסח מחדש` (closed, n=12, no dimension divided): no
  mark on any stone and no sidebar note, which is the negative case.
- No console errors on either round.

### Blocked or not run

- Nothing. The deployed endpoint has no round to render, as the handoff records.

### Residual risk

- Low. The rule is pure and covered by tests; the layout is measured on the
  widest case the row can reach (score, delta chip and mark together) at two
  widths.

## Approval gates

None.

## Questions requiring an owner decision

None. The one that existed — whether a division changes the status — was
answered on 2026-08-10: it does not.

## Next concrete step

Land `fix/comparison-reads-the-questionnaire` first, then this branch:
`git push origin feat/a-split-staff-room-is-visible:main` (the owner runs the
push).
