# PROJECT CONTEXT: Shalomut Map (מפת שלומות)

This file owns stable architecture and long-lived product decisions. Current
branch work belongs in `docs/agent-tasks/active/`, milestones in `PROGRESS.md`,
and deployed/operational state in `docs/shalomut-tracker-handoff.md`. When this
file was last touched is a question for `git log -1 -- PROJECT_CONTEXT.md`, not
for a line inside it.

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

Retaining released semantics does not mean a published version can never gain a
field. Owner decision 2026-08-05: an **optional additive field** may be added to
a published contract, and only that. Every one of these must hold.

- The field is optional in the manifest, and its absence means exactly what the
  version meant before it existed. A round analysed earlier stays valid and
  keeps its old reading.
- No existing field changes its type, its meaning or whether it is required, and
  nothing is removed.
- A consumer written before the field keeps working unchanged. Validation on
  both sides checks the shape of the fields it knows and does not enumerate
  keys, so an unknown field is ignored rather than rejected — this is the
  property the rule rests on, and a validator that ever starts refusing unknown
  keys ends it.
- The addition is recorded in the version's manifest, in
  `docs/ai-contract-version-matrix.md` and in the ADR that owns the behaviour.
- The sequence stays consumer-first. Ignoring a field is not the same as acting
  on it, so whoever must read the field accepts it before the other side emits
  it.

Anything else — a changed meaning, a narrowed type, a new required field, a
removal, or a new shape a consumer must understand to render a round correctly —
is a new version with a new manifest, not an amendment.

Two amendments to `6.0` on 2026-08-04 were made before this clause existed and
are the reason it does: `supportsPartialMaps` and
`generationProvenance.unavailableReason`. Both meet every condition above, and
ADR-007 owns their behaviour.

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

**Amended 2026-08-14.** A questionnaire may also hold *background* questions —
demographics and allocation grids — which are answered and stored like any
other but carry no dimension and no score. They are outside every rule in this
ADR: outside the eight-dimension coverage requirement, outside the aggregates,
outside the questionnaire identity hash, and outside the all-or-nothing lock.
The rule stays exactly as written for analyzed questions; it simply never
counted an optional question about commute time, and reading it as if it did
would let one skipped demographic item take a school's whole result away.
Background answers are aggregated and suppressed separately — see ADR-005.

### ADR-005: Privacy is a product invariant

Ten respondents is both the default and minimum configurable threshold; a
manager may raise it. Respondent identity, individual answers and detailed
results below the threshold never cross the manager or AI boundary. Core
recomputes callback evidence and rejects mismatched scores, statuses, question
aggregates, counts or questionnaire identity.

**Amended 2026-08-14, for demographics.** The threshold above counts responses,
which protects a total and says nothing about a *cell*. A cross-tabulation of
two background questions can isolate one teacher inside a healthy round, so a
demographic table carries its own rule, in `src/lib/privacy/cell-suppression.ts`:

- No cell below the threshold is published.
- No suppressed cell is *recoverable* from what is published. Every line the
  table publishes — each row and its total, each column and its total, and the
  margins against the grand total — holds either no suppressed entry or at
  least two, because one blank against a published total is a subtraction, not
  a blank.
- The grand total stays published. It is the round's response count, which
  every manager screen already shows.

And background answers never cross the model boundary at all. The AI service is
asked for a reading of eight dimension scores; a salary band adds nothing to
that and would make a subprocessor hold a demographic profile of a named
school. Demographics are aggregated, suppressed and displayed inside Core.

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
attempts fail the round as `provider_unavailable`, followed by the reason the
run learned when it has one (`provider_unavailable_missing_api_key`,
`provider_unavailable_http_429`); raw provider errors are not rendered to
managers.

Up to contract 5.0, yellow and red have no deterministic copy at all: a
two-sentence interpretation of a problem would have to say something the
numbers do not, so a spent attempt budget raises. Green may retain one
aggregate-grounded sentence, labelled `deterministic_fallback` with the actual
attempt count.

Contract 6.0 does not raise per dimension. Its three-paragraph summary and its
metric narratives fall back at every status, because the V6 fallback is built
to restate the status and the distribution and nothing else — it names no
cause, no diagnosis and no person, so it is not the guess 5.0 refused to make.
The obligation this transfers is disclosure, not silence: the outcome stays
`deterministic_fallback`, the dimension screen tells the manager in Hebrew that
no model wrote those paragraphs, and every accepted map emits
`ai_deterministic_summary_ratio_sample` so a round the provider never answered
is distinguishable from one it did. Copy the service wrote may be shown; it may
not be presented as the model's.

**Disclosure reaches the map itself, 2026-08-19.** Naming it only on the
dimension screen left the disclosure on the screen a manager who trusts the map
never opens — the same reasoning that put `DashboardPartialMapNotice` on the map
for missing words. That notice now also names the dimensions whose paragraphs
the service composed, in one box and under a heading that distinguishes the two:
`ניתוח חלקי` when something is missing, `פסקאות שנגזרו מהנתונים` when nothing is.
Only the dimension summaries. Metric narratives fall back separately and stay
disclosed where their sentences are, deliberately: a manager who read a real
interpretation has no reason to suspect the readings underneath it.

Python validates its assembled outgoing Stone Map before callback. Repair
replays only rejected dimensions/parts and carries safe Hebrew critique into
the repair prompt; non-repairable contract violations fail immediately.

When the repair budget is spent and every refusal left is one dimension's own
copy, contracts that declare `supportsPartialMaps` — 5.0 and 6.0 — report those
dimensions as a stated gap instead of failing the round: `summary: []` or an
empty interpretation, `outcome: unavailable`, and a matching
`dimensionsWithoutInterpretation`. The validator runs again over the degraded
state, so a gap is accepted rather than assumed. A refused overall summary, a
refused recommendation, a refusal with no dimension attached, and eight failed
dimensions all still fail the round whole — the last because a map with nothing
written is a failed round wearing a map's shape.

Since 2026-08-05 the metric narratives carry their own outcome,
`generationProvenance.metricInsightsOutcome`. `outcome` is the dimension's
three paragraphs and was never an answer about the sentence under each
question: the two are written by separate calls and fall back independently, so
a stone could open with the model's interpretation and read every question in
copy the service derived, with nothing on screen saying so. One value covers all
of a dimension's narratives because one exact-coverage call writes them, and
there is no `unavailable` — a dimension whose overview is a gap still owes its
narratives. The metrics screen carries the disclosure, not the overview screen,
and `ai_deterministic_metric_narrative_ratio_sample` carries the operational
half; a round that recorded nothing emits no sample rather than counting as
model-written.

A gap states its cause in `generationProvenance.unavailableReason`:
`provider_unavailable` for a service that did not answer, `validation_rejected`
for copy this service wrote and then refused. The field is optional because
rounds analysed before it existed carry none, and it is rejected on any outcome
other than `unavailable` — a stone may not claim its interpretation is both
written and missing. The two causes lead to different advice on screen, which
is the only reason the distinction travels.

Since 2026-08-19 the disclosure this ADR requires of every dimension also
covers the round: `overallSummaryOutcome` says who wrote the opening sentence,
the same `llm` or `deterministic_fallback` the stones carry, in
`generate_overall_summary`'s own return value rather than inferred from its
text. Before it existed, a `6.0` round the provider never answered still
produced a real-looking opening sentence with no field anywhere saying it was
counted rather than written — the summary and the dimensions fall back
independently, being separate calls, so the gap was not academic: a manager
could read the model's account of eight stones the model never wrote. The
screens now carry a quiet note beside the summary and beside a dimension's
catalog-worded recommendations, each naming what happened and that another run
may write it differently — the same shape the dimension and metric screens
already used, extended to the two provenances that had none.

### ADR-008: Explicit application and repository boundaries

Python application services depend on the ports `AnalyticsSource`,
`ResultSink`, `JobStore`, `AnalysisRunner` and `TextGenerator`; default HTTP/MCP
and provider objects are composed at module boundaries.

Core has separate organization, round, survey, AI-run and AI-insights
repositories, and `src/lib/composition-root.ts` is the only module that
constructs them. Only an entrypoint — a route handler, the server-component
context loader, a script or a test — calls `resolveCoreRepositories()`;
everything below that edge receives repositories as arguments.
`npm run lint:composition` enforces both halves, and as of 2026-08-20 it has no
exceptions: the one it carried — the process-local audit log in
`src/lib/server/manager-audit.ts` — went away with the durable audit table
(ADR-026).

There is a second way to resolve the wiring, added 2026-08-23:
`runInTransaction(work)` hands `work` a repository set built over a transaction
client instead of over the pool, so writes that span several repositories are
one write as far as anything reading the database is concerned. It is a
resolution, so the entrypoint rule applies to it identically and the same lint
enforces it under both names. Two callers: the round reset, and the AI
callback that finishes a paid run — where the second caller made the shape of
the seam explicit. A route may hand a service a *runner* rather than a
repository set, so the service decides what goes inside the transaction and the
entrypoint still owns the resolving. The AI callback needs that because
everything it reads, validates and recomputes must stay outside: the lock is
opened on the way back from a model call, and holding it across
`AnalyticsService` would be a lock held for the length of a computation. Where no transaction client exists — the in-memory
wiring — the work runs against the ordinary set, which is not a downgrade: one
process mutating a `Map` has no half-applied state to protect against. The
observability sinks are deliberately not re-pointed at a transactional store,
because a counter recording work that later rolls back would vanish with it.

### ADR-009: Manager UI requires server runtime and server-owned scope

Manager UI/API uses application-level session authentication. Unauthenticated
pages redirect to `/login`; APIs return `401`. Middleware removes client scope
headers and supplies the server-owned school scope; routes verify round
ownership and hide foreign resources as `404`.

Since ADR-020 that scope is the school the manager chose, and
`MANAGER_ORGANIZATION_ID` is the one they land on when they have chosen none.
The header is still server-owned: a client cannot set it, and since phase 0 of
the multi-tenancy plan (2026-08-20) a chosen school is honoured only when the
session holds an **active membership** for it — not merely when the school
exists. The middleware decides that, because it is the only place holding the
session, and it sends the session's own schools along in a second server-owned
header so the scope service and the school switcher reason about those schools
rather than about every school in the system.

Since 2026-08-23 they also *ask* for those schools and no others. Resolving the
scope used to read the organizations table on every authenticated request and
discard all but the session's own rows, so the cost of the authorization
chokepoint grew with each school onboarded. The organization port now carries
two bounded reads — `findByIds(ids)` and `listIds(limit)` — and `findAll`
belongs to the administrator overview and the platform bootstrap, where "every
school" is the question being asked.

