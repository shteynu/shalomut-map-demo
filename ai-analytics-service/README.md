# Shalomut AI Analytics Service

Standalone FastAPI service that turns privacy-safe round analytics into the
versioned Shalomut “Stone Map” contract.

The current implementation is deliberately small:

- it reads aggregate round data through the core app's JSON-RPC MCP endpoint;
- it enforces the privacy lock before any interpretation;
- it runs an async graph-style sequence of interpretation, narrative metric
  generation, intervention lookup, intervention adaptation (`5.0` and `6.0`),
  safety validation, and formatting;
- it reads interventions from the structured local
  `data/interventions_kb.json` catalog, scoped strictly by dimension and
  status, and on `5.0`/`6.0` ranks the candidates by the round's distributions;
- it polls durable analysis jobs from Core, keeps each lease alive while the
  pipeline runs, and posts the validated result back with the run identity.

The service does not currently use LangGraph or ChromaDB at runtime, so those
heavy packages are intentionally absent from the deployment manifest.

The graph nodes are split by responsibility under `src/agents/`:

- `privacy_node.py` owns the fail-closed privacy gate;
- `psychologist_node.py` owns interpretations, the round summary and generation
  provenance;
- `intervention_nodes.py` owns catalog selection and provider adaptation;
- `safety_node.py` owns semantic/provenance validation and replay targets;
- `node_support.py` owns contract-aware lookup and bounded provider-call helpers;
- `nodes.py` is only the compatibility facade for existing imports.

`state.py` names the stable nested graph records while leaving version-specific
external JSON rules to the shared manifests and `schemas/mcp_types.py`.

Application orchestration is separated from transport through protocols in
`src/application/ports.py`: `AnalyticsSource`, `ResultSink`, `JobStore`,
`AnalysisRunner` and `TextGenerator`. `AnalyticsRunnerService` receives source,
pipeline and sink explicitly; the durable worker depends on the runner/job-store
ports; generating nodes receive the graph's `TextGenerator`. The module-level
objects are only the default composition. Validated wire input becomes
`CanonicalAnalysisInput`, and every success/locked/failure response is built by
`schemas/analytics_output.py` before outgoing validation.

The model-facing half lives in four files under `src/services/`, split by what
each one is responsible for:

- `llm_transport.py` — one bounded conversation with a provider: endpoint,
  attempts, backoff, `Retry-After`, hard-quota rules. It never reads the copy
  it carries; what counts as an acceptable answer arrives as a predicate.
- `hebrew_prompts.py` — the Hebrew this service composes itself: the three
  prompts, and the one interpretation written without a model at all.
- `hebrew_validation.py` — what counts as acceptable copy about a round. The
  graph calls it directly on text no provider returned, which is why it does
  not sit behind the provider.
- `llm_provider.py` — the facade the rest of the service imports: model tier,
  which prompt goes out, which predicate judges the answer, and what a refused
  answer means for the round.

## Contract

Runtime input/output support spans `1.0` through `6.0`. Python health advertises
that range, Core can produce `3.0`–`6.0`, and the deployed Core explicitly
produces `6.0`; an unset Core setting remains rollback-safe `5.0`. See
[`../docs/ai-contract-version-matrix.md`](../docs/ai-contract-version-matrix.md).

The immutable deployed source of truth for structural contract `1.0` is
[`../contracts/ai-analytics-v1.json`](../contracts/ai-analytics-v1.json). The
breaking semantic contract `2.0` is published separately in
[`../contracts/ai-analytics-v2.json`](../contracts/ai-analytics-v2.json). Both
TypeScript and Python load the versioned manifests; `2.0` preserves the eight
canonical dimension IDs and adds all 24 canonical question definitions.
Breaking dynamic-questionnaire contract `3.0` is published separately in
[`../contracts/ai-analytics-v3.json`](../contracts/ai-analytics-v3.json). It
keeps the same eight dimensions and score/status semantics, but replaces the
24-question allowlist with exact persisted round question IDs, text and counts.
This implementation was deployed consumer-first. Contract `3.0` remains the
dynamic-questionnaire foundation used by later versions; current deployed
production is `6.0` and rollback configuration is `5.0`.

Every rollout remains consumer-first: Python/parser support first, Core
callback/read compatibility second, Core producer capability third, and only
then the configured producer switch. Published manifests are not edited to
smuggle incompatible semantics into an old version.

