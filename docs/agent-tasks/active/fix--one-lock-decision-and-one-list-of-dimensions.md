# One lock decision, and one list of dimensions

## Metadata

- Branch: `fix/one-lock-decision-and-one-list-of-dimensions`
- Base branch: `main`
- Base commit: `4683d68`
- Current HEAD: see `git log -1` on this branch
- Status: implemented, verified, awaiting push
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the fifth finding of `docs/questionnaire-modularity-audit-2026-08-16.md` (§3.2):
the eight wellbeing dimensions were written out twice by hand, and the map read a
score out of a record it never checked was populated.

The audit described this as duplication plus an unguarded destructure. Execution
showed something sharper underneath: the manager's map screen holds **two
disagreeing decisions about whether a round is locked**, and when they disagree
the screen crashes.

## User-visible outcome

- A round the analysis locked while its response total was already past the
  threshold now shows the locked screen instead of throwing on the manager's
  main page.
- That locked screen no longer says "another 0 answers and the map opens" — a
  sentence a manager could watch stay false forever. It says the total is met
  but part of the questionnaire has not yet drawn enough answers, and that the
  threshold applies per question.
- The `balance` stone's description on the map is now the methodology's own
  wording ("היחס בין היקף המשימות לבין הזמן לביצוען"), not the map's drifted
  copy of it.

## Context

`AnalyticsService` locks a round for three reasons, not one:

1. the round total is below the privacy threshold,
2. the questionnaire does not cover every dimension,
3. any single enabled analytic question drew fewer answers than the threshold.

When it locks, it withholds `dimensionScores`. `DashboardMapPage` decided
locking for itself with `responseCount < minimumResponses` — reason 1 only. A
round locked for reason 2 or 3 arrives with the total met, so the page called
itself unlocked and rendered the map against the scores that were withheld.

Reason 3 is reachable through the product: the question editor
(`src/components/survey/survey-builder/question-edit-dialog.tsx:464`) has a
"חובה / רשות" toggle, so a manager can make one analytic question optional and
let it collect fewer answers than the round did.

Proved by execution against the real `AnalyticsService` with in-memory
repositories — 12 respondents, threshold 10, one analytic question optional and
answered by 8:

```
service isLocked          : true
totalResponses            : 12
privacyThreshold          : 10
page predicate says locked: false
dimensionScores keys      : 0
DESTRUCTURE THREW         : Cannot destructure property 'averageScore' of
                            'analytics.dimensionScores.self-expression' as it is undefined.
```

The second half of the audit finding — the hand-written second copy of the
dimension taxonomy — had already drifted in the wild, with nothing pinning it:

- `conceptLabel`: duplicated identically in all eight (drift waiting to happen).
- `subtitle`: matched in seven; `balance` diverged — source
  "היחס בין היקף המשימות לבין הזמן לביצוען" against the map's
  "יחס מאוזן בין כמות המשימות לזמן לביצוען".
- `label`: genuinely the map's own, and different on purpose
  (`management-support` is "עוגן" on the map and "עורף מקצועי" in the source).

The full suite passed before the change, so no test held any of this.

## Scope

- `DashboardMapPage` takes the lock decision as a prop instead of recomputing it.
- `dimensionPresentations` is derived from `surveyInstrument.dimensions` and
  keyed by `WellbeingDimensionId`, so the compiler refuses a ninth dimension
  with no stone and a stone with no dimension.
- The locked screen's copy branches on whether more answers would actually help.
- The map's per-stone destructure is guarded as a second line of defence.

## Non-goals

- Changing when the analysis locks a round. The three reasons are unchanged;
  only who decides moved.
- Moving `label` into the methodology. Which short name each screen shows is a
  product decision and stays the map's.
- Reworking the stone geometry, colours or the "+" placements.

## Acceptance criteria

- A locked round with `responseCount >= minimumResponses` renders the locked
  screen. — met, pinned by test 5.
- The locked screen's zero-remaining branch does not promise "עוד 0 תשובות". —
  met, pinned by test 1.
- The map's stones equal the methodology's dimensions in id, order,
  `conceptLabel` and `subtitle`. — met, pinned by test 4.
- Adding a ninth dimension to `WellbeingDimensionId` fails to compile, naming
  the file that must change. — met, shown by sabotage D.
- A missing score skips its stone rather than blanking the page. — met, pinned
  by tests 2 and 3.

## Relevant repository instructions

- `AGENTS.md`: never expose respondent identity or results below the configured
  privacy threshold. This change strengthens that — a screen that rendered
  withheld scores is the failure mode being removed.
- `.agents/skills/shalomut-verification/SKILL.md`: every guarantee sabotaged and
  shown to fail exactly the intended test; only checks that actually ran are
  recorded below.

## Relevant architecture and contracts

- `src/lib/services/analytics.service.ts` owns `isLocked` and withholds
  `dimensionScores` alongside it.
- `src/lib/shalomut-source.ts` owns the dimension taxonomy: which dimensions
  exist, their order, `conceptLabel` and `subtitle`.