Behaviour is unchanged while each session carries exactly one membership, which
is the point: the rule is in place before a second one exists.

Deployed login fails closed when `SESSION_SECRET`,
`MANAGER_ADMIN_PASSWORD` or `MANAGER_ORGANIZATION_ID` is missing. This is a
design-stage gate, not the final multi-tenant identity model. Respondent routes
and machine endpoints use separate boundaries.

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

A dimension's stable presentation — map geometry, stone shape, concept colour —
is separate again, in `src/lib/dashboard/dimension-presentation.ts`. The two were
one type, which is why fixture analysis lived in a production module.

Presentation stopped carrying names on 2026-08-21. It had re-declared all eight
labels beside the geometry, and the 2026-08-16 modularity audit named the risk
exactly: duplication without a parity test. One of the eight had already drifted
— `management-support` read `עוגן` on the breakdown table and `עורף מקצועי`
everywhere else. The names now live once, in
`contracts/wellbeing-dimensions.json`, read through
`src/lib/wellbeing-dimensions.ts`, which validates the manifest at load and
refuses one that renames the set rather than a member. Renaming a dimension is
now a data edit; adding a ninth is still a code change, because the map has
eight hand-drawn stones.

### ADR-012: OpenAPI has one editable source and one generated mirror

`docs/openapi.yaml` is the specification. `public/openapi.json` is generated
from it by `npm run openapi:generate` and stays committed only because
`/api-docs` fetches `/openapi.json` as a static file out of `public/`.

Both files were previously hand-edited, and the integrity test compared a
hand-maintained list of AI schema names — so a path, a response or a schema
outside that list could drift unobserved. Now `npm run openapi:check`, which
`npm test` runs, compares the whole document byte for byte.

### ADR-013: One manager per deployment, until a second one is requested

**Superseded on 2026-08-20 by ADR-025.** Identity is a row now, and the trigger
this ADR named — multi-tenant hosting — is what fired. It is kept because the
reasoning it records is still the reason the successor looks the way it does,
in particular why replacing the password hash was never the work.

There was no persistent identity, and that was deliberate rather than unfinished.
The signed-in manager is not a database record: it is constructed in
`src/lib/auth/manager-auth-service.ts` from `MANAGER_ADMIN_PASSWORD`, and
`MANAGER_ORGANIZATION_ID` names the organization that session starts in — since
ADR-020 the manager can move to another school, and the value is the default
rather than a binding. Roles, memberships, permissions and an audit-log
interface exist as types and in-memory services and are not persisted.

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

That trigger fired on 2026-08-20: the owner chose multi-tenant hosting, with
about four platform administrators who see every school and exactly one invited
user per school. Phase 1 of
[`docs/multi-tenancy-plan-2026-08-20.md`](docs/multi-tenancy-plan-2026-08-20.md)
is what replaced this ADR, on the same day, and ADR-025 is the successor.

### ADR-014: A school runs one round at a time

Owner decision 2026-08-03. A school may hold any number of rounds — drafts
being prepared, closed rounds kept as history — but only one is active, and
activating a round closes whichever round was active before it.

Two active rounds would mean two live share links for the same staff room, with
no answer to which round a respondent is answering and no way to read the
result of either. The rule therefore lives at both points where a round can go
live: `RoundService.activateRound`, which the survey-definition route calls once
a draft covers all eight dimensions, and `createAndSaveRound`, for a round born
with a complete questionnaire.

Since 2026-08-04 the database enforces it too, through the partial unique index
`survey_rounds_one_active_per_organization` on
`(organization_id) where status = 'active'`
(`20260804120000_one_active_round_per_organization`). Both service paths
therefore close the previous round before activating the next one; the reverse
order would collide with the index, and closing first also fails in the safer
direction — a school with no running round rather than two.

### ADR-015: A goal is a copy of a recommendation, not a reference to one

Owner decision 2026-08-04, backlog §5, in its minimal form: a manager can mark a
recommendation as a goal, move it through selected → in progress → done, and
stop tracking it. There is no owner, no due date and no plan of steps.

Owner decision 2026-08-09 makes that the settled shape rather than a first
step: the fields stay out, because they would turn measurement into task
management and would land a form on the manager trying a single goal for the
first time. The same day closed the companion question — no number is shown
beside a goal, since a dimension's delta is not the goal's result and placing
one there would assert through layout the causal link the AI copy is forbidden
to assert. Both are revisited only on evidence from real schools.

A recommendation belongs to an analysis run and is rewritten wholesale by the
next one. A goal belongs to the school, so `round_goals` stores the title and
body as they read at the moment of the decision. A goal the current analysis no
longer recommends stays on the screen, marked as chosen from an earlier
analysis — the alternative, letting goals follow the payload, would erase the
decision every time the provider rephrased its advice.

The title is a recommendation's only identity: the AI payload gives it no id.
So a unique key on `(round_id, dimension_id, title)` is what makes one
recommendation into one goal, and a rephrased title reads as a new
recommendation beside the older goal rather than as the same advice.

Dropping a goal deletes the row rather than adding a fourth status: a school
that changed its mind is not reporting an outcome, and the recommendation
becomes choosable again. Round reset is the one other thing that removes goals —
it does not re-run the analysis, it declares that the round measured nothing.

Goals hold no respondent data. They name a dimension and repeat manager-facing
copy that had already cleared the privacy gate before it could be shown.

### ADR-016: Closing a round is what asks for its analysis, and no failure retries itself

Analysis used to start after every respondent submission. Owner decision
2026-08-17 moved it to the moment a manager closes the round, and the manual
route became the second opinion rather than the exception: it refuses a round
that is not `closed` with `round_not_closed`, and refuses one below its privacy
threshold with `below_privacy_threshold`. A submission dispatches nothing.

Every close asks, not only the one a manager pressed. A school runs one round
at a time (ADR-014), so starting the next round closes the previous one, and
until 2026-08-23 that close was silent: `enqueueAiAnalyticsOnClosure` had a
single caller, the PATCH route. The superseded round could never ask again
either — `closed → closed` is not an allowed transition — so a school that
started its next round the ordinary way lost the map of the round that had
just finished. The dispatch is wired at the two entrypoints that cause an
implicit close, `PUT /api/rounds/:id/survey-definition` and `POST /api/rounds`,
rather than inside `RoundService`: the service is a Core domain service handed
round repositories only, and by ADR-008 just the entrypoint resolves
repositories. A queue write that fails is swallowed per superseded round — the
close already happened and the new round is already live, so undoing a round
the manager did start, to recover a map they had not asked for yet, would be
the worse trade.

The reason is what a round means while it is open. A durable run reads the
round's aggregates when it starts, and Core re-verifies the callback against
aggregates recalculated when it arrives; a response landing in between made a
correct result fail with `round_validation_failed`. That was the expected
outcome of a normal submission burst, so the automatic path carried a re-arm
(keys `automatic`, `automatic:2`, `automatic:3`) and a ceiling of three runs to
stop a school spending a provider call per answer. A closed round refuses
submissions, so both lost their subject and both are gone — along with
`ai_jobs_rearmed`, which counted the re-arms. The residual race survives —
`updateStatus` is not in a transaction with the dispatch — and is measured from
the other end as `ai_jobs_failed{failureCode="round_validation_failed"}`.

Closure keys stay derived from the round's own history, `closure`, `closure:2`,
so two requests racing on one close compute the same key and collapse on
`(round_id, request_key)`; the partial unique index
`ai_analysis_runs_one_active_per_round_key` separately keeps one run in flight
whatever the key. A round that was reopened and closed again takes the next key
and gets a genuinely new analysis, because it is a genuinely different set of
answers — the old `already_generated` guard went with the automatic path.

Nothing retries itself. `contract_validation_failed` and
`analysis_validation_failed` describe the payload the service produced and
`lease_exhausted` describes a worker that keeps dying — a fresh input changes
none of them, and each attempt costs roughly two dozen provider calls. A failed
run is kept, not reset in place: terminal state stays terminal, the row is the
evidence, and the manual route is how a manager asks again.

### ADR-017: A lost reply is retried; a verdict is not

The Stone Map behind one callback costs roughly two dozen provider calls, and
the sink used to make exactly one HTTP attempt. A dropped connection therefore
threw the analysis away — including the case where Core had already persisted
it and only the answer was lost.

`HttpResultSink.deliver` now makes up to four attempts with exponential backoff
and jitter. What it retries is the class of answer that judges nothing: `408`,
`425`, `429`, every `5xx`, and transport failures. What it does not retry is
Core's opinion of the payload — `400` rejected, `404` unknown run, `409` stale
lease, `401` unauthorized. Repeating those repeats the verdict at the cost of
another delivery.

The retry is safe because every attempt sends the same bytes under the same run
identity, and `finish` recognises an identical result for a run already in that
state as a duplicate rather than a second write. Core answers `200` with
`duplicate: true`, so a lost reply resolves as the success it always was.

The split is in the code as well as the policy: `post` is one attempt and
carries the classification, `deliver` is the port's promise and owns the
budget. Nothing about delivery state is persisted — the worker heartbeats
through the retries so the budget stays inside the lease, and Core's
`callbackReceivedAt` already records the acknowledgement. A separate delivery
record would be the right shape only once something outside the worker needed
to read the attempt history.

### ADR-018: Archiving a round takes it out of the list, and nothing else

Owner decision 2026-08-05, backlog §10. The round switcher offers the school's
rounds; an archived round is not one of them. It keeps everything else — its
URL, its dashboard, its stored analysis, and its place in the comparison
history that a later round measures itself against.

The status existed with no behaviour attached to it. `RoundService`
allowed `draft`/`active`/`closed` → `archived` as a terminal transition, and the
switcher then listed archived rounds last rather than hiding them, so the only
thing archiving did was reorder a list. Either the state means "not part of the
everyday view" or it means nothing; this is the first reading.

Out of the list is not out of reach. `toRoundSwitcherOptions` returns two
groups, and the switcher renders the archive as its own group — `ארכיון (N)` —
so returning to an old semester never requires having kept its URL.

The switcher was a row of links, one chip per round, and became a single
select on 2026-08-06 (owner request): the list of rounds only grows, a school
runs two to four a year and never deletes one, and twenty chips are a wall.
What did not change is that it must work without JavaScript — the constraint
that made the rounds links in the first place. The select sits in a `GET` form
whose action is the current screen and whose parameter is the same `round`
every screen already reads, so a submission produces exactly the URL a link
would have. With JavaScript the choice submits on change; without it, a submit
button inside `noscript` is the way through. Each round still keeps a URL a
manager can return to.

