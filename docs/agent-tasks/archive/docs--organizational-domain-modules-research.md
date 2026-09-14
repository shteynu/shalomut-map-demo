# Research: can "Organizational Domain" modules be built on the existing architecture

## Metadata

- Branch: `docs/organizational-domain-modules-research`
- Base branch: `main`
- Base commit: `1cd6591`
- Current HEAD: the commit carrying this archive move, fifth on top of
  `1cd6591` — `a3ae60f` the document, `b60cb5d` §9 and item 24, `0d6fb85`
  §10, `1ec663c` item 25, then this move. `origin/main` is `1cd6591` and the
  branch fast-forwards onto it (`git merge-base --is-ancestor` confirmed
  after a fetch on 2026-09-14)
- Status: ready to land — archived 2026-09-14 as the branch goes to `main`.
  The push is the owner's; until it runs, this work is visible only in this
  worktree, because the branch was never pushed
- Last updated: 2026-09-14
- Last agent/tool: Claude Code (Claude Fable 5.1)

## Objective

Answer the owner's question of 2026-09-13: can the existing architecture carry
new domain modules — "Organizational Domain": delivery risk, team overload,
bottlenecks, organizational friction, onboarding, knowledge concentration,
attrition indicators, wellbeing — and which modules would the agent introduce,
ranked by how much weight each carries in organizations.

## User-visible outcome

One dated, read-only research document under `docs/`, indexed in
`docs/README.md`, with the decisions it raises listed in
`docs/open-decisions.md`. Nothing in the product changes.

## Context

- Since 2026-09-12 the default questionnaire is the 126-item research
  instrument (`src/lib/research-instrument.ts`), analysed under contract `7.0`
  (ADR-056), deployed 2026-09-13. Several proposed modules already have items
  inside it, bound to the eight dimensions or deliberately unscored.
- The eight dimensions are a product invariant in `PROJECT_CONTEXT.md`
  (ADR-004, development invariant 3), `docs/source-of-truth.md`, `PRODUCT.md`
  and both skills. A domain module that is a new taxonomy therefore needs an
  owner decision before any engineering.
- `docs/questionnaire-modularity-audit-2026-08-16.md` already priced "a
  different dimension set" (scenario d); this research re-measures it on
  today's `main` and adds the module question on top.

## Scope

- Read-only analysis of both runtimes, executed probes against shipped code,
  external evidence gathered by two research agents and labelled as such.
- The research document, its index entry and its open-decision entries.

## Non-goals

- No product, contract, schema or prompt change.
- No decision on behalf of the owner: options are priced, one is recommended,
  none is taken.

## Acceptance criteria

- Every code-level claim carries a `path:line` anchor on `1cd6591` or an
  executed probe; every external claim is labelled as researched, not verified.
- The document says plainly which proposed modules fit an anonymous-survey,
  k-anonymous, fixed-taxonomy pipeline and which do not, and why.

## Relevant repository instructions

- `.agents/skills/shalomut-tracker/SKILL.md` — session start, task file.
- `.agents/skills/shalomut-map/SKILL.md` — canonical boundaries (the eight
  dimensions, contracts `1.0`–`7.0`, privacy threshold).
- `.agents/skills/shalomut-verification/SKILL.md` — before claiming completion.

## Relevant architecture and contracts

- `src/lib/wellbeing-dimensions.ts`, `src/lib/shalomut-source.ts`,
  `contracts/wellbeing-dimensions.json` — the eight ids and their loader.
- `src/lib/survey-definition.ts` — parser refuses a foreign `dimensionId`;
  activation requires all eight.
- `src/lib/services/analytics.service.ts`, `src/lib/analytics-encoder.ts`,
  `contracts/ai-analytics-v7.json` — aggregates and the wire.
- `ai-analytics-service/src/contracts.py`, `schemas/mcp_types.py`,
  `schemas/stone_map_validation.py`, `data/interventions_kb.json` — the Python
  side of the same eight.
- `src/lib/privacy/cell-suppression.ts`, `src/lib/analytics/background-breakdown.ts`
  — the k-anonymity machinery any group-level module would reuse.

## Decisions made

- The document is written in Russian, as `methodologist-questions-analysis-2026-09-12.md`
  is: the owner reads it and asked in Russian; dated documents keep the
  language they were produced in (`AGENTS.md` §Language).
- Evidence labels follow the 2026-08-10 convention: `[проверено]` for what was
  read or executed in this repository, `[по исследованию]` for web research.

## Assumptions

- "Organizational Domain" is read as a family of modules for the same product
  and audience first; a second, non-school audience is priced separately as
  the widest option rather than assumed.

## Completed

- Branch created from `origin/main`; state established (`npm run agent:context`).
- Repository reading: skills, ADR-001–005, 011, 022, 024, 037, 056; the
  modularity audit; the strategy axes; the evidence study §1.4, §2, §3, §5;
  the instrument plan and the 2026-09-12 analysis; contracts `6.0`/`7.0`;
  Prisma schema; analytics service; encoder; dimension loader and presentation;
  Python contracts, ports, canonical schema, topics, catalog shape.
- Executed probes in both runtimes (see Verification evidence).
- The research document, written and anchored on `1cd6591`; the two agents'
  reports folded into §4 (measurement basis, meta-analytic weights, teacher
  studies, framework crosswalk) and §5 (eight survey vendors, eight
  engineering tools, the Israeli and OECD public instruments, attrition under
  anonymity), carrying only what the agents marked confirmed or secondary;
  §6 re-ordered from that evidence (friction above workload, and a note that
  management support — the strongest lever in the evidence — is already a
  stone with five items).
