---
name: shalomut-map
description: Work on the Shalomut Map product and code in the shalomut-map-demo repository. Use when changing UI/UX, Hebrew RTL, the survey and its methodology, wellbeing dimensions, scoring, the privacy threshold, manager flows, the dashboard stone map, persistence, the API, the AI analytics integration, product documentation or source-of-truth files.
---

# Shalomut Map

## How to read this skill

Always in force: `Purpose` — what this skill does and where the rest goes;
`Canonical boundaries` — the product invariants, any one of which breaks
privacy, a contract or the taxonomy when violated; `Change safety` — approval
gates and environment boundaries.

On condition: `Starting work` — implementation begins or resumes;
`Product and UI` — the diff touches screens, copy, styles, accessibility or the
presentation modules in `src/lib/dashboard/*`; `Verification` — before claiming
readiness.

## Purpose

Use this skill for domain and product implementation. To continue a session,
establish current status or prepare a handoff, use the neighbouring
`../shalomut-tracker/SKILL.md`.

## Starting work

Before substantial implementation, use `../shalomut-tracker/SKILL.md` to
establish the current branch's task file, its scope and its `Next concrete
step`.

1. Determine the repository root with `git rev-parse --show-toplevel`.
2. Start from the branch's task file and the relevant code: they are more
   accurate than prose. Open `docs/README.md` to learn a document's status only
   when you are about to rely on it or edit it, and `docs/source-of-truth.md`
   when the task touches the survey, the methodology or the provenance of
   canonical data.
3. Load only the sections a task type needs, not a whole document:
   - UI/UX: `PRODUCT.md` and `design.md`;
   - runtime, API and persistence: the sections of `PROJECT_CONTEXT.md` holding
     the stable architectural decision for the boundary being touched;
     `docs/shalomut-tracker-handoff.md` on deployment, migrations, a change of
     environment configuration or alias, and whenever the work depends on
     external state. The condition is stated as a class of task, not as "does it
     touch a blocker": whether a blocker exists is not visible from the diff,
     which is exactly what that document reports;
   - AI analytics: `docs/ai-contract-version-matrix.md`,
     `contracts/capabilities.json`, the relevant versioned manifest and
     `ai-analytics-service/README.md`; `docs/ai-analytics-handoff.md` gives the
     cross-service overview, and archived rollout details are not current state;
   - survey methodology: `src/lib/shalomut-source.ts`; the Hebrew texts of the
     eight dimensions live in `contracts/wellbeing-dimensions.json` and are read
     through `src/lib/wellbeing-dimensions.ts`.
4. Check existing components, tests and patterns before adding new abstractions.

Find the section you need by heading or search first — the same rule as in
`../shalomut-tracker/SKILL.md`. Read a global document end to end only when the
task requires all of it, such as an audit of the document itself.

## Canonical boundaries

- Use `src/lib/shalomut-source.ts` as the source of the eight canonical
  dashboard dimensions, the scoring/status semantics and the default
  questionnaire template. Their Hebrew texts — name, description and the heading
  from the Google Form — live in `contracts/wellbeing-dimensions.json` and are
  read through `src/lib/wellbeing-dimensions.ts`; renaming a dimension is a
  manifest edit, not a code change. The list of eight ids stays compile-time,
  and the loader refuses a manifest that has reordered, shortened or extended
  it. The actual source of questions for a given round must be the persisted
  `SurveyRound.surveyDefinition` snapshot.
- Treat the Google Form as the upstream source of the default/v1 questionnaire
  template and Adobe XD as a visual reference, per `docs/source-of-truth.md`.
- Never use `DEMO_ORGANIZATION`, `DEMO_ROUND` or `SHALOM-DEMO` as a hidden
  runtime fallback; they are admissible only as explicit test fixtures.
  `src/lib/demo-data.ts` has been deleted — do not bring demo analytics back
  into a production module.
- Dashboard screens render `DashboardInsightsDto`
  (`src/lib/dashboard/dashboard-insights.ts`), not the wire type. The only
  translation from `StoneMapResult` is `toDashboardInsights` in
  `ai-insights-view-model.ts`. A dimension's static presentation — map geometry,
  stone shape, colour — lives in `src/lib/dashboard/dimension-presentation.ts`;
  labels are no longer stored there, because a second copy of a name had already
  drifted from the methodology, and since 2026-08-21 a dimension has one name.
- Leave empty or unavailable persistence empty; deployed writes without
  `DATABASE_URL` must fail closed.
- Keep the eight wellbeing dimensions as the stable output taxonomy of the
  Dashboard Stone Map. Do not treat the canonical 24 questions as a mandatory
  runtime set: they are a default/legacy template, and a round's survey may hold
  a different number, different IDs and different wordings of product-relevant
  questions.
- Every analysed question must have a stable round-scoped ID, its exact
  persisted text and an explicit binding to one of the eight dimensions. AI
  input, question metrics, fallback and provenance must all use that round's
  snapshot, never substituting text or IDs from the default template.
- Preserve the fixed shape of the Dashboard output: eight stones, status-aware
  Hebrew interpretation/actions, a shared summary and question-grounded metrics.
  If the safe data is not enough to cover all eight dimensions, finish the
  analysis in a locked/validation state rather than inventing the missing
  stones.
- Do not silently change the semantics of published contracts `1.0`–`6.0`.
  Capability policy lives in `contracts/capabilities.json` and runtime status in
  `docs/ai-contract-version-matrix.md`. Incompatible new semantics require a new
  versioned manifest and a consumer-first rollout.
- Keep scoring thresholds in the single source `contracts/scoring-bands.json`
  (Core — `src/lib/scoring-bands.ts`, Python — `src/schemas/scoring_bands.py`).
  The current bands: green `>=75`, yellow `50–74`, red `<50`. Do not return
  threshold literals to the code. The bands are per deployment, not per round:
  the service validates status against score, so per-round bands mean new
  contract semantics and a new versioned manifest.
- Apply the configured privacy threshold: `10` is both the default and the
  minimum, and a manager may only raise it. Never expose respondent identity,
  individual answers or detailed results below the threshold. For a dynamic
  questionnaire there is no partial unlocked analysis: if the total or even one
  analysed question is below the threshold, the whole detailed result stays
  locked and the provider is not called.
- Route a manager's path to a school's data through one of the two chokepoints:
  `loadManagerContext` for screens and `authorizeManagerRound` for round routes.
  Each records a platform administrator's visit to a school they are not a
  member of, and takes the school from the answer rather than from the request —
  most requests do not name a school at all. `npm run lint:tenant-chokepoints`
  checks this; a page that reads persistence itself must be named in its list of
  pages that are not about one school.
- Preserve the boundary between the Core Data Layer and the external AI
  analytics service. Check the versioned contract and use fail-closed transport.
- Keep canonical domain models separate from wire contracts: Core computes
  `CanonicalRoundAnalytics` and encodes it through `encodeAnalyticsInput`, while
  Python parses `CanonicalAnalysisInput` and builds its payload through an
  output adapter. The Python application boundary uses the ports
  `AnalyticsSource`, `ResultSink`, `JobStore` and `TextGenerator`; in Core every
  repository is assembled in `src/lib/composition-root.ts`, and
  `resolveCoreRepositories()` is called only by entrypoints — a route handler, a
  server-component context loader, a script or a test. Everything below that
  boundary receives repositories as arguments; `npm run lint:composition` checks
  it.
- Keep the API description in the single editable source `docs/openapi.yaml`.
  `public/openapi.json` is generated: editing it by hand is drift, not a change.
  The rule sits here rather than under `Verification` because it decides which
  file may be opened for editing at all.

## Product and UI

- Design Hebrew RTL as the primary experience, including reading order,
  navigation arrows and responsive layout.
- Meet WCAG AA and never convey status by colour alone.
- Do not use white text on bright green/yellow status surfaces.
- Keep the warm organic stone-map language of `design.md`; avoid a cold
  corporate dashboard aesthetic.
- Prefer existing components and tokens.
- Keep empty, loading, error and privacy-locked states first-class.

## Change safety

- The project is at the design stage: there are exactly two environments, local
  and deployed; there are no real respondents and no production data, and the
  Vercel alias named `Production` is an operational staging endpoint. Treat
  database contents as disposable: `db:clear`, reseeding, resetting the schema
  and applying migrations are ordinary work, with no approval ritual, backup or
  PITR checkpoint. Confirm the target environment so that a write does not waste
  time going to the wrong place, not because the data is precious.
- Explicit bounded confirmation is required for secrets, credentials,
  authentication configuration and repointing deployment aliases.
- Do not connect public manager writes to real data without authentication,
  authorization or confirmed deployment protection.
- If implementation uncovers a new architecture, privacy, contract, persistence
  or deployment risk, hand control back to `shalomut-tracker` to update task
  state and decide about escalation.

## Verification

- Before claiming readiness, read and follow `../shalomut-verification/SKILL.md`.
- After changing the survey source, check the respondent and dashboard flows.
- After an API change run `npm run openapi:generate` and commit the updated
  `public/openapi.json`. Which of the two files is editable is stated in
  `Canonical boundaries`.
- Report only checks that actually ran.