The round on screen is the exception, and it has to be: a manager who followed
a link to an archived round would otherwise read a switcher naming every round
except the one they are looking at. Such a round stays in the everyday group,
marked `בארכיון`, rather than inside the archive group.

Archiving is an act, not a state a round drifts into. The round screen offers
`העברה לארכיון`, and only for a round that has already stopped running: a live
round leaving the list would take its share link with it, so a running round is
closed first. The action confirms before it acts, because `archived` is terminal
— which is also why closing is disabled on an archived round rather than
answering `409` from the route.

**Amended 2026-08-05, owner decision: the archive is read-only.** The heading
above is still the shape of the decision — archiving takes a round out of the
everyday list — but "and nothing else" was not survivable. `archived` was
terminal only in `RoundService.isTransitionAllowed`; reset wrote `draft`
directly, without going through that table, so resetting an archived round took
it back out of the archive. Re-running the analysis had no status check at all
and would rewrite the narrative of a round the school had already filed, while
a later round's comparison went on naming it.

So three writes now answer `409` with `code: round_archived`, through one guard
in `src/lib/server/archived-round-guard.ts`: reset, the manual analysis run and
the questionnaire save. The last of those matters even though a round with
answers already refuses a changed question snapshot — a draft can be archived
without ever taking an answer, and that round's questionnaire was still
editable.

The goals a round produced are deliberately **not** guarded. They are the
school's own work rather than part of the measurement: a recommendation chosen
last spring can be finished this autumn, and freezing it would mean a school
either never files a round or loses the ability to mark a goal done. Reset
still deletes goals — but reset no longer happens to an archived round at all.

The screen does not offer what the routes refuse: an archived round shows no
reset and no analysis button, and its questionnaire opens frozen, the way a
round with answers already does.

### ADR-019: Restoring a questionnaire version is an ordinary save

Backlog §1, 2026-08-05. Every save that changes a round's questionnaire copies
it into `survey_definition_versions`; the builder lists those copies and can
load one back into the editor.

Loading is where it stops. There is no restore endpoint, and deliberately so:
the questionnaire `PUT` already validates the definition, already refuses to
replace the questions of a round that has answers, and already activates a
draft whose questionnaire became complete. A restore route would have to repeat
all three, and the copy it repeated would be the one that drifts. So a version
travels back through the same save the manager would have performed by hand —
which also makes the restore reversible, because it is itself a version, and
leaves the edit that was undone in the history instead of erasing it.

A save that changes nothing records nothing. `isSameSurveyDefinition` compares
the question snapshot and the copy the respondent reads — title, audience,
estimate, threshold, intro and anonymity text — so a second press of save does
not add an entry that differs only by its timestamp.

The definition is copied whole rather than stored as a diff against the round.
A version has to be readable years after the questionnaire moved on, and a diff
would depend on a chain of intermediate states the retention cap is allowed to
delete. Twenty versions per round is that cap: recovery, not an archive. The
prune deletes by id after ordering, never by a timestamp cutoff, because two
saves can share a millisecond and a cutoff would take the row it meant to keep.

Resetting a round leaves the history alone — reset clears what respondents
produced, and a questionnaire is what the manager wrote. The versions die with
the round instead, through the cascade. Nothing about a respondent is in the
table: it holds questionnaires.

### ADR-020: The school is chosen, and the choice is not a permission

Owner decision 2026-08-07. The system holds more than one school, and the
manager chooses which one every screen is about. The data layer was already
school-scoped — rounds, analytics, goals and questionnaires are all read inside
one organization, and a round from another school reads as `404` — so what this
adds is the choice, not the isolation.

The choice is deliberately outside authentication. There is one manager
(ADR-013), so a school is a place to work rather than a thing to be granted:
`MANAGER_ORGANIZATION_ID` names where a session starts, and the chosen school,
remembered in the `shalomut_school` cookie, is where it continues. Middleware
turns that into the same server-owned scope header the session used to supply,
so every route below it is unchanged. When memberships become real, this is the
layer that starts consulting them; nothing above it has to move.

A chosen school is checked against the schools that exist before anything is
read with it. A cookie outlives the school it names, and an id taken on trust
would empty every manager screen with nothing on them saying why. An unknown id
is therefore no choice at all: one school is read, and several ask to be chosen
again.

Since phase 0 of the multi-tenancy plan (2026-08-20) it is checked against the
session's **active memberships** first, and the sentence above now describes the
second half of the check rather than the whole of it. That is the line this ADR
said would be crossed — "when memberships become real, this is the layer that
starts consulting them" — and nothing above the middleware moved when it was.
ADR-025 is where the memberships come from.

The switcher is on the setup screen alone, and only when there is more than one
school to switch between. A round is chosen per screen and travels in the URL,
because a manager reads one round on the map while another is running. A school
is not read that way — everything is inside one — so the control belongs where
schools are configured, and the other screens carry no school in their links.

Adding a school says so explicitly (`createOrganization`). An absent
organization id cannot carry that meaning: the setup route scopes an unnamed
organization to the school the request is already in, which is what saves an
ordinary edit, so a school opened by omission would have been a rename of the
one before it.

### ADR-021: Route-level loading screens, and therefore a 200 on `notFound()`

Owner decision 2026-08-08. Every screen the product renders through
`notFound()` answers HTTP 200 while saying the thing was not found. This is
known, measured, and deliberately left as it is.

The cause is not the failure screens and not a framework bug. A `loading.tsx`
wraps its segment in a Suspense boundary; a Suspense boundary makes the
response stream; a streamed response sends its status line with the first byte,
before the page body runs. By the time `notFound()` is called the response is
already committed as 200. A route the router cannot match never reaches a
render, which is why `/no-such-page` is the one path that answers 404.

Proved by removing files and rebuilding. With `src/app/loading.tsx`,
`dashboard/loading.tsx`, `dashboard/[dimension]/loading.tsx` and
`answer/[shareCode]/loading.tsx` gone, exactly those routes answered 404, while
`dashboard/[dimension]/metrics` stayed at 200 because its own `loading.tsx` was
still in place. Putting back the root file alone returned every route to 200.
Real pages answered 200 throughout.

So a correct status is available at exactly one price: six of the nine
`loading.tsx` files deleted and their skeletons rewritten as in-page
`<Suspense>` placed after the validation that can call `notFound()`. There is
no setting and no upgrade — this is documented App Router behaviour, reported
against Next since 13.

The price is not worth paying yet. Route-level loading is free, consistent, and
shows during client-side navigation before the server is asked, which an
in-page boundary cannot do. Against that, nothing machine-readable reads these
responses: no crawler indexes the product, no monitor counts 4xx, and the one
public URL affected — a dead share link — shows a respondent the right screen
either way.

Revisit when something starts reading the status rather than the page: search
indexing, uptime monitoring, or a client that branches on `response.ok`. The
diagnosis and the measurements live in
`docs/agent-tasks/archive/fix--not-found-answers-404.md`.

### ADR-022: The product describes how a round was filled and never subtracts from it

Owner decision 2026-08-17. A manager may see how a round was filled — how many
questionnaires came back faster than the instrument can be read — and may act on
it at the level of the round: extend collection, reword the invitation, ask the
staff room again. The product does not offer to drop a response, and no screen,
service or export may single out a subset of respondents.

This is a privacy decision, not a squeamish one. `displayableDistribution`
publishes exact integer green/yellow/red counts per question. Two publication
bases differing by one respondent move exactly one bucket by exactly one on
every question, which is a direct read of that person's answer sheet rather
than an estimate — 108 analytic items carry roughly 171 bits about one
individual, where identifying someone in a school of sixty takes about six. The
demographic breakdown publishes group sizes over the same people, so the same
one-person difference also yields their role, seniority, stage and age band
without reading a score at all, and the cell-suppression guarantee is proved for
one population, never for two overlapping bases from one round.

Any two bases do this, whoever chose them and for whatever reason, so "the
manager chose by reason rather than by row" protects the selection screen and
not the numbers. The rule that holds is that a round has exactly one basis of
calculation.

Amended 2026-08-21. That rule was enforced here against a manager *choosing* a
second basis, and the product went on publishing a fresh one on every read of an
open round — where the second basis costs nobody a decision, only a refresh
after somebody presses send. ADR-030 closes that axis: a round publishes when it
closes. The reasoning above is what it rests on, and is not repeated there.

Two further findings stand behind it. On a unidirectionally keyed three-point
scale the fast-filling signal is not merely noisy but *directional* — it flags
dissatisfied respondents more often than satisfied ones — so acting on it would
bias a school's result in a predictable direction while looking like hygiene.
And per-item timing, which is what the careless-responding literature actually
uses, is not measurable here: the questionnaire walks steps, and one step can be
a block of thirty statements.

Amended 2026-08-17, when the browser began measuring. `submittedAt − openedAt`
counted a forgotten tab and a lunch break as filling, so the client now
accumulates the wall time the questionnaire was actually visible and sends one
`visibleSeconds` with the answers; a response carrying none falls back to the
session's lifetime, and the panel says which measure a round used because the
median mixes the two. The fast count needs no such caveat: a session's lifetime
is always at least its visible time, so a response flagged fast on the lifetime
is fast on either measure and the count never over-reports.

What did not change is per-step timing, and the change makes that a refusal
rather than an absence. Measuring per step is now technically within reach — the
client already runs a clock — and it is declined: the browser keeps one running
total, no per-step value is sent, and none is stored. Collecting per-step
durations in order to reduce them server-side would be the worst version of this
feature, because the durable record would then hold what question each person
hesitated on while the screen showed an aggregate. The consent screen states the
limit to the respondent, so relaxing it later is a promise to re-negotiate and
not a schema change.

What that leaves is safe because a count is not a subset. `RoundFillingService`
returns counts and one median, never a response id, a session token or an
individual duration, and nothing joins a duration to an answer. The floor on the
fast count is `FILLING_DETAIL_MINIMUM = 3`, the same argument as
`ABANDON_DETAIL_MINIMUM`. The round screen has read it since 2026-08-17, and the
panel spends its closing sentence explaining why no exclusion control exists — a
manager who is not told why will reasonably ask for the button.

Attention-check items do not change this, which is worth stating because the
plan that produced this feature says they would. Its reasoning was that trap
items are the one careless-responding signal that is not directionally biased —
a satisfied respondent fails a trap no more often than a dissatisfied one — and
that a methodologist's positive answer would therefore "make an exclusion
feature defensible later". Signal quality is not what closed exclusion. The
differencing argument above is about the *number of published bases* and says
nothing about how the second one was chosen, so a perfectly unbiased criterion
produces exactly the same leak as a biased one. Exclusion stays closed whatever
the methodologist answers.

