# The archive is read-only

## Metadata

- Branch: `feat/archived-rounds-read-only`
- Base branch: `main`
- Base commit: `d02d5fa`
- Current HEAD: `d02d5fa` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the last open line of `docs/product-behaviour-backlog.md` §10 — whether an
archived round should be read-only.

## User-visible outcome

An archived round's screen no longer offers `איפוס נתונים` or `רענון ניתוח`, and
its questionnaire opens frozen. The note under the actions says the round is
read-only and that its goals are not. Everything else about an archived round is
unchanged: its URL, its dashboard, its stored analysis and its place in the
comparison history.

## Context

§10 called this "a separate decision". It turned out to rest on a leak rather
than on a preference: `RoundService.isTransitionAllowed` lists `archived: []`,
but `POST /api/rounds/{id}/reset` writes `draft` through
`roundRepo.updateStatus` without consulting that table. Resetting an archived
round therefore returned it to the everyday list as a draft — a way out of a
terminal state. `POST /api/rounds/{id}/trigger-ai` had no status check at all.

## Scope

- One guard, `src/lib/server/archived-round-guard.ts`, used by three routes.
- The round screen and the builder page's frozen condition.
- Tests, OpenAPI, ADR-018 amendment, backlog §10, `PROGRESS.md`.

## Non-goals

- Freezing goals. Owner decision below.
- Any transition out of `archived`. It stays terminal; nothing un-archives.
- Touching the read paths. The dashboard, the analytics route and the version
  history all still serve an archived round.

## Acceptance criteria

- Reset, the manual analysis run and the questionnaire save answer `409` with
  `code: round_archived` on an archived round.
- A closed round can still be reset — the guard is about `archived`, not about
  "finished".
- Creating and advancing a goal on an archived round still works.
- The screen offers nothing the routes would refuse.

## Relevant repository instructions

- `AGENTS.md`: OpenAPI is generated from `docs/openapi.yaml`; edit the source and
  commit the generated `public/openapi.json`.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-018, amended by this task.
- No published contract is touched: nothing here changes what Core sends the AI
  service, only whether it enqueues a run at all.

## Decisions made

- **Goals keep moving on an archived round.** Owner decision 2026-08-05. They
  are the school's own work rather than part of the measurement; freezing them
  would mean a school either never files a round or gives up finishing what the
  round started. Reset still deletes goals — but reset no longer reaches an
  archived round.
- **The questionnaire save is guarded too**, even though a round with answers
  already refuses a changed question snapshot. A draft can be archived without
  ever taking an answer, and that round's questionnaire was still editable.
- **`409`, not `403`.** The request is authorized and well formed; what refuses
  it is the state of the round.
- **The guard lives in the routes, not in the repository.** The repository is
  also what a reset of a *live* round legitimately uses, and a rule there would
  have to know why it was being called.

## Assumptions

- Nobody wants an archived round un-archived. `archived: []` has said so since
  the status existed; this task makes it true rather than reversing it.

## Completed

All of the scope above. `npm run verify:core` exit 0 with 596 tests, up from
589: five route tests and two on the round screen.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

New: `src/lib/server/archived-round-guard.ts`,
`src/app/api/__tests__/archived-round-read-only.test.ts`.

Modified: the reset, trigger-ai and survey-definition routes;
`src/components/round/round-controls.tsx` and its test; `src/app/survey/page.tsx`;
`docs/openapi.yaml` and the generated `public/openapi.json`;
`PROJECT_CONTEXT.md`, `docs/product-behaviour-backlog.md`, `PROGRESS.md`.

Untouched and pre-existing: `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 596 tests, 596 pass. Includes lint, types, the
  four fitness checks and the production build.
- The reset test was watched to fail before the guard existed: with the two
  guard lines removed from the route, `resetting an archived round is refused`
  fails and the round comes back as `draft`. That is the leak, reproduced.

### Failed

None.

### Blocked or not run

- `verify:db` — no schema, migration or repository change in the diff.
- `verify:ai` — no Python change.
- No browser evidence. The round screen is behind `/login`, and the manager
  password is the owner's to type. The screen's two behaviours are covered by
  rendering tests instead.

### Environment

Local. Nothing deployed from this branch.

### Residual risk

- An archived round that a worker is already analysing when it is archived will
  still finish and store its result. The guard refuses new runs; it does not
  cancel a lease. This is narrow — archiving requires a closed round and the
  manager has to press both buttons within the same job — and cancelling a
  claimed lease is a different mechanism.

## Failed approaches

- The first OpenAPI edit broke the YAML twice: `refused: writing` and
  `` `code: round_archived` `` both put `: ` inside a plain scalar, and
  `openapi:generate` refused to parse. Rephrased rather than quoted.

## Known risks

None beyond the residual risk above.

## Approval gates

None.

## Questions requiring an owner decision

None open.

## Next concrete step

The owner pushes: `git push origin feat/archived-rounds-read-only:main`.
