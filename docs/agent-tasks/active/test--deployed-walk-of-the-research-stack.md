# Test: the research-instrument stack walked on the deployed endpoint

## Metadata

- Branch: `test/deployed-walk-of-the-research-stack`
- Base branch: `main`
- Base commit: `2a958db`
- Current HEAD: `2a958db` (no commit on this branch yet)
- Status: complete. Both halves of the walk ran on the deployed endpoint, the
  throwaway data is deleted and the database is counted back to zero. One
  defect found, recorded and left for its own branch.
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

Exercise the research-instrument stack — background questions, Likert blocks,
`/breakdown` and cell suppression — on the deployed endpoint for the first time.
Every branch of that stack was verified locally, one branch at a time, against a
local production build. Nothing in it has ever run on Vercel against Supabase,
because the deployed database has been empty since 2026-08-09.

## User-visible outcome

None. This task adds no product behaviour; it produces evidence, and throwaway
data that is deleted at the end.

## Context

Owner chose this over three alternatives on 2026-08-15. The other three were
plan §7 questions 4–5, backlog §11 and backlog §8.

Everything the stack changed is described in `docs/shalomut-tracker-handoff.md`
and in the eight archived task files of the stack. The relevant gap this task
closes is stated there twice: the deployed database holds nothing, so no round
exists to break down and the rule that changed cannot fire.

## Scope

- Read-only preflight on the deployed endpoint and database.
- Throwaway school, round and responses on the deployed database, deleted with
  `scripts/clear-test-data.ts` before the task closes.
- Respondent walk against the deployed URL (public route, no sign-in).
- Manager walk against the deployed URL, which needs the owner signed in.

## Non-goals

- No product code change. If the walk finds a defect, it is recorded here and
  fixed on its own branch.
- No AI analysis run: it spends provider quota and is not what this walk is for.
- No change to secrets, credentials or deployment aliases.

## Acceptance criteria

- Every widget kind the stack added is answered by hand on the deployed
  endpoint, and the stored answer is read back from the deployed database.
- `/breakdown` is read there in at least two states: a table that publishes, and
  a table that is refused.
- The deployed database is back to 0 organizations, 0 rounds, 0 responses and
  0 answers at the end, counted rather than assumed.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, deployed-environment confirmation.
- `.agents/skills/shalomut-verification/SKILL.md` — deployed evidence is
  read-only by default; writing to it is this task's explicit scope.
- `.agents/skills/shalomut-tracker/SKILL.md` — session start, save progress.

## Relevant architecture and contracts

- `src/lib/privacy/cell-suppression.ts`, `src/lib/analytics/background-breakdown.ts`.
- `src/components/breakdown/breakdown-board.tsx`.
- `scripts/seed-breakdown-round.ts` — builds every shape this walk needs and
  refuses a non-loopback database by design.
- `scripts/clear-test-data.ts` — deletes named schools and rounds rather than
  emptying the database.

## Decisions made

- The seed script keeps its loopback default and gains `--allow-remote` rather
  than losing the guard. The guard's reasoning still holds for every other use.
- The breakdown rounds are not seeded before the owner signs in. With exactly
  one organization on the deployed database, `ManagerScopeService` lands a
  signed-in manager straight on it (`manager-scope.service.ts:46-50`); adding a
  second school first would make their first screen a scope chooser instead.

## Assumptions

- The deployed endpoint serves the merged stack. The handoff records this from
  the Vercel dashboard at `2a8f613`, with only documentation commits since.

## Completed

- Session start: git state read, `origin/main` equals the branch point, worktree
  clean.
- Deployed preflight, read-only:
  - `GET /api/health/` → 200, contract `6.0`,
    `producedContractVersionSource: "configured"`, producible `3.0`–`6.0`.
  - `GET /login/` → 200.
  - Deployed database counted directly: **0 organizations, 0 rounds, 0
    responses, 0 answers**.
  - `_prisma_migrations` on the deployed database: **13 rows, all finished**,
    matching the 13 directories in `prisma/migrations/`. Nothing is pending.
- `scripts/seed-breakdown-round.ts` gained `--allow-remote`. The loopback guard
  stays the default and now names the one case it was never arguing against.
- Seeded on the deployed database with
  `--respondent --allow-remote`: organization `local-respondent-walk-school`,
  round `round_breakdown_1786796850634`, share code `SHALOM-BACKGROUND`,
  `active`, privacy threshold 10.
