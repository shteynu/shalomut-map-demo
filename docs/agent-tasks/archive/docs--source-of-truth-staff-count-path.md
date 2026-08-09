# The staff count is named where it actually lives

## Metadata

- Branch: `docs/source-of-truth-staff-count-path`
- Base branch: `chore/experiment-scripts-out-of-pytest-path` (the last of a
  six-branch chain on top of `main` at `79a6d39`; none of them pushed)
- Base commit: `edf64ed`
- Current HEAD: `5188bfa`
- Status: landed on `main` as 5188bfa; `origin/main` is `5188bfa`
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close item 7 — the last one — of
[`ai-service-incidental-findings-2026-08-09.md`](../../ai-service-incidental-findings-2026-08-09.md):
the field-ownership table in `docs/source-of-truth.md` listed
`backgroundContext.totalStaffCount`, a field that does not exist.

## User-visible outcome

None. Documentation correctness.

## Context

`RoundBackgroundContext` has seven fields and this is not one of them;
`totalStaffCount` is on `Organization`. The row's owner column was already
right, so the fix is the path plus the one fact the wrong path implied: the
value never crosses the MCP boundary, so it is not available AI input. That
implication is what made this worth more than hygiene — it is exactly the field
a later plan would budget as already available to the model.

Verified in code rather than from the finding: `/round` reads
`organization.totalStaffCount` for its expected-response counter
(`src/app/round/page.tsx:87`), the home page uses it for the response ratio
(`src/app/page.tsx:45`), the setup form edits it
(`src/components/round/setup-form.tsx:261`), and
`src/lib/analytics-encoder.ts` sends only `canonical.backgroundContext` across
the boundary.

## Scope

- `docs/source-of-truth.md` — the one table row.
- `docs/ai-service-incidental-findings-2026-08-09.md` — item 7 closed, and the
  file's own framing, now that every item is closed.
- `docs/README.md` — the one-line index entry described the file as deferred.

## Non-goals

- Rewriting the findings text itself. It stays as written, which is why its
  line references no longer match the code.
- Any code change. Nothing in the code was wrong here.

## Acceptance criteria

- The row names `Organization.totalStaffCount` and says it does not reach the
  AI.
- No other document repeats the wrong path (checked by grep).
- The findings file and the documentation index no longer describe a deferred
  queue.

## Relevant repository instructions

`AGENTS.md` documentation lifecycle, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

`docs/source-of-truth.md` is a living source of truth per `docs/README.md`. No
contract artifact is involved.

## Decisions made

- Say what the field is not, as well as what it is. "Does not cross the MCP
  boundary" is the sentence that prevents the mistake the finding predicted.
- Retitle the findings file rather than move it to an archive. It is still the
  reasoning behind seven merged changes, and `docs/README.md` already files it
  under historical evidence.

## Assumptions

None.

## Completed

- The table row, the findings file's header and item 7, the index entry.

## In progress

None.

## Remaining

None. The owner pushed the chain on 2026-08-09.

## Changed files

Committed together with this file:

- `docs/source-of-truth.md`
- `docs/ai-service-incidental-findings-2026-08-09.md`
- `docs/README.md`

Unstaged and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`. Nothing untracked.

## Verification evidence

### Passed

- The claims read against the code: `src/lib/types/backend.ts:7-24` for both
  shapes, `src/app/round/page.tsx:87` and `src/app/page.tsx:45` for the
  counters, `src/lib/analytics-encoder.ts:83` for what crosses the boundary.
- `grep -rn "backgroundContext.totalStaffCount" docs PROJECT_CONTEXT.md
  PRODUCT.md design.md PROGRESS.md` — only the findings file's own quotation of
  the defect remains.
- `git diff --check` — clean.

### Failed

None.

### Blocked or not run

- Test suites, lint, build: not run. The change is Markdown only and no test
  reads these documents.

### Environment

local

### Residual risk

None. The rest of the table was not audited row by row; only the row the
finding named was checked against the code.

## Failed approaches

None.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

None.

## Next concrete step

None. The chain landed on `main` on 2026-08-09 and this file is closed.