What an attention check may still do is gate at intake rather than after the
fact. A respondent told on their own screen that they missed a trap item, and
given the chance to fix it before sending, produces no second basis — there is
one set of responses and it is the one published. That is a different feature
from the one the plan described, it needs no manager decision and offers none,
and it is the only shape of "act on a trap item" this ADR permits. The
alternative it permits is the descriptive one already built for filling times: a
count beside the others, under the same floor, that sanctions a round-level
action and nothing else. Both still wait on the methodologist for the items
themselves — see question 6 in `docs/methodologist-questions-2026-08-15-ru.md`
and its Hebrew twin.

If exclusion is ever revived, the snapshot of the decision has to reach every
path that recomputes aggregates — `src/app/api/mcp/route.ts` sends them,
`src/lib/server/ai-insights-service.ts` recomputes them when the callback
arrives and compares, and `buildBackgroundBreakdown` reads responses on a third
path of its own. Filtering one and not the others makes Core reject its own
correct result on every run, or makes the breakdown screen and the map disagree
in front of a manager. The research is
`docs/response-quality-research-2026-08-17.md`, on the `research/how-a-round-was-filled`
branch; the reasoning above is repeated here rather than referenced because that
branch may never land.

### ADR-023: An anonymous endpoint publishes a variable only when its shape proves what it is

2026-08-19, with `commit` on `GET /api/health`. The rule that endpoint had held
until then was absolute and stated in `ai-contract-version.ts`: no variable's
value is echoed, because echoing whatever a variable happens to hold is how a
misplaced secret gets published. It is an unauthenticated endpoint, so the
question is never "is this value secret" but "what could this value turn out to
be".

Reporting the deployed commit is worth an exception, and the exception is
written so the rule survives it. `resolveDeploymentCommit` publishes
`VERCEL_GIT_COMMIT_SHA` only when it matches `^[0-9a-f]{40}$` — exactly the
shape of a Git SHA-1 — and `unknown` otherwise. A value that passes could be
nothing but a commit, so the endpoint never publishes a variable's contents,
only a proof about them.

Exactly forty rather than at least forty, because this repository generates its
own shared secrets with `openssl rand -hex 32`: sixty-four hex characters, which
a lower bound would accept and publish the first seven of. No secret belongs in
that variable and the endpoint does not get to assume so.

`unknown` deliberately does not say which of three things happened — running
locally, an unrecognised host, or a value that is not a SHA. All three mean the
same thing to a caller comparing against `git rev-parse`, and distinguishing
them would describe the deployment's own configuration to an anonymous caller.

What this binds is the next field, not this one. Anything added to a public
health payload states what it publishes and why the worst plausible value is
safe; a field whose value cannot be constrained to a shape does not go there.

The AI service's `/health` predates the rule and truncated `RENDER_GIT_COMMIT`
to seven characters without a shape check, publishing the first seven characters
of whatever the variable held. **Closed on 2026-08-19**: it now resolves through
`ai-analytics-service/src/deployment_commit.py`, the same forty-hex rule under a
different variable name, and `tests/test_deployment_commit.py` asserts it case
for case against the Core test. Both halves of the system answer the question
by one rule, which is what makes `unknown` mean the same thing on either
endpoint.

### ADR-024: A run may name the dimensions it rewrites, and still deliver a whole map

2026-08-19, with the per-dimension re-run button. Until then "re-run the
analysis" meant all eight dimensions, so a manager reading that one dimension's
paragraphs were composed from the numbers had to pay for seven nobody had
complained about — and on contract 6.0, where a silent provider produces
derived copy rather than failing, that is the ordinary case rather than the
rare one.

`AiAnalysisRun.regenerate_dimension_ids` carries the request. Empty means the
whole round, which is what every run written before the column existed did, so
no history had to be backfilled and no caller had to change. `POST
/api/rounds/{roundId}/trigger-ai` accepts the list, validates it against the
contract's own eight rather than a list repeated in the route, and refuses a
name it does not recognise instead of quietly analysing everything.

**The callback is unchanged, and that is the decision.** The service delivers a
whole map either way: the named dimensions are written again, the rest start
from the copy the stored map already carries, and every score, status and
aggregate is recomputed from this run's own data. So no contract version, no
partial-payload shape and no merge step exists — `verifyAiResultAgainstRound`
runs exactly as it did, and "eight stones or the round fails" still holds. The
alternative, a callback carrying one stone merged into a stored result, was
refused on that: it buys a smaller payload and costs a new contract shape, a
merge rule, and a question about what the round-level summary then means.

Only the writing is carried. A carried stone is last round's words over today's
figures, never a stale stone copied whole — Core would refuse the stale one,
because it recomputes the numbers before it stores anything. The round sentence
is always rewritten: it is written from every dimension at once, so keeping it
over a rewritten dimension would be the one carried thing that is no longer
true.

Provenance travels with the copy it describes. A dimension the previous run
fell back on keeps reading as fallen back until a run actually rewrites it,
which is ADR-007's disclosure rule holding across a partial run.

The map the run amends travels with the lease, in the claim response. The
worker has no manager-scoped way to ask for it, and widening
`/api/rounds/{roundId}/ai-insights` so a service could read through it would
trade a manager boundary for a convenience. A run that names nothing is sent
nothing.

A partial run is refused for a round with no stored analysis: there is nothing
to amend, the manager reached it from a note about paragraphs that exist, and
spending a whole round's provider calls to paper over that would answer a
question nobody asked.

### ADR-025: Identity is a row, the credential belongs to somebody else

2026-08-20, phase 1 of the multi-tenancy plan, and the successor to ADR-013.

**A manager is a row.** `managers` and `organization_memberships` replace the
accounts `manager-auth-service.ts` assembled from environment variables per
login. A membership is what the tenant boundary already reads (ADR-020, ADR-009),
so making them real changed where they come from and not what they mean.

**There is no credential column and there will not be one.** The owner chose an
external identity provider, so the product never learns a password. This is the
part of ADR-013 that finally resolves: that ADR spent a paragraph explaining why
swapping SHA-256 for Argon2 closed nothing, and the answer turned out to be that
the hash is deleted rather than improved. `src/lib/auth/identity-provider.ts`
runs an authorization-code flow with PKCE against any OpenID Connect issuer —
endpoints come from that issuer's discovery document — and everything it learns
about a person is `openid email profile`.

**Authenticating is not being invited.** The provider says an address is
genuine; `ManagerDirectoryService` says whether that address is anybody here,
and an address with no row is refused. There is no registration. The single
exception is the bootstrap: the first time `MANAGER_ADMIN_EMAIL` signs in and no
platform administrator exists, one row is created — after which the variable is
a seed rather than a credential, and the standing rotation gate on
`MANAGER_ADMIN_PASSWORD` changes meaning and should be re-read.

**Two ways in never exist at once.** A runtime with all four `OIDC_*` variables
signs in through the provider and `/api/auth/login` refuses with
`PROVIDER_REQUIRED`; a runtime with fewer keeps the password form. That is what
lets a deployment keep working until its OAuth client exists, and it is a
transition rather than a design: the password path has no second purpose and is
deleted when no runtime is on it.

