# Research: Scientific Evidence Layer for the Shalomut AI pipeline

## Metadata

- Branch: research/scientific-evidence-layer
- Base branch: main
- Base commit: 14c2269
- Current HEAD: `ce8ce8a`, the second of two commits on this branch. Both are
  on `origin/main` — the owner pushed them on 2026-08-09 with
  `git push origin research/scientific-evidence-layer:main`.
- Status: research and prototype write-up complete, committed and pushed to
  `main`. Nothing remains for an agent; the task waits on owner decisions.
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Answer, from the code, whether the current decision pipeline lacks scientific
evidence, where exactly the lack is, and which existing extension points could
carry a new capability. The deliverable is a research document with four
conclusion groups — current state, evidence gap, extension points and 2–3
architectural alternatives — not an implementation plan and not a chosen winner.

## User-visible outcome

None. This task adds documentation only; no runtime behaviour changes.

## Context

The owner supplied a 30-question research plan covering pipeline placement,
ranking, provenance, contracts, ports, failure modes, testing, cost and audit.
The plan explicitly forbids assuming an implementation up front.

## Scope

- Read-only investigation of `ai-analytics-service/`, `contracts/`, `src/`,
  `prisma/`, `docs/`.
- One research document under `docs/`.

## Non-goals

- No code change, no contract change, no new dependency.
- No implementation plan and no premature architectural choice.

## Acceptance criteria

- Every claim in the document carries a `path:line` citation.
- Questions the code cannot settle are listed as owner decisions, not guessed.
- 2–3 architectural alternatives stated with trade-offs and no winner declared.

## Relevant repository instructions

- `AGENTS.md` — branch-scoped task state, documentation lifecycle.
- `.agents/skills/shalomut-tracker/SKILL.md` — session start, save progress.
- `.agents/skills/shalomut-map/SKILL.md` — canonical boundaries, contract
  immutability, privacy invariants.

## Relevant architecture and contracts

- `ai-analytics-service/src/agents/graph.py` — the hand-written pipeline.
- `ai-analytics-service/src/rag/store.py` — deterministic intervention ranking.
- `ai-analytics-service/data/interventions_kb.json` — 192 catalog entries.
- `contracts/capabilities.json`, `contracts/ai-analytics-v6.json`.

## Decisions made

- Research runs on its own branch and task file; nothing on `main` changes.

## Assumptions

- The research is read-only; any implementation is a separate later decision.

## Completed

- Session start: git state inspected, skills read, branch created.
- Read-only research over 12 tracks plus a completeness pass and an adversarial
  pass that re-opened the load-bearing claims and executed the shipped
  validators. Four track claims were corrected before they reached the document
  (topic-lexicon count, a character-vs-byte unit error, a rules-vs-cases
  miscount, and a non-reproducible ranking-score range).
- `docs/scientific-evidence-layer-research-2026-08-09.md` written: current
  state, four separable gaps, extension points with hazards, three
  architectural alternatives with no winner, twelve owner decisions, and a
  coverage table for all 30 plan questions.
- Split on owner request: defects and drift moved out of the study into
  `docs/ai-service-incidental-findings-2026-08-09.md`, deferred by owner
  decision on 2026-08-09. The study now contains research only.
- `docs/README.md` registers both dated documents under historical plans and
  evidence.
- Owner asked directly whether a research-retrieval node is worth adding. The
  answer given was no, not now and not as a node: alternative A is a strict
  prerequisite for B or C, because a retrieval stage has nothing to bind to
  while the catalog carries no structured evidence fields. Recorded here as the
  agent's recommendation, not as an owner decision.
- Evidence-card probe run after the study, on owner request, to answer the
  follow-up question of what one unit of evidence would look like and cost.
  Two rounds, six cards, all executed against the shipped
  `LocalInterventionVectorStore` statistics, `hebrew_validation` gates and
  `evals/corpus.py`. Three primary sources were downloaded and read directly
  (OECD WP 213; Spilt et al. 2011; Carroll et al. 2021), plus the owner-supplied
  strategy document read in full. Results written up in
  `docs/evidence-card-prototype-2026-08-09.md`.
- Automated citation extraction was wrong on both attempts it was used for (a
  Schneider et al. reference with the wrong title, volume and pages; the four
  OECD framework components). Both were caught only by reading the source PDFs.
  Recorded in the prototype document as evidence against runtime literature
  reading.
