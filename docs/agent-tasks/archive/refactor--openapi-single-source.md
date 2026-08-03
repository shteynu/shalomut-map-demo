# One editable OpenAPI source and one generated mirror

## Metadata

- Branch: `refactor/openapi-single-source`
- Base branch: `main`
- Base commit: `baf229b`
- Current HEAD: this documentation commit, directly on top of `7d60b59`
- Status: complete, merged and archived. Reached `main` on 2026-08-03.
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Remove the last place in the repository where the same contract is maintained
in two hand-edited files, and replace a check that could only see part of the
document with one that sees all of it.

## User-visible outcome

None. `/openapi.json` and `/api-docs` serve the same specification, minus one
route description that disagreed with its own YAML twin.

## Context

- Stage 5 of the refactoring plan (`docs/wellbeing-refactoring-plan-v4-review.md`
  §6), listed as an open decision in `ROADMAP.md` and `PROGRESS.md`: "two
  integrity-checked mirrors, or generated from one source".
- The decision needed no product input, so it was taken as part of the work:
  YAML is the source, JSON is generated.
- The old integrity test compared `docs/openapi.yaml` against
  `public/openapi.json` for a hardcoded list of 32 AI schema names. Everything
  else — 16 paths, 21 other schemas, security schemes, tags, servers — was
  unchecked, and had already drifted.

## Scope

Delivered as described in `Completed`.

## Non-goals

- No change to what the specification says about the API beyond the one drifted
  description. Route semantics, status codes and schemas are untouched.
- No generation of the specification from the route handlers or from
  TypeScript types. The YAML remains hand-written; only the JSON is derived.

## Acceptance criteria

All met:

- `public/openapi.json` is produced from `docs/openapi.yaml` by one command.
- Editing either file without regenerating fails a check, in both directions.
- The check covers the whole document, not a list of schema names.
- `npm run verify:core` passes.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` and
  `.agents/skills/shalomut-verification/SKILL.md` both told agents to
  "synchronize JSON/YAML" after an API change. Both now say to edit the YAML
  and regenerate; they were updated in the same commit as the behaviour.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-012 records the source/mirror split and why the
  generated file stays committed.
- No AI contract version, manifest or `contracts/capabilities.json` entry is
  affected. The versioned schema names the old test listed are still present in
  the specification; they are simply no longer the only thing compared.

## Decisions made

- **YAML is the source.** It is the artifact a person reads and reviews: it
  carries comments and folded prose, and its diffs are legible. JSON is a
  serialization of it.
- **The generated JSON stays committed.** `/api-docs` fetches `/openapi.json`,
  which Next serves as a static file from `public/`. Generating it at build
  time would mean a build step for a file the repository already needs.
- **Canonical form is `JSON.stringify(spec, null, 2)` plus a trailing
  newline.** Exact bytes make the check exact. The previous JSON had a few
  hand-compacted lines in `QuestionAggregateV5`, so the first regeneration
  reflows 129 lines; nothing there changed meaning.
- **The drifted `/api/rounds/{roundId}/reset` description resolves to the YAML
  wording.** The JSON said "Deleting the responses also drops any persisted AI
  result", which reads as a cascade; `src/app/api/rounds/[roundId]/reset/route.ts`
  deletes the AI result with its own call.
- **The test spawns `openapi:check` rather than importing the generator.**
  `tsconfig.json` sets `allowJs: false` and excludes `scripts/`, so a `.mjs`
  import from a TypeScript test would not typecheck. Spawning also exercises
  the command a developer actually runs.
- **`js-yaml` is now an explicit devDependency,** pinned to the 4.2.0 already
  installed. The old test required it through `createRequire` and resolved it
  transitively from eslint, so an eslint upgrade could have broken the OpenAPI
  test.

## Assumptions

- None outstanding.

## Completed

- `scripts/generate-openapi.mjs`: `renderOpenApiJson`, `generate`,
  `findStaleReason`, and a CLI with `--check`.
- `package.json`: `openapi:generate`, `openapi:check`, and `js-yaml` in
  `devDependencies`; `package-lock.json` updated with `--package-lock-only`.
- `public/openapi.json` regenerated.
- `docs/openapi.yaml`: a header comment naming it the source.
- `src/app/api/__tests__/openapi.test.ts`: the 32-name synchronization test is
  replaced by one that runs the check. The seven semantic tests are unchanged.
- Documentation: `PROJECT_CONTEXT.md` (ADR-012, stack line, date), `PROGRESS.md`
  (architecture milestone, closed backlog item, corrected `origin/main`),
  `ROADMAP.md` (closed backlog item), `docs/README.md`,
  `ai-analytics-service/README.md`, both skills, and the plan review §6.

## In progress

- Nothing.

## Remaining

- Nothing.

## Changed files

Commit `7d60b59` (15 files, +212/−126, of which `public/openapi.json` is
+129/−42 and almost entirely reflow). The commit on top of it adds the review's
`Чем закрыто` row and this task file.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0. `lint:literals` 5/5, `npm test` 359 tests /
  0 failures, `npm run lint`, `npm run typecheck` and `npm run build` all
  clean. The test count is unchanged by this branch: one test replaced one test.
- Drift is caught in both directions, checked by hand before committing:
  editing `public/openapi.json` alone, and appending a path to
  `docs/openapi.yaml` without regenerating, each made `npm run openapi:check`
  exit 1 with the regenerate instruction. Both files were restored and the
  check passed again.
- The regeneration was diffed semantically against `HEAD:public/openapi.json`
  before committing: exactly one value differs, the `reset` description.
- `npm run verify:db` — exit 0, 7 PostgreSQL integration tests, and
  `npm run verify:ai` — exit 0, 368 Python tests. Both were run later, at the
  stack tip `d588b97`, which contains this branch; neither was expected to be
  affected and neither was.

### Failed

- None.

### Blocked or not run

- Browser check of `/api-docs`: not run. The page fetches `/openapi.json`,
  whose content is byte-verified against its source and semantically identical
  to the previously served file except for one description string.

### Environment

- local.

### Residual risk

- The generator guarantees the two artifacts are identical, not that either is
  truthful about the handlers. Status codes, auth requirements and payload
  shapes still have to be compared against the routes by hand; the verification
  skill now says so explicitly.
- `js-yaml` parses YAML 1.2 core types, so an unquoted `no` or `on` in a future
  edit would become a boolean in the JSON. Nothing in the current document
  relies on that, and the check would not catch it because both artifacts would
  agree.

## Failed approaches

- None.

## Known risks

- None specific to this branch.

## Approval gates

- None.

## Questions requiring an owner decision

- None.

## Final state

Archived 2026-08-03. Final commits `7d60b59` and `ae19d0f`, fast-forwarded into
`main` together with the identity-decision slice stacked on top of them; there
is no merge commit and no pull request — this repository merges branches
directly. The branch `refactor/openapi-single-source` is fully contained in
`main` and can be deleted.
