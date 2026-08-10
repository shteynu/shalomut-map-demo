# Product strategy axes — 360° analysis sweep

## Metadata

- Branch: `docs/product-strategy-axes`
- Base branch: `main`
- Base commit: `50fac0f`
- Landed as: `b42b509` on `main`, 2026-08-10.
- Status: closed. The document is in `docs/`, and the seven owner decisions it
  raises are tracked in `docs/shalomut-tracker-handoff.md`, not here.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Answer the owner's question — which analysis axes would make Shalomut better in
every respect as a hi-tech product, especially the axes never opened — and leave
a strategy document in the repository.

## User-visible outcome

None. Documentation only; no runtime file changed.

## Context

The owner asked at session start for analysis points across product, technical,
design, marketing, profit and best practice, explicitly inviting web research and
comparison. Four framing answers were given on 2026-08-10 and are recorded in the
deliverable: not a business yet (R&D/portfolio), first pilot in a real school
within ~3 months, Arabic sector out of scope, output is a repository document.

Produced by a 14-agent sweep: seven repository audits, five external research
areas, one synthesis and one completeness critic. 145 raw findings.

## Scope

- Read-only investigation of `src/`, `ai-analytics-service/`, `prisma/`,
  `contracts/`, `docs/`, plus external research.
- One dated study under `docs/` and its lifecycle-index entry.

## Non-goals

- No runtime change, no fix, no refactor. Several findings are defects with
  named files and lines; none was fixed in this task on purpose, so the document
  stays a decision input rather than a half-executed plan.
- No re-opening of decisions already taken with reasons on record.

## Acceptance criteria

- Every code-level claim in the deliverable is checked against this repository,
  with file and line.
- Claims from external research are labelled as unverified leads and are never
  presented as facts.
- The document is registered in `docs/README.md` under the correct lifecycle
  section.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-tracker/SKILL.md` (read in full at session
start), `.agents/skills/shalomut-verification/SKILL.md` (read before recording
evidence). `docs/README.md` update rules.

## Decisions made

- The deliverable is classified as a **dated study, not for implementation**,
  following the precedent of
  `docs/scientific-evidence-layer-research-2026-08-09.md`. Its findings about the
  code are current; its agenda is a proposal awaiting owner decisions.
- The synthesis ranked the commercial procurement rail first. It was **re-ranked
  here** against the owner's answers: with "not a business yet" plus "a pilot with
  real teachers", the binding constraints are permission, the public boundary,
  measurement validity on a phone, funnel instrumentation and observability.
- Every external legal, market and psychometric claim is labelled `[researched]`
  and explicitly marked unverified. Nothing about Israeli law is asserted as fact.

## Assumptions

- "First pilot in a real school" means real teachers submitting real answers,
  which is what converts the repository's deferred gates into blockers.

## Completed

- 14-agent sweep across twelve areas, synthesis and completeness critique.
- Independent verification in this worktree of every code-level claim used.
- `docs/product-strategy-axes-2026-08-10.md` written.
- `docs/README.md` lifecycle entry added.

## In progress

None.

## Remaining

Nothing for an agent. Seven owner decisions are listed in the deliverable.

## Changed files

- `docs/product-strategy-axes-2026-08-10.md` (new)
- `docs/README.md` (one lifecycle entry)
- `docs/agent-tasks/active/docs--product-strategy-axes.md` (this file)

## Verification evidence

### Passed

Documentation-only diff, so the verification matrix selects structural checks
rather than the suite. Claims were verified individually by reading source in
this worktree on 2026-08-10:

- `src/lib/services/round.service.ts:20-22` — `Math.random()` share code, four
  characters, no retry; `crypto.randomUUID()` in use six lines below.
- `src/app/api/survey/[shareCode]/route.ts` returns the whole `round` object and
  echoes `round.title` in the 400; `prisma-round.repository.ts:58` maps
  `backgroundContext` into that object.
- `src/app/globals.css:5384` — `.answer-stone span { display: none }` inside
  `@media (max-width: 620px)`.
- `src/lib/survey-definition.ts:267` — `estimatedMinutes: 15`, rendered at
  `survey-consent-step.tsx:72`.
- `next.config.ts` has no `headers()`; no `vercel.json` exists.
- `dashboard-map-page.tsx:199` — `onClick={() => window.print()}`;
  `grep -c '@media print' src/app/globals.css` returns `0`.
- `src/middleware.ts:75-83` with `basic-auth.ts:15-45` — `/api/health` is in no
  bypass list; `/api/mcp` bypasses unconditionally for every method.
- `manager-scope.service.ts:34` — `orgRepo.findAll()` as the scoping primitive.
- `endDate` has nine references, all types/persistence/creation; no rule reads it.
- `src/app/page.tsx:53` — `getStatusCount` returns `0` while analytics are locked.
- No inbound rate limiting and no error-tracking dependency anywhere in `src/`
  or `package.json`.
- `src/lib/shalomut-source.ts` — eleven feminine-singular forms across the three
  anchors and the default questions; `:137` shows the triple-barrelled green
  option.
- `gh repo view` — public since 2026-06-16, `licenseInfo: null`, no LICENSE file.
- `git log` — 587 commits, 88 from a corporate address, 414 with a Claude
  co-author trailer.
- `.env.deployed.local` — deployed database is `aws-1-ap-northeast-2` (Seoul).

### Failed

None.

### Blocked or not run

- `npm run verify`, the Python suite, Playwright and the mutation run: **not
  run**. No runtime, schema, contract or Python file is in this diff.
- Every `[researched]` claim — Israeli procurement, Amendment 13, the Chief
  Scientist directive, the Ministry supplier standard, RAMA `שאלון אח"מ`, TALIS
  figures, competitor pricing, the psychometric literature and the LLM cost
  estimate — was **not independently verified**. They are labelled as leads in
  the document itself.
- Statistical claims about minimum detectable change and band-edge pool switching
  were reproduced by the researching agent, not re-derived here.

### Environment

Local worktree only. Nothing was read from or written to the deployed
environment, and no database was touched.

### Residual risk

The document's value depends on the `[researched]` half, which is exactly the
half that is unverified. The legal items in particular need a human professional
before any of them becomes a decision. The completeness critic's first finding
stands: no human user has been spoken to, so the ranking itself is an inference.

## Failed approaches

None.

## Known risks

- A future agent could read the axes as a task queue. The document says twice
  that it is not one, and its lifecycle entry says so a third time.

## Approval gates

None consumed. The credential rotation the operational handoff already carries as
a deferred gate is restated in the document as due before the first real
respondent — it is not opened or closed here.

## Questions requiring an owner decision

The seven at the end of `docs/product-strategy-axes-2026-08-10.md`. The two that
gate the most other work: whether a pilot school can be named, and whether the
three-colour *answer scale* may change.

## Next concrete step

Answer decision 1 — name the pilot school and its date — or, if that is not yet
possible, take the four Tier 0 cheap wins that are unconditional regardless of
which school it turns out to be: the survey GET whitelist, the share-code
entropy, the `display: none` deletion at `globals.css:5384`, and
`estimatedMinutes` derived from question count.
