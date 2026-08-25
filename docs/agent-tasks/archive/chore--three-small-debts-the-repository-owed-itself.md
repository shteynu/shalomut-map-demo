# Three small debts the repository owed itself

## Metadata

- Branch: `chore/three-small-debts-the-repository-owed-itself`
- Base branch: `main`
- Base commit: `04f63a4`
- Current HEAD: `96ab5b4`, three commits on `04f63a4` — `bf1b2c1`, `8d59f3b`, `96ab5b4`
- Status: complete, verified and landed on `main` as `2c2f5da`
- Last updated: 2026-08-25
- Last agent/tool: Claude Opus 5 / Claude Code

## Objective

Three unrelated small items, asked for in this order and delivered as three
commits. They share only their size and the fact that nothing else in the
backlog is startable without an owner decision or the methodologist's mapping.

1. **The documents catch up with the code.** Four statements were true when
   written and are not true now.
2. **A script for publishing `docs/*.html`.** The transformation is performed by
   hand and re-derived by whoever publishes next.
3. **The last full-JSON read of a school's round list.** ADR-051 moved the
   manager screens to a summary read and left one caller behind.

## User-visible outcome

None from any of the three. (1) and (2) are repository hygiene; (3) is a read on
an administrator write path.

## Context

The question that opened the session was "what is left to do in code". The answer
was: almost nothing that an agent can start. The research instrument's phases 5
and 6 wait on the methodologist's item-to-dimension mapping, and all eight
partly-closed records of the 2026-08-21 audit name remainders that are owner
decisions, environment scope or considered holds. These three are what was left
that needs no one else.

## Scope

- `PROGRESS.md` — the multi-tenancy paragraph said phases 4, 5 and 6 remain; all
  three landed (`2576b99`, `85d5676`, `5089fb2`).
- `docs/shalomut-tracker-handoff.md` — three superseded facts inside a document
  whose own rule is to replace rather than append: an abandoned count of open
  audit records, phase 6 described as deferred and undecided, and the audit-log
  question described as open.
- `docs/multi-tenancy-plan-2026-08-20.md` — phases 4 and 5 annotated as
  implemented, in the same style phase 6 already carried, and the phase-3 bullet
  that called the log-reading question open.
- `docs/agent-tasks/active/feat--the-school-does-not-read-its-own-log.md` — moved
  to `archive/`; it said unpushed and `origin/main` carries it.
- Then: a publishing script under `scripts/`, and `closeOtherActiveRounds` in
  `src/lib/services/round.service.ts`.

## Non-goals

- Rewriting dated plans and the audit's own ledger. `docs/critical-audit-2026-08-21.md`
  was checked and left alone on purpose — its record bodies are dated layers and
  its `Открытых записей N` feed is declared abandoned-and-kept in the document
  itself, so what reads as a contradiction there is the format working.
- Anything gated on the owner or the methodologist.

## Acceptance criteria

- No living document states a fact the code contradicts.
- Publishing a `docs/*.html` page is one command that someone else can repeat.
- A school's active-round check stops reading whole questionnaires.

## Relevant repository instructions

- `AGENTS.md` — documentation lifecycle: current code outranks prose, and dated
  plans are preserved rather than rewritten.
- `.agents/skills/shalomut-tracker/SKILL.md` — memory boundaries; each global
  document is edited only where it owns the state that changed.

## Decisions made

1. **Annotate the plan, do not rewrite it.** Phase 6 already carried an
   `Implemented 2026-08-23` line, so phases 4 and 5 got the same shape.
2. **The handoff stops keeping its own count of audit records.** It now names
   `npm run lint:audit-count` as the authority instead of carrying a second
   ledger, which is the thing that went stale.
3. **The publishing script refuses rather than repairs.** A body still pointing
   at `vendor/`, a second page skeleton or a missing `<title>` are each a
   question about the document, not something to paper over on the way out.
4. **The two mermaid hazards are reported, not refused.** A `;` in a label and a
   real `<br/>` are legal HTML; a page could want either. What they must not be
   is invisible.
5. **`lint:docs-publish` joined `verify:core`.** The transformation itself takes
   an argument, so it cannot be a gate; its tests can, and they are what notices
   a document that has stopped publishing.
6. **`findByOrganizationId` was removed, not left uncalled.** Moving the sweep
   onto the summary read left it with no production caller. ADR-055 — the commit
   this branch sits on — took the same decision about an uncalled permission for
   the same reason, and it applies to a read that costs a quarter of a megabyte.
