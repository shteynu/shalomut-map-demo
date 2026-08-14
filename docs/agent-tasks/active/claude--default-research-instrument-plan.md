# Plan the research instrument as the default questionnaire

## Metadata

- Branch: `claude/default-research-instrument-plan`
- Base branch: `main`
- Base commit: `05a23bc`
- Current HEAD: see `git log -1` on this branch
- Status: plan written and documentation reconciled; implementation not started
- Last updated: 2026-08-14
- Last agent/tool: Claude Code (claude-opus-5)

## Objective

Establish what it takes to make the owner's research questionnaire the default
instrument, and leave the repository's documentation telling the truth about
both the current product and the planned change. This branch produces the plan
and the documentation pointers. It changes no runtime code.

## User-visible outcome

None yet. A reader of `docs/` can now find one live plan that says what the
change is, which owner decisions are settled, which are outstanding, and which
phase each piece of work belongs to.

## Context

The owner named a Google Docs research instrument
(`1W7bQhdo0oyJ-WL73MmrsZB3XJqNDo_lE`) and asked what would have to change for it
to be the default. Reading it against the code showed it is a different class of
instrument, not new content: 126 items in three answer classes, two scale
lengths, mixed polarity and 18 items that belong to no wellbeing dimension.
Three owner decisions were taken in-session; they are in the plan's §2.

## Scope

`docs/default-research-instrument-plan-2026-08-14.md` (new), this task file, and
forward pointers in `docs/README.md`, `docs/source-of-truth.md`, `ROADMAP.md`,
`PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/ai-contract-version-matrix.md`, `docs/data-flow-and-subprocessors.md` and
`docs/product-behaviour-backlog.md`.

## Non-goals

- Any runtime, schema, contract or test change. Phase 1 of the plan is where
  that starts, on its own branch.
- Rewriting living documents as though the change had happened. Every pointer
  added here is explicitly forward-looking; the sentences describing today's
  24-question default remain because they are still true.
- Reopening the eight-dimension taxonomy or the scoring bands.

## Acceptance criteria

- One dated, live plan exists in `docs/` with phases, blockers and citations
  that resolve.
- `docs/README.md` classifies it, and the classification distinguishes a live
  plan from the historical ones it sits beside.
- No living document claims the new instrument is in use.
- `ROADMAP.md` no longer says "None open" under next product outcomes.
- The owner-supplied mapping table is recorded as an external blocker where
  blockers are owned.
- `npm run lint:skills` passes and every added link resolves.

## Relevant repository instructions

`AGENTS.md` documentation lifecycle and branch-scoped task state;
`shalomut-tracker` for source priority and memory boundaries;
`shalomut-verification` for the check matrix — this diff is documentation only,
so the matrix calls for link and skill checks rather than the full suite.

## Relevant architecture and contracts

- ADR-004 (`PROJECT_CONTEXT.md`) owns the dynamic-questionnaire/fixed-taxonomy
  rule and the all-or-nothing unlock; both are amended by plan phases 1 and 2
  and are untouched here.
- ADR-005 owns the privacy invariant; the k-anonymity decision extends it and is
  recorded as planned, not as shipped.
- Contracts `1.0`–`6.0` keep their semantics. The plan routes the new answer
  shapes through a new `7.0` and the consumer-first sequence in
  `docs/ai-contract-version-matrix.md`.

## Decisions made

- **The plan is a live document, not a historical one.** `docs/README.md` had
  two states — living sources of truth and dated plans that are explicitly not a
  task queue — and this plan is neither. A third section was added rather than
  filing it under "historical", which would have told the next reader to ignore
  it.
- **Living docs get forward pointers, not rewrites.** `source-of-truth.md` still
  says the default is 24 questions on one three-colour scale, because that is
  what the code does today.
- **"Replaces the 24" is qualified in the plan (§3).** `surveyInstrument.questions`
  is the default parameter of the submission and analytics paths, so a literal
  deletion would change how a round with no snapshot is scored. The plan names
  the migration that makes the replacement honest.

## Assumptions

- The Google Doc as read on 2026-08-14 is the intended instrument; the six
  defects in plan §4 are transcription artifacts rather than content decisions.
- The methodologist's mapping will assign every one of the 108 Likert items to
  exactly one dimension. If some items map to none, plan phase 3 grows a
  fourth item class and the plan needs a revision, not a workaround.

## Completed

The plan and the documentation reconciliation described in Scope.

## In progress

None.

## Remaining

Nothing on this branch. The next unit of work is plan phase 1, on its own
branch, and it does not wait on the owner.

## Changed files

New: `docs/default-research-instrument-plan-2026-08-14.md`, this file.

Modified: `docs/README.md`, `docs/source-of-truth.md`, `ROADMAP.md`,
`PROGRESS.md`, `docs/shalomut-tracker-handoff.md`,
`docs/ai-contract-version-matrix.md`, `docs/data-flow-and-subprocessors.md`,
`docs/product-behaviour-backlog.md`.

## Verification evidence

### Passed

- `npm run lint:skills` — 28/28 tests, 3 canonical skills, 4 declared
  entrypoints. Run because the diff is repository documentation.
- Every relative Markdown link in the two new files and the eight modified ones
  resolves on disk — 0 broken, checked by script over all `](…)` hrefs.
- Every `file#Lnnn` citation in the plan was read back with `sed -n 'Np'` and
  points at the construct it names: `survey-definition.ts#L119` at the question
  loop, `survey.service.ts#L47` at `valueToScore`, `#L61`/`#L141` at the
  `surveyInstrument.questions` default parameters, `analytics.service.ts#L118`
  at the aggregate map, `types/backend.ts#L26` at `SurveyDefinitionQuestion`,
  `#L120` at `RoundResponseFunnel`, `analytics-encoder.ts#L64` at
  `encodeAnalyticsInput`, `survey-definition.ts#L276`/`#L280` at the estimator
  and the canonical builder, `survey-builder/types.ts#L29` at the validator,
  `question-suggestions.ts#L39` at the canonical lookup, and
  `docs/openapi.yaml:1147` at `enum: [green, yellow, red]`.
- Link anchors were corrected from `:nnn` to the repository's `#Lnnn`
  convention, which the six existing docs linking into `src/` already use.

### Failed

None.

### Blocked or not run

Runtime suites are not triggered: the diff contains no `.ts`, `.tsx`, `.py`,
schema, contract or configuration change.

### Environment

Local, documentation only. No database and no deployed environment was touched.

### Residual risk

The plan's phase estimates are structural, not sized. Phase 1's persistence
decision — sub-question rows versus a JSON value column for the allocation grid
— is deliberately left to that phase and could change its shape.

## Failed approaches

None.

## Known risks

None affecting privacy, contracts or persistence: no runtime file changed.

## Approval gates

None. No secret, credential, authentication configuration or deployment alias
was touched.

## Questions requiring an owner decision

The five in plan §7. The first — the item-to-dimension mapping and the
reverse-scored list — blocks plan phases 3 and 5 and nothing else.

## Next concrete step

Start plan phase 1 on a new branch: the answer model in
`src/lib/types/backend.ts`, `src/lib/survey-definition.ts`,
`src/lib/services/survey.service.ts` and the schema, plus the migration that
backfills a snapshot onto rounds that have none.
