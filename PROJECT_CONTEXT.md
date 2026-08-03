# PROJECT CONTEXT: Shalomut Map (מפת שלומות)

Updated: 2026-08-03. This file owns stable architecture and long-lived product
decisions. Current branch work belongs in `docs/agent-tasks/active/`, milestones
in `PROGRESS.md`, and deployed/operational state in
`docs/shalomut-tracker-handoff.md`.

## Product and stack

Shalomut Map is an RTL-first platform for school-staff wellbeing surveys. A
manager configures a round and its questionnaire, teachers answer anonymously,
and privacy-safe aggregates become an eight-dimension organic Stone Map.

- Core: Next.js 16 App Router, React 19, TypeScript 6.
- Persistence: PostgreSQL through Prisma 7.
- AI analytics: separate Python 3.11+ FastAPI service.
- Styling: Tailwind CSS 4, CSS variables and warm organic tokens.
- Deployment shape: Vercel Core, Render Python service, Supabase PostgreSQL.
- Contracts: JSON manifests `1.0`–`6.0`, shared capability registry and an
  OpenAPI specification with one editable source.

The documentation lifecycle and owners are indexed in `docs/README.md`.

## Stable architectural decisions

### ADR-001: Core owns data; the AI service owns generated interpretation

Core owns organizations, rounds, exact questionnaire snapshots, anonymous
responses, privacy gating, deterministic score/status facts, persistence and
Dashboard delivery. The external AI service reads only privacy-safe aggregates
and writes Hebrew interpretations, summaries, narrative metrics and
recommendations. It never receives respondent identity or individual answers.

Core does not hide an expert recommendation engine behind a runtime fallback.
Human-authored catalog copy and aggregate-grounded green fallback text are
explicit, provenance-labelled boundaries, not simulated provider output.

### ADR-002: Versioned contracts and consumer-first rollout

Published contracts `1.0`–`6.0` retain their released semantics. Their machine
sources live under `contracts/`; cross-version policy lives in
`contracts/capabilities.json`, and current produced/supported status lives in
`docs/ai-contract-version-matrix.md`.

Core currently can produce `3.0`–`6.0`. An unset
`AI_ANALYTICS_CONTRACT_VERSION` resolves to rollback-safe `5.0`; the deployed
environment explicitly selects `6.0`. Unknown values fail closed. A new
incompatible exchange requires a new manifest and a consumer-first sequence:
consumer acceptance, callback/read compatibility, producer capability, then
the configured switch.

Core computes version-free `CanonicalRoundAnalytics` and encodes a chosen wire
contract through `encodeAnalyticsInput`. Python parses validated input into
`CanonicalAnalysisInput` and builds success/locked/failure payloads through its
output adapter. This prevents domain calculations and graph state from becoming
version-specific wire models.

### ADR-003: Empty persistence remains empty

Missing `DATABASE_URL`, an unavailable Prisma client or an empty database must
not invent an organization, round or response. In-memory repositories start
empty. `DEMO_ORGANIZATION`, `DEMO_ROUND` and `SHALOM-DEMO` are test fixtures
only, never a hidden runtime fallback. Since 2026-08-03 there are no demo
scores or demo analysis copy to fall back to: `src/lib/demo-data.ts` is gone,
and a screen with no analysis says so.

Deployed writes without durable persistence fail closed. Manager screens show
explicit onboarding/empty/error states.

### ADR-004: Dynamic questionnaire input, fixed Dashboard taxonomy

`SurveyRound.surveyDefinition` is the exact runtime snapshot. The original 24
questions are the default/legacy template, not a product-wide allowlist. Every
enabled analyzed question has a stable round-scoped ID, exact text and one of
the eight canonical dimension mappings.

The Dashboard always uses the same eight wellbeing dimensions and Core-owned
score/status thresholds. A valid active questionnaire covers all eight. Once a
response is accepted, changing the meaning of the snapshot requires a new
round/revision.

Unlocked analysis is all-or-nothing: total responses and every analyzed
question must meet the configured threshold. A low-count question blocks the
whole detailed result; it is never silently removed to produce a partial map.

### ADR-005: Privacy is a product invariant

Ten respondents is both the default and minimum configurable threshold; a
manager may raise it. Respondent identity, individual answers and detailed
results below the threshold never cross the manager or AI boundary. Core
recomputes callback evidence and rejects mismatched scores, statuses, question
aggregates, counts or questionnaire identity.

### ADR-006: Durable AI execution belongs to Core

Core persists `AiAnalysisRun` with `queued` → `running` →
`succeeded`/`failed`, request idempotency, bounded attempts, a 90-second lease,
heartbeat and durable result. PostgreSQL permits one active run per round.
Python polls and atomically claims work; an expired owner cannot complete it.

The legacy webhook remains a rollback boundary, not the source of execution
truth. `SurveyRound.aiInsights` remains a temporary dual-read/dual-write
compatibility field while `AiAnalysisRun.result` is the durable read source.

### ADR-007: Provider failure is visible, not disguised

Missing keys, quota exhaustion, timeouts and output rejected after bounded
attempts fail the round as `provider_unavailable`; raw provider errors are not
rendered to managers. Yellow/red text is never fabricated. Green may retain one
aggregate-grounded deterministic sentence, labelled
`deterministic_fallback` with the actual attempt count.

Python validates its assembled outgoing Stone Map before callback. Repair
replays only rejected dimensions/parts and carries safe Hebrew critique into
the repair prompt; non-repairable contract violations fail immediately.