**A platform administrator is a flag on the person, not a membership.** They are
outside the membership system rather than a member of every school, so the number
of schools never changes what their session carries. The session token carries
the flag, and the middleware's second branch — `isAdministrator || memberships
include it` — is the whole of the exception. Their session names no school until
they choose one, and the scope header then says `*` where a school user's lists
their memberships.

**The identity provider is a subprocessor**, recorded in
`docs/data-flow-and-subprocessors.md` before the role existed. It touches
managers and never respondents: a teacher filling in a questionnaire has no
account and never reaches it.

### ADR-026: The audit log outlives the container, and an administrator's read is in it

2026-08-20, phase 3 of the multi-tenancy plan, and the consequence of ADR-025.

**`audit_events` is a table.** `getAuditLogRepository()` returned an in-memory
store, so a recorded action died with the container and the `console.info` beside
it landed in a log window nothing collects. `PrismaAuditLogRepository` sits behind
the `IAuditLogRepository` that already existed, and it is resolved through the
composition root like every other repository.

**An administrator opening a school they are not a member of is an event**, which
is the first read in a list that was all writes. It is recorded at the two
chokepoints every manager path passes through — `authorizeManagerRound` for the
round routes and `loadManagerContext` for the screens — so a route cannot reach a
school without the visit being recorded, and a new route cannot forget to.

**Both chokepoints take the school from the answer, not from the request**, and
the screens' half did not at first. `authorizeManagerRound` always read
`round.organizationId` off the resolved round; `loadManagerContext` read the
`MANAGER_ORGANIZATION_HEADER` the middleware sets from `?school=`, and a request
carrying no school therefore recorded nothing while being answered with one
anyway — which is what `resolveOrganizationId` does when there is only one school
to hand back. Most manager requests carry no school: the choice is made once on
the setup screen and every other screen has a round in its URL. Corrected on
2026-08-21 by `recordManagerScreenVisit`, which is given the loaded context. The
cost is that the record now comes after the context resolves, so a page that is
then refused has already paid for its reads.

**`npm run lint:tenant-chokepoints` is what keeps both of them chokepoints.**
Routing every path through one function was a convention until 2026-08-21, and
`lint:composition` cannot help — it permits any page to resolve the wiring,
because it is asking who may construct a repository rather than who may read a
school. Three rules: a `page.tsx` that reads persistence must be named in the
check's short list of pages about no single school, with a reason; every route
under `src/app/api/rounds/` must call `authorizeManagerRound`; and each
chokepoint must still call its recorder. The third rule exists because the
original defect had exactly that shape — every path went through the chokepoint,
and the chokepoint recorded the wrong thing.

**That read fails closed, and it is the only thing here that does.** If the visit
cannot be written the read is refused: `503` to an API caller, a thrown error to a
screen. A read nobody can reconstruct is worse than a read that did not happen. A
manager's write in their own school keeps the opposite rule — a failed audit write
is logged and the action proceeds, because refusing it would take away access
rather than record it.

**One visit is one row for fifteen minutes**, per administrator per school. One
screen is a dozen requests, and a row per request would bury the log it exists to
make readable. The window is process-local, so two instances can each record the
same visit; the log would rather hold it twice than miss it.

**The table carries no foreign keys.** An audit row has to outlive what it
describes — a deleted school and a removed manager are exactly the cases somebody
would want to reconstruct — so a cascade would delete the record of the deletion.
`manager_id` may also read `unknown`, for an action that reached the server
without a manager session.

**Who may read the log is deliberately still open.** `getOrganizationAuditLogs`
lets an administrator read any school's and a school user their own, and nothing
renders either: no screen and no endpoint exposes the log yet. Whether a school
should see the visits made to it is a question for the administrators.

### ADR-027: A school is opened by the platform, and its person is invited into it

2026-08-20, phase 2 of the multi-tenancy plan.

**`/admin` is the platform's own screen**, gated in the middleware and again in
everything it renders or calls. Its refusal is `404` rather than `403`, matching
the rest of the product: a route that answers `403` has confirmed it exists.

**An invitation is an entitlement, not a credential**, which is what ADR-025 left
implied. Nothing is sent and nothing is set: the membership is written `invited`,
the person signs in with their organizational account, and arriving is the
acceptance — `ManagerDirectoryService` flips the row to `active` on the first
successful sign-in. The state is kept rather than skipped so the screen can show
an invitation nobody used, which is the only way to notice a mistyped address.
This is also what took the e-mail provider off phase 2's critical path: e-mail
became a notification rather than a delivery mechanism.

**A school has one user, enforced.** A second invitation is refused while a
standing one exists — `active` or `invited` — and replacing somebody is
revoke-then-invite rather than a transfer. Enforced by the database since
2026-08-23, and by the application alone before that; the amendment below says
why the difference matters. Revocation is a status and never a
delete, because the audit log's `manager_id` points at that row. It takes effect
within a quarter of an hour rather than immediately, and phase 5 is why it is a
quarter of an hour rather than a day: the token still carries its memberships and
the middleware still trusts them without a query, but the token now expires in
fifteen minutes and the renewal that replaces it re-reads those memberships from
the database. A revoked person's next renewal is refused; the token already in
their browser dies on its own inside the window.

**Opening a school became a platform act.** The owner's order is that the
administrator creates the school and then invites its user, and the alternative
had been broken since phase 0 anyway — the creator got no membership, so the
boundary refused them the school they had just opened. The setup screen no longer
offers it and `/api/manager/setup` refuses it with a reason.

**A school is created with no round.** The staff count is set by the
administrator because it is the floor under every privacy threshold the school
can later choose; the first round is the school user's own first act rather than
an administrator guessing at a quarter.

**Amended 2026-08-23: the refusal moved into the database.** Both writers —
`inviteSchoolUser` and `setMembershipStatus` — read the school's memberships,
looked for one that stands, and refused if they found one. That is
check-then-write, and two requests that read before either writes both pass: the
school ends up with two standing memberships and two answers to "who is this
school's person". The 2026-08-21 audit named it, and this model's own schema
comment had already said that only the database can refuse it atomically.

The partial unique index `organization_memberships_one_standing_per_organization`
now holds it, on `(organization_id) where status in ('active','invited')` —
`suspended` deliberately outside, because a handover leaves revoked rows behind
and the audit log points at them. It is the second index of this shape here, and
it is owned by its migration rather than by `schema.prisma`, which cannot express
a partial index; the first is `survey_rounds_one_active_per_organization`
(ADR-014).

**Both stores raise the same refusal.** The Prisma adapter translates that one
`P2002` into `SchoolAlreadyHasSomebodyError` and re-throws anything else, and the
in-memory repository enforces the rule directly. So the unit suite and PostgreSQL
agree about what the product does, and no caller can be written against a store
that quietly allows two. Both service methods map the error back to
`SCHOOL_ALREADY_HAS_SOMEBODY` — the reason the read already gives — so the screen
shows one message whichever of the two decided it, which is correct: by then the
answer is no either way.

The read stays. It is not redundant: it refuses without a write on the ordinary
path, and it is the only one of the two that can say no before a person row is
created.

### ADR-028: The session is short, and renewal is where the database is re-read

2026-08-21, phase 5 of the multi-tenancy plan. It closes the gap ADR-027 named:
revoking a school's person meant "from their next sign-in", because the token
carrying their memberships was good for a day.

**Fifteen minutes, under a twelve-hour cap.** Owner decision, taken against how a
manager actually works — the same number is the idle-logout timer, and a session
that dies mid-reading is a worse defect than the one this fixes. The window
slides on activity; the cap is set at sign-in, copied unchanged into every
renewed token, and is the ceiling on a stolen cookie and on a tab left open over
a weekend. Both live in `src/lib/auth/session-lifetime.ts` and nowhere else;
`86400` used to appear in two route handlers and a provider default.

**Renewal is the only moment a live session meets the database.** The token
asserts memberships, role and the administrator flag so the middleware can answer
"may this request open that school" without a query — Seoul database, Washington
functions. That trade is unchanged and the assertion is now good for fifteen
minutes instead of a day. `SessionRenewalService` re-reads all of it and refuses
a session whose manager is gone, whose memberships were suspended, or whose named
school is no longer theirs.

**It refuses rather than repairs.** A person whose named school was taken away
but who still has another is sent to sign in again, not slid sideways into the
remaining one — changing what somebody is reading without saying so is worse than
asking them to sign in. And renewal never writes: an invitation is accepted by
signing in, so granting access here would be a second, quieter sign-in path with
no audit event behind it.

**A route handler, not the middleware**, which is where it belongs by every other
measure — the middleware sees every navigation and is the only place that can set
a cookie on one. It is ruled out by this repository's own composition rule:
repositories are resolved from a route handler, a server-component context loader,
a script or a test, and `npm run lint:composition` enforces it. A server component
cannot set a cookie in Next 16 either. So `POST /api/auth/session/renew` does the
read and `SessionRenewal` asks for it, on the manager's own activity and never on
a timer — a timer would keep a forgotten tab signed in for as long as the browser
was open, which is the variant this decision turned down.

**A token without the deadline claim is refused**, the same safe reading of
silence the administrator flag gets. Whoever is signed in when this deploys signs
in once more.

**What is still open is the last window.** A token already in a revoked person's
browser stays valid until it expires — at most fifteen minutes. Closing that
needs a revocation list, which is a different design and was not what this phase
asked for. `revokeSession()` remains a no-op and now says why.

### ADR-029: An administrator reads each school, and never the schools together

2026-08-21, phase 4 of the multi-tenancy plan, and the last of its phases that
was not deferred.

**The administrator's screen says whether anything is happening in each school**
— how many rounds it has run, which one it is currently about, that round's
state, and how many people have answered against the threshold that would unlock
it. A school that has never opened a round says so.

**Opening a school's results needed no mechanism.** The middleware already
honours `?school=` on any path for an administrator and remembers the choice in
a cookie, so the card's link to that school's map is a link. What the
administrator then sees is that school's own screens under that school's own
suppression: the locked map, with the same two numbers the school's user is
shown.

**No figure is computed across schools, and the type is where that is enforced.**
`CurrentRoundSummary` carries an id, a title, a status, a response count, a
threshold and whether the two have met — and no score. This is the k-anonymity
limit rather than a preference: two schools whose small groups are each
suppressed become readable when added together, and a per-school score rendered
down a list is the first half of exactly that object. Two tests pin it, one on
the separateness of the counts and one on the summary's field list, so adding a
score is a failing test rather than a review question. Counting schools is not
the same act and stays: it counts schools, not people.

**Three queries per school and none per round.** The response count is asked only
for the round the card names, so the screen's cost grows with the number of
schools rather than with any school's history — the deployed database is in Seoul
and the functions are in Washington. *Superseded by ADR-036 on 2026-08-22: the
per-school cost was accepted as three queries and turned out to be three
sequential round trips, which at a hundred schools is a function timeout. The
screen is now a fixed number of queries. What this paragraph decided and ADR-036
keeps is the other half — no count per round.*

**Reading the list is still not a visit.** An administrator opening a school is
recorded in `audit_events` (ADR-026); the list that says a school has four rounds
is a cardinality about it, not a read of it, and records nothing.

### ADR-030: A round is published when it closes, and until then only its count

2026-08-21. ADR-022 settled that a round has exactly one basis of calculation,
and closed the way a manager could have asked for a second one: excluding
responses. It left open the way nobody has to ask for at all.

**Every read of an open round was its own publication basis.** The analytics
were recomputed from the current responses on each request, and the only gate
was the count, so a round past the threshold published exact per-question
green/yellow/red integers, exact per-question response counts and exact
demographic group sizes — again on the next request, over one more person.
ADR-022 already did this arithmetic for the exclusion case: two bases one
respondent apart move exactly one bucket by exactly one on every question, which
is that person's answer sheet read directly rather than estimated, and the
demographic breakdown yields their role, seniority, stage and age band without
reading a score at all. The manager did not need a tool. They needed to refresh
the dashboard after watching somebody press send.

**So the rule now holds on the clock as well.** A round publishes its numbers
once it has stopped collecting: `draft` and `active` are withheld whatever they
hold, `closed` and `archived` publish under the same threshold as before.
Reaching the threshold is what makes a round *publishable*; closing it is what
publishes it. While it is open the product still shows the response count, the
funnel and how the round was filled — one number about the round is not a subset
of its people, which is the same line ADR-022 drew.

**Archived publishes, and that is not an oversight.** Archiving takes a round
out of the list and changes nothing else (ADR-018). Withholding there would also
make the AI callback verifier recompute an archived round as locked while
holding a result full of detail, and reject Core's own correct analysis.

**The gate is inside the calculation, which is the only place it works.**
ADR-022 closes by naming the paths any such decision has to reach — the MCP
route sends aggregates, `ai-insights-service` recomputes them when the callback
arrives and compares, and `buildBackgroundBreakdown` reads responses on a third
path of its own — and warns that filtering one and not the others makes Core
reject its own result or makes two screens disagree in front of a manager. So
the condition lives in `calculateDynamicRoundAnalytics`, beside the threshold,
and every one of those paths inherits it without knowing it exists. Nothing was
added to the wire and no contract version changed.

**The screens had to stop guessing why.** A locked round was a bare boolean and
each screen re-derived the cause by comparing the count to the threshold — sound
while the count was the only cause. A round at seventeen answers out of ten is
now withheld too, so that arithmetic would have told a manager they need another
zero. The reason is not carried back from the analysis, because the screens
already hold the round: they call `isRoundCollecting(round.status)`, the same
predicate the gate calls, and the map, the breakdown and the home stones each
say the reason that is true. One predicate rather than a field means the
explanation cannot drift from the verdict it explains.

**What a manager loses is the live map, and they are told so.** Watching the
dimensions move during collection is the feature this removes; the AI analysis
was already dispatched at closure (ADR-016), so the narrative half of the
dashboard never existed for an open round anyway. The seed carries two rounds
for this reason — an active one holding the share link and a closed one whose
map opens — because one round can no longer demonstrate both halves of the
product.

### ADR-031: The deployed build applies its own migrations, or it does not ship

2026-08-22. Until this day no deploy path applied migrations. `npm run build`
ran `prisma generate` and never `prisma migrate deploy`; the manual CI job ran
`vercel deploy --prod` with no migration step; and Vercel builds every push to
`main` on its own, which is how nearly every deployment here happens. So the
schema was moved by a person remembering to move it, and the code was moved by a
push. A schema change that reached the code first left every read of the changed
table answering 500 — Prisma selects the model's columns by name and does not
fall back — until somebody ran the command. That cost a broken deployment on
2026-08-04 and a hand step after every schema change since, the most recent of
them earlier today.

**The build is the only place that covers every path**, because every path ends
in a Vercel build: the git integration, the manual CI job and a developer's
`vercel deploy` alike. `scripts/deploy-migrate.mjs` is therefore the first step
of `npm run build`, before `prisma generate` and before `next build`, and a
migration that cannot be applied fails the build. A failed build ships nothing
and the previous deployment keeps serving, which is the outcome to want: the
alternative to a failed build is not a working deployment, it is a deployment
against a schema nobody migrated.

**It runs only where it should.** The step is keyed on `VERCEL_ENV === 'production'`,
not on an opt-in variable of ours — an opt-in is one more switch that can sit in
the off position, which is the shape of the defect being closed. A local
`npm run build`, which `npm run verify:core` runs, migrates nothing: a
verification command that writes to a database is not a verification command. A
preview build migrates nothing either, because previews share the one deployed
database and an unmerged branch has no business moving its schema.

**It needs `DIRECT_URL` on the deployment, and says so rather than guessing.**
`prisma migrate` takes an advisory lock, which does not survive the
transaction-mode pooler that `DATABASE_URL` points at. With `DIRECT_URL` unset
the build fails with that sentence; with `DIRECT_URL` set to the pooled string —
the same database and the same credentials, differing only in port — it fails
naming the port, because otherwise the error a person meets is about a lock
rather than about a variable.

**The consequence, which is a real cost and not a footnote: the schema now moves
ahead of the alias.** The build finishes before the new deployment starts
serving, so between migration and cutover the *previous* code runs against the
*new* schema. An additive migration is safe there; a destructive one — a dropped
or renamed column the old code still selects — breaks the deployment that is
still serving. That is the old failure with its two sides swapped, and it is a
smaller window than the old one, which lasted until a person noticed. Additive
first, destructive in a later deployment, is now a rule of this repository rather
than a preference. Dropping an index is exempt in practice: Prisma names columns
and never names an index.

**What this does not do** is notice a schema that has drifted for some other
reason — a migration applied out of band, or a deployment made by a tool that
skipped the build. The audit's suggestion of a startup `migrate status` that
puts the app into maintenance instead of answering 500 per query is not built
here, and is not implied by this decision.

### ADR-032: A round's status write is conditional, and its outcome is named

2026-08-22. `IRoundRepository.updateStatus` answered `SurveyRound | null` and
caught every database error into that `null`. Four things therefore looked
identical to a caller: the round no longer exists, the partial unique index
refused the school a second active round, another request had already moved the
status, and the connection dropped. None of the callers could tell them apart,
so all of them read `null` as nothing worth reporting.

**What that cost.** The PATCH route wrote `ROUND_STATUS_UPDATED` and answered
`success: true, round: null` for transitions that never happened — an audit log
recording a state the round never reached. For `closed` it went on to queue the
closing analysis, so a failed `active → closed` produced a map for a round that
was still collecting, which is the single-basis rule of ADR-030 broken from the
other end. The builder closed the school's running round, met the index on the
activation that followed, and reported a successful save with an empty
`closedRoundTitles` — leaving the school with no live round and no sentence
saying which one had stopped.

**The write is conditional.** `updateStatus(id, status, expectedCurrent)` sends
the expected status into the `WHERE` of an `updateMany`, so the database decides
whether the transition still applies rather than a read taken moments earlier.
Two requests that both read `active` produce one write and one refusal. The
parameter is required rather than optional, because an omitted expectation is
exactly the unconditional write this replaces, and an optional one would be left
out.

**The outcome is named.** `RoundStatusWrite` is `written`, `not_found`,
`status_changed`, `another_round_is_active` or `write_failed`, and
`describeRefusedStatusWrite` maps those to one set of answers used by every
route: 404 for a round that is gone, 409 for a conflict the manager can resolve
by looking at the school's rounds, 500 only for a failure that is ours. The
refusal names the running round, because a manager whose activation was refused
needs to know which round refused it. The database's own words are not
forwarded; a driver message is for a log.

**Audit rows, dispatches and `success: true` are consequences of a confirmed
write.** That is the rule the cluster comes down to, and it is what the tests
hold. Two paths report a partial outcome rather than a failure, because a
partial outcome is what happened: a reset whose erasure succeeded but whose
return to draft did not says both and carries the deleted counts, and a builder
save that stored the questionnaire but could not start the round says both and
names the rounds it closed on the way.

**The in-memory repository enforces one running round per school.** It has no
constraints and never refused anything, so it was the one place the invariant
did not hold — and nearly every test of a refused activation runs against it. A
repository that cannot refuse proves the handling works by never reaching it.

**How the index reports itself was measured, not assumed.** The adapter-backed
runtime names this constraint by its *columns* —
`meta.driverAdapterError.cause.constraint.fields` is `['organization_id']` —
with `survey_rounds_one_active_per_organization` appearing only inside the
driver's message, and `meta.target` undefined. A reader written for
`constraint.index` called a real refusal an unknown write failure; the
PostgreSQL suite is what caught it. Any unrecognised `P2002` stays
`write_failed`, because answering an unknown constraint with "another round is
active" would explain a real defect away in the manager's own words.

**What this does not do.** It does not make the multi-write paths atomic. The
builder still closes the previous round and then activates the new one as two
writes, and `createAndSaveRound` still closes before creating; the repository
interface has no transaction primitive. What changed is that a jam between those
writes is now reported instead of absorbed — a sibling that could not be closed
still holds the school's active slot, so the activation meets the index and
comes back as `another_round_is_active`.

### ADR-033: A re-analysis qualifies the map, it does not remove it

2026-08-22. The manager GET resolved a round's map through
`findLatestByRoundId`, which prefers an active run and otherwise takes the
newest one in any state, and answered with that run's own `result`. A run that
has just been queued has no result yet. So pressing "rewrite this dimension" —
a partial re-analysis whose entire purpose is to amend the map that exists —
made the whole map unreadable for the roughly three minutes the run took, and a
re-run that failed hid it with no end date, while the previous successful result
sat in the database untouched. The callback compounded it from the other side:
the dual-write to `survey_rounds.ai_insights` accepted whatever validated, and a
failure payload validates, so the round's own rollback copy was overwritten by
the failure of the run meant to replace it.

**The map is the newest result the round has.** `findLatestResultByRoundId`
already existed and already meant that; the read now uses it, with the legacy
column behind it for results written before `AiAnalysisRun` did. A run in
flight, or a run that failed, changes what is *said about* the map. It does not
change which map there is.

**The rollback copy holds results only.** A payload counts as carrying one when
its status is `success` or `locked_error` — a round below the privacy threshold
produces a map that is deliberately locked, which is an answer rather than a
breakdown. Failures already have a durable place: their own run row, with their
own `failureCode`. A fallback to a failure is not a fallback.

**The response is an envelope, `{ result, run }`.** The map alone is half of
what the screen needs, because a map that survives a re-analysis has to say so —
otherwise the screen is honest about the data and silent about the work, and a
manager sees an unchanged map with no way to tell whether their re-run started,
finished or died. `result` is the versioned contract payload and the only thing
validated as one; `run` is Core's account of the newest run and therefore sits
beside the payload rather than inside it. One `AiAnalysisRunSummary` schema
serves the 200 and the 404, so a map and its absence cannot describe the same
run differently.

**The note lives on the map screen only.** It joins the partial-map notice in
that sidebar, which is already where facts about *this analysis* are stated, and
every dashboard screen is reached through the map. The same sentence repeated on
four screens would be read on none.

**What this reverses.** The read used to hold, deliberately, that an active run
wins so that a queued analysis is never answered with a stale Stone Map. The map
in question is not stale: it is the round's real, previous, successful result,
and withholding it cost more than labelling it ever could. The test that pinned
the old rule now pins the new one and says why.

**What this does not do.** It does not make a partial re-analysis merge into the
map it is amending — that is the worker's business and unchanged here. It does
not retry a failed run; the run that failed stays failed until someone asks for
another, which is the separate resilience finding of the 2026-08-21 audit.

### ADR-034: A run is failed for its own reasons, not for the network's

2026-08-22. The worker heartbeats every 30 seconds against a 90-second lease.
`heartbeat()` read only `404` and `409` as lease loss and `raise_for_status()`ed
everything else, so one timeout or one `502` from a Core that was busy serving
manager screens escaped the heartbeat loop, `finally` cancelled a three-minute
analysis, and `except` sent `fail(..., 'worker_error')`. That state is terminal:
`claimNext` never picks it up again. Up to 28 paid provider calls were spent, the
school's map never arrived, and nobody was told. The same ending waited at the
other end of the run — `HttpResultSink` retries a transient callback four times
and then raises, so a Core that stayed unreachable for those seven seconds burnt
a finished map the same way. The three attempts a run is allowed covered only a
worker that died without saying anything.

**A renewal that could not be sent is retried, three times inside one beat.**
Every way of not getting an answer is one case — a timeout, a `5xx`, a dropped
connection — and none of them says the lease is gone. An answer that says so
(`404`, `409`) is a verdict and is not retried: asking again only takes longer to
arrive at the same place, while a stale analysis keeps running against a round
somebody else has already reclaimed.

**The lease, not the beat, decides when to stop.** The worker measures how long
it has gone without a renewal and keeps analysing until that reaches the 90
seconds Core grants. This is what `config.py` always claimed the 30/90 pair was
for. `CORE_LEASE_SECONDS` mirrors `AI_ANALYSIS_JOB_LEASE_MS`, and a test reads
Core's file so the mirror cannot drift — a worker measuring a longer lease than
Core grants would spend provider calls on a run another worker already holds.

**Silence releases the lease; it never fails the run.** `LeaseUnreachableError`
is a `LeaseLostError` for exactly that reason: both mean stop, neither means
finished. No `fail()` is sent, the lease expires on its own, and expiry plus
reclaim is the mechanism that hands the run its remaining attempts. The same
rule covers a result that could not be delivered: `CallbackDeliveryError` already
carries whether another attempt could change the answer, and a transient one is
released rather than failed, because the map is made and only the last hop was
out.

**`fail()` is kept for verdicts.** A refused payload, a stale lease, a crash in
our own code — these repeat verdict for verdict, and retrying one spends the
money again to hear it again.

**What this costs.** A released run is analysed again from the beginning, so its
provider calls are spent again, bounded by the three attempts after which
`claimNext` marks it `lease_exhausted`. A reclaim also waits out the remainder of
the lease before it can happen, because the worker cannot tell Core to expire it
early — Core has no endpoint for that, and adding one is not this change.

### ADR-035: A round derives its numbers as rarely as it honestly can

2026-08-22. `getAnalyticsForRound` read every `SurveyResponse` of the round with
all of its `QuestionAnswer` rows and aggregated them in Node, every time anyone
asked. `loadManagerContext` is the entrance to eight manager screens and asked on
every render; the dashboard asked up to four more times for its comparison; the
MCP tool asked again for every AI request. At 300 staff on the 126-question
instrument that is some 38 000 rows per page view, from a database this code
itself places ~180 ms away.

**A round that is still collecting reads no answers at all.** Its result is
locked whatever they say — that is ADR-030, one basis of calculation per round —
and the only thing the locked payload takes from the responses is how many there
are, which is a `COUNT(*)`. `lockedRoundAnalytics` builds the same payload the
full calculation would, from the round's questionnaire and that count, and a
test runs both paths and compares them because two ways of producing one payload
is how they drift.

**A round that has stopped collecting keeps what it published.** The analytics
go into `survey_rounds.published_analytics` on the way out of the first read and
are read back afterwards, so the numbers are derived once rather than per
reader. `calculatedAt` is stored with them: a published round was calculated at
one moment, and a later reader is being told about that moment rather than
about theirs.

**The stored copy is used only while the basis is unchanged.** Same round, same
school, same number of responses, same privacy threshold, same measurement
snapshot hash. Anything else and it is ignored and replaced. The measurement
hash alone, not both hashes: it is computed from the same questions plus
`scaleId` and `polarity`, so it moves whenever `surveyDefinitionHash` does — a
test pins that relation, because the day the projections stop overlapping this
check would quietly stop noticing a rewritten question.

**A reset clears it outright.** The basis check would catch most of a reset on
its own, but a re-collection that ends at the same count with the same
questionnaire matches it exactly, and would republish the erased round's numbers
as the new round's result.

**The school context is not stored with them.** It is what a manager typed about
the school rather than something the answers produced, and it stays editable
after the round closed. It is read from the round on every read, which is where
the calculation reads it from too.

**The callback verifier reads through the same path.** It used to recompute the
round to check the AI's payload against it. The MCP tool that handed those
numbers out reads the stored copy, so verifying against a second calculation was
both the expensive way to ask and the way to disagree with ourselves.

**Why this sits on `IRoundRepository`.** The other JSON column of the same table
belongs to `IAiInsightsRepository`, and the symmetry argues for a repository of
its own. This one is read on the way to every manager screen, so a separate
collaborator would have to be passed in by every caller, and a caller that
forgets it gets the slow path with nothing to say so — the argument ADR-032 made
about `expectedCurrent`.

**What is left.** Two screens still read every response of a round, once each:
the demographic breakdown, which partitions the responses themselves, and the
filling report, which needs per-respondent timing. Neither is on the path every
screen takes.

### ADR-036: The administrator's screen costs the same whatever the platform holds

2026-08-22. ADR-029 accepted a cost linear in the number of schools and wrote it
down as "three queries per school". What it did not say is that the three sat
inside a loop, each awaited before the next: memberships, the school's rounds
with their questionnaires, and a response count. The deployed database answers in
roughly 180 ms, so a hundred schools is around 300 sequential round trips — some
54 seconds, past the function timeout, on the only administration screen there
is.

**Five queries, whatever the number of schools.** The schools, the people, every
membership among them, every round of them as a summary, and one grouped count
of the responses to the rounds the screen names. A test counts the calls for one
school and for twenty-five and asserts the two lists are identical, so the loop
cannot come back unnoticed.

**Rounds arrive as `SurveyRoundSummary`.** Six scalar columns, because a round
carries its whole questionnaire — 126 questions on the default instrument — and a
list of schools needs none of it. That is invisible in what the repository
returns, which is a summary either way, so the test reads the query rather than
its result.

**The reads name their ids rather than asking for everything.** The console
renders every school today, so "all of them" would have been the same query; the
day it pages its list, the page is what these methods are asked about.

**A round with no responses is absent from the grouped count.** That is what a
`GROUP BY` says about it, and the caller reads it as `?? 0` rather than the
repository inventing zeroes for rows PostgreSQL never mentioned.

**An index on `survey_rounds(organization_id)`, and the measurement that decided
it.** The only index on that column was the partial unique one — `WHERE status =
'active'` — which holds a fraction of the rows and serves none of these reads. At
5 000 rounds across 500 schools, questionnaires included: one school's rounds
went from a 0.50 ms sequential scan to a 0.034 ms index scan, and the overview's
own query is a sequential scan either way because it wants every row, which the
planner confirms. So the index is not for this screen at all. It is for the
per-school read every manager screen makes, and it is in this change because
this is where the measurement was taken.

**What is left, and it is a product decision.** The console still renders every
school with no pagination and no server-side search. That is the second half of
the audit's entry and it is not closed here: how many schools to a page, and what
searching them means, is the owner's call rather than a refactor.

### ADR-037: The threshold protects a cell, not only a column

2026-08-22. `/breakdown` gated a group on its size and then published a dimension
average for every dimension that group answered at all. The two are not the same
number. Analytic questions may be optional, so a group of twenty can bring four
people to one dimension and twenty to the next — and the printed average was
those four people's, beside a group size of twenty that said nothing about it.
At one respondent it is that person's own answers, published under the
methodology's own `k ≥ 10` invariant.

**A cell is suppressed by the same function as a group size.** `suppressFrequency`
over the respondents each category contributed to that dimension. Not a fresh
`count < threshold` test: the rule that matters is the second one this module
already enforces — the hidden entries of a line together account for nothing or
for at least the threshold — and a hand-written comparison enforces only the
first.

**Computed across the groups, not inside each.** The round's own map publishes
each dimension's average and the answers behind it, so a dimension whose groups
are all published save one has published that one too, by subtraction. The
suppression has to see the whole row to close it, which is why the cells are
built once for the table rather than per group.

**A respondent is one person however many questions they answered.** Three
answers to the three questions of one dimension are one person, and the threshold
protects people. Counting answers would have published a cell standing on four
teachers as though twelve stood behind it, which is the arithmetic this rule
exists to refuse.

**The published cell carries its own count, on screen.** `respondentCount`
alongside `answerCount`, rendered under the number in every cell rather than
surfaced only when it looks alarming — a count that appears conditionally is one
nobody learns to read. It is not the column's group size and it is not meant to
be.

**Three unlike blanks stay unlike.** A dimension the questionnaire never asked
about is absent — there is nothing there to hide. A suppressed group has no cells
at all. A withheld cell inside a published group says which of the two reasons it
is, and the table's footnote explains the blanks it contains, because otherwise
they read as a rendering fault.

### ADR-038: A redirect is checked in the words the browser will read it in

2026-08-22. `resolveLoginRedirect` refused a destination outside the product by
looking at the first two characters of the string: `//` and `/\`. Browsers and
the WHATWG URL parser strip ASCII tab, line feed and carriage return from
anywhere in a URL before parsing it, so `/<LF>/elsewhere` passed a check on its
first two characters and then landed on `elsewhere`. The string that was
inspected was not the string that was navigated to.

