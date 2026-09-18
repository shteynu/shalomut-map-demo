# A school user is not offered the analysis button

## Metadata

- Branch: `fix/school-user-sees-no-analysis-button`
- Base branch: `origin/main`
- Base commit: `6c06ceb`
- Current HEAD: the branch tip. `origin/main` is `5e75154` and contains the
  fix, `19c70ec`. Every commit after that point is documentation — this file's
  move to the archive and the handoff's `Now` entry — and is **unpushed**.
- Status: the fix is complete, verified and deployed; the documentation
  commits behind it are unpushed
- Last updated: 2026-09-18 (session close)
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Stop the four dashboard screens from offering «יצירת ניתוח עכשיו» /
«הפעלת ניתוח מחדש» to a school user, whose press could only ever earn a 403.

## User-visible outcome

A school user reading a round whose analysis is missing or failed sees the
state's own explanation and its «בדיקה חוזרת» / «ניסיון נוסף» re-check button,
and no way to order an analysis. An administrator's screens are unchanged.

## Context

Owner decision 2026-08-23 (ADR-042): the `manager` role reads; every action on a
round, `write:trigger-ai` included, belongs to `admin`. The table has said so in
`src/lib/auth/roles-and-permissions.ts` since 2026-08-20, and
`src/lib/server/manager-permission.ts` enforces it — `POST
/api/rounds/:roundId/trigger-ai` answers 403 to a school user.

`dashboard-ai-insights-state.tsx` had no notion of the reader. Its two failing
states rendered `GenerateAnalysisButton` whenever they were handed a `roundId`,
which all four screens always had. The 403 landed in the button's own `!ok`
branch and was rendered as «שירות הניתוח אינו זמין כרגע. נסו שוב מאוחר יותר.» —
a sentence blaming the provider for a decision about the reader.

## Scope

The four dashboard screens and the two routes that did not read the role.

## Non-goals

- The API side: `trigger-ai` already refuses, and
  `src/app/api/__tests__/a-school-user-may-only-read.test.ts` already pins it.
- The `onRetry` re-check buttons. Re-reading a round is a read and stays for
  both roles.
- `administratorOnlyScreens`: the dashboard is a school user's screen and
  remains one. Only the button on it was an administrator's.

## Acceptance criteria

- No analysis button on any of the four screens for a `manager`-role session.
- The failed and empty states still explain themselves and still re-check.
- An administrator's four screens are byte-for-byte the behaviour they had.

## Relevant repository instructions

`AGENTS.md`; `shalomut-tracker`, `shalomut-map` and `shalomut-verification`
under `.agents/skills/`.

## Relevant architecture and contracts

`ROLE_PERMISSIONS` in `src/lib/auth/roles-and-permissions.ts`;
`loadManagerRole` in `src/lib/server/manager-context.ts`; the `mayAct` idiom
already used by `round-controls.tsx`, `round-threshold-next-step.tsx` and the
recommendations page's goals board.

## Decisions made

- The existing `mayAct` prop is the vehicle, not a new role type on the client.
  Two of the four screens already received it and simply did not apply it to
  this path.
- `mayAct` is **required** on `DashboardAiInsightsState` and
  `DashboardOverviewSummary` rather than defaulting to `true`. A default is
  fail-open, and the original defect is exactly a screen that forgot to decide;
  `npm run typecheck` is what now refuses a screen that forgets.
- Inside the component the flag collapses into `generateRoundId = mayAct ?
  roundId : undefined`, so the button keeps its single precondition — a round to
  POST to — rather than growing a second one.

## Assumptions

None outstanding.

## Completed

All of it, in `19c70ec`.

## In progress

Nothing.

## Remaining

Nothing in the product. The owner pushed the fix to `main` on 2026-09-18, Vercel
deploys every push to `main` on its own, and all four workflows on `5e75154`
finished green: `Core verification`, `Browser smoke`, `Vercel Deployment &
Pipeline Checks` and `CodeQL`.

What is left is the documentation commits on this branch, which exist only in
this worktree until they are pushed.

## Changed files

- `src/components/dashboard/dashboard-ai-insights-state.tsx` — the rule.
- `src/components/dashboard/dashboard-map-page.tsx`,
  `dashboard-metrics-page.tsx`, `dashboard-dimension-page.tsx`,
  `dashboard-recommendations-page.tsx` — `mayAct` threaded to the state path.
- `src/app/dashboard/page.tsx`,
  `src/app/dashboard/[dimension]/metrics/page.tsx` — the two routes that read no
  role at all now read one.
- `src/components/dashboard/__tests__/school-user-analysis-button.test.tsx` —
  new; the pin, written first and failing first.
- `src/components/dashboard/__tests__/dashboard-semantic-quality.test.tsx`,
  `dashboard-map-lock.test.tsx` — existing call sites given the required prop.

## Verification evidence

### Passed

- Reproduction: the new test failed 3 of 6 before the fix — the school user was
  handed «יצירת ניתוח עכשיו» and «הפעלת ניתוח מחדש», including on the map
  screen's summary path. 6 of 6 after.
- `npm run typecheck` — exit 0. This is the check that proves no screen was
  missed, since `mayAct` is required.
- `npm test` — 1694 passed, 0 failed.
- `npm run lint` — exit 0.
- `npm run build` — exit 0; the four dashboard routes stay dynamic (`ƒ`).
- `npm run test:e2e` — 41 passed (chromium, tenant-boundary, mobile-chrome).
- Signed-in browser walk, both roles, same closed round with zero
  `ai_analysis_runs`, on `next start --port 3210` with the four `OIDC_*` set so
  the directory is the database: on all four screens the school user sees
  «הניתוח עדיין לא נוצר» with «בדיקה חוזרת» and no analysis button, and the
  administrator sees the same text with «יצירת ניתוח עכשיו» above the re-check.
  Screenshots confirmed the panel closes cleanly with no gap where the button
  was.

### Failed

None.

### Blocked or not run

- `npm run verify:db` and the Python suite — not run. Nothing in the diff
  touches persistence, Prisma or the AI service.
- Deployed: not touched.

### Environment

local. `npm test` needed `ai-analytics-service/.venv`, which this worktree did
not have — four `ai-e2e.test.ts` cases failed on its absence before it was
created per `docs/local-environment.md`, and passed after. The walk used the
local container on `:5433`; nothing was written to it, and no `.env` was left
behind.

### Residual risk

A fifth screen that renders the state component must pass `mayAct`, and the
compiler will say so — but it cannot judge whether the value passed is the right
one. The four that exist were each read.

## Failed approaches

None.

## Known risks

None outstanding.

## Approval gates

The push, which the owner made. `main` is checked out in another worktree, so
the branch was landed with `git push origin <branch>:main` rather than a local
merge.

## Questions requiring an owner decision

None.

## Next concrete step

Push the documentation commits, which is the owner's:

```bash
git push origin fix/school-user-sees-no-analysis-button:main
```

Nothing depends on them. They carry no product change, so a push that waits
costs nothing but a stale `Now` section in the handoff.
