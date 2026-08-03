# Reconcile the product behaviour backlog with the requirements document

## Metadata

- Branch: `docs/product-backlog-doc-sync`
- Base branch: `main`
- Base commit: `39a4339`
- Current HEAD: `39a4339` (documentation edits uncommitted at the time of
  writing)
- Status: documentation edits complete, awaiting commit
- Last updated: 2026-08-03
- Last agent/tool: Claude Code

## Objective

Bring `docs/product-behaviour-backlog.md` in line with the owner's development
requirements document ("פיתוח פלטפורמת מפת שלומות — MVP + הכנה לשלב הבא",
Google Docs), keeping deliberate product differences visible instead of
silently absent.

## User-visible outcome

None at runtime. The backlog now states which requirements are delivered, which
differ by owner decision, and which remain open.

## Context

The requirements document was reviewed section by section against the schema,
services and manager/respondent routes. Four differences needed an owner
decision; all four were answered on 2026-08-03 and are recorded in the backlog.

## Scope

- `docs/product-behaviour-backlog.md`: new alignment section, new items 9–11.
- `PROGRESS.md`: product "Next up" list updated, reconciliation noted.

## Non-goals

- No code change. The scoring thresholds stay hard-coded; item 9 owns that work.
- No change to environment or deployment documentation.

## Decisions made

Owner decisions, 2026-08-03:

- The three-colour answer scale replaces the document's Likert/choice/open/100%
  item types as an explicit product decision. No backlog item follows.
- Viewer and Owner/Admin roles stay deferred; the 2026-08-03 single-manager
  decision outranks the document's MVP scope.
- The privacy threshold keeps its floor of ten rather than the document's
  suggested 5–10 range.
- Staging/production separation is infrastructure and stays out of the product
  backlog.

## Assumptions

- The requirements document's URL is deliberately not stored in the repository;
  the document is referenced by title.

## Completed

- Section-by-section review of the requirements document against the code.
- Alignment section added to the backlog with delivered items and the four
  deliberate differences.
- New backlog items: 9 configurable scoring thresholds, 10 per-round dashboard
  and round history, 11 repeat-measurement reminders (future).
- `PROGRESS.md` product "Next up" list updated.

## Remaining

Nothing in this task beyond committing.

## Changed files

- `docs/product-behaviour-backlog.md` (modified)
- `PROGRESS.md` (modified)
- `docs/agent-tasks/active/docs--product-backlog-doc-sync.md` (new)

Pre-existing unrelated modifications left untouched: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- Claims in the new backlog text were checked against the source: colour
  boundaries 75/50 duplicated in `src/lib/services/analytics.service.ts`;
  single current round in `src/lib/services/manager-context.service.ts`;
  round status transitions in `src/lib/services/round.service.ts`; manual close
  in `src/components/round/round-controls.tsx`; survey progress bar in
  `src/components/survey/survey-flow.tsx`; background fields in
  `src/lib/types/backend.ts`; answer scoring in `prisma/schema.prisma`.

### Failed

None.

### Blocked or not run

- `npm run verify` was not run. The diff is documentation only and touches no
  code, tests, schema or configuration.

### Environment

Local worktree only; no deployment or database interaction.

### Residual risk

Low. Documentation-only change; the risk is a stale claim in prose, mitigated by
the source checks above.

## Approval gates

None.

## Questions requiring an owner decision

None open. The four questions raised in this session were answered on
2026-08-03 and are recorded under Decisions made.

## Next concrete step

Commit the three files on `docs/product-backlog-doc-sync` with a
`docs(product)` message, then hand the push to the owner
(`git push origin docs/product-backlog-doc-sync:main`).