**Parsed, not prefixed.** The candidate resolves against
`https://login-redirect.invalid` — a host RFC 2606 reserves and nothing can
answer for — and is honoured only if it still names that origin afterwards. A
prefix rule can list the normalisations somebody thought of; the parser knows
all of them because it performs them.

**What comes back is the parser's output, not the candidate.** So the value
handed to a `Location` header or an `href` has already been through the
normalisation a browser would apply, control characters included. A CR or an LF
cannot reach a response header from here, because the parse is where those
characters stop existing.

**A candidate naming another host is refused whole.** Not reduced to the path
inside it: keeping `/goals` out of `//elsewhere/goals` would honour the half of
an attacker's value that happens to be harmless, and would make where a manager
lands depend on what the other host's path spelled.

**It still has to start with `/`.** The parser would resolve `round` to `/round`
quite happily. The middleware writes absolute paths and nothing else, and a
contract that holds by accident is one that stops holding quietly.

**Checked again where it is used.** The OIDC callback used to redirect straight
to the `next` it read from the handshake cookie. That cookie is HttpOnly but it
is unsigned JSON, and its `next` came from a query string one link ago — so the
value is exactly as attacker-shaped at the end of a sign-in as at the start. The
line that builds the `Location` header is the line that checks it.

### ADR-039: An anonymous submission carries a session and meets a ceiling

