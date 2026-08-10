# The round learns who opened the link, not only who finished

## Metadata

- Branch: `feat/respondent-funnel`
- Base branch: `fix/respondent-path-pilot-ready`
- Base commit: `2961027`
- Landed as: `bf02dd1` on `main`, 2026-08-10 (rebased onto `3df1a13`; the
  pre-rebase commit was `b8a0a1e`).
- Status: closed. The migration was applied to the deployed database the same
  day.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Measure the respondent funnel — opened, consented, how far the questions got,
completed — so a pilot round can explain a low response count instead of merely
reporting one.

## User-visible outcome

The round screen gains a panel, `מה קרה עם הקישור`, that says how many sessions
opened the questionnaire, how many accepted the consent and started answering,
and how many sent answers. It counts sessions, not people, and says so.

## Context

Until now `SurveyResponse` was written on submit and nowhere else, so a teacher
who opened the link and left was indistinguishable in the database from one who
never received it. `docs/product-strategy-axes-2026-08-10.md` lists this as the
next unconditional item after the Tier 0 respondent-path fixes: without it a
pilot produces a number nobody can act on.

## Scope

- A `survey_attempts` table keyed by round plus the same per-attempt token hash
  the response already carries.
- An unauthenticated beacon endpoint beside the questionnaire.
- A funnel service and a Hebrew panel on `/round`.

## Non-goals

- No new identity of any kind: no IP, no user agent, no cookie, no device id.
- No per-question drop-off curve — only the furthest question a session reached.
- No funnel on the dashboard or in any AI contract.

## Acceptance criteria

- A reload is one session, not two.
- A client cannot claim a completion; only a stored response does that.
- An unknown share code answers exactly like a known one.
- The stopping point stays hidden until at least three sessions abandoned.

## Decisions made

- **Completions are counted from responses, not from attempts.** Rounds that
  collected answers before this table existed would otherwise read as zero. The
  gap is shown as `completedWithoutAttempt` and explained in the panel's prose.
- **The endpoint always answers `204`**, for a malformed body, a closed round or
  an unknown share code alike. Anything else turns the funnel into the share-code
  oracle the questionnaire endpoint stopped being.
- **`ABANDON_DETAIL_MINIMUM = 3`.** The median stopping question is suppressed
  below three abandoned sessions, where it would describe a person rather than a
  pattern. This is narrower than the round's privacy threshold on purpose: it
  guards a stopping point, not a result.
- **The client reports three stages only** (`opened`, `consented`, `progress`).
  `completed` is written by the submit route.
- **The beacon holds a precomputed hash.** The beacon that matters most fires
  from `pagehide`, where there is no time to await a digest.

## Assumptions

- A session that never sends a `progress` beacon but has a consent timestamp
  stopped at the first question; the panel reads that as "stopped at the consent
  screen" only when no progress was ever reported.

## Completed

Everything in scope. Schema, migration, repositories, composition wiring,
service, endpoint, submit-route completion, client beacon, panel, styles,
reset-route and `db:clear` cleanup, OpenAPI, tests.

## Remaining

Nothing on this branch. Two owner actions listed under Approval gates.

## Changed files

New: `prisma/migrations/20260810101610_add_survey_attempts/`,
`src/lib/repositories/in-memory/in-memory-survey-attempt.repository.ts`,
`src/lib/repositories/prisma/prisma-survey-attempt.repository.ts`,
`src/lib/services/survey-funnel.service.ts`,
`src/app/api/survey/[shareCode]/attempt/route.ts`,
`src/lib/survey-attempt-beacon.ts`,
`src/components/round/round-funnel.tsx`, plus four test files.

Modified: `prisma/schema.prisma`, `src/lib/types/backend.ts`,
`src/lib/repositories/interfaces.ts`, `src/lib/repositories/index.ts`,
`src/lib/repositories/prisma/prisma-client.ts`, `src/lib/composition-root.ts`,
`src/lib/services/index.ts`, `src/lib/server/manager-context.ts`,
`src/app/round/page.tsx`, `src/components/round/index.ts`,
`src/components/survey/survey-flow.tsx`, `src/app/globals.css`,
`src/app/api/survey/[shareCode]/submit/route.ts`,
`src/app/api/rounds/[roundId]/reset/route.ts`, `scripts/clear-db.ts`,
`scripts/verify-db.mjs`, `docs/openapi.yaml`, `public/openapi.json`,
`.gitignore`.

## Verification evidence

### Passed

- `npm test` — 808 tests, 0 failures. Includes the new funnel service (8),
  beacon (6) and attempt endpoint (7) suites.
- `npm run verify:db` — 32 tests against the local PostgreSQL container,
  including the six new `postgres-survey-attempts` cases.
- `npm run typecheck`, `npm run lint`, `npm run build`.
- `npm run lint:composition`, `lint:fixtures`, `lint:literals`,
  `npm run openapi:check`.
- `npx playwright test e2e/` — 9 passed.
- A browser walk on the local stack: opening `/answer/SHALOM-X1XC` wrote an
  `opened` row; a restored draft reported `consented`; answering to question 3
  and navigating away left `last_question_reached = 3` with no completion. The
  panel then rendered those numbers on `/round`, desktop and at 390px.

### Blocked or not run

- Nothing was run against the deployed database.
- `npm run verify:ai` was not run: no AI contract, prompt or version changed.

### Environment

Local only: `npm run local` on port 3000 against the `shalomut-local-db`
container.

### Residual risk

The panel's copy claims sessions rather than people; a teacher who opens the
link on a phone and again on a laptop counts twice. That is stated in the panel
itself and is the honest limit of an anonymous link.

## Approval gates

Both are closed.

- The push was the owner's, on 2026-08-10. The two branches ahead of it had to
  be rebased first: `main` had moved to `b42b509` while all three still grew
  from `50fac0f`, so the second and third pushes were refused as non-fast-forward
  until they were replayed onto it. Rebasing produced no conflict — the strategy
  commit touched four documentation files, and only
  `docs/shalomut-tracker-handoff.md` overlapped, in a different section.
- `20260810101610_add_survey_attempts` was applied to the deployed database the
  same day, with `DIRECT_URL` from `.env.deployed.local`. `prisma migrate status`
  against that host then reported all twelve applied.

## Outcome

Landed as `bf02dd1`. Verified after the rebase by diffing the pushed tree
against the pre-rebase commit: the only difference is the strategy commit's own
four files, so nothing in this slice drifted while it was replayed.

Not yet observed on the deployed endpoint: its database holds no round, so
there is no link for anyone to open and no funnel to read. The first deployed
round is what will show whether the beacons survive a real network.
