# Product Roadmap — Shalomut Map (מפת שלומות)

Updated: 2026-08-02. This roadmap summarizes outcomes; detailed session history
belongs in archived task files and Git.

## Completed platform foundation

- Hebrew RTL-first, warm organic Stone Map UI with explicit status labels,
  privacy-locked states and WCAG AA targets.
- Persisted organizations, configurable survey rounds, dynamic questionnaires,
  anonymous response submission and PostgreSQL-backed aggregation.
- Application-level manager login and server-owned organization scope; machine
  endpoints use separate shared-secret boundaries.
- Privacy threshold of ten as both default and minimum, with lifecycle-aware
  manager messaging before and after the threshold.
- Database-enforced response idempotency and durable AI analysis jobs with
  queue/lease/heartbeat/retry/callback state.
- Versioned AI analytics contracts `1.0`–`6.0`, shared capability metadata,
  callback cross-runtime corpora and fail-closed validation.
- Dynamic exact-question analytics, background context, score distributions,
  partial-map history, structured V6 summaries, narrative metrics and five
  recommendations per stone.
- AI-assisted questionnaire suggestions that identify their source and require
  a manager edit before joining the questionnaire.
- Canonical Core analytics separated from wire encoding; Python parsing/output
  adapters and application ports for source, sink, job store and text generator.
- Full TypeScript, PostgreSQL and Python verification in CI, plus an opt-in
  Stryker mutation-testing pilot for `src/lib/ai-contract.ts`.

## Next product outcomes

1. **Comparative multi-round analytics** — compare wellbeing across semesters
   instead of treating each round as an island.
2. **From recommendations to action** — decide whether recommendations remain
   read-only or become tracked goals/action plans.
3. **Survey-builder recovery and efficiency** — visible save metadata,
   search/bulk/reorder behavior and optional version history.
4. **Dashboard interaction accessibility** — keyboard stone movement and a
   focused audit of labels, focus behavior and reduced-motion coverage.
5. **Clipboard failure honesty** — distinguish a successful copy from a
   browser permission failure and show a fallback.

## Next architecture outcomes

1. Define a stable `DashboardInsightsDto` and remove remaining production type
   ownership from `src/lib/demo-data.ts`.
2. Replace the current single-organization/password gate with the chosen
   long-term identity model before multi-tenant or real-respondent rollout.
3. Decide whether OpenAPI remains two integrity-checked mirrors or is generated
   from one source.
4. Expand mutation testing only after classifying high-value surviving mutants;
   the current pilot is intentionally focused and non-blocking.

## Conditional, not scheduled

- Nx monorepo migration only if the product is actually split into independently
  built applications such as survey, admin and mobile.
- Additional deployed environments only when product operations require them;
  today the supported environments are local and deployed.