2026-08-22. The submit endpoint is the product's only unauthenticated write. Its
rate limit is deliberately loose — a staffroom answers from one address, and a
limit tuned for a script refuses exactly the moment the product is working — and
the comment beside it named the attempt token hash as the narrower defence. That
value is computed in the respondent's own browser, it was an **optional** field,
and omitting it skipped the duplicate guard entirely. So the defence against
stuffing was a field the caller could leave out.

**The attempt token hash is required, and must be the shape this product
hashes.** `^[0-9a-f]{64}$`, the same rule the attempt endpoint has always
applied, so a value one endpoint stores is one the other can find. This is not a
claim that the value is trustworthy — anybody can produce sixty-four hex
characters. It is a claim that the guard runs.

**A round stops accepting answers somewhere.** Three times the school's own
`totalStaffCount`, with a floor of one hundred. The multiplier is generous
because the product publishes response rates over 100% quite legitimately — a
link forwarded past the staff list is ordinary — and the floor exists because
the multiplier trusts a number a manager typed once: a mistyped `2` must not
cost the staffroom its answers.

**Read from the organization on every submission, not stamped on the round.** A
school that corrects its staff count corrects the ceiling of the round it is
running. That is two extra reads on the hot unauthenticated path, and they are
the price of the round being bounded at all.

**`ROUND_FULL` is a 409, not a 429.** Waiting does not change it, and a `429`
invites a client to retry a request that will never be accepted.

