# Documentation map

Use this index to decide whether a document describes current behavior,
freezes an implemented contract, or only records how earlier work was planned.
Current code, tests, schemas and configuration always win over prose.

## Living sources of truth

These files must stay aligned with `main`:

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | Repository entry point, local start and verification commands |
| [`../PRODUCT.md`](../PRODUCT.md) | Users, product purpose, privacy posture, voice and design principles |
| [`../PROJECT_CONTEXT.md`](../PROJECT_CONTEXT.md) | Stable architecture, environments and long-lived decisions |
| [`../ROADMAP.md`](../ROADMAP.md) | Completed platform phases and the next product/architecture outcomes |
| [`../PROGRESS.md`](../PROGRESS.md) | Concise product-level milestones and major completed capabilities |
| [`source-of-truth.md`](source-of-truth.md) | Survey methodology, field ownership and runtime source roles |
| [`local-environment.md`](local-environment.md) | Supported local stack and setup |
| [`ai-contract-version-matrix.md`](ai-contract-version-matrix.md) | Contract capabilities, produced/supported versions and rollout rule |
| [`ai-analytics-handoff.md`](ai-analytics-handoff.md) | Current cross-service AI architecture and boundaries |
| [`ai-analysis-run-lifecycle.md`](ai-analysis-run-lifecycle.md) | One durable analysis run end to end — claim, lease, heartbeat, callback and every failure branch — as diagrams, endpoints and constants |
| [`platform-handbook.md`](platform-handbook.md) | What the whole platform does, in language a non-developer reads; the source text every translated snapshot is released from |
| [`shalomut-tracker-handoff.md`](shalomut-tracker-handoff.md) | Current deployed/operational state, external blockers and approval gates |
| [`data-flow-and-subprocessors.md`](data-flow-and-subprocessors.md) | Who receives respondent data, what crosses each boundary and where it is hosted; the factual basis every future legal document rests on |
| [`../ai-analytics-service/README.md`](../ai-analytics-service/README.md) | Python service runtime, configuration and verification |
| [`../AGENTS.md`](../AGENTS.md) and [`.agents/skills/`](../.agents/skills/) | Canonical repository instructions for coding agents |

## Implemented specifications

These documents define behavior that remains testable, even when their rollout
sections are historical:

- [`dashboard-semantic-contract.md`](dashboard-semantic-contract.md) — semantic
  foundation introduced in `2.0`; current runtime extends it through `6.0`.
- [`dynamic-questionnaire-ai-contract.md`](dynamic-questionnaire-ai-contract.md)
  — dynamic-questionnaire foundation introduced in `3.0`.
- [`product-requirements-summary.md`](product-requirements-summary.md) — source
  summary for the original product and methodology.
- [`product-behaviour-backlog.md`](product-behaviour-backlog.md) — remaining
  user-behavior improvements; completed items stay marked completed.
- [`adr/`](adr/) — accepted architectural decisions. Later living docs may
  refine operational detail without rewriting the decision history.

Versioned machine-readable contracts live under `contracts/`; shared behavior
is indexed by `contracts/capabilities.json`. OpenAPI has one editable source,
[`openapi.yaml`](openapi.yaml); `public/openapi.json` is generated from it by
`npm run openapi:generate` and must never be edited by hand.

One section of a living document is generated the same way, and for the same
reason: the endpoint surface table in
[`ai-analysis-run-lifecycle.md`](ai-analysis-run-lifecycle.md) is written by
`npm run docs:endpoints` from the routes in `src/app/api` and the decorators in
`ai-analytics-service/src/main.py`, between its `generated:endpoint-surface`
markers. `npm test` fails when the two disagree, in either direction — a route
the table has lost, and a row whose route is gone. Everything outside those
markers is prose a person writes; an endpoint's *direction* and its answer codes
are declared in the script, because a machine can see that a route exists and
not who calls it.

## Released snapshots

[`snapshots/`](snapshots/README.md) holds translations of a source document,
released at a date rather than kept continuously aligned. A snapshot is never
the place to add content: a correction found while reading one goes into its
source, and the snapshot is re-released. When a snapshot is older than its
source, the source wins — that is the normal state between releases.

Currently: [`snapshots/platform-handbook.ru.md`](snapshots/platform-handbook.ru.md)
and [`snapshots/platform-handbook.he.md`](snapshots/platform-handbook.he.md),
both released from [`platform-handbook.md`](platform-handbook.md). A snapshot may
also be published outside the repository for readers who do not use Git; the
constraints on doing so are in `snapshots/README.md`.

## Live plans

A plan belongs here while it is the current task queue, and moves to the
historical section below once it is delivered or abandoned. This section exists
because the two states are read differently: a live plan is meant to be acted
on, and a historical one explicitly is not.

