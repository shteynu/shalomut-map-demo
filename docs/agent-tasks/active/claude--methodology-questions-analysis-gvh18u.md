# Proposed answers to the six methodologist questions

## Metadata

- Branch: `claude/methodology-questions-analysis-gvh18u`
- Base branch: `main`
- Base commit: `f47959e`
- Current HEAD: the commit carrying this file
- Status: analysis written and registered; awaiting the owner's reading
- Last updated: 2026-09-12
- Last agent/tool: Claude Code

## Objective

The owner asked the agent to analyse and answer the six questions in
`docs/methodologist-questions-2026-08-15-ru.md` itself, since the methodologist
has not answered. Deliver a proposal the methodologist can confirm or correct
rather than compose from scratch.

## User-visible outcome

None in the product. One new document,
`docs/methodologist-questions-analysis-2026-09-12.md`, holding a proposed
answer to every question, a full item-to-dimension table for the 108 Likert
items with polarity and confidence, and twelve source-document defects with a
proposed resolution each.

## Context

The research instrument itself (Google Doc `1W7bQhdo0oyJ-WL73MmrsZB3XJqNDo_lE`)
was read in full on 2026-09-12 through the owner's Drive connector; until now
the repository held only its shape from the 2026-08-14 plan. The item texts are
quoted in the analysis for the first time.

## Scope

- The analysis document, in Russian, the language of the letter it answers.
- Its registration in `docs/README.md` beside the letter.
- Pointer lines in `docs/open-decisions.md` on items 6 and 18–21, which stay
  open: a proposal is not the external input those items wait for.

## Non-goals

- No code. Owner decision 3 of 2026-08-14 says the mapping is owner-supplied;
  this document is what the owner and methodologist decide *about*, not the
  decision. Nothing in `createCanonicalSurveyDefinition`, the seed or the
  contracts changes.
- No edit to the two outgoing letters. A reply against one applies to both, and
  this document is that reply's draft, not a seventh question.

## Decisions made

- Written in Russian, because the letter and the owner's reading language are
  Russian; the repository's English rule covers instructions, not this class of
  document (`AGENTS.md`, *Language*).
- Two evidence labels carried over from the 2026-08-10 strategy document:
  *[проверено]* for what was read in this session, *[по памяти агента]* for
  claims about published scales and standards the agent did not open. The
  ISO 45003 clause-number finding in §5 is the most consequential of the latter
  and is marked as needing a check, not asserted.
- The mapping table was generated from a scratchpad script so that the
  coverage counts (78 scored, 30 unscored; 36 items on `balance`, 3 on
  `self-expression`) match the table. The script is not committed: the table
  is the deliverable and a second copy would drift.
- SMBM burnout items go to `balance` (negative) as the recommended pilot
  default, with the "unscored until an outcome index exists" alternative stated
  beside it, because the product cannot show an outcome that reaches no stone.

## Assumptions

- The Drive document read on 2026-09-12 is the version the plan of 2026-08-14
  described. Counts match (16 + 2 + 108 across 13 blocks), so it is.

## Completed

- `docs/methodologist-questions-analysis-2026-09-12.md` — the analysis.
- `docs/README.md` — entry beside the methodologist letters.
- `docs/open-decisions.md` — pointer lines on items 6, 18, 19, 20 and 21.

## In progress

Nothing.

## Remaining

Owner reads the analysis and either sends it to the methodologist as a draft
reply or takes the decisions directly. Only after "accepted" does phase 6 of the
instrument plan (authoring the 126 items as data) become an engineering task.

## Changed files

- `docs/methodologist-questions-analysis-2026-09-12.md` (new)
- `docs/README.md`
- `docs/open-decisions.md`
- this file

## Verification evidence

### Passed

- `npm run lint:doc-numbers` and `npm run lint:skills` — exit 0 on the final
  tree, 2026-09-12.
- Every code claim in the analysis was read, not recalled: the scale steps in
  `src/lib/survey/answer-scales.ts`, the bands in `contracts/scoring-bands.json`,
  the analytic-only filter in `src/lib/services/analytics.service.ts:288`, the
  single-choice restriction in `src/lib/analytics/background-breakdown.ts`, and
  the catalog counts computed from `interventions_kb.json` with a script.

### Failed

None.

### Blocked or not run

- No test, typecheck or build: no source file changed.
- ISO 45003:2021 clause structure not verified against the standard's text —
  stated as such in the document.

### Environment

Remote container, documentation only. No database, no deployment.

### Residual risk

- The document could be mistaken for the methodologist's answer. Its status
  banner says it is not, and `open-decisions.md` still lists item 6 as waiting.

## Failed approaches

None.

## Known risks

None beyond the residual risk above.

## Approval gates

None. Sending the document outside the repository is the owner's action.

## Questions requiring an owner decision

- Whether to send the analysis to the methodologist as a draft reply, or to
  take the §2 mapping decisions (notes 1 and 3) directly.

## Next concrete step

Owner: read `docs/methodologist-questions-analysis-2026-09-12.md` §Сводка and
decide whether it goes to the methodologist as a draft or is accepted as is.
On "accepted", open a new branch for phase 6 of
`docs/default-research-instrument-plan-2026-08-14.md` and author the 126 items
from the §2 table.
