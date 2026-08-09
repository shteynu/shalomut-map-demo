# Scientific Evidence Layer — research, plus one defect fixed

## Metadata

- Branch: `claude/scientific-evidence-layer-4beyxi`
- Base branch: `main`
- Base commit: `14c2269`
- Current HEAD: `14c2269` (before this task's commit)
- Status: research delivered, recommendation added on owner request, and the
  recorded defects worked through on owner request — four fixed, one withdrawn
  as a misreading, one deliberately left. The evidence layer itself is not
  started and no owner decision on it is taken
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5), 14-agent research workflow

## Objective

Answer, from the code, whether the AI analytics pipeline needs a Scientific
Evidence Layer, where it would sit, and what the minimum component would be.
The user explicitly asked for research, not an implementation plan, and asked
that no winning option be picked.

## User-visible outcome

None on screen. The code fix changes one runtime behaviour that a manager
never sees: on 6.0, a recommendation replay now tells the heavy model what the
safety validator refused, instead of asking for the same answer again.

## Context

The AI service selects five catalogue interventions per dimension with a purely
lexical/statistical ranking and emits a free-text `source` string that never
reaches a screen. No notion of scientific literature exists anywhere in the
repository.

## Scope

- `docs/scientific-evidence-layer-research-2026-08-09.md` — the deliverable.
- `docs/README.md` — one index line under "Historical plans and evidence".
- The section 7 defects, fixed on owner request across two commits: the lost
  `repair_critique` on the 6.0 adaptation branch, the `org_context` fallback in
  `_background_context_for_prompt`, the false `id` claim in the RoundGoal
  schema comment, and the dead ChromaDB settings.

The code fixes ride this branch because the session designates one branch and
forbids pushing to another without permission. They are otherwise independent
changes and would normally have had their own branches and task files.

## Non-goals

- Building any part of a Scientific Evidence Layer.
- Changing `interventions_kb.json`, the ranking or the contract.
- Renaming `LocalInterventionVectorStore`, and removing the now-unread
  `org_context` state field. Both are consequences of the fixes rather than
  parts of them, and both are recorded instead.
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
- Section 7 findings are reported, not fixed — except defect 1, which the
  owner asked for explicitly after reading the study.
- The fix is behaviour-preserving for a first pass: `_joined_critique` returns
  `None` when both critiques are absent, and `repair_section(None)` is `""`, so
  a non-replay prompt is byte-identical to what it was. Pinned by the new
  test's `repaired.startswith(plain)` assertion.

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
- Section 7 defect 1 fixed on owner request: the 6.0 adaptation branch now
  builds its prompt with `_joined_critique(repair_critique, retry_critique)`,
  like the other six prompt sites. Proven by a test that reads the rendered
  prompt rather than the node's keyword argument, which is why the existing
  end-to-end critique test never caught it (it stubs the generator, and it
  runs on 5.0).
- Section 7 defects 2, 4 and 5 fixed on owner request; defect 3 withdrawn and
  defect 6 declined, both with the reason recorded in the document.
  - 2: `_background_context_for_prompt` reads only the contract-declared
    `backgroundContext`; the `state` parameter is gone with the fallback.
    New module `tests/test_background_context_selection.py` covers both halves
    across 4.0/5.0/6.0, including a leg that renders all three 6.0 prompts.
  - 4: the RoundGoal `@@unique` comment now gives the real reason the title is
    the identity — the `id` exists and is persisted, and the dashboard view
    model drops it before the goals panel.
  - 5: `chroma_dir`, `chroma_persist_dir`, `CHROMA_PERSIST_DIR` and the dead
    `chroma_db/` ignore rule removed; the class keeps its name and gains a
    docstring that says what it actually is.
  - Found during review and fixed with them: `config.py` named a
    `generate_interpretation_result` that does not exist.

## In progress

None.

## Remaining

Nothing in scope. Follow-on work, if the owner wants it, is one of:

- a decision on the four questions in section 6 of the document;
- separate branches for the two consequences this task recorded rather than
  took: renaming `LocalInterventionVectorStore`, and deciding whether the
  now-unread `org_context` state field should survive.

## Changed files