- [`default-research-instrument-plan-2026-08-14.md`](default-research-instrument-plan-2026-08-14.md)
  — replacing the default 24-question template with the owner's 126-item
  research instrument. Six phases, three owner decisions taken and five open.
  **Not yet implemented**: every living document still describes the
  24-question default, because that is what the code does.
- [`methodologist-questions-2026-08-15-ru.md`](methodologist-questions-2026-08-15-ru.md)
  and [`methodologist-questions-2026-08-15-he.md`](methodologist-questions-2026-08-15-he.md)
  — the same six questions in Russian and Hebrew, written to be sent outside
  the repository. They ask what the eight dimensions rest on, for the
  item-to-dimension mapping that blocks phases 3, 5 and 6 of the plan above,
  where the scoring bands belong on a 1–5/1–7 scale, what the two allocation
  grids are for, who owns the intervention catalog, and — added 2026-08-17 —
  whether attention-check items belong in this instrument at all. Question 6
  states up front that exclusion is already closed, so that a positive answer
  cannot be read as reopening it; ADR-022 in `PROJECT_CONTEXT.md` is why. **Outgoing, not a
  specification**: nothing here may be implemented from, because every line of
  it is a question. Keep the two files in step — an answer that arrives against
  one version applies to both.

## Historical plans and evidence

Dated plans and rollout records are evidence of decisions at that time, not a
current task queue. Do not mechanically update their old commands, test counts
or deployment snapshots. The one plan that *is* a current task queue is listed
under "Live plans" above:

- `*-plan*.md`, `completion-plan-*`, `manager-feedback-plan-*`,
  `provider-quota-plan-*` and `e2-step3-contract-version-rollout.md`;
- [`questionnaire-modularity-audit-2026-08-16.md`](questionnaire-modularity-audit-2026-08-16.md)
  — dated read-only audit of whether a different questionnaire, several default
  templates, a Likert scale or a different dimension set cost data or code.
  Prices all four against `5c7b254`, names what is already right, and records
  three hypotheses that an adversarial pass refuted. Two of its findings were
  established by executing shipped code rather than reading it — including a
  1–7 round whose twelve midpoint answers are published as twelve "yellow".
  **Not for implementation**: three options with no winner declared, and a
  recommendation that is the agent's rather than an owner decision;
- [`scientific-evidence-layer-research-2026-08-09.md`](scientific-evidence-layer-research-2026-08-09.md)
  — dated read-only study of where the AI pipeline lacks scientific evidence and
  which extension points exist. **Not for implementation**: material for a
  product discussion, with unranked alternatives and open owner decisions.
  §1.7 is **stale**: it reads as though no attribution reaches the manager, and
  one has since 2026-08-11 (`dashboard-goals-panel.tsx:136`);
- [`evidence-card-prototype-2026-08-09.md`](evidence-card-prototype-2026-08-09.md)
  — companion to that study: what one unit of research evidence would look like
  and what it costs to produce, measured by running probes against the shipped
  validators, statistics and eval corpus. **Not for implementation**: the card
  format is a probe, not a specification, and the scripts were deliberately kept
  outside the repository;
- [`product-strategy-axes-2026-08-10.md`](product-strategy-axes-2026-08-10.md) —
  dated 360° sweep of the product as a product, a system and a business, ranked
  against the owner's stated goal of a first pilot in a real school.
  **Not for implementation**: an agenda of analysis axes with seven open owner
  decisions, not a task queue. Code-level claims are labelled `[verified]` and
  checked in this repository; market, legal and psychometric claims are labelled
  `[researched]` and are unconfirmed leads;
- [`ai-service-incidental-findings-2026-08-09.md`](ai-service-incidental-findings-2026-08-09.md)
  — defects and drift found during that study. Deferred by owner decision on
  2026-08-09, then all seven fixed the same day; the file records what each one
  was and which branch closed it;
- `wellbeing-refactoring-plan-v4-review.md` (its section 6 is the final audit of
  the merged refactoring stack; remaining work is summarized in `ROADMAP.md`);
- `redesign-change-log.md`;
- [`archive/documentation-snapshots/`](archive/documentation-snapshots/) —
  explicitly labelled pre-compaction copies of substantially rewritten living
  documents;
- [`agent-tasks/archive/`](agent-tasks/archive/) and Git history.

Branch-local in-progress state belongs only in
[`agent-tasks/active/`](agent-tasks/active/) and follows
[`agent-tasks/README.md`](agent-tasks/README.md).

## Update rules

- Update a living document when its owned state changes.
- Update an implemented specification only when its contract changes; keep
  older-version sections explicitly historical.
- Do not copy task evidence into `PROGRESS.md` or the operational handoff.
- Keep exact test counts in task evidence, not evergreen instructions.
- Never store secrets, credentials, respondent data, chats or private session
  URLs in documentation.
