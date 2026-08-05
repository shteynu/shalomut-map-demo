# Fixtures out of the runtime barrel

## Metadata

- Branch: `chore/fixtures-out-of-runtime`
- Base branch: `main`
- Base commit: `514cb07`
- Current HEAD: `514cb07` plus this slice
- Status: implemented and verified; the push is the owner's
- Last updated: 2026-08-05
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close `docs/product-behaviour-backlog.md` §7 — demo data boundaries — by making
the boundary enforced rather than asserted.

## User-visible outcome

None. This is provenance: an empty database has to read as empty, and no
production import path may reach a fixture.

## Context

Most of §7 was already true. Stone geometry and labels live in
`dimension-presentation.ts`; no view component carries a score threshold. What
was not true was the location of the fixtures: `DEMO_ORGANIZATION` and
`DEMO_ROUND` — a school with an active round and `SHALOM-DEMO` — were exported
from `src/lib/repositories/index.ts`, the barrel route handlers import adapters
from. Only tests used them, but nothing held that line.

## Scope

- Move the fixtures to `src/lib/repositories/__fixtures__/demo-records.ts` and
  repoint the five test files.
- Add `scripts/check-runtime-fixtures.mjs` with its own tests, wired into
  `verify:core` as `lint:fixtures`.
- Rename the CSS class `dashboard-mock-page` to `dashboard-page`.

## Non-goals

- No change to what any screen renders, to the repositories, or to the
  in-memory adapters themselves.
- No attempt to reconcile the label differences between
  `dimension-presentation.ts` and `surveyInstrument`; that is a product
  decision, recorded in the module's own comment.

## Acceptance criteria

- No runtime module can import a fixture without failing the build.
- The barrel cannot start defining `DEMO_` constants again without failing it.
- `verify:core` stays green.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Sits beside the composition-root fitness check, which owns the neighbouring
rule — repositories are constructed in one place. No contract, schema,
migration or route change.

## Decisions made

- The rule is about reachability, not intent. A comment saying "for tests" next
  to an export from a runtime barrel is not a boundary.
- The check fails in both directions. A one-directional check would pass
  happily on a repository whose fixtures had been moved back into a runtime
  module, because then nothing would import a `__fixtures__` path at all.
- `__fixtures__` in the path, so the boundary is visible where the import is
  read rather than only in a script.

## Assumptions

- None.

## Completed

- The move, the five repointed test files, the check, its five tests, the
  `lint:fixtures` wiring, the class rename and the backlog entry.

## In progress

- Nothing.

## Remaining

- The push is the owner's action.

## Changed files

- `src/lib/repositories/__fixtures__/demo-records.ts` (new)
- `src/lib/repositories/index.ts`
- `src/app/api/__tests__/{api,mcp-integration,round-goals-route}.test.ts`
- `src/lib/repositories/__tests__/repositories.test.ts`
- `src/lib/__tests__/composition-root.test.ts`
- `scripts/check-runtime-fixtures.mjs`, `scripts/check-runtime-fixtures.test.mjs` (new)
- `package.json`
- `src/app/globals.css`, the four `dashboard-*-page.tsx` components
- `docs/product-behaviour-backlog.md`
- `docs/agent-tasks/active/chore--fixtures-out-of-runtime.md` (new)

## Verification evidence

### Passed

- `npm run verify:core` — exit code 0: 576 TypeScript tests, four fitness
  checks including the new one, `typecheck`, ESLint and the production build.
- `node --test scripts/check-runtime-fixtures.test.mjs` — 5 tests, 0 failures.
- **The check was made to fail on purpose, twice**, before it was trusted: a
  temporary `src/lib/__guard-probe.ts` importing the fixture exited 1 naming
  that file and line, and a `DEMO_ROUND` re-added to the barrel exited 1 naming
  the barrel. Both probes were removed; `git status` is clean of them.

### Failed

- None.

### Blocked or not run

- `verify:db` and `verify:ai`: no schema, migration, repository behaviour,
  route or Python change.
- Browser smoke: not run. The only user-facing edit is a CSS class rename with
  the same rules attached, and the production build compiles the four screens
  that carry it.

### Environment

Local.

### Residual risk

- The rename is textual. If a stylesheet outside `src/` or a test asserted on
  the old class name it would not have been caught by the build — nothing
  outside `src/` did, checked by grep.

## Failed approaches

- None. One self-inflicted mistake worth remembering: `git checkout` on
  `index.ts` during the failure probe reverted the real edit to the version in
  the index, because the edit was never staged. It was reapplied and
  re-verified.

## Known risks

- The check reads imports line by line, so an import split across lines with
  the specifier on its own line is matched, but a specifier built at runtime
  from a variable is not. That is the same limit the composition-root check
  has.

## Approval gates

- None touched.

## Questions requiring an owner decision

- None.

## Next concrete step

Hand the push over: `git push origin chore/fixtures-out-of-runtime:main`.
