# Comparing a round with the one before it

## Metadata

- Branch: `feat/round-comparison`
- Base branch: `main`
- Base commit: `43fb927`
- Current HEAD: the branch's own commits; not pushed
- Status: implementation complete, awaiting the owner's push
- Last updated: 2026-08-04
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make repeat measurement readable: show what changed since the previous round.
Backlog `docs/product-behaviour-backlog.md` §10, requirements document §8.1.

## User-visible outcome

On the map, each stone carries its change against the previous measured round
(`+17`, `-23`), and the sidebar states the overall change in words and names the
round it compared with. A school's first measured round shows nothing extra.

## Context

`feat/round-history-selection` made the dashboard read any round;
`feat/round-creation` let a school have a second one. Neither answered the
question a principal actually opens the map with — is this better than last
time.

## Scope

- A pure comparison module: which round counts as previous, and the deltas.
- One extra analytics read, only on the screen that shows the comparison.
- Delta on each stone and in the map sidebar.

## Non-goals

- A separate comparison screen or a trend across the whole history.
- Question-level or narrative comparison; the AI analysis still reads one round.
- Comparison on the dimension detail, metrics and recommendations screens.

## Acceptance criteria

- The comparison names the round it used.
- A locked round is never compared, in either direction.
- A school's first measured round shows no comparison rather than zeros.
- Direction is legible without colour.

## Relevant repository instructions

`AGENTS.md` skill routing; branch-scoped task state; `git push` is the owner's
action in this environment.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-004: rounds keep their own questionnaire snapshots
while the eight dimensions stay fixed, which is why the comparison is per
dimension and not per question. ADR-005: privacy is a product invariant, which
is why a locked round is skipped instead of compared. No contract version is
affected — nothing crossing the Core/AI boundary changed.

## Decisions made

- Delta on the existing map rather than a second screen. It is the surface a
  manager already opens, and the same eight stones carry the answer.
- The previous round is the nearest earlier round *with results*. The nearest
  earlier round can be one that never reached its threshold, which is a round
  with no numbers rather than bad numbers; the walk continues past it and the
  screen names whichever round it used. Bounded at three lookups.
- A locked round produces no comparison in either direction. Its scores are
  withheld by the privacy gate, and a delta against an unlocked round would hand
  them straight back by subtraction.
- Drafts are never candidates: a draft is a plan, not a measurement.
- `.round-delta` is isolated left-to-right so the sign stays on the left of the
  number inside Hebrew text.

## Assumptions

- Ordering by `startDate` matches how a manager thinks about "the previous
  round", even when a round was prepared long before it started.

## Completed

All of the scope above, with tests.

## In progress

Nothing.

## Remaining

Nothing on this branch. §10 keeps question-level and narrative comparison, the
archived-rounds question and the partial unique index for the active-round rule.

## Changed files

- `src/lib/dashboard/round-comparison.ts` — new: `comparableRoundsBefore`,
  `toRoundComparison`, `describeDelta`, `formatDelta`, `deltaDirection`.
- `src/lib/server/manager-context.ts` — `loadRoundComparison`, the bounded walk
  over earlier rounds.
- `src/app/dashboard/page.tsx` — asks for the comparison and passes it down.
- `src/components/dashboard/dashboard-map-page.tsx` — sidebar sentence.
- `src/components/dashboard/dashboard-map-interactive.tsx` — per-stone delta and
  the extended stone `aria-label`.
- `src/app/globals.css` — `.round-delta`, `.map-sidebar-comparison`.
- `src/lib/dashboard/__tests__/round-comparison.test.ts` — new, 8 cases.
- `PROGRESS.md`, `docs/product-behaviour-backlog.md` §10.

## Verification evidence

### Passed

- `npm run verify:core` (lint:literals, lint:composition, typecheck, tests,
  eslint, build): passed, 463 TypeScript tests.
- Browser, local dev server and the owner's authenticated session:
  - `/dashboard?round=round_local_1785676013225` — sidebar reads
    "+3 עלייה של 3 נקודות בהשוואה לסבב אביב 2026", stones read `+17` green and
    `-23` / `-53` red.
  - The nearest earlier round (`סבב סתיו 2026`, zero responses) was skipped and
    the comparison named `סבב אביב 2026`, which is the walk working.
  - `/dashboard?round=round_local_previous_spring_2026` — the school's first
    measured round shows no sidebar sentence and no stone deltas.
  - `/dashboard?round=25a163b5-…` — the locked active round still shows only the
    lock, with no comparison.

### Failed

None.

### Blocked or not run

- Mobile viewport: not checked. The in-app browser's `resize_window` did not
  change `window.innerWidth` in the previous slice either.
- `npm run verify:db` and `npm run verify:ai`: not run. No schema and no AI
  payload changed.
- Screen-reader output was not heard; the stone `aria-label` and the Hebrew
  wording were verified as text, not with assistive technology.

### Environment

Local: `next dev` on `:3000`, Docker PostgreSQL on `127.0.0.1:5433`.

Test data, disposable: a round `סבב אביב 2026`
(`round_local_previous_spring_2026`, closed, start 2026-02-01, twelve seeded
responses) was added so there were two unlocked rounds to compare. Two temporary
scripts under `scripts/` were used to seed and inspect it and were deleted; they
are not part of the diff.

### Residual risk

`loadRoundComparison` adds up to three analytics reads to a dashboard render on
a school with abandoned rounds. Acceptable at this size; a school with a long
history would want the previous round's aggregate stored rather than recomputed.

## Failed approaches

The first version took the nearest earlier round unconditionally. Local data
made the flaw obvious immediately: the nearest earlier round had zero responses,
so the dashboard showed no comparison at all even though a comparable round
existed one step further back.

## Known risks

None beyond the residual risk above.

## Approval gates

`git push` is blocked for the agent in this environment.

## Questions requiring an owner decision

None open on this branch. The backlog numbering collision raised in an earlier
thread is still undescribed and documentation-only.

## Next concrete step

Owner runs:

```bash
git push origin feat/round-comparison:main
```
