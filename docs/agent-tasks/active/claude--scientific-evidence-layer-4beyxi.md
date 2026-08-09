# Scientific Evidence Layer — research only

## Metadata

- Branch: `claude/scientific-evidence-layer-4beyxi`
- Base branch: `main`
- Base commit: `14c2269`
- Current HEAD: `14c2269` (before this task's commit)
- Status: research delivered plus a recommendation added on owner request;
  no implementation started, no owner decision taken
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5), 14-agent research workflow

## Objective

Answer, from the code, whether the AI analytics pipeline needs a Scientific
Evidence Layer, where it would sit, and what the minimum component would be.
The user explicitly asked for research, not an implementation plan, and asked
that no winning option be picked.

## User-visible outcome

None. This task changes no product behaviour. It adds one dated research
document and its index entry.

## Context

The AI service selects five catalogue interventions per dimension with a purely
lexical/statistical ranking and emits a free-text `source` string that never
reaches a screen. No notion of scientific literature exists anywhere in the
repository.

## Scope

- `docs/scientific-evidence-layer-research-2026-08-09.md` — the deliverable.
- `docs/README.md` — one index line under "Historical plans and evidence".

## Non-goals

- Any code change in `ai-analytics-service/` or `src/`.
- Changing `interventions_kb.json`, the ranking, the contract or any test.
- Taking the owner's decision. The document's "Заключение" recommends against
  building the layer now and names two cheaper alternatives, but the four
  questions in section 6 remain the owner's.

## Acceptance criteria

- Every claim carries a `path:line` citation and was verified by reading or
  executing the code, not inferred.
- Four conclusion groups delivered: current state, evidence gap, existing
  extension points, 2–3 alternatives with trade-offs.
- All 30 areas of the user's plan answered.
- Sections 1–7 recommend no option. The later "Заключение" section does, and
  is labelled as a judgement added on request rather than a code finding.

## Relevant repository instructions

- `AGENTS.md` — required skill routing; branch-scoped task state; documentation
  lifecycle (dated research belongs under "Historical plans and evidence" in
  `docs/README.md`, not among living sources of truth).
- `.agents/skills/shalomut-tracker/SKILL.md`, `.agents/skills/shalomut-map/SKILL.md`,
  `.agents/skills/shalomut-verification/SKILL.md` — all three read.

## Relevant architecture and contracts

- ADR-002 additive-field rule, `PROJECT_CONTEXT.md:45-67`.
- Contract 6.0: `contracts/ai-analytics-v6.json`, `contracts/capabilities.json`.
- `ai-analytics-service/src/rag/store.py`, `src/agents/*.py`,
  `src/application/ports.py`, `src/lib/ai-contract.ts`,
  `src/lib/ai-insights-view-model.ts`, `prisma/schema.prisma`.

## Decisions made

- Documented as a dated research file rather than a plan or an ADR: no decision
  was taken, so nothing belongs in `PROJECT_CONTEXT.md` or `docs/adr/`.
- No living document updated: none of their owned state changed.
- `PROGRESS.md` and `docs/shalomut-tracker-handoff.md` left untouched — no
  product milestone and no operational/deployed state changed.

## Assumptions

- The user wants a decision-ready study, not a decision. Stated explicitly in
  the request ("без преждевременного выбора победителя").
- Findings recorded in section 7 of the document are reported, not fixed; each
  would be its own task on its own branch.

## Completed

- 14-agent research workflow across 10 code tracks, one adversarial
  fact-check pass and three independent architecture lenses.
- Independent verification by this agent of every load-bearing claim used in
  the deliverable (see Verification evidence).
- `docs/scientific-evidence-layer-research-2026-08-09.md` written.
- `docs/README.md` index line added.
- "Заключение" section added on owner request: recommends not building the
  layer now, and names three cheaper actions instead (render the existing
  `source`; stamp the catalogue revision; fix the section 7 defects).

## In progress

None.

## Remaining

Nothing in scope. Follow-on work, if the owner wants it, is one of:

- a decision on the four questions in section 6 of the document;
- separate branches for the six defects in section 7.

## Changed files

- `docs/scientific-evidence-layer-research-2026-08-09.md` (new)
- `docs/README.md` (one index entry)
- `docs/agent-tasks/active/claude--scientific-evidence-layer-4beyxi.md` (this file, new)

## Verification evidence

### Passed

Read-only verification, appropriate to a documentation-only diff. Each of the
following was confirmed by this agent directly, independently of the research
agents:

