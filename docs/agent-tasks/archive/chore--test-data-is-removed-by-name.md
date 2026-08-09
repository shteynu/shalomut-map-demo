# Test data on the deployed endpoint is removed by name, not by emptying

## Metadata

- Branch: `chore/test-data-is-removed-by-name`
- Base branch: `docs/deployed-verification-2026-08-09`
- Base commit: `0bc3e86`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `a788a0c`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Clear the throwaway data the 2026-08-09 deployed smoke and verification walks
left on the deployed database, without touching the manager's own schools.

## Context

The only existing tool is `npm run db:clear`, which empties every table. That is
right for a local reset and wrong here: the deployed database holds the
manager's own two schools beside the walk's leftovers, and emptying it would
also remove the organizations, leaving the deployed app on `scope-required`
until setup is run again. No delete endpoint exists for schools or rounds — the
only `DELETE` handler in the API is for a round goal.

### What is actually on the deployed database

Read through the signed-in browser on 2026-08-09, each round fetched scoped to
its own school. The first attempt at this was wrong and is worth recording: the
fetches carried `?school=`, which re-scoped the session cookie, so every later
round resolved cross-school to `round-not-found` and reported the wrong school.

| school | id | round | title | status | responses |
| --- | --- | --- | --- | --- | --- |
| בית ספר בדיקת E2E | `ff5625a8` | `b19be646` | סבב שלישי E2E | active | 0 |
| בית ספר בדיקת E2E | `ff5625a8` | `2d0b109e` | סבב שני E2E | draft | 0 |
| בית ספר בדיקת E2E | `ff5625a8` | `f1cc7f0a` | סבב ראשון E2E | closed | 10 |
| טסט | `34d05e66` | `9c78768b` | סבב בדיקה E2E 2 | active | 10 |
| טסט | `34d05e66` | `f9c18f1c` | 1 | closed | 10 |
| טסט מקס | `03385396` | `f15cd0a4` | 1 שבוע | draft | 0 |

`ff5625a8` is entirely the walk's: the school and all three of its rounds were
created during the smoke and the verification. `9c78768b` is named as a test
round but sits in one of the manager's own schools and is the round that carries
the unlocked analytics and the round-over-round deltas — deleting it leaves
`טסט` with only its closed round. The other three rows predate this work.

## Decisions made

- **Delete by id, not by emptying.** `scripts/clear-test-data.ts` takes
  `--school=` and `--round=` and removes only those. `db:clear` stays as it is,
  for the local reset it was written for.
- **Nothing deletes without `--confirm`.** Without it the script reads the
  targets, names each one with its school, title, status and response count, and
  stops. The dangerous command and the safe one differ by one flag that has to
  be typed.
- **A missing id is reported, not an error.** Re-running after a partial run is
  safe, which matters when the owner runs the command and the agent cannot.
- **No manual delete ordering.** Every relation cascades from `Organization` and
  from `SurveyRound`, so a school takes its rounds, goals, questionnaire
  versions, AI runs, responses and answers with it. Rounds are deleted before
  schools only so that a round belonging to a school on the same command line is
  not reported as having vanished on its own.
- **The scope was the owner's to set.** All three deployed schools carry
  test-looking names, so "clean the test data" had two honest readings and the
  deletion is irreversible. The unambiguous half was handed over as one command
  and the round in `טסט` as a separate one, with what it costs; the owner chose
  the E2E school only.

## Non-goals

- No delete endpoint. Deleting a school from the UI is a product decision with
  its own confirmation design; this is an operational tool.
- Emptying the deployed database. If that is ever wanted, `db:clear` already
  does it.

## Changed files

- `scripts/clear-test-data.ts` — new
- `package.json` — `db:clear:targeted`

## Verification evidence

### Passed

- `npm run typecheck` clean; `npx eslint scripts/clear-test-data.ts` clean.
- **Proven against a real database**, locally, with rows made for the purpose: a
  throwaway school with a round and a response, plus a second throwaway round
  placed inside the seeded school so that the two paths were exercised
  separately.
  - Dry run printed all four targets, including a school id that does not
    exist, and wrote nothing.
  - `--confirm` deleted 1 school and 2 rounds. The seeded school and its four
    rounds survived, and the response under the deleted round went with it
    (`responses` back to 24, `answers` 576 — the seeded counts).
  - Re-running the same command reported both ids absent, deleted 0 and 0, and
    left the counts unchanged.
- No arguments exits with a message rather than doing anything.
- **Run against the deployed database on the owner's instruction**, with
  `DATABASE_URL` read from `.env.deployed.local`. The script printed
  `aws-1-ap-northeast-2.pooler.supabase.com`, which is how the target was
  confirmed before anything was written. `dotenv/config` does not override an
  environment variable that is already set, so the repository `.env` did not
  pull the run back to the local container.
  - Dry run: `בית ספר בדיקת E2E (3 rounds)`.
  - `--confirm`: 1 school deleted. Remaining `{ organizations: 2, rounds: 3,
    responses: 20, answers: 510 }` — the two manager schools, their three
    rounds and the 20 responses that were there before the walks.
  - Read back through the signed-in browser: the setup school list is now
    `טסט` and `טסט מקס`, and the E2E school is gone from it.
- No environment default pointed at the deleted school:
  `MANAGER_ORGANIZATION_ID` is `34d05e66` in `.env`, `.env.deployed.local` and
  `.env.staging.local`.
- **After the push, the endpoint was walked again.** Both surviving schools
  load, and `טסט`'s map still renders its comparison: nine delta chips, each on
  `--surface` (`rgb(255, 250, 240)`) with an 8px radius, two of them `±0` in
  `--muted`. Deleting a school took nothing else with it.

### Not run, and why

- `npm run verify:core`, the e2e suite and the Python suite: this diff is one
  operational script and a package script, and touches no application code,
  schema, contract or UI.

### Environment

local for the proof, deployed for the deletion.

## Observed while verifying

A session whose `shalomut_school` cookie names a school that no longer exists
lands on `נדרש שיוך לבית ספר` with no way out — no school switcher, the same
dead end that finding #6 fixed for `round-not-found`. It is reachable only when
a school is deleted out from under an open session, which is why it did not come
up in the smoke. The browser session used here was put back on `טסט`
afterwards. Not fixed in this task; recorded so it is not rediscovered.

## Residual risk

- The script trusts the ids it is given. It names each target before deleting,
  which is the whole defence — the dry run is meant to be read, not skipped.
- The enumeration above is the reading that preceded the deletion. It is
  history now; a later run's dry-run output is the authority, not this table.

## Approval gates

The deletion was the owner's call and was given for the E2E school only. The
round `9c78768b` (סבב בדיקה E2E 2) inside `טסט` was deliberately left alone: it
is named like a test round but carries the unlocked analytics and the
round-over-round deltas, and it sits in one of the manager's own schools.

## Next concrete step

None. The branch is on `origin/main` and the deletion is done. If the
scope-required dead end recorded above is ever taken up, it is its own task:
`loadSchoolChoices` already exists and would need the `scope-required` state
added beside `round-not-found`.
