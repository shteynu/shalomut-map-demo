# A split staff room is visible on the map

## Metadata

- Branch: `feat/a-split-staff-room-is-visible`
- Base branch: `fix/comparison-reads-the-questionnaire` (stacked, not `main` —
  it imports nothing from that branch, but it was cut after its commit and its
  `index.ts` exports `DashboardRoundComparison`, so land that one first)
- Base commit: `37960c4`
- Current HEAD: this branch's commit
- Status: implemented and tested; browser walk waiting on an owner sign-in
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

## Completed

- `dividedDimensions(questionAggregates)`, returning both shares per divided
  dimension in the instrument's order.
- `DashboardDividedDimensionsNotice` in the sidebar.
- The stone mark and its accessible name.
- Six unit tests on the rule, four render tests on the notice.

## Remaining

- The browser walk (below).

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
  — 4/4.
- `npm test` — 842 pass, 0 fail.
- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run build` — succeeded.

Environment: local.

### Blocked or not run

- **The browser walk.** `/dashboard` is behind the manager session and an agent
  does not enter passwords, so it needs the owner to sign in at
  `http://localhost:3000/login` first. The local seed already produces a divided
  dimension: `organizational-climate` alternates green and red by respondent, so
  it lands at 50/50, while every other dimension stays one-sided.
- **How the stone mark behaves at phone widths in particular.** The mark is a
  fourth line inside `.dashboard-map-blob-copy`, which is a fixed-height stone;
  nothing in the test suite renders it at a real width. This is the main thing
  the walk is for.

### Residual risk

- Medium on layout, low on logic. The rule is pure and covered; what no test
  covers is a stone that has an icon, a caption, a score, a delta chip and now a
  fourth line, on the narrowest phone.

## Approval gates

None.

## Questions requiring an owner decision

None. The one that existed — whether a division changes the status — was
answered on 2026-08-10: it does not.

## Next concrete step

Sign in at `http://localhost:3000/login` and open the dashboard on the seeded
round; confirm the `דעות חלוקות` mark sits on the `אקלים ארגוני` stone without
crowding the score or the status line, at desktop and at 375px, and that the
sidebar note names that dimension with both shares.
