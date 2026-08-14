# PROJECT CONTEXT: Shalomut Map (מפת שלומות)

Updated: 2026-08-04. This file owns stable architecture and long-lived product
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
headers and supplies the server-owned school scope; routes verify round
ownership and hide foreign resources as `404`.

Since ADR-020 that scope is the school the manager chose, and
`MANAGER_ORGANIZATION_ID` is the one they land on when they have chosen none.
The header is still server-owned: a client cannot set it, and a chosen school is
honoured only after it is matched against the schools that exist.

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

### ADR-016: A run invalidated by newer responses is retried; nothing else is

A durable run reads the round's aggregates when it starts and Core re-verifies
the callback against aggregates recalculated when it arrives. The round keeps
accepting responses in between, so a response landing mid-analysis makes a
correct result fail with `round_validation_failed`. Until a run owns an
immutable input snapshot, that is the expected outcome of a normal submission
burst, not a defect in the payload.

The automatic path therefore starts a new run when the previous automatic run
failed that way, keyed `automatic`, `automatic:2`, `automatic:3`. Keys stay
derived from the round's own history rather than random so two concurrent
submissions compute the same key and collapse on
`(round_id, request_key)`; the partial unique index
`ai_analysis_runs_one_active_per_round_key` separately keeps one run in flight
whatever the key.

No other failure is retried. `contract_validation_failed` and
`analysis_validation_failed` describe the payload the service produced and
`lease_exhausted` describes a worker that keeps dying — a fresh input changes
none of them, and each attempt costs roughly two dozen provider calls. Three
automatic runs per round is the ceiling, so a round receiving a long tail of
responses cannot spend quota one submission at a time.

The failed run is kept, not reset in place: terminal state stays terminal and
the row is the evidence that the round's input moved. `ai_jobs_rearmed` counts
these, and its rate is the measurement that says whether the durable run needs
to carry its own immutable input.

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
