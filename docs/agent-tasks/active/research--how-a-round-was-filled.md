# Research: how a round was filled, and whether the product may act on it

## Metadata

- Branch: `research/how-a-round-was-filled`
- Base branch: `main`
- Base commit: `8231490`
- Current HEAD: `8231490` plus one documentation commit on this branch
- Status: research complete; owner decisions taken 2026-08-17; no implementation started
- Last updated: 2026-08-17
- Last agent/tool: Claude Code (Opus 5)

## Objective

Answer, from the code and from the literature, whether the product can detect
suspiciously filled questionnaires (too fast, too uniform), whether it may
publish that finding to a manager, and where such a capability would live. The
deliverable is a research document and a decision, not an implementation.

## User-visible outcome

None yet. The research narrows a requested feature to the half that survives
scrutiny, and records why the other half does not.

## Context

The owner asked for a round summary that states which questionnaires look
suspiciously filled and offers the manager the choice to exclude them, with
automatic exclusion explicitly rejected because it would depress the reported
completion rate.

Full findings, with paths and citations:
[`docs/response-quality-research-2026-08-17.md`](../../response-quality-research-2026-08-17.md).

## Scope

- Read-only investigation of the respondent flow, aggregation and scoring, the
  round lifecycle, the Core ↔ AI-service boundary, privacy invariants, and
  engineering conventions.
- External research on careless/insufficient-effort responding indices and on
  available tooling and its licences.
- A design proposal, adversarially checked against the code.

## Non-goals

- No code, schema or contract change in this task.
- Not the removal of the automatic AI analysis during collection — accepted as
  a separate task (see "Decisions made", 4).
- Not the methodologist's item-to-dimension and reverse-item mapping, which is
  an existing external blocker.

## Acceptance criteria

- Every load-bearing claim carries a path and, where it is a number, a source.
- The design proposal is stated together with what refuted its earlier version.
- Owner decisions are recorded where the next agent will read them.

## Relevant repository instructions

- `AGENTS.md` — privacy is a product invariant, not an environment gate; the
  design-stage exemption does not reach it.
- `.agents/skills/shalomut-map/SKILL.md` — canonical boundaries, published
  contracts `1.0`–`6.0` are immutable, Core/AI-service separation.
- `.agents/skills/shalomut-tracker/SKILL.md` — branch-scoped task state.

## Relevant architecture and contracts

- `AnalyticsService.calculateDynamicRoundAnalytics` is the single choke point for
  both the MCP send path (`getAnalyticsForRound` → `encodeAnalyticsInput`) and
  the callback verification path (`ai-insights-service.ts:145`).
  `buildBackgroundBreakdown` is a third path that reads responses separately.
- The MCP payload is validated by Core against its own schema with
  `additionalProperties: false` before it is sent, and again by
  `_DYNAMIC_FORBIDDEN_FIELDS` in the Python service. Any respondent-level field
  would require a manifest `7.0`, which has not been started.
- `SurveyFunnelService` and `dividedDimensions` are the two precedents for
  deterministic new analytics in Core with no contract change.

## Decisions made

Taken by the owner on 2026-08-17:

1. Target the 126-item research instrument. The feature is not built against the
   current 24, which are unidirectionally keyed on a three-point scale.
2. The report is **descriptive only** — how the round was filled. No exclusion of
   responses, and no score deltas, previews or recolourings.
3. Attention-check items go to the methodologist as an open question. They are
   the only signal examined here that is not directionally biased, and a
   positive answer is what would make an exclusion feature defensible later.
4. Removing the automatic AI analysis during collection is accepted as a
   **separate task**.
5. The intended shape is a manual close followed by analysis, subject to (4).

## Assumptions

- During any review step the round keeps accepting responses; a report is
  recomputed when the manager acts rather than being frozen. Stated to the owner
  and not contradicted, but not explicitly confirmed either.
- "Once the completed-questionnaire minimum is reached" means a threshold; which
  one — the round's `privacyThreshold` or a smaller floor of its own, as
  `ABANDON_DETAIL_MINIMUM` is — was not settled.

## Completed

- Codebase investigation across respondent flow, aggregation, round lifecycle,
  AI boundary, privacy invariants, docs and engineering conventions.
- External research on IER indices, thresholds and tooling licences.
- A first design, and an adversarial pass that refuted three of its five points.
- `docs/response-quality-research-2026-08-17.md` written.

## In progress

Nothing.

## Remaining

- Index the new document in `docs/README.md` (done in this branch's commit).
- Await the methodologist on attention-check items before revisiting exclusion.
- Open the separate task for decision 4.

## Changed files

- `docs/response-quality-research-2026-08-17.md` (new)
- `docs/agent-tasks/active/research--how-a-round-was-filled.md` (new, this file)
- `docs/README.md` (indexed the new document)

`next-env.d.ts` carries a pre-existing unstaged modification that predates this
branch and is not part of this task.

## Verification evidence

### Passed

Four load-bearing claims were verified by opening the code directly rather than
accepting an agent's summary:

- `displayableDistribution` publishes exact `{green, yellow, red}` integers once
  `responseCount >= MINIMUM_PRIVACY_THRESHOLD`
  (`src/lib/ai-insights-view-model.ts:83-93`).
- The manager's response count is `analytics.totalResponses`, not
  `getResponseCount` (`src/lib/services/manager-context.service.ts:196`).
- `closed → active` is an allowed round transition
  (`src/lib/rounds/round-status.ts`).
- A `SurveyStep` may be a `block` holding many questions on one screen
  (`src/lib/survey/survey-steps.ts:23-35`), so per-item timing is not
  measurable.

### Failed

None.

### Blocked or not run

No test suite, typecheck, lint or build was run: this branch changes
documentation only and touches no code path any of them cover.

### Environment

Local worktree only. Nothing deployed, no database read or written.

### Residual risk

The false-positive estimate in §5.2 of the research document is an analytical
estimate from published base rates, not a measurement on this product's data.
Its direction — that flagging is biased toward satisfied respondents — follows
from the construction of the indices and is the robust part; the specific PPV of
about 16% is not.

## Failed approaches

The first design proposed excluding responses by *reason* rather than by row,
with a preview of the resulting deltas, on the theory that group-level choice
prevents recovering an individual's answers. It does not: the leak is in the
published per-question distributions, not in the selection interface, and the
gate "show this only when exclusion changes something" is empty because the
shift from removing `k` responses is always at least the map's own resolution.

## Known risks

- Reviving the exclusion half without also removing the exact per-question
  distributions would reintroduce the differencing attack in full.
- Any future filtering must be applied to `buildBackgroundBreakdown` as well as
  to `calculateDynamicRoundAnalytics`, or the breakdown screen and the map will
  disagree on one screen.

## Approval gates

None opened by this task. The existing gate on the methodologist's mapping now
also gates the exclusion half of this feature.

## Questions requiring an owner decision

- Will the methodologist add attention-check items, and how many?
- Does the descriptive report appear before the round closes, or only after?
- Which threshold gates the report — the round's `privacyThreshold`, or a
  smaller floor of its own?

## Next concrete step

Open a separate branch and task file for decision 4 — removing the automatic AI
analysis after each respondent submission, so that analysis runs only on an
explicit manual trigger — starting from
`src/app/api/survey/[shareCode]/submit/route.ts` and
`src/lib/server/trigger-ai-analytics.ts`.