A successful `2.0` result contains exactly the eight canonical dimensions,
three canonical question metrics per Stone, strict Hebrew semantic output,
status-scoped interventions, and persisted LLM/retry/fallback provenance.
Successful `3.0` output keeps exactly eight Stones while each Stone contains
all and only the dynamic question metrics mapped to that dimension. Its input
and provenance carry a deterministic `surveyDefinitionHash`; `3.0` never
substitutes text from the default 24-question template.
Privacy-locked rounds return a `locked_error` payload without stones or any
detailed aggregates. The core app validates callback payloads again before
persisting them.

The historical `3.0` rollout completed in that order. Later `4.0`/`5.0` and
`6.0` capabilities follow the same registry in
`../contracts/capabilities.json`; current runtime status belongs in the version
matrix rather than in old rollout prose.

### `4.0` and `5.0`

`4.0` ([`../contracts/ai-analytics-v4.json`](../contracts/ai-analytics-v4.json))
is `3.0` plus the school background context, which reaches the prompt and is
recorded in provenance as `backgroundContextIncluded`.

`5.0` ([`../contracts/ai-analytics-v5.json`](../contracts/ai-analytics-v5.json))
is `4.0` plus a `scoreDistribution` of `{green, yellow, red}` on every question
aggregate — three integers that must sum to the question's `responseCount`,
are required while the round is unlocked, are forbidden while it is locked, and
do not enter `surveyDefinitionHash`. The distribution is the reading the
average cannot give: ten lukewarm answers and a staff halved into green and red
both average 60. Everything `5.0` adds follows from being able to tell those
apart:

- the interpretation may run to five sentences instead of exactly two, and the
  prompt states the buckets per question and the other seven dimensions
  alongside;
- the round summary is generated by the model rather than assembled from a
  fixed sentence, and a provider that cannot produce it fails the round instead
  of returning the counted sentence used by `1.0`-`4.0`;
- recommendations are chosen by the shape of the answers — which question fell
  hardest, how rare a topic is among the candidates, how split the staff is —
  rather than by dimension and status alone;
- the chosen recommendation's summary and steps are rewritten for the school
  against its own numbers, and each one records `adaptationOutcome` (`llm` or
  `deterministic_fallback`) so a reader can tell a rewrite from catalog copy;
- provenance gains `distributionIncluded` and `crossDimensionContextIncluded`.
  Both are measurements of what the prompt actually carried, not claims: a
  round whose aggregates arrive without buckets records `false`, and the safety
  validator compares the stored flags against what was measured.

Each stone metric returns its distribution exactly as it arrived, never
recomputed. Core owns that number and verifies it against the analytics it
recalculates from the round's answers, so a `5.0` callback whose buckets
disagree with the round is rejected.

The status validator changes with the prompt: up to `4.0` naming another
status colour contradicts the numbers, because nothing in the prompt ever
mentioned one. On `5.0` the prompt states the distribution in those very
words, so a foreign colour is allowed where it reads as a count — the sentence
has to carry a number matching one of the buckets — and never as a verdict.

### `6.0`

`6.0` ([`../contracts/ai-analytics-v6.json`](../contracts/ai-analytics-v6.json))
keeps the aggregate-only `5.0` input and numeric evidence, but replaces each
dimension interpretation with three structured Hebrew summary paragraphs and
adds a qualitative narrative to every question metric. Both paths use strict
JSON parsers, exact input-ID coverage, bounded attempts and deterministic
fallbacks that remain valid when the provider is missing, unavailable or
returns malformed/unsafe copy.

Each dimension selects five recommendations from at least eight exact
dimension/status candidates. The five objects are adapted in one
identity-preserving JSON batch call; reordered, duplicate, missing or invalid
items fall back together to enriched human-authored catalog copy. V6 does not
allow partial maps: success always contains eight stones, three summary
paragraphs, every input question metric and five recommendations per stone.
Locked input still short-circuits before any provider call and contains no
details.

## Local setup

Python 3.11 or newer is required.

