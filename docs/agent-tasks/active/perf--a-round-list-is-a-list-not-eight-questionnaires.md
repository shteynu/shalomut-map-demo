# A school's round list is a list, not eight questionnaires

## Metadata

- Branch: `perf/a-round-list-is-a-list-not-eight-questionnaires`
- Base branch: `main`
- Base commit: `23180d5`
- Current HEAD: see **Exact Git state**
- Status: complete and verified
- Last updated: 2026-08-23
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the open half of the 2026-08-21 audit's «У `survey_rounds` нет индекса по
`organization_id`, и каждый запрос раундов тащит полный `surveyDefinition` и
`aiInsights` JSON». The index half closed 2026-08-22 (`e056d21`, ADR-036); the
summary-read half was still open for every manager screen.

## What was wrong

`findByOrganizationId` selects every column. So the list of a school's rounds —
loaded by `ManagerContextService.load`, which is the entrance to every manager
screen — arrived with each round's whole questionnaire and whole Stone Map. Every
screen renders titles from that list. One screen renders a questionnaire, and it
renders the questionnaire of one round.

## Measurement

Eight rounds, the 126-item instrument, seven of them carrying an analysis.
Warmed, twenty-five samples, local PostgreSQL on `:5433`.

| | bytes | median |
| --- | --- | --- |
| before — one wide list | 292.7 KB | 3.81 ms |
| after — summaries, then the round on screen | 25.5 KB | 2.24 ms |
| summaries alone | 1.9 KB | 1.16 ms |

And the case it costs:

| a school with one round | median |
| --- | --- |
| before | 2.56 ms |
| after | 2.82 ms |

The deployed database is not on the same continent as the process reading it, so
the millisecond figures are lower bounds and the 267 KB is what travels. Scripts
were written at the repository root, run, and deleted.

## Decisions made

1. **No new repository method.** `findSummariesByOrganizationIds` already
   existed, written for the administrator console listing many schools, and one
   school's own list is the same projection. It is called with a single id.
2. **`startDate` added to `SurveyRoundSummary`.** `comparableRoundsBefore` orders
   rounds by when the school ran them, and that column was not in the summary.
3. **`ManagerContext.rounds` is `SurveyRoundSummary[]`.** The type is the
   guarantee, as in ADR-045 — a screen reading a questionnaire off a list entry
   does not compile. Four consumers were narrowed to what they read: the round
   switcher, the goals view, the comparison walk, and `orderRoundsForManager`,
   now generic over the two fields it sorts by.
4. **`AnalyticsService.getAnalyticsForLoadedRound`.** Without it this change
   would have reintroduced the duplicate ADR-045 removed, from the other side:
   `load` now holds the round, and passing its id to `getAnalyticsForRound` would
   make the analysis look it up again.
5. **Sequential, not parallel, and the cost is named.** The selected round is
   only known after the list is ordered. Speculating on `?round=` would fire a
   read for an id the tenant check has not yet approved, and one round-trip is
   not worth putting a speculative read in front of the boundary that keeps
   schools apart.
6. **A missing round between the two reads is `round-not-found`.** A reset or a
   delete landing between them is a real interleaving; the school is real and the
   round is not, which is exactly what that state says.

## The ADR-045 test was restated, not deleted

`asking-for-a-round-does-not-compute-a-map.test.ts` asserted `findById` was never
reached when analytics were declined. That was true because the list carried
whole rounds and `load` picked the selected one out of it — which is what made
the analysis's own lookup a duplicate.

The premise is now deliberately false. The assertion says `findById` is reached
exactly **once**, with and without the analysis, and the comment carries why. The
duplicate is still refused, by the negative control on the analytics path: if it
ever reads 2, ADR-045 has come undone.

Rewriting an assertion a previous task wrote is the kind of edit that quietly
weakens a suite, so it is recorded here rather than left in a diff.

## Changed files

- `src/lib/types/backend.ts` — `SurveyRoundSummary` gains `startDate` and a doc
  comment naming the two columns it deliberately omits.
- `src/lib/repositories/prisma/prisma-round.repository.ts`,
  `src/lib/repositories/in-memory/in-memory-round.repository.ts`.
- `src/lib/services/manager-context.service.ts` — the read, the type,
  `orderRoundsForManager` and `selectActiveRound` generic.
- `src/lib/services/analytics.service.ts` — `getAnalyticsForLoadedRound`.
- `src/lib/rounds/round-options.ts`, `src/lib/goals/school-goals.ts`,
  `src/lib/dashboard/round-comparison.ts` — narrowed parameter types.
- Tests: new
  `src/lib/services/__tests__/a-round-list-is-a-list-not-eight-questionnaires.test.ts`;
  `a-summary-read-asks-for-six-columns.test.ts` renamed to
  `a-summary-read-asks-for-the-columns-a-list-needs.test.ts` and extended;
  `asking-for-a-round-does-not-compute-a-map.test.ts` restated.
- `PROJECT_CONTEXT.md` ADR-051, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`.

Nothing in `docs/openapi.yaml`. `GET /api/rounds` returns `selectedRound`, which
is still a whole round; the list never left the server.

## Exact Git state

Branched from `origin/main` (`23180d5`), which carries the three previous tasks —
the owner's push landed this time.

- `a927e84` — code and tests.
- The documentation commit follows it; see `git log`.

The only unstaged file is `next-env.d.ts`, which is generated and belongs to the
owner — stage with `git add -A ':!next-env.d.ts'`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, zero `not ok`, production build included.
- `npm run verify:db` — exit `0`, **97 tests, 97 pass**.
- `npm run test:e2e` — **24 passed**, including the five tenant-boundary specs.
  Run because this changed what `ManagerContextService.load` reads, and `load` is
  the entrance to every manager screen and to the school-scoping check.
- **Three regressions were planted and all three were caught**: the list going
  back to `findByOrganizationId`; the analysis looking the round up again; and
  the projection quietly widening to include `surveyDefinition`.
- The new suite pins that no list entry carries a questionnaire, a map or a share
  code **at runtime** as well as in the type, so a list serialised into a server
  component's payload cannot start shipping questionnaires to a browser.
- The order and the completeness of the list are asserted separately, so the
  cheapness assertions cannot pass on a context that stopped listing rounds.

### Blocked or not run

- **Nothing was walked in a browser by hand.** Playwright covers the screens.
- **The measurement was not repeated against the deployed database.** It has one
  school and one round, which is the case this makes marginally slower, and the
  local numbers are reported as the lower bounds they are.
- **No `EXPLAIN` was taken.** The claim is about what is fetched; the byte and
  time figures measure that end to end, and the projection test reads the query.
- The Python suite — not run; nothing on that side changed.

### Environment

Local. Disposable PostgreSQL on `127.0.0.1:5433`.

### Residual risk

- **A school with one round is marginally slower**, measured and stated above.
  Every school starts there.
- **`findByOrganizationId` still exists**, still selects everything, and is still
  used by `RoundService` for the sibling walk that enforces one active round per
  school — which needs whole rounds. Nothing stops a future list reaching for it
  except that the summary read is now the obvious one on that path.
- **Two reads where there was one** means a new interleaving: a round deleted
  between them. It is handled as `round-not-found`, which is a state that already
  existed, but it is a new way to reach it.

## Next concrete step

Hand the owner the push, which is theirs to run:

```
git push origin perf/a-round-list-is-a-list-not-eight-questionnaires:main
```