7. **No dedicated `WHERE status = 'active'` read.** It would be one row instead
   of a handful of scalar ones. The projection already exists, and the partial
   unique index is what enforces the rule either way.

## Assumptions

- None. Every claim about what the documents said was read at its anchor, and
  every claim about the code was read in the code.

## Completed

All three.

- `bf1b2c1` — the documents. `PROGRESS.md`, three superseded facts in the
  operational handoff, two annotations in the multi-tenancy plan and the
  archived task file.
- `8d59f3b` — `scripts/publish-doc.mjs`, its test, `docs:publish` and the
  `lint:docs-publish` gate, plus the rule in `docs/README.md` and the handoff's
  publishing section.
- `96ab5b4` — `closeOtherActiveRounds` reads summaries;
  `IRoundRepository.findByOrganizationId` is gone; ADR-051 records the close.

## In progress

- Nothing.

## Remaining

- Nothing in this task. The three commits are unpushed; pushing is the owner's.

## Changed files

`git diff --stat 04f63a4..HEAD`.

## Verification evidence

### Passed

- `npm run verify:core` — exit `0`, read from a redirected log rather than
  through a pipe. **1826 node tests passed, 0 failed**; the Python suite 587
  passed; all fifteen fitness/lint gates including the new `lint:docs-publish`,
  then `typecheck`, `lint` and `build`.
- `npm run verify:db` — exit `0`, **108 passed**, against the disposable
  PostgreSQL on `127.0.0.1:5433`. Run because
  `__dbtests__/postgres-one-active-round.test.ts` moved off the removed read;
  the one-active-round rule is a database behaviour and this is where it is
  proved.
- `node --test scripts/publish-doc.test.mjs` — 10 passed, including one that
  transforms the three real documents in `docs/` and asserts each keeps its
  title and reports no hazard.
- The script was run for real on all three documents. Each output starts with
  its `<title>` and contains no occurrence of `vendor/`,
  `claude-mermaid-runtime`, `<body` or `<html`; 61590 → 58770, 26880 → 23908 and
  148037 → 145757 bytes.
- The sweep test was proved to bite: reverting the one service line to
  `findByOrganizationId` fails `activating a round sweeps the school with
  summaries, not with its history`, and restoring it passes.
- **On `main`, 2026-08-25.** All four workflows green at `2c2f5da`: `Core
  verification` — which now carries `lint:docs-publish` — `Browser smoke`,
  `Vercel Deployment & Pipeline Checks` and `CodeQL Security Analysis`. Browser
  smoke matters here because `verify:core` does not run Playwright and nothing
  local had walked a screen.
- **Deployed, anonymous, 2026-08-25.** `GET /api/health/` → `commit: 2c2f5da`,
  so the deployment is level with `main`; `GET /api/health/observability/` →
  `200` with `alerting: []`.

### Failed

- None.

### Blocked or not run

- `npm run test:e2e` — not run. No screen, route, navigation or middleware
  changed; the one runtime change is a repository read behind an existing
  service method, and `verify:core` does not walk Playwright.
- `npm run test:mutation:ai-contract` — not run; no mutated file was touched.
- **No signed-in walk of the deployment.** Nothing here is visible there: three
  commits are repository-only, and the fourth changes which columns one query
  selects on a path that renders nothing new. The two anonymous health endpoints
  were read and are recorded above; no screen was opened.
- **The two published pages still carry the duplicated `<style>`.** The script
  removes the runtime block whole, so their next republish ends it; republishing
  is a separate action and was not taken.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- Low, and concentrated in the third commit. `findByOrganizationId` is gone from
  `IRoundRepository`, so a caller that wanted a school's rounds whole now has to
  say so — the compiler names any that appears. The behaviour of the sweep is
  unchanged: it filtered on `id` and `status` before and after, and both are on
  the summary.
- The publishing script writes into `tmp/published/`, which is gitignored, so it
  cannot produce a second copy of a document that drifts from the first.

## Failed approaches

- None.

## Known risks

- None.

## Approval gates

- None. No secret, credential, authentication configuration or alias.

## Questions requiring an owner decision

- None in this task.

## Visibility of this handoff

Archived. `origin/main` carries all four commits, `bf1b2c1` through `2c2f5da`.

## Next concrete step

None. This task is closed.