```bash
cd ai-analytics-service
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

The `[dev]` extra is what puts `pytest` in the virtualenv. A plain
`pip install -e .` runs the service but answers `No module named pytest` to
every verification command.

Export the required variables in your shell. Use
[`./.env.example`](./.env.example) as the list of supported settings. For a
fully local run:

```bash
export ENV=development
export DATA_LAYER_MCP_URL=http://localhost:3000/api/mcp
export DATA_LAYER_CALLBACK_URL=http://localhost:3000/api/rounds
export USE_MOCK_MCP=false
uvicorn src.main:app --reload --port 8000
```

`ENV=development` is required for a local run without secrets. When neither
`ENV` nor `VERCEL_ENV` is set the service assumes `production` and rejects
webhooks that carry no `AI_WEBHOOK_SECRET`, so a new hosting platform cannot
silently come up with an open webhook.

`USE_MOCK_MCP=true` is an explicit local/test mode. With the default `false`,
MCP failures stop processing; the service does not invent analytics.

Matching shared secrets must be present on both sides outside development:

- `MCP_SHARED_SECRET`: AI service → core MCP endpoint;
- `AI_WEBHOOK_SECRET`: legacy core trigger → AI webhook, and manager question suggestions;
- `AI_CALLBACK_SECRET`: AI worker claim/heartbeat/failure and callback → Core.

Outside development, missing shared secrets, local Data Layer URLs, and
`USE_MOCK_MCP=true` fail closed before the analytics pipeline starts. Local
development may run without shared secrets.

`AI_JOB_POLLING_ENABLED=true` starts the durable worker in the FastAPI
lifespan. `AI_JOB_POLL_INTERVAL_SECONDS` is how soon a worker with work asks
again, and `AI_JOB_POLL_MAX_INTERVAL_SECONDS` is how far that wait drifts out
while the queue answers `204`: it doubles after every empty poll and resets on
the first claim, so an idle day costs Core thousands of invocations rather than
tens of thousands. Each slot of `AI_JOB_POOL_SIZE` backs off on its own.
`AI_JOB_HEARTBEAT_INTERVAL_SECONDS` must remain comfortably below Core's
90-second lease. The switch is explicit so Core can deploy the durable routes
and migration before the worker begins claiming them.

### LLM provider configuration

Use one provider-specific key whenever possible:

- `GEMINI_API_KEY` selects Gemini;
- `OPENAI_API_KEY` selects OpenAI;
- `OPENROUTER_API_KEY` selects OpenRouter.

Provider selection comes from the environment variable name, not from the
secret's prefix or the model name. An explicit `LLM_PROVIDER` overrides that
inference and selects the matching provider-specific key when several are
present.

`LLM_API_KEY` is the provider-neutral escape hatch. Outside development it
must be paired with either `LLM_PROVIDER` or `LLM_BASE_URL`; otherwise startup
fails closed instead of sending an opaque credential to a guessed endpoint.
Multiple provider-specific keys without an explicit provider also fail closed.
`LLM_MODEL_FAST` and `LLM_MODEL_HEAVY` override model selection. Gemini uses
`gemini-flash-latest` and `gemini-pro-latest` as defaults; the OpenAI-compatible
defaults remain `gpt-4o-mini` and `gpt-4o`.

`LLM_MAX_CONCURRENT_REQUESTS` caps how many provider requests one round has in
flight and defaults to `2`. Both LLM nodes hand their whole batch to
`asyncio.gather`, so a round otherwise puts eight interpretations, and then up
to two dozen recommendation adaptations, on the wire at once — which is what a
free tier answers `429` to. The slot is taken before the worker thread is
dispatched, so waiting for one costs no part of the per-dimension retry budget;
it only makes the round longer while the durable worker keeps its lease alive.
Raise it for a paid key.

`LLM_MAX_REQUESTS_PER_MINUTE` caps how fast the whole process reaches the
provider and defaults to `5`. Concurrency and rate are two different limits: two
slots still deliver a round's seventeen requests inside a single minute, and a
free tier counts the minute. That is what every live round had been failing on —
`429` on the count of requests, never on their content.

The rate belongs to a model, not to the service: Google counts per model, so
`LLM_MAX_REQUESTS_PER_MINUTE` and `LLM_MODEL_FAST` have to move together.
`render.yaml` carries both — `gemini-3.5-flash-lite` at `60` since 2026-08-05.
It was `14` for as long as the key was a free one, where the tier allowed `15`
per minute and the missing fifteenth was not caution for its own sake: evenly
spaced sends arrive every `60/R` seconds, so at exactly `15` they arrive every
four seconds and some sixty-second window holds both endpoints — sixteen sends,
one over. `60` is not read off the billed tier's table either; it is the pace
seven eval-corpus runs actually sustained through this model on the billed key,
about 140 provider requests a run with no quota failure. The default of `5`
matches `gemini-3.5-flash` on the free tier (`5` per minute, `20` a day), which
is the stricter bucket and the right assumption for an environment that has not
said which model or which key it runs.

Which is why `LLM_MAX_REQUESTS_PER_MINUTE_HEAVY` exists and paces
`LLM_MODEL_HEAVY` separately, at `30` in `render.yaml` — half the fast pace,
and the pace those same runs used. The heavy model is not an occasional single
request that could round down into the fast model's budget: a replay used to
switch an entire node to it, so a replayed round sent every problematic
dimension there back to back. On the free key's numbers the fast model's `14`
was nearly three times what `gemini-3.5-flash` allowed — the original `429`,
moved into the path that only opens once the round is already in trouble. Unset
it defaults to `5` rather than to the fast pace, because inheriting would
rebuild the defect the next time the fast number was raised.

Both values assume the billed key is the one on the Render dashboard, which
`render.yaml` cannot check because `GEMINI_API_KEY` is `sync: false`. On a free
key `60` earns `429` on nearly every send; the transport retries those with
`Retry-After`, so the round crawls instead of failing, and the fix is the key
rather than the number.

A replay now sends only what the safety validator actually rejected — the
dimensions it named, and the parts of them it named — so repairing one refused
stone costs one heavy request rather than seventeen of the twenty the tier
allows in a day. That was the residual risk no pace could address.

There is one queue per model and one set of them per process. Per process,
because the quota is counted per key rather than per round, and Render runs the
service with `WEB_CONCURRENCY=1`. Per model, because that is the unit the
provider counts in — and because a single queue would have to run at the
strictest tier on the key, which would slow every ordinary round for the sake of
a replay that never happens in most of them. Two model names mean two buckets;
the same name on both tiers means one bucket at the stricter of the two paces,
so pointing `LLM_MODEL_HEAVY` at the fast model needs no code change. Every
request passes through the queue, retries included: three attempts 0.5 and 1.1
seconds apart used to spend themselves inside the minute that had just refused
them. A `Retry-After` the provider sends outranks the interval when it asks for
longer, and the retry budget declines a wait it cannot hold instead of
shortening it.

At fourteen per minute a round takes a little over a minute; at five it takes
about three and a half. The respondent/manager request does not wait: it only
commits the queued job, while heartbeats keep the processing run explicitly
`running`. Zero turns pacing off; raise it for a paid tier.

`MAX_TOKENS_PER_DIMENSION` caps one interpretation and defaults to `2048`.

That number is not the length of the answer. A reasoning model spends the
budget on thinking first and writes the answer out of what remains, and the
thinking is invisible in the response — it shows up only as the gap between
`completion_tokens` and `total_tokens`. Measured against `gemini-flash-latest`
on 2026-07-28, one interpretation cost 1440 thinking tokens and 108 visible
ones. Under the earlier caps of `180` and `420` the budget was gone before the
first Hebrew word: the provider answered `finish_reason: "length"` with a
fragment of its own reasoning, the validator rejected it, all three attempts
failed the same way, and the round read as if the model had never been called.

So a cap that truncates is not a shorter answer, it is no answer. Raise this
before suspecting the model, and lower it only against a measurement of what
the configured model actually spends.

`LLM_REASONING_EFFORT` bounds the thinking itself, which is the other half of
that number. The cap above says how much an answer may spend; this says how
much of it goes on reasoning nobody reads, and reasoning is billed at the output
rate — on `gemini-3.5-flash` $9 per million against $1.50 for input. At the
measured ratio of 1440 thinking tokens to 108 visible ones, almost the whole
bill for a round is this.

It is unset by default and then nothing is sent, which is the request this
service made before the setting existed. Set it to one of `none`, `minimal`,
`low`, `medium` or `high` — the OpenAI-compatible spelling, which is the surface
this service speaks; Gemini accepts `none` on its 2.5 models only. Anything else
is refused rather than forwarded and appears in the runtime configuration
errors, because a misspelt effort sent to the provider is a `400` on every call
of the round rather than on one.

Lower it against a measurement rather than on principle: thinking is what buys
the Hebrew that passes the validation gate, and an effort too low fails the same
way a cap too small does — no answer, and a round that reports success while the
map is written by this service. The measurement is the `reasoning_tokens` field
on the usage line below, taken from one round before and after.

LLM logs record only provider, model, outcome, HTTP status and a safe request
identifier when available. Keys, prompts, responses and respondent data are
never logged by the provider adapter.

One `outcome=usage` line is written per billed answer — per HTTP `200` rather
than per conversation, so the retries a refused answer costs are visible instead
of hidden inside the accepted one. It carries `prompt_tokens`,
`completion_tokens`, `reasoning_tokens` and `total_tokens`, each exactly as the
provider reported it or `unavailable` when it reported nothing. `reasoning_tokens`
is the thinking part of `completion_tokens`, not an addition to it, and it is
reported only by providers that itemise it. Gemini's OpenAI-compatible surface
does not: it leaves `reasoning_tokens=unavailable` and the thinking appears as
the gap, `total_tokens - prompt_tokens - completion_tokens`. Measured on one
round on 2026-08-19 that gap was 58,885 tokens against 6,928 visible ones. The
line carries all three counts so the gap can be taken from it; the transport
does not compute it, for the same reason it never defaults a missing count to
zero. A round is
the sum of its lines; the transport does not know which round it serves and does
not aggregate.

Transient HTTP `408`, `429`, and `5xx` responses use bounded exponential
backoff with jitter. `Retry-After` is honored up to the configured delay cap.
Known hard-quota errors such as `insufficient_quota` are not retried.
Transport timeouts are retried once, limiting them to two total attempts so
the pipeline retains room for its callback inside the core app's timeout.
`LLM_MAX_ATTEMPTS` includes the first request and defaults to `3`; the default
backoff is `0.5s`, capped at `2s`, with up to `0.25s` jitter.

When the bounded attempts are exhausted the round fails. There is no substitute
copy: a dimension the model never wrote makes the whole round come back as
`status: "validation_failed"` with a `failureReason` that starts
`provider_unavailable` and, when the run knows one, carries the reason after it
— `provider_unavailable_missing_api_key`, `provider_unavailable_http_429`,
`provider_unavailable_retry_budget_exhausted`. Core stores that string as the
run's `failureCode`, so the operational answer is not the same for all of them.
The manager reads none of it: the Hebrew message says the analysis service is
unavailable right now. The answers are untouched, so re-running the round is the whole remedy.
Reporting a provider outage as a finished analysis was the alternative, and a
school cannot act on advice it has no way of knowing was invented.

The single exception is a green dimension, and it reaches the deterministic
sentence by two roads. Setting `ONLY_LLM_FOR_PROBLEMATIC=true` skips the provider
entirely: no call, so no failure is hidden, and the record is
`outcome=deterministic_fallback` with `attempts=0`. With the default `false`
since 2026-07-30, green is asked like every other dimension and falls back to
the same sentence only if the answer never comes, recorded the same way but
with the attempts that were actually spent. Either way the sentence is grounded
in that dimension's strongest question aggregate and never wears the `llm`
label.

Green is the only status allowed this. Its sentence is the copy green received
for as long as it was never asked, so withholding it would take away text the
manager already has. For yellow and red the same substitution would be a guess
about a problem, which is what the rule above exists to prevent — they raise.

Each provider request may run for up to `LLM_REQUEST_TIMEOUT_SECONDS` (`90s`
by default). The full retry loop for one dimension is capped by
`LLM_RETRY_BUDGET_SECONDS` (`300s`, with a hard maximum of `600s`), and a new
attempt starts only when at least `LLM_MIN_RETRY_WINDOW_SECONDS` (`20s`)
remain. All four numbers were `20`, `25`, `25` and `8` until 2026-08-19, when
55 timed provider calls showed the request timeout sitting below even the
median answer; `config.py` carries the measurements and the reason the ceiling
is raised rather than removed.
The budget bounds how long one dimension may hold a provider slot. The durable
job request is already committed before processing, and the legacy webhook
also answers before its background run, so neither path has to fit the Core
request timeout.

When the core app is a protected Vercel deployment, both outbound calls — MCP
and callback — are answered with a `302` to the SSO page unless
`VERCEL_PROTECTION_BYPASS` is set to the project's Protection Bypass for
Automation secret. The service then sends it as `x-vercel-protection-bypass`.
Leave it empty for unprotected targets; it is never added implicitly. The
callback target is always derived from `DATA_LAYER_CALLBACK_URL` and the
URL-encoded `roundId`. A legacy webhook `callbackUrl` may still be accepted for
compatibility, but it is ignored and cannot control callback transport.

## Endpoints

- `GET /health` — anonymous, and deliberately says nothing about the provider,
  the database or any credential. Its `commit` is the one variable value that
  reaches the response, and it is published only when `RENDER_GIT_COMMIT` is
  provably a Git SHA — exactly forty hex digits — and `unknown` otherwise. The
  rule lives in `src/deployment_commit.py` and is the same one Core's
  `/api/health` holds; `PROJECT_CONTEXT.md` ADR-023 owns it for both.
- `GET /api/v1/provider-status` — anonymous, and one word: `answering`,
  `failing` or `unknown`. It is what a free uptime monitor can read, since
  UptimeRobot's free plan locks request headers to its paid tiers and so cannot
  present a bearer token. It carries no reason, no model, no counts and no
  timing, which is the line between "the model is down" and "the account has no
  credit".
- `GET /api/v1/fallback-status` — anonymous, and one word: `writing`,
  `degraded` or `unknown`. The other question a watchdog needs answered: not
  "is the model down" but "is the model still writing the map". It reads a
  bounded window of the last 20 provider conversations and says `degraded` when
  more than half of them fell back to service-derived copy, `unknown` below five
  observed. The two words are on two paths deliberately — a round whose last
  conversation succeeded reads `answering` while most of its dimensions carry
  derived text, which is the 2026-08-09 incident exactly.
- `GET /api/v1/provider-health` — the same state with all of that detail, plus
  the window under `recent`, behind the same inbound secret as the two POSTs
  below. It never calls the provider: it
  reports what real work last observed and answers `unknown` when this process
  has observed nothing, because a quiet service and a healthy one are
  indistinguishable from the inside.
- `POST /api/v1/webhook/events`
- `POST /api/v1/questions/suggest` — one drafted questionnaire item. This line
  was missing from this list until 2026-08-17; the endpoint is older.
- `POST /api/v1/rounds/{round_id}/analyze` (`ENV=development` only)

### What a round costs

Every HTTP 200 from the provider writes one line carrying the provider's own
accounting:

```
[LLM Service] outcome=usage provider=gemini model=gemini-3.5-flash attempt=1 \
  prompt_tokens=812 completion_tokens=143 total_tokens=955
