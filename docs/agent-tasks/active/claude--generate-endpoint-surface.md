# The endpoint surface table is generated, not written

## Metadata

- Branch: `claude/generate-endpoint-surface`
- Base branch: `main`
- Base commit: `f0d868d`
- Current HEAD: this commit
- Status: delivered on the branch; not merged
- Last updated: 2026-08-18
- Last agent/tool: Claude Code

## Objective

Stop the endpoint surface table in `docs/ai-analysis-run-lifecycle.md` from
being hand-written, and make the repository fail when the table and the routes
disagree — in either direction.

## User-visible outcome

None. This is documentation infrastructure: no product screen, API or database
behaviour changes.

## Context

The table was written by hand and went stale within a day of being written.
`main` gained `GET /api/v1/fallback-status`, the table went on claiming to
enumerate the boundary without it, and nothing in the repository noticed — the
drift was caught by a rebase, which is luck rather than a process. A table that
promises completeness is worse incomplete than absent.

The repository already has the pattern for this: `openapi.yaml` is the editable
source, `public/openapi.json` is generated from it, and `openapi:check` runs
inside `npm test`. This applies the same shape to one section of a living
document rather than to a whole file.

## Scope

- `scripts/generate-endpoint-surface.mjs` — the generator and its `--check` mode.
- `docs/ai-analysis-run-lifecycle.md` — generated markers around the table, plus
  prose saying the section is generated.
- `src/app/api/__tests__/endpoint-surface.test.ts` — runs `--check` so `npm test`
  enforces it.
- `package.json` — `docs:endpoints`, `docs:endpoints:check`.
- `docs/README.md` — the paragraph explaining what is generated and what is not.

## Non-goals

- Generating any other section of any document. The contract version matrix, the
  dimension and band tables and the queue constants are candidates, and none of
  them is touched here.
- Publishing docs anywhere — no Wiki sync, no GitHub Pages. That question is
  still open and unanswered.
- Changing any route, secret or handler.

## Acceptance criteria

- `npm run docs:endpoints` rewrites the table between its markers.
- `npm test` fails when a route exists that the table lacks.
- `npm test` fails when the table is edited by hand.
- `npm test` fails when a declaration names a route that no longer exists.
- The failure message names the endpoint and says what to do about it.

## Relevant repository instructions

`AGENTS.md`: current code outranks prose, and a living document that disagrees
with the code is fixed in the same task. This makes that rule enforceable for one
section instead of trusting it.

`docs/README.md` already documents the generated-artifact rule for OpenAPI; the
new paragraph puts the endpoint table under the same heading.

## Relevant architecture and contracts

- ADR-006 keeps `POST /api/v1/webhook/events` as a rollback boundary rather than a
  source of execution truth. It is a live route, so it is in the table, declared
  as `legacy, dispatched by nothing`.
- ADR-010 closes `POST /api/v1/rounds/:round_id/analyze` outside `development`.
  That route is guarded by environment rather than by a secret, so its secret
  column reads `none` and the declaration says so — the empty column is not a gap.

## Decisions made

- **The generator derives what the code knows and refuses to guess the rest.**
  Which routes exist, which methods they answer and which secret guards each one
  are read from the source. Direction and answer codes are declared in the script,
  because a machine can see that a route exists and cannot see who calls it.
- **An undeclared endpoint fails the check** rather than being skipped or
  guessed at. The intended failure is "CI asks you to classify the new endpoint",
  never "the document quietly stopped being true".
- **The rule runs backwards too**: a declaration whose route is gone fails, so
  deleting a route cannot leave a row behind.
- **Core is collected by `hasConfiguredSharedSecret`, not by a list of paths.**
  That call is what makes a route part of this boundary, so a new machine-called
  route is found without anyone remembering to extend a list. The check is read
  per exported handler, because one file can hold a manager-authenticated `GET`
  beside a secret-authenticated `POST`, and only the latter belongs here.
- **Rows are rendered in declaration order.** File order is not reading order:
  routes sort by directory name and FastAPI decorators by position in `main.py`,
  and neither knows that the three public paths belong together or that a run
  begins with `claim`. The set of rows is checked against the code; only their
  sequence is chosen by a person.
- **`[runId]` and `{round_id}` both render as `:name`**, so one table reads one
  way across two frameworks.

## Assumptions

- Every Core route the worker calls authenticates through
  `hasConfiguredSharedSecret`. This holds for all five today. A route that
  authenticated some other way would be invisible to the collector — the failure
  mode is a missing row, not a wrong one, and it is the same failure mode the
  hand-written table had.
- Every AI service route is declared with an `@app.<method>("...")` decorator in
  `main.py`. There is no router mounted from another module today.

## Completed

- `scripts/generate-endpoint-surface.mjs` with `--check`, mirroring
  `generate-openapi.mjs`.
- Markers and explanatory prose in `docs/ai-analysis-run-lifecycle.md`.
- `src/app/api/__tests__/endpoint-surface.test.ts`.
- `package.json` scripts.
- `docs/README.md` paragraph.

## In progress

Nothing.

## Remaining

Nothing on this branch. Merging is the user's call, separately.

## Changed files

- `scripts/generate-endpoint-surface.mjs` (new)
- `src/app/api/__tests__/endpoint-surface.test.ts` (new)
- `docs/ai-analysis-run-lifecycle.md`
- `docs/README.md`
- `package.json`

## Verification evidence

### Passed

- Drift proven in both directions before shipping, by temporarily adding a route
  and by hand-editing the table:
  - undeclared route → `These endpoints exist in the code and are not
    declared … GET /api/v1/drift-probe`, exit 1.
  - hand-edited table → `the endpoint surface table … does not match`, exit 1.
  - regenerated → `Endpoint surface check passed: 12 endpoints`. The probe left
    no trace: `git status` showed `main.py` unmodified afterwards.
- `npm test` → `ok 36 - Endpoint surface documentation`.

### Failed

None.

### Blocked or not run

None.

### Environment

Local. No database or deployed environment is involved in this change.

### Residual risk

Low. Nothing shipped here executes at runtime; the generator runs in
`npm test` and on demand.

## Failed approaches

An earlier declaration had `POST /api/v1/rounds/:round_id/analyze` guarded by a
secret. It is not: the handler raises 404 outside `development`, so the guard is
the environment. Corrected before commit.

## Known risks

The collector recognises exactly two authentication shapes — the
`hasConfiguredSharedSecret` call on Core and the `settings.ai_webhook_secret`
comparison in the service. A third shape would be silently missed. Introducing
one is the moment to extend the collector.

## Approval gates

None. No credentials, secrets, deployment aliases or database state are touched.

## Questions requiring an owner decision

- Which generator comes next, if any: the contract version matrix, the dimension
  and band tables, or the queue constants table in this same document.
- Whether generated documentation is published anywhere (Wiki, GitHub Pages) or
  stays in the repository. Unanswered, and nothing here depends on it.

## Next concrete step

Merge `claude/generate-endpoint-surface` into `main` when the user asks for it.