### ADR-008: Explicit application and repository boundaries

Python application services depend on the ports `AnalyticsSource`,
`ResultSink`, `JobStore`, `AnalysisRunner` and `TextGenerator`; default HTTP/MCP
and provider objects are composed at module boundaries.

Core has separate organization, round, survey, AI-run and AI-insights
repositories, and `src/lib/composition-root.ts` is the only module that
constructs them. Only an entrypoint — a route handler, the server-component
context loader, a script or a test — calls `resolveCoreRepositories()`;
everything below that edge receives repositories as arguments.
`npm run lint:composition` enforces both halves. The one acknowledged exception
is the process-local audit log in `src/lib/server/manager-audit.ts`, which waits
on a durable audit table.

### ADR-009: Manager UI requires server runtime and server-owned scope

Manager UI/API uses application-level session authentication. Unauthenticated
pages redirect to `/login`; APIs return `401`. Middleware removes client scope
headers and supplies the server-owned `MANAGER_ORGANIZATION_ID`; routes verify
round ownership and hide foreign resources as `404`.

Deployed login fails closed when `SESSION_SECRET`,
`MANAGER_ADMIN_PASSWORD` or `MANAGER_ORGANIZATION_ID` is missing. This is a
single-organization design-stage gate, not the final multi-tenant identity
model. Respondent routes and machine endpoints use separate boundaries.

### ADR-010: The Python service is a container and polling needs uptime

The root `Dockerfile` builds the FastAPI service; `render.yaml` configures the
deployed worker. The service is stateless and owns no database. Durable polling
requires an always-available process or explicit wake/scheduler; scale-to-zero
without one is not reliable execution.

Outside development the service requires all shared secrets, non-local Core
URLs and `USE_MOCK_MCP=false`. Callback destinations are derived only from
trusted configuration. Direct `/analyze` is development-only.

### ADR-011: The Dashboard renders a presentation DTO, not the wire payload

`DashboardInsightsDto` (`src/lib/dashboard/dashboard-insights.ts`) is what the
screens hold: round summary, and per dimension a score, status, summary
paragraphs, metrics and recommendations. `toDashboardInsights` in
`ai-insights-view-model.ts` is the only translation from `StoneMapResult`, so a
new contract version changes one function and no component.

A dimension's stable presentation — labels, map geometry, concept colour — is
separate again, in `src/lib/dashboard/dimension-presentation.ts`. The two were
one type, which is why fixture analysis lived in a production module.

### ADR-012: OpenAPI has one editable source and one generated mirror

`docs/openapi.yaml` is the specification. `public/openapi.json` is generated
from it by `npm run openapi:generate` and stays committed only because
`/api-docs` fetches `/openapi.json` as a static file out of `public/`.

Both files were previously hand-edited, and the integrity test compared a
hand-maintained list of AI schema names — so a path, a response or a schema
outside that list could drift unobserved. Now `npm run openapi:check`, which
`npm test` runs, compares the whole document byte for byte.

### ADR-013: One manager per deployment, until a second one is requested

There is no persistent identity, and that is deliberate rather than unfinished.
The signed-in manager is not a database record: it is constructed in
`src/lib/auth/manager-auth-service.ts` from `MANAGER_ADMIN_PASSWORD`, and
`MANAGER_ORGANIZATION_ID` binds the session to one organization. Roles,
memberships, permissions and an audit-log interface exist as types and
in-memory services and are not persisted.

Owner decision 2026-08-03: a second manager per school is not a requirement, so
the long-term identity model is requirement-gated future work, tracked in
`docs/product-behaviour-backlog.md` §8 rather than as an open architecture task.

Replacing the SHA-256 password hash with Argon2 on its own is explicitly not
that work and does not close it. Nothing stores that hash — it is derived from
the environment variable on each login and discarded — so a memory-hard KDF
protects a credential database that does not exist. What the current shape
actually costs is named in the backlog entry: the deployment secret is the
credential, rotation means a redeploy, and there is no per-user revocation.

The trigger for real identity work is a second manager, multi-tenant hosting or
real respondents — whichever arrives first.

## Environments

The project supports exactly two environments:

| Environment | Core | AI | Database |
| --- | --- | --- | --- |
| local | `next dev` on `:3000` | FastAPI on `:8000` | Docker PostgreSQL on `127.0.0.1:5433` |
| deployed | Vercel alias `shalomut-map-demo.vercel.app` | Render service | Supabase PostgreSQL |

The Vercel target is named Production operationally but is the product's
design-stage deployed/staging endpoint; there are no real respondents or
production data. Database contents are disposable. Confirm the target before
writes to avoid operating on the wrong environment; separate approval is not
required for clear/reseed/schema reset/migrations.

Explicit bounded approval is required before changing secrets, credentials,
authentication configuration or deployment aliases. Rotate the previously
exposed design-stage credentials before the first real respondents.

Local `.env` points to the Docker database. Deployed credentials belong in the
gitignored deployed environment configuration and must be passed explicitly to
deployment/migration commands. Do not create a competing `DATABASE_URL` in
`.env.local`; Next.js and Prisma would then target different databases.

## Development invariants

1. RTL-first and WCAG AA; status is never communicated only by color.
2. Use the warm token system; do not introduce a cold corporate dashboard.
3. Preserve the eight-dimension taxonomy and configurable status thresholds.
4. Keep empty/loading/error/privacy-locked states first-class.
5. Released contracts change only through a new version and consumer-first
   rollout.
6. Preserve unrelated worktree changes and verify in proportion to risk.