**What this does not buy, said out loud.** It bounds the rows, not the ratio. A
school of sixty with a ceiling of one hundred and eighty leaves room for a
hundred and twenty fabricated answers beside sixty real ones, and no ceiling a
real round can reach is also a ceiling that makes stuffing pointless. The answer
to that is a submission bound to something this server issued — a token minted
when the questionnaire is served — which is a change to the respondent flow
rather than a number, and which is still defeated by minting tokens one GET at a
time. It stays open, named in `src/lib/survey/response-ceiling.ts` and in the
audit, so nobody mistakes the ceiling for the whole defence.

### ADR-040: The deployed database is verified, not merely encrypted

2026-08-22. Every connection to the deployed database — the serverless runtime
pool and every administrative script, since both build their configuration from
`resolvePoolConfig` — used `rejectUnauthorized: false`. TLS was negotiated and
nobody was authenticated: an active attacker between the function and the pooler
could present any certificate at all, read and rewrite every survey answer, and
take the database credentials on the way past. Encryption without verification
is a conversation with whoever answers.

**The reason it was there was true and is not a reason.** Supabase terminates
TLS with its own authority rather than one in a public trust store, so the
default trust store fails with `SELF_SIGNED_CERT_IN_CHAIN`. That is an argument
for carrying the authority, not for switching the check off.

**The root is in the repository, inline.** A certificate is what the server
hands to every client that connects, so there is nothing here a repository
should not hold. Inline rather than a `.crt` beside the module because the
runtime is serverless and a file would have to survive whatever the build's
tracing decided about it — and the failure mode of getting that wrong is a
deployment that cannot reach its database at all.

**Two independent checks on where it came from.** Downloaded over verified
HTTPS, so the public PKI vouches for the source; then compared against the chain
the pooler itself presents, whose root has the same SHA-256 fingerprint. A
certificate taken from the server you are authenticating proves nothing on its
own, and a download page could serve the wrong file; together there is nothing
for one compromised party to lie about. The fingerprint is pinned in a test.

**The shipped root replaces the trust store rather than joining it.** This
connection has exactly one known counterparty, so a certificate for
`*.pooler.supabase.com` from any other authority — including a public one that
was compromised or coerced — is refused. The cost is that pointing this project
at a database somewhere else needs a deliberate act, which is the right amount
of friction for that decision. `DATABASE_CA_CERT` is that act: a PEM that
replaces the shipped root. It cannot switch verification off, and a value that
is not a PEM is ignored rather than becoming an empty trust store.

**Three cases and no fourth.** Loopback gets no TLS, because the local container
speaks none; `sslmode=disable` says the same explicitly; everything else is
encrypted and verified, including a connection string that does not parse. A
test asserts the property rather than the three examples: no connection string
produces an encrypted-but-unverified pool.

**What is not closed.** `prisma migrate deploy`, which the Vercel build runs
through `scripts/deploy-migrate.mjs`, connects through Prisma's own engine on
`DIRECT_URL` rather than through this pool, and still does not verify. It
carries the same credentials. It is left open deliberately: the session-mode
port it uses is not reachable from the environment this change was made in, so
the fix could not be run even once — and an unverified change there fails the
build rather than one request.

### ADR-041: A counter that cannot warn anyone is a counter that does not exist

2026-08-23. Eighteen operational counters and the whole of this product's error
tracking were `console` lines and nothing else. Each of them was written to
catch a failure nobody is watching for — a submission lost before the function
ran, a paid provider that stopped answering while its rounds still report
success, a payload the published contract refuses — and each landed in a
scrollback with no retention, no query and no reader. The audit of 2026-08-21
named it; `ai-operational-metrics.ts` had already named it about itself and
called the receiver an open owner decision.

**The receiver is this product's own Postgres**, decided with the owner. It
costs no account, no secret and no first third-party SDK in a dependency list
that has none, and it puts the answer where every other durable fact here
already lives. The alternative — Sentry or an equivalent — buys real retention
and survives the database being the thing that broke, and it stays one function
away: the store is a sink and nothing above it knows what the sink is.

`operational_events` holds both families with a `kind` telling them apart, and
carries no foreign keys for the reason `audit_events` carries none (ADR-026): an
event about a round must outlive the round. Retention is a thirty-day cutoff
swept on the way past the public health endpoint, because that is the one thing
this deployment is called on a schedule and the project owns no scheduler.

**The sinks are installed by the composition root**, not passed to the emit
sites. Every emit happens in the middle of the product's real work, and a
repository parameter would put observability in the signature of everything it
watches. The write is scheduled with `after()` so it never runs in front of a
response, and a failure is swallowed to a log line at three depths: nothing here
may break what it observes. The `console` lines stay, and not as belt and
braces — the error family's worst case is a failure *caused by* the database,
and then the durable copy is the one write that cannot land.

**Being stored is not being noticed**, so four thresholds turn into an HTTP
status the way `GET /api/health/ai-queue` already does for the queue's
liveness — a free uptime monitor cannot send a header, and a detector nobody
watches is the failure being fixed rather than a fix. `GET
/api/health/observability` is anonymous and answers `503` on `alerting` and on
`unknown`, because a deployment recording nothing and a deployment with nothing
to record look identical from outside. It publishes the breached threshold ids —
an id is what makes a monitor's mail actionable — and no numbers; those are on
`GET /api/observability` behind `AI_CALLBACK_SECRET`, because a count of failed
analyses says how much measuring is happening even though it names no school.
Neither returns a stored event's contents: request errors carry messages and
stacks, and a development-build message can hold row contents.

The thresholds, the windows and why each was chosen are in
[`docs/observability.md`](docs/observability.md), which
`npm run lint:doc-numbers` holds to the constants.

### ADR-042: A school user reads; every action on a round is the administrator's

2026-08-23. Phase 6 of the multi-tenancy plan was recorded on 2026-08-20 as
deliberately undecided — the restrictions existed in principle and their content
did not. The owner decided it in one sentence: a school user may not build a
questionnaire, start a round or analyse one, and every action on a round belongs
to the administrator. Goals, resetting a round and the AI question suggestion
were each confirmed administrator-only when asked separately.

So the school user is a reader, and what they keep is what a school actually
does with a round: hand out the anonymous link, watch the answer count come in,
and read the map. `RolePermissionService` had defined the two roles since
slice 3 and had **zero production callers**; it now has them, with three actions
added for the writes it had no name for.

**The gate is the chokepoint, not the routes.** `requireManagerPermission` is
called from inside `authorizeManagerRound`, which every round-scoped route
already goes through to resolve its school — so fifteen call sites across
thirteen route files gained the role check by naming their action, and no route
gained a branch it could forget. The
three writes with no round to resolve yet — creating a round, the setup screen,
the question suggestion — call it directly, which is visible in the diff as the
exception it is.

**It answers `403`, not this product's usual `404`.** Non-disclosure exists so a
manager cannot learn that another school's round exists; this refusal is about a
round the reader is fully entitled to see, and calling it "not found" would be a
lie told to the one person it is not protecting anyone from. The check runs
*after* the round resolves, so a foreign round still answers `404` first and the
role refusal cannot be used to probe for rounds.

**The screens leave controls out rather than disabling them.** `setup`,
`surveyBuilder` and `goals` are administrator-only: the middleware redirects and
the navigation does not render their tabs. `round`, `dashboard` and `breakdown`
stay with their write controls absent. A disabled button is an invitation to
find out why, and the reason is not something the school can fix.

The role travels the way the school already does: the middleware computes it and
sets `x-shalomut-manager-role` on the forwarded request, deleting any inbound
header of that name first (ADR-009). `getManagerRole` reads an absent or
unrecognised value as `admin`, because that means the middleware did not run —
a route outside the gate entirely, not a school user who slipped past it.

**Cost:** the root layout became `async` to read the role, so `/api-docs` and
`/_not-found` are rendered on demand instead of statically. Only `/icon.svg` is
still static. This was chosen over fetching the role in the browser, which would
have rendered the full navigation and then taken tabs away in front of the user.

**Amended the next day, because the rule reached nobody.** `inviteSchoolUser`
granted `role: "admin"` — the reading, recorded on 2026-08-22, that a school gets
one person who does everything today's manager does. It is the only place a
school membership is created, so every school user was an `admin` and the gate
above had no one to refuse; the restriction was live and unreachable at the same
time. The invitation now grants `manager`. "Administrator" in the owner's
sentence is the platform administrator, the role above the tenant; `admin` on a
membership means everything inside one school, and nothing creates one now. The
value stays in the type because the column is `String` and older rows carry it.

The browser suite is what found it. `e2e/tenant-boundary.spec.ts` held the only
`manager`-role membership in the repository, and its first test drove that
session to `/setup/` — which the redirect above had just closed. The API tests
asserted the 403 and could not see the door.

### ADR-043: A callback that cannot store its result asks to be repeated

2026-08-23. Finishing a paid analysis was two writes: the durable run was closed,
and then the round's legacy `aiInsights` column was written separately. A
dropped connection between them left a run marked `succeeded` beside a column
still holding the map it was meant to replace — each half internally valid, and
nothing downstream able to tell. The 2026-08-21 audit named it.

Worse than the divergence was how the second write failed. `save` collapses
every reason into `false`, and `false` was reported as `round_not_found`. That
is a `404`, and `result_sink.py` classifies `404` as a verdict about the payload
— `_is_transient_status` retries `408`, `429` and every `5xx` and nothing else —
so the worker stopped. A transient database error therefore discarded an
analysis that was correct and had been paid for.

**Both writes now go into one transaction, and a refused write answers `500`.**
The round was read at the top of the callback, so a `false` from `save` is a
failed write far more often than a vanished round; a round that really did
vanish is caught by that read on the retry, which answers the `404` from the
place that actually knows. The rollback means the retry finds the run still
`running` with its lease, so the second callback finishes it.

**A verdict is returned from inside the transaction; a failure is thrown.**
`run_not_found` and `lease_stale` are answers about this analysis and keep their
`404` and `409` — the worker knows to stop on them, and nothing has been written
when they are decided. Only the write failure throws, in its own error class so
the `catch` cannot relabel an unrelated bug as retriable.

**The metrics moved after the commit.** They used to be recorded between the two
writes. Observability may not run inside a transaction (ADR-041), and a counter
saying a job completed is a claim that, until the commit, was not yet true.

The rollback is proved on PostgreSQL in
`src/lib/repositories/__dbtests__/postgres-ai-callback-atomicity.test.ts`, with
the same callback and the same injected failure run without a transaction as the
negative control — it reproduces the divergence exactly.

**One window stays open and is not closed by this.** If the lease expires during
the worker's backoff, the retry is refused as `stale` and the run waits for the
lease reaper to requeue it. That is the existing lease design, not something
this change makes worse, and closing it means lengthening the lease or renewing
it on a refused callback — neither of which was paid for here.

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