- `src/lib/dashboard/dimension-presentation.ts` owns the map's presentation of
  them: `label`, geometry, colour, "+" placement.
- No API, wire format, database column or contract version is touched.

## Decisions made

- The subtitle drift is reconciled **from the source**: the map now shows the
  methodology's wording for `balance` rather than the methodology adopting the
  map's. Owner instruction, this session.
- `label` stays map-owned and is not derived. It differs on purpose, and the
  comment in `dimensionMapPlacements` says so at the one place it differs.
- The destructure guard is kept even though the lock fix makes it unreachable
  through the product. Reaching it is a bug either way; seven stones is a better
  failure than a blank page.

## Assumptions

- `surveyInstrument.dimensions` remains the single list of dimensions and keeps
  its order — the map's stone order now follows it rather than matching by
  coincidence.

## Completed

- `DashboardMapPage` takes `isLocked` from `analytics.isLocked`, passed at
  `src/app/dashboard/page.tsx`.
- `dimensionPresentations` derived from `surveyInstrument.dimensions`, with the
  map's own fields in a `Record<WellbeingDimensionId, DimensionMapPlacement>`.
- The `balance` subtitle now comes from the source.
- Locked-screen copy branches on `remaining > 0`.
- Guarded destructure in `DashboardMapInteractive`.
- Five tests in a new file, and five falsification runs.

## In progress

Nothing.

## Remaining

Push. `git push` is an owner action here.

## Changed files

- `src/app/dashboard/page.tsx` — passes `isLocked={analytics.isLocked}`.
- `src/components/dashboard/dashboard-map-page.tsx` — `isLocked` prop; local
  predicate deleted; `DashboardMapReady` retyped as
  `Omit<DashboardMapPageProps, "isLocked">`.
- `src/components/dashboard/dashboard-map-locked.tsx` — two-branch copy.
- `src/components/dashboard/dashboard-map-interactive.tsx` — guarded lookup.
- `src/lib/dashboard/dimension-presentation.ts` — taxonomy derived from the
  instrument; placements keyed by the dimension union.
- `src/components/dashboard/__tests__/dashboard-map-lock.test.tsx` — new, 5 tests.
- `docs/agent-tasks/active/fix--one-lock-decision-and-one-list-of-dimensions.md`
  — this file.
- `docs/agent-tasks/archive/fix--a-changed-scale-is-a-changed-questionnaire.md`
  — archived, its commits are on `main`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. 1068 tests, 1068 pass, 0 fail (1063 before).
  Covers `lint:literals`, `lint:interpreter`, `lint:composition`,
  `lint:fixtures`, `lint:skills`, `lint:mutation-config`,
  `lint:contract-refusals`, `lint:fonts`, `typecheck`, `test`, `lint`, `build`.
- Execution proof of the defect before the fix, through the real
  `AnalyticsService` with in-memory repositories — transcript quoted under
  **Context** above.
- Falsification A — removing `if (!dimensionScore) return null;` fails tests 2
  and 3, and nothing else.
- Falsification B — collapsing the locked screen back to one sentence fails
  test 1.
- Falsification C — re-inlining the map's own `balance` subtitle fails test 4.
- Falsification D — adding `"workload-recovery"` to `WellbeingDimensionId`
  produces exactly one tsc error,
  `dimension-presentation.ts(70,7): error TS2741`. Before this change a ninth
  dimension compiled clean and named no site — the audit's §(d).
- Falsification E — restoring the page's local
  `responseCount < minimumResponses` fails test 5.

Each sabotage was reverted and the tree restored before the next.

### Failed

None.

### Blocked or not run

- No browser walk. The change is on a manager screen behind `/login`, and the
  three tests that matter render the real components through
  `renderToStaticMarkup` against the exact state that used to crash — which the
  browser cannot be made to reach without editing a questionnaire mid-round.
- No deployed check. Nothing is deployed from this branch yet.

### Environment

Local only. No database writes, no deployed environment touched, no AI provider
called.

### Residual risk

- The guarded destructure means a genuinely missing score is now silent. If the
  analysis ever withholds one dimension while reporting the round as unlocked,
  the map will draw seven stones and say nothing. That is the failure this
  chooses; it is not a state the analysis produces today.
- `isLocked` is now a required prop, so every caller is named by the compiler —
  but there is exactly one caller, and no test asserts the wiring at
  `src/app/dashboard/page.tsx` itself.

## Failed approaches

None on this item.

## Known risks

None outstanding.

## Approval gates

None. No credentials, secrets, authentication configuration or deployment
aliases are involved.

## Questions requiring an owner decision

- The map's `label` and the methodology's `label` differ for
  `management-support` ("עוגן" against "עורף מקצועי") and `self-expression`
  ("קול אישי" against "ביטוי עצמי"). Both are deliberate today. Worth a decision
  whether the map should keep its own vocabulary at all, or whether these two
  are leftovers.

## Next concrete step

Push this branch to `main`:

```bash
git push origin fix/one-lock-decision-and-one-list-of-dimensions:main
```