- **The respondent path walked by hand on the deployed endpoint**, all fourteen
  steps of `/answer/SHALOM-BACKGROUND/`, and the stored response read back from
  the deployed database. What it proves, per widget:
  - The consent screen quotes `25 שאלות, כ־5 דקות` and the progress line reads
    `שלב N מתוך 14` — steps, not questions.
  - The 1–5 block states its five anchors once at the top and its eight
    statements below; the 1–7 block states its own seven.
  - The single-choice background question renders as its own option list with
    `מעדיף/ה לא לענות`; the numeric one as a number field; the allocation grid
    as three rows with a running total that reads `100% הסכום מלא` when full.
  - Stored: `4→75`, `2→25`, `5→100`, `3→50`, `1→0` on the positive 1–5 block,
    and `7→0`, `4→50`, `1→100` on the **negative** 1–7 block. Mixed polarity is
    in service on the deployed endpoint.
  - `background_tenure=veteran`, `background_hours=7` and three allocation rows
    `50/30/20`, each with `dimension_id: null` and `score: null` — the phase 1
    migration doing its work rather than merely being applied.
  - The two questions left unanswered — one optional block statement and the
    skipped `background_role` — are **absent** from the response, not blank.
- **The manager screens walked signed in on the deployed endpoint**, in the
  owner's connected Chrome. The owner signed in themselves; no agent saw or
  typed the password.
  - Sign-in landed straight on the one school, with no scope chooser, which is
    what `manager-scope.service.ts:46-50` says should happen at one
    organization. `פילוח קבוצות` is the seventh navigation item, between the map
    and the goals.
  - Three more rounds seeded into that school with `--allow-remote`, `--locked`
    and `--lopsided`, then `/breakdown` read in **five** states:
    1. Active round, 6 responses against a threshold of 10 — locked, and the
       message quotes the real count: `נדרשות לפחות 10 תשובות, ובינתיים יש 6.`
    2. The publishing round (14/12/4/11): `יותר מחמש שנים` and
       `שנה עד חמש שנים` publish their dimension scores; `עד שנה` is suppressed
       as `קבוצה קטנה מדי כדי להישאר אנונימית`; and the unanswered column is
       taken **with** it, labelled
       `לא מוצג כדי שלא ניתן יהיה לחשב את הקבוצה הקטנה בחיסור`. That is the
       joint suppression this branch added, firing on the deployed endpoint.
    3. The lopsided round (40/1) grouped by tenure: the table is refused whole,
       and the copy says why — a group big enough to publish, a remainder too
       small, and publishing the big one would give the remainder away by
       subtraction. It also points at the other question.
    4. The **same** round grouped by role (14/27): the table publishes. So the
       refusal is per table, not per round.
    5. The locked round, 4 responses: `ובינתיים יש 4.`
  - The builder read the same questionnaire there: 25 active questions of which
    17 required, 8 dimensions, 5 minutes, threshold 10, sections collapsible,
    and phase 4's own controls present — the answer-scale chooser offering all
    four scales including `סולם 1–7 (תדירות)`, and the scoring-direction chooser
    offering `הפוך — מענה גבוה = שלומות נמוכה`.
- **The deployed database is empty again**: the throwaway school was deleted by
  id with `scripts/clear-test-data.ts --confirm`, which reported
  `organizations: 0, rounds: 0, responses: 0, answers: 0`, and an independent
  recount agreed and added `aiAnalysisRun: 0`.

## In progress

- Nothing.

## Remaining

- Nothing in this task. The submit defect under `Known risks` is a separate
  branch, not unfinished work here.

## Changed files

- `docs/agent-tasks/active/test--deployed-walk-of-the-research-stack.md` (this
  file, untracked).
- `scripts/seed-breakdown-round.ts` (unstaged): `--allow-remote`, the renamed
  `requireSeedableDatabase`, and the header comment that says what the flag is
  for.

Nothing else is modified. The worktree was clean at branch creation, confirmed
with `git status --short` and `git ls-files -o --exclude-standard`.

## Verification evidence

### Passed

- Deployed health, login status, row counts and migration state as recorded
  under `Completed`. Read-only, 2026-08-15.
- The respondent walk on the deployed endpoint and the read-back of its stored
  answers, as recorded under `Completed`. 2026-08-15.