- Copyright boundary held: no source PDF, extracted full text, card file or
  prototype script was placed in the repository. They live only in the session
  scratchpad and are not part of any commit.

## In progress

- Nothing.

## Remaining

- Owner answers the twelve decisions in section 5 of the study. Until then no
  implementation task can be scoped, because decisions 1–3 alone select between
  three different projects.

## Changed files

Committed in the two commits on this branch:

- `docs/scientific-evidence-layer-research-2026-08-09.md`.
- `docs/ai-service-incidental-findings-2026-08-09.md` (unchanged since).
- `docs/README.md`.
- `docs/agent-tasks/active/research--scientific-evidence-layer.md` (this file).
- `docs/evidence-card-prototype-2026-08-09.md` (added in the second commit).

Both commits are on `origin/main` and touch `docs/` only — verified before the
push with `git diff --name-only origin/main...HEAD`, which returned no path
outside `docs/`. No code, contract, schema or configuration file changed.

Pre-existing unrelated modifications left untouched and unstaged:
`.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

Deliberately outside the repository, in the session scratchpad only: the source
PDFs and their extracted text, `evidence_cards*.json` and `prototype*.py`.

## Verification evidence

### Passed

- `git diff --check` — exit 0.
- Relative-link validation over the touched Markdown files: 108 links checked
  after the first commit, 95 after the second; all targets exist both times.
- Independent spot-checks of quoted citations against the code:
  `hebrew_prompts.py:523` (`v6_intervention_fallback`), `graders.py:327`
  (`grade_evidence_specificity`), `product-requirements-summary.md:19/43/58`,
  `goal-rows.ts:38`, `trigger-ai-analytics.ts:45,107`,
  `dashboard-recommendations-page.tsx:184`, `PROJECT_CONTEXT.md:45-63`
  (ADR-002), `backend.ts:16-24` (`RoundBackgroundContext` has seven fields and
  no `totalStaffCount`), `pyproject.toml` (no chromadb).
- Evidence-card probes executed with `ai-analytics-service/.venv/bin/python`
  against the shipped code, not against copies. Results reproduced in the
  prototype document: `mixed-middle` and `polarized` separated at polarization
  0.040 vs 1.000 with identical score 60.0 and identical severity 0.500; the
  cross-dimension card fires exactly once, on `contradictory`; the
  within-dimension card never fires because `evals/corpus.py` gives every
  question inside a dimension the same spread; the three tier-1 Hebrew claims
  pass both `is_hebrew_only_copy` and `is_v6_qualitative_narrative` at 339–377
  characters, while two earlier drafts failed the 300-character floor at 292 and
  282.

### Failed

- None.

### Blocked or not run

- `npm run verify`, pytest, Playwright: not run. The diff is Markdown only and
  the verification matrix asks for frontmatter/link/structural checks for that
  row, which were run.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- The study is a snapshot of `14c2269`. Its `path:line` citations will drift as
  the code moves; anyone acting on it later should re-verify the specific lines
  a decision rests on.

## Failed approaches

- None.

## Known risks

- None to runtime; documentation only.

## Approval gates

- None triggered. No secrets, credentials, aliases or migrations touched.

## Questions requiring an owner decision

The full list is section 5 of the study. The three that gate everything else:

1. Must a manager *see* a citation? Yes forces a contract-version decision,
   because visible copy forbids Latin letters and digits. No means nothing on
   the wire changes at all.
2. Should evidence change *which* recommendation surfaces, or only justify the
   one that surfaced? These are near-disjoint changes.
3. Enrich the 192 catalog entries offline, or retrieve literature at runtime? A
   content project versus an architecture project.

The prototype adds three more, in section 7 of
`docs/evidence-card-prototype-2026-08-09.md`. One of them may outrank all of the
above: **the bridge between this product's eight dimensions and any published
framework is undocumented**, in this repository and in the owner's own strategy
document. Dr. Irene Diamant is named there as providing research guidance, so
the question has an addressee and costs no engineering to ask.

## Next concrete step

Wait for the owner's answers to decisions 1–3 in
`docs/scientific-evidence-layer-research-2026-08-09.md` section 5. Do not open
an implementation task before those answers exist.
