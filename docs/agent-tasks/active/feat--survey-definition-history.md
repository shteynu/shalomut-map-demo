# Questionnaire version history and restore

## Metadata

- Branch: `feat/survey-definition-history`
- Base branch: `main`
- Base commit: `5616e66`
- Current HEAD: `5616e66` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close `docs/product-behaviour-backlog.md` §1 — draft persistence and recovery —
by giving the questionnaire a history the manager can go back to, instead of
only a timestamp saying when the current one was written.

## User-visible outcome

The survey builder gains a `היסטוריית שאלון` panel listing the round's saved
questionnaires, newest first, each named by when it was saved and how many of
its questions were active. Any earlier entry can be loaded into the editor with
one button; the current questionnaire does not change until the manager presses
save. The panel is absent for a round with fewer than two saved versions —
there would be nothing to offer.

## Context

Since 2026-08-04 both save surfaces report the stored `updated_at`, so a
manager knows when the questionnaire last reached the database. That does not
help after a bulk edit: hiding twelve questions in one click is a single save,
and nothing kept what was there before it.

## Scope

- A `survey_definition_versions` table, its migration, its port and both
  adapters.
- Recording a version from the existing questionnaire `PUT`.
- Two read endpoints — the list of summaries, and one version whole.
- The builder panel and the editor-side load.

## Non-goals

- A restore endpoint. Restoring is the ordinary save (ADR-019).
- Diffing two versions on screen. The list says how many questions were active;
  a real diff view is a separate decision.
- Versioning the school's setup details. §1 is about the questionnaire; the
  setup screen writes organization fields, which no bulk action rewrites.

## Acceptance criteria

- A save that changes the questionnaire adds exactly one version.
- A save that changes nothing adds none.
- An earlier version reads back byte-identical and can be saved again.
- The history survives `POST /api/rounds/{id}/reset` and dies with the round.
- A version id from another round is a 404, not another school's questionnaire.
- No respondent data reaches the new table.

## Relevant repository instructions

- `AGENTS.md`: composition root is the only place that constructs a repository;
  OpenAPI is generated from `docs/openapi.yaml`.
- `.agents/skills/shalomut-verification`: the diff carries a migration and a
  Prisma adapter, so `verify:db` is required, not optional.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-019 records the four decisions below.
- No published contract (`1.0`–`6.0`) is touched: versions never leave Core for
  the AI service.

## Decisions made

- **Restore is the existing `PUT`.** It already validates, already refuses to
  replace the questions of a round that has answers, and already activates a
  complete draft. A restore route would duplicate all three. A restore is
  therefore itself a version, so it is reversible and the undone edit stays in
  the history.
- **An unchanged save records nothing.** `isSameSurveyDefinition` compares the
  question snapshot plus the copy the respondent reads.
- **Twenty versions per round.** Recovery, not an archive. The prune deletes by
  id after ordering rather than by a timestamp cutoff, because two saves can
  share a millisecond.
- **Reset leaves the history alone.** Reset clears what respondents produced;
  the questionnaire is what the manager wrote. The cascade from the round owns
  the deletion instead, which is why the port has no delete method.

## Assumptions

- A manager who loads a version wants to review it before it takes effect. The
  panel says so in the note under the list rather than saving on their behalf.
- Twenty is enough for a school editing a questionnaire over a few weeks. The
  constant is one export away from being raised if it turns out not to be.

## Completed

All of the scope above. `npm run verify:core` (589 tests) and `npm run
verify:db` (25 tests) both pass.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

New:
- `prisma/migrations/20260805170000_add_survey_definition_versions/migration.sql`
- `src/lib/types/survey-definition-version.ts`
- `src/lib/repositories/in-memory/in-memory-survey-definition-version.repository.ts`
- `src/lib/repositories/prisma/prisma-survey-definition-version.repository.ts`
- `src/lib/survey-definition-versions.ts`, `src/lib/survey-definition-versions-client.ts`
- `src/app/api/rounds/[roundId]/survey-definition/versions/route.ts`
- `src/app/api/rounds/[roundId]/survey-definition/versions/[versionId]/route.ts`
- `src/components/survey/survey-builder/survey-builder-history.tsx`
- Tests: `src/lib/repositories/__tests__/survey-definition-versions.test.ts`,
  `src/app/api/__tests__/survey-definition-versions-route.test.ts`,
  `src/lib/repositories/__dbtests__/postgres-survey-definition-versions.test.ts`

Modified: `prisma/schema.prisma`, `src/lib/repositories/{index,interfaces}.ts`,
`src/lib/repositories/prisma/prisma-client.ts`, `src/lib/composition-root.ts`,
`src/lib/survey-definition.ts`, the questionnaire `PUT` and the reset route,
`src/components/survey/survey-builder.tsx`, `src/app/globals.css`,
`scripts/verify-db.mjs`, `docs/openapi.yaml`, `public/openapi.json`,
`PROJECT_CONTEXT.md`, `docs/product-behaviour-backlog.md`.

Untouched and pre-existing: `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 589 tests, 589 pass. Includes lint, types,
  the four fitness checks, the production build and 13 tests new to this slice.
- `npm run verify:db` — 25 tests, 25 pass, against the disposable local
  PostgreSQL on `127.0.0.1:5433`. The five new ones cover the round trip through
  the table, the retention cap, same-millisecond saves, cross-round scoping and
  the cascade.

### Failed

None.

### Blocked or not run

- No browser evidence. The panel was not exercised in a running browser; its
  behaviour is covered by the route tests and by the in-memory repository tests,
  not by a screenshot.

### Environment

Local. Nothing deployed from this branch; the deployed database has not seen
the migration.

### Residual risk

- The migration has run only against the local test database. The deployed one
  takes it on the next deploy, and a Prisma client generated before it throws a
  named error from the repository rather than a `TypeError` inside a route.

## Failed approaches

- The first builder effect set state in its own body and tripped
  `react-hooks/set-state-in-effect`. The fetches moved into
  `src/lib/survey-definition-versions-client.ts` and the effect now subscribes
  to a result, the shape `useAiInsights` already uses.
- `setAudience` does not exist — `audience` is a const in the builder. A loaded
  version therefore cannot carry a different audience, which is stated in a
  comment rather than silently true.

## Known risks

- Retention is enforced per write. A round whose versions were written by an
  older build would keep more than twenty until its next save prunes them. No
  such build has ever run.

## Approval gates

None. No secret, credential, authentication setting or deployment alias is
touched.

## Questions requiring an owner decision

- Whether the history should be visible for a round whose questions are frozen
  by a first answer. It currently is: the list reads, the load button is
  disabled with a Hebrew explanation.

## Next concrete step

The owner pushes: `git push origin feat/survey-definition-history:main`.