- `npm run typecheck` and `npm run lint` — exit 0, on the
  `scripts/seed-breakdown-round.ts` edit.
- The signed-in manager walk and the five `/breakdown` states, as recorded
  under `Completed`. 2026-08-15.
- Cleanup: `scripts/clear-test-data.ts --confirm` and an independent recount,
  both reading zero on every table. 2026-08-15.

### Failed

- `POST /api/survey/SHALOM-BACKGROUND/submit` on the deployed endpoint, twice,
  under the conditions in `Known risks`. Not a failure of this task's changes:
  nothing in this task touches that route.

### Blocked or not run

- `npm test` has not been run. Nothing under `src/` changed, and no test covers
  `scripts/seed-breakdown-round.ts`.
- A third idle-then-submit probe, which would have separated "first request
  after an idle period" from "first request of a deployment", was not run. The
  throwaway data was already deleted, so there was no round left to submit to,
  and re-seeding for it would have re-created the cleanup this task just did.
- No AI analysis was started. It spends provider quota and is not what this
  walk is for, so nothing here says anything about contract `6.0` at runtime.
- The dashboard, the round screen and the goals screen were not walked. They
  are older than this stack and were exercised on the deployed endpoint on
  2026-08-11.

### Environment

- Deployed: `shalomut-map-demo.vercel.app` and the Supabase database named in
  `.env.deployed.local`.
- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- The submit defect under `Known risks` is open. Its cause is a reading that
  fits two reproductions, not a diagnosis: nobody has looked at the deployment's
  own function logs, which needs the owner's dashboard.
- Everything here ran against seeded data. No real school has used any of it,
  and the deployed database is empty again, so the next round created there is
  still the first one a person will meet.
- One screenshot during the walk showed a stale paint — the round-selector
  `form_input` set the value without triggering the navigation, and the screen
  still showed the previous round's refusal while the chooser read the new
  question. It looked exactly like a defect in the role table and was not. Read
  the URL as well as the screen before calling a breakdown state wrong.

## Failed approaches

- None.

## Known risks

- **The first submit after an idle period fails with no response at all.**
  Reproduced twice on 2026-08-15, by two different clients:
  - In the browser, `POST /api/survey/SHALOM-BACKGROUND/submit` failed with
    `net::ERR_EMPTY_RESPONSE` and the screen said
    `לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.` The same button pressed
    again succeeded with 200, and the database holds **one** response for the
    two presses, so the failed attempt wrote nothing.
  - From `curl`, the first request carrying a payload that would actually be
    stored hung for **12.8s** and returned `status:000` — no response. The five
    that followed it succeeded in 1.8–3.0s each.

  What was ruled out: `trailingSlash: true` forces a 308 on this POST, because
  `survey-flow.tsx:449` posts to `/submit` without the slash. That is not the
  cause — two control POSTs from the same browser to uncached URLs followed the
  redirect correctly (`redirected: true`, reaching `/submit/`), and `curl -L`
  carried the body through the 308 in 0.96s to a 400 on the validation path.

  What fits both reproductions: the request that has to open a database
  connection is the one that dies, and only when it is the first for a while.
  The validation-only 400 never touches Prisma and answered in under a second;
  every warm write answered in about two.

  Consequence if it reaches a pilot: the first person to answer after a quiet
  period is told the server is unreachable, and has to press send a second time.
  Nothing is lost and nothing is duplicated, but it lands on the one action the
  product exists for. Not fixed here — this task changes no product code.
- Writing throwaway data to the deployed database. Mitigated by deleting it by
  id with `scripts/clear-test-data.ts` and counting the database back to zero,
  which is the pattern the 2026-08-11 deployed walk established.

## Approval gates

- None triggered. No secrets, credentials, authentication configuration or
  deployment aliases are touched. Creating and deleting deployed data needs no
  approval ritual under `AGENTS.md`; the owner named the target environment when
  choosing this task.

## Questions requiring an owner decision

- The submit defect needs the deployment's function logs, which only the owner
  can open. Until someone reads them, the cold-start reading stays a reading.

## Next concrete step

Open a branch for the submit defect under `Known risks`. Start by reading the
deployment's function logs for the two failed requests — that needs the owner's
Vercel dashboard, and it is the one thing that would turn the cold-start reading
into a diagnosis.