- Index entry in `docs/README.md`; item 23 in `docs/open-decisions.md`.
- 2026-09-14, on the owner's follow-up «а если коммерческая организация»:
  §9 added to the document, measured on the same snapshot — school words in
  the dimension texts and the canonical 24 (none), in the instrument (~20 of
  150 questions plus grid rows), prompts (11 lines, Hebrew-only validators),
  catalog (60 of 192), round context fields, 40 of 224 UI files, the flat
  `Organization`/`OrganizationMembership` model, the hard-coded `lang="he"`,
  the threshold floor; the payload of `7.0` carries no audience marker. Item
  24 in `docs/open-decisions.md`; the README entry names §9 and both items.
- 2026-09-14, on the owner's next question «насколько долго и затратно …
  интеграционный модуль»: §10 added — a plain-language summary, a calibration
  table from the repository (the `7.0` rollout in Git, the one shape the AI
  service accepts, no scheduler, no third-party token storage, the catalog
  without an owner), the five signal families, an effort table in
  person-weeks, where the cost really is, and what to do instead. The README
  entry names §10.
- 2026-09-14, on the owner's «да, добавь пункт 25»: the decision §10 raises —
  whether the product ever reads a client's systems — is item 25 in
  `docs/open-decisions.md`; §10.6 and the README entry now point at it.

## In progress

- (none)

## Remaining

- Owner: land the branch with
  `git push origin docs/organizational-domain-modules-research:main`, then
  read the document and answer items 23 to 25 in `docs/open-decisions.md`.
  No agent work is left on it.

## Changed files

- `docs/agent-tasks/archive/docs--organizational-domain-modules-research.md`
  (new; lived under `active/` until this move)
- `docs/organizational-domain-modules-research-2026-09-13.md` (new; §1–§8 on
  2026-09-13, §9 and §10 on 2026-09-14)
- `docs/README.md` — index entry under *Historical plans and evidence*
- `docs/open-decisions.md` — items 23 to 25 under *Product decisions that are
  holding code*

All of it is committed on this branch in the five commits named above; nothing
is staged or unstaged for this task. `next-env.d.ts` is modified by the last
Next command, is not part of this task and was left unstaged.

## Verification evidence

### Passed

- Core probe, `npx tsx` against `1cd6591` (script kept outside the repository):
  a question bound to `delivery-risk` → `Survey contains an invalid question.`;
  a `balance`-only questionnaire parses leniently and is not activatable, strict
  parse → `Enabled survey questions must cover all eight dimensions before
  activation.`; a dimension-texts manifest with 9 or 7 entries → refused by
  `loadDimensionTexts`; the default instrument counts 150 stored questions,
  78 analytic (balance 36, certainty 9, social-resource 7, meaning 7,
  organizational-climate 6, management-support 5, professional-competence 5,
  self-expression 3) and 72 background.
- Python probe, `ai-analytics-service/.venv/bin/python` against the `7.0`
  positive case of `contracts/fixtures/golden_corpus.json`: unmodified payload
  accepted; a ninth `dimensionScores` entry → `Dynamic AI analytics contract
  requires exactly eight canonical dimension scores`; a question aggregate bound
  to `delivery-risk` → `Question aggregate 'q-0' must use a supported
  dimension`; seven dimensions → the same eight-dimension refusal.
- Anchors: every `path:line` cited in the document was re-read with `grep`/`sed`
  on `1cd6591` after writing; eight were corrected.
- `git diff --check` — exit 0.
- Link check (script outside the repository), after the agents' sections
  were in: 83 links in the new document, every relative one resolves; the
  mermaid block has no `;` and no `<br/>`; every Markdown table has a
  consistent column count; no `pending` marker is left.
- `npm run lint:doc-numbers` — passed twice, before and after §4–§5 (26
  claims across 4 documents; this document quotes no configured number the
  gate registers).
- `git diff --check` — exit 0 after every edit.
- 2026-09-14, after §9: `git diff --check` exit 0; link check — 100 links in
  the document, every relative one resolves, README and open-decisions links
  resolve; every table has a consistent column count; `npm run
  lint:doc-numbers` passed (26 claims across 4 documents).
- 2026-09-14, after §10: the same four checks — `git diff --check` exit 0,
  103 links with every relative one resolving, even tables, `lint:doc-numbers`
  passed.
- 2026-09-14, after item 25: `git diff --check` exit 0; links in the three
  documents resolve; `lint:doc-numbers` passed.

### Failed

- (none)

### Blocked or not run

- `verify:core` beyond `lint:doc-numbers`: not run — the diff is Markdown
  only, and that is the one gate `scripts/gate-hook.mjs` maps to `docs/*.md`.

### Environment

- macOS, repository at `1cd6591`, Node via `npx tsx`, Python via
  `ai-analytics-service/.venv/bin/python`.

### Residual risk

- File counts are from `grep` on this commit and drift with the code.

## Failed approaches

- (none)

## Known risks

- External evidence is agent web research and is not independently confirmed.

## Approval gates

- None: read-only research and documentation.

## Questions requiring an owner decision

- Recorded in the research document and mirrored in `docs/open-decisions.md`.

## Next concrete step

Owner: `git push origin docs/organizational-domain-modules-research:main`.
That command is the owner's to run — the agent's attempt was refused by the
permission classifier on 2026-09-14. Vercel builds every push to `main`; this
one is Markdown only, so the build changes nothing a respondent or a manager
sees. After landing: read `docs/organizational-domain-modules-research-2026-09-13.md`
(the short answer, §6–§7, §9 and §10 are enough to decide) and answer items
23 to 25 in `docs/open-decisions.md`.
