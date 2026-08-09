# Research: Scientific Evidence Layer for the Shalomut AI pipeline

## Metadata

- Branch: research/scientific-evidence-layer
- Base branch: main
- Base commit: 14c2269
- Current HEAD: the single commit on this branch, which adds the two dated
  documents and this file (`git log -1`). Not pushed.
- Status: research complete, awaiting owner decisions
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

## In progress

- Nothing.

## Remaining

- Owner answers the twelve decisions in section 5 of the study. Until then no
  implementation task can be scoped, because decisions 1–3 alone select between
  three different projects.

## Changed files

- `docs/agent-tasks/active/research--scientific-evidence-layer.md` (this file,
  untracked).
- `docs/scientific-evidence-layer-research-2026-08-09.md` (untracked).
- `docs/ai-service-incidental-findings-2026-08-09.md` (untracked).
- `docs/README.md` (modified, unstaged).
- Pre-existing unrelated modifications left untouched:
  `.idea/shalomut-map-demo.iml`, `next-env.d.ts`.

## Verification evidence

### Passed

- `git diff --check` — exit 0.
- Relative-link validation over the four touched Markdown files: 108 links
  checked, all targets exist.
- Independent spot-checks of quoted citations against the code:
  `hebrew_prompts.py:523` (`v6_intervention_fallback`), `graders.py:327`
  (`grade_evidence_specificity`), `product-requirements-summary.md:19/43/58`,
  `goal-rows.ts:38`, `trigger-ai-analytics.ts:45,107`,
  `dashboard-recommendations-page.tsx:184`, `PROJECT_CONTEXT.md:45-63`
  (ADR-002), `backend.ts:16-24` (`RoundBackgroundContext` has seven fields and
  no `totalStaffCount`), `pyproject.toml` (no chromadb).

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

## Next concrete step

Wait for the owner's answers to decisions 1–3 in
`docs/scientific-evidence-layer-research-2026-08-09.md` section 5; only then
open an implementation task on its own branch.