- Pipeline order and node responsibilities — `graph.py:68-166`.
- Ranking formula, weights, tie-break — `rag/store.py:9-11,248-296`.
- Topic lexicon is a closed Hebrew keyword set, not embeddings — `rag/topics.py`.
- Catalogue census, executed over `data/interventions_kb.json`: 192 entries,
  9 keys, 10 distinct `source`, 24 per dimension, 72 `kb-v6-*` rows carrying two
  generic sources and non-topical tags, 60 rows with an ISO clause number,
  `sickness` on 4 rows and `new_staff` on 7.
- `intent` has zero readers in `ai-analytics-service/src/` (grep count 0).
- `ALLOWED_SOURCE_CITATIONS = {"ISO","OECD","TALIS"}` enforced —
  `tests/test_rag_store.py:47,141-147`.
- `source` crosses the contract, is type-checked only
  (`src/lib/ai-contract.ts:246`) and is dropped at
  `src/lib/ai-insights-view-model.ts:155-168`; `DashboardRecommendation` has two
  fields (`src/lib/dashboard/dashboard-insights.ts:36-39`).
- No zod, no ajv in `src/`; no pydantic `BaseModel` in the service (grep count 0).
- No caching anywhere in the service (grep count 0).
- ADR-002 quoted verbatim from `PROJECT_CONTEXT.md:45-67`.
- `AiAnalysisRun.result Json?` — `prisma/schema.prisma:100-125`; no input column.
- Hebrew-only and no-visible-digits rules — `hebrew_validation.py:158-191`.
- Safety validator never reads `source`; `user_facing_copy` is
  `[title, summary, *actionable_steps]` — `safety_node.py:176-180`.
- Outgoing gate never inspects `recommendedInterventions` —
  `schemas/stone_map_validation.py:68-127`.
- LLM call count per 6.0 pass = 25, from the four call sites.
- Deployed pacing 60/30 rpm and `ONLY_LLM_FOR_PROBLEMATIC=false` —
  `render.yaml:60,94,109-110`; the green-skip is honoured only on the pre-6.0
  path (`llm_provider.py:217`).
- `repair_critique` dropped in the 6.0 adaptation branch —
  `llm_provider.py:663-670` against `:736`.
- Repository root commit is `00c79bc`; catalogue history is not recoverable.
- 2026-07-27 owner rule on sources quoted from
  `docs/ai-insights-depth-plan-2026-07-27.md:438-446`.

### Failed

None.

### Blocked or not run

- No test suite run. The diff is three Markdown files and touches no code,
  configuration, schema or contract; `shalomut-verification` scales checks to
  the risk of the actual diff, and there is no runtime behaviour to prove.
- No prototype built, so no cost or latency figure in the document is measured;
  all are arithmetic over the call sites.

### Environment

Remote container, read-only inspection of the working tree. No database, no
deployment and no provider was contacted.

### Residual risk

- The document's line citations are pinned to HEAD `14c2269` and will drift as
  the files change.
- The claim "a fabricated Hebrew scientific statement passes every validator"
  was demonstrated on one synthetic paragraph against the real validators. It
  proves the hole exists; it does not measure how often a model would fall into
  it.

## Failed approaches

None. One correction applied during the work: several research agents' line
citations in the `store.py` / `intervention_nodes.py` region were drifted by
1–7 lines; the adversarial pass caught them and the deliverable uses re-derived
citations.

## Known risks

- Sections 4 and 6 deliberately leave the choice open; only the "Заключение"
  section takes a side, and it is a judgement, not a finding. If a later agent
  reads either as a mandate to start building, that would exceed the task.
- The recommendation rests on two claims that could change without the code
  changing: that no curator is committed, and that no manager has asked for
  attribution. Both are stated as the trigger to revisit.
- Section 7 lists six real defects found in passing. They are recorded, not
  fixed, and none has a branch yet.

## Approval gates

- None triggered. No secret, credential, authentication configuration or
  deployment alias was touched, and no database was contacted.
- A future evidence layer using a live external source would need a new
  credential and would trigger the `AGENTS.md` approval gate. Noted in the
  document, not requested here.

## Questions requiring an owner decision

The four in section 6 of the research document: who curates; audit or screen;
whether evidence should influence selection; and whether framework-clause-level
attribution is sufficient.

## Next concrete step

Owner reads the "Заключение" section and either accepts it or names a curator.
If accepted, the first piece of work is not on this branch and not this layer:
it is question 4 of section 6 — decide whether framework-clause attribution is
enough — because a "yes" closes the subject entirely and a "no" makes rendering
the existing `source` the cheapest next slice. No code work should start on
this branch.