- `docs/scientific-evidence-layer-research-2026-08-09.md` (new; section 7
  item 1 and the conclusion's third bullet later marked as fixed)
- `docs/README.md` (one index entry)
- `docs/agent-tasks/active/claude--scientific-evidence-layer-4beyxi.md` (this file, new)
- `ai-analytics-service/src/services/llm_provider.py` (the `:670` call site,
  and one comment naming a method that does not exist)
- `ai-analytics-service/tests/test_repair_critique.py` (one helper, one test)
- `ai-analytics-service/src/agents/node_support.py` (the fallback and the
  now-unused `state` parameter)
- `ai-analytics-service/src/agents/psychologist_node.py`,
  `src/agents/intervention_nodes.py`, `tests/test_service_integration.py`
  (call sites following that signature)
- `ai-analytics-service/tests/test_background_context_selection.py` (new)
- `ai-analytics-service/src/rag/store.py`, `src/config.py`, `.env.example`,
  root `.gitignore` (dead ChromaDB settings and the docstring)
- `prisma/schema.prisma` (the RoundGoal `@@unique` comment)

## Verification evidence

### Passed

**Code fixes.** Per the verification matrix, an `ai-analytics-service` change
takes the full Python suite; the `prisma/schema.prisma` line adds schema
validation.

- `.venv/bin/python -m pytest` from `ai-analytics-service` — **474 passed**,
  1 warning, exit 0 (465 before this branch's code changes; +2 for the
  adaptation critique, +9 for background-context selection, and the two
  interim tests in `test_contract_v5.py` were withdrawn when they moved).
  The `.venv` did not exist in this container and was created per
  `docs/local-environment.md`.
- `npx prisma validate` — "The schema at prisma/schema.prisma is valid", exit 0.
  `npm ci` was run first; node_modules did not exist in this container.
- Defect 1 reproduced before its fix: with `llm_provider.py` reverted, the new
  test failed on `6.0` and passed on `5.0` — 1 failed, 11 passed.
- Defect 2 reproduced before its fix: with the pre-change fallback restored,
  5 of the 9 new selection tests failed, including the leg that renders the
  three 6.0 prompts and the end-to-end provenance leg.
- Adversarial review of the finished diff (four independent readers) produced
  five corrections that were applied; see Failed approaches.

**Research document.** Read-only. Each of the following was confirmed by this
agent directly, independently of the research agents:

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

- TypeScript suite (`npm test`), `npm run typecheck`, `npm run build`,
  `npm run lint` — not run. No `.ts`/`.tsx` file, no contract manifest, no
  `contracts/capabilities.json` and no OpenAPI source is in the diff, and no
  payload shape changes: the fixes alter prompt inputs, one provenance boolean
  whose value nothing on either side re-derives, and comments. The Prisma
  change is a comment, so no client regeneration and no repository test is
  implied beyond `prisma validate`.
- No deployed check. `render.yaml` ended up untouched.
- No provider and no deployed environment contacted, so the repaired prompt has
  not been observed against a real model — only against the rendered string.
- No prototype of any evidence layer built, so no cost or latency figure in the
  document is measured; all are arithmetic over the call sites.

### Environment

`test` — an isolated local Python venv inside the remote container. No
database, no deployment and no provider was contacted.

### Residual risk

- The defect 1 fix widens what a 6.0 replay prompt carries. Both critiques are
  short fixed Hebrew lines, and `max_tokens` bounds the answer rather than the
  prompt, so truncation risk is not materially changed — but this is reasoned,
  not measured against a live provider.
- `backgroundContextIncluded` will now be `false` on rounds that previously
  reported `true`. Nothing re-derives or compares the field — the safety
  validator checks only the two 5.0 inclusion fields, and Core type-checks it —
  so this is a stored value becoming truthful, not a contract change. Rounds
  analysed before this branch keep the old value with no way to tell.
- The local mock MCP server puts undeclared fields in `organizationContext`.
  Those no longer reach a prompt, so a local mock run is now closer to a
  deployed one and further from what it used to print. Deployed rounds are
  unaffected: Core's own MCP contract test asserts the payload never carries
  that field.
- `org_context` is now read by nothing. It is left in place because the runner
  is tested on writing it.
- The document's line citations are pinned to HEAD `14c2269` and will drift as
  the files change; `llm_provider.py:670` has already moved.
- The claim "a fabricated Hebrew scientific statement passes every validator"
  was demonstrated on one synthetic paragraph against the real validators. It
  proves the hole exists; it does not measure how often a model would fall into
  it.

## Failed approaches

None. Two corrections applied during the work:

- several research agents' line citations in the `store.py` /
  `intervention_nodes.py` region were drifted by 1–7 lines; the adversarial
  pass caught them and the deliverable uses re-derived citations;
- the first shape considered for the defect 1 regression test was an end-to-end
  replay on 6.0, in the style of `test_a_replayed_adaptation_is_told_what_was_wrong`.
  It would not have caught the defect: that test stubs the generator, so it
  observes the node's keyword argument, and the loss happens one layer deeper.
  The test had to read the rendered prompt instead;
- defect 2 was first fixed by keeping the `org_context` fallback and filtering
  both sources through `hebrew_prompts.background_context_lines`. Adversarial
  review killed it, correctly: that builder reads seven keys and the three 6.0
  prompts do not use it, so the filter would have erased fields that reach a
  6.0 prompt today, and it inverted precedence — a round context reporting zero
  sick days and zero new staff fell through to an org-level context that
  reported nine and seven, moving the ranking by 10.0. Reproduced before it was
  replaced by simply dropping the fallback;
- the same review caught that the first version of the defect 2 tests repeated
  the mistake defect 1 had just taught: they asserted a provenance boolean on
  5.0, where the prompt half of the defect cannot occur. They were replaced by
  a version-parametrised module with a leg that renders the 6.0 prompts;
- defect 3 was withdrawn entirely. The `render.yaml` comment is past tense and
  the archived decision record confirms the default was `true` when it was
  unset in both places and moved to `false` in the same change. The research
  document read past tense as present, the edit introduced a real error, and it
  was reverted;
- two factual errors in the new store.py docstring — a wrong count of test
  modules and a description of the ranking that omitted its heaviest term —
  were caught by review and corrected.

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
If accepted, the next slice is question 4 of section 6 — decide whether
framework-clause attribution is enough — because a "yes" closes the subject
entirely and a "no" makes rendering the existing `source` the cheapest next
piece of work. That slice belongs on its own branch; nothing further is open
on this one.