```

One line per billed answer, including the refused ones — this service retries
with a critique, so those retries are a real part of the bill, and a
per-conversation total taken from the accepted answer would hide exactly that.
A round's cost is the sum of its lines; the transport does not know which round
it is serving, so summing is the reader's job.

A field reads `unavailable` when the provider sent no `usage`, or sent it in a
shape this does not recognise. Deliberately not zero: a zero is a number a
reader would sum, and summing what was never sent is how a cost figure becomes
confidently wrong.

This exists to answer the cost question once and close it — the 2026-08-10
strategy sweep estimated $0.31–$1.91 per round, put "do not optimize LLM cost"
in its do-not-do list, and asked only that the estimate be replaceable by a
measurement. It does not aggregate and does not alert, and it should not grow
into a budget feature.

The core application API is documented in `../docs/openapi.yaml`.
`../public/openapi.json` is generated from it and is what Core serves at
`/openapi.json`.

## Deployment

The service is stateless: no database, no writable volume, four light runtime
dependencies, and one JSON catalog. Any container platform can host it.

The repository-root [`Dockerfile`](../Dockerfile) builds this service alone.
Its build context is the repository root, because `src/contracts.py` loads the
shared contract from `contracts/ai-analytics-v1.json`; the image preserves that
relative layout.

The durable polling path requires a process that remains scheduled while no
HTTP request is active. Cloud Run can host the image, but a scale-to-zero
service needs a separate wake/scheduler or a non-zero minimum instance before
polling can be considered reliable:

```bash
gcloud run deploy shalomut-ai-analytics --source . --region europe-west1 --min-instances 0 --allow-unauthenticated
```

Run it from the repository root. `--allow-unauthenticated` exposes the webhook
to the internet, where `AI_WEBHOOK_SECRET` is the access control, so that
secret must be set. Configure the remaining variables from
[`./.env.example`](./.env.example) and keep `USE_MOCK_MCP=false`.

[`../render.yaml`](../render.yaml) describes the same image for Render and
enables polling. Render's free web service still sleeps after fifteen minutes
without inbound traffic, and outbound polls are not inbound traffic — a sleeping
instance claims nothing, so a queued run waits for a visitor rather than for a
worker. The wake mechanism that closes this is
[`../.github/workflows/render-keepalive.yml`](../.github/workflows/render-keepalive.yml):
a scheduled `GET /health` every ten minutes, which is inbound and therefore
resets the timer. It is a workaround with a price — the free plan grants 750
instance-hours a month against a month's 730, so an always-awake service spends
the account's whole free allowance. A paid instance type is the version of this
that needs no workflow.

Vercel needs more than this package provides: a Python entrypoint under
`api/`, which does not exist here. The previous `[tool.vercel]` block in
`pyproject.toml` was not a Vercel convention and was removed.

The primary path is Core-owned: submission or manager refresh commits an
`AiAnalysisRun`, and the Python worker atomically claims it. The worker sends a
heartbeat while the pipeline runs; losing the lease cancels stale work. A
successful or contract-level failed callback completes only that run, and an
unhandled worker exception is reported through Core's failure endpoint. Core
can therefore recover abandoned work without treating a `202` acknowledgement
as completion.

**A claimed run may name the dimensions it has to write again.** The claim
response then carries `run.regenerateDimensionIds` and `previousResult`, the
stored map that run amends, and the runner starts the graph with the copy of
every other dimension already in its state — the same mechanism a targeted
replay uses, which is why the nodes needed nothing new: a node skips a
dimension when the state already says who wrote it. What is delivered is still
a whole map, with every score and aggregate recomputed from this round's own
data, so nothing about the callback, the contract or Core's verification of it
changes. Only the writing is carried, never a number, and the round summary is
always rewritten because it is written from every dimension at once. An
ordinary run names no dimensions, is sent no previous map, and behaves exactly
as it did. `PROJECT_CONTEXT.md` ADR-024 owns the rule.

Callback delivery is retried, bounded at four attempts with exponential backoff
from `1s`, capped at `8s`, with up to `0.5s` jitter and `Retry-After` honored as
sent. Only answers that judge nothing are retried — `408`, `425`, `429`, every
`5xx`, and dropped connections or timeouts, which are the case where Core may
have persisted the result and lost only the reply. A `400` rejected payload, a
`404` unknown run, a `409` stale lease and a `401` are verdicts on the analysis,
and repeating the request repeats the verdict, so they end delivery at once.
Every attempt sends the same bytes under the same run identity, which is what
lets Core answer a repeat with `200` and `duplicate: true` rather than storing
it twice. The worker heartbeats throughout, so the retry budget cannot outlive
the lease it is delivering for.

`POST /api/v1/webhook/events` remains available for rollback compatibility. It
still authenticates, answers `202 Accepted`, and runs the pipeline in an
in-process background task, but new Core enqueue flows do not use it as their
execution record. LLM calls for all dimensions remain concurrent in either
path.

## Local container check

```bash
docker build -t shalomut-ai-analytics ..
docker run --rm -p 8000:8000 -e ENV=development shalomut-ai-analytics
```

## Verification

Run the whole service suite — contracts, privacy gate, LLM provider, RAG store
and the end-to-end graph — through the project virtualenv:

```bash
.venv/bin/python -m pytest
```

`run_tests.py` still exists and now only forwards to the same command. Until
2026-07-27 it carried sixteen tests of its own and never collected `tests/`,
so a green run there proved nothing about the contract suites.

From the repository root, `npm run verify:ai` invokes the same virtualenv
command. A system `python3` is not canonical evidence, and on macOS it is not
even an interpreter this service can load: the Command Line Tools ship 3.9,
below the `requires-python = ">=3.11"` in `pyproject.toml`, so
`src/agents/state.py` fails on `typing.NotRequired` before any test runs. A new
enough system interpreter still lacks the dev dependencies, which are installed
only into the virtualenv.

Tests answer whether the service is correct. `evals/` is a separate question —
whether the generated Hebrew is any good — and answers it with deterministic,
provider-free graders over a synthetic corpus. Nothing there gates anything;
see `evals/README.md`, including what it deliberately does not do.

The repository-level suite includes a real local boundary test:

```bash
cd ..
npm test
```

That test passes analytics from the Next.js MCP route into
`tests/stub_pipeline_cli.py`, sends the resulting Stone Map through the Next.js
callback route, and reads it back from persistence. The CLI is a test harness
and does not replace the FastAPI webhook in deployment. It runs under this
service's `.venv/bin/python` too — `scripts/ai-service-python.mjs` resolves the
interpreter for every caller on the Node side, so `npm test` needs the
virtualenv to exist and says so plainly when it does not.
