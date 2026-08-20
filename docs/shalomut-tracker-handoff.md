# Shalomut Tracker — operational handoff

This document owns only cross-task operational and deployed state, external
blockers and approval gates. Product milestones belong in `PROGRESS.md`; branch
work and exact verification belong in `docs/agent-tasks/{active,archive}/`;
stable architecture belongs in `PROJECT_CONTEXT.md`. It is a snapshot of what is
true now, not a journal — when a fact here is superseded, replace it rather than
appending below it.

Until 2026-08-20 it was a journal, and the cost was concrete: thirty-seven dated
session entries had accumulated above the first heading, the newest was appended
2988 lines down, and the top of the file named an `origin/main` four commits
stale. The session history those entries carried is preserved verbatim in
[`archive/documentation-snapshots/2026-08-20-handoff-compaction/`](archive/documentation-snapshots/2026-08-20-handoff-compaction/README.md)
and in Git; what was durable in them is below.

## Now

Verified 2026-08-20, in this worktree:

- **`origin/main` is `6a19916`**, asked of the remote — the multi-tenancy plan
  and phase 0, pushed by the owner on 2026-08-20. The only modified file outside
  the branch below is `next-env.d.ts`, which is generated, was dirty before the
  session and belongs to the owner.
- **`feat/identity-becomes-a-row` holds phase 1 of multi-tenancy** and is
  unpushed. Its task file is
  `docs/agent-tasks/active/feat--identity-becomes-a-row.md`, and the work in it
  is complete and verified: managers and memberships are tables, sign-in is an
  OpenID Connect flow, and a platform administrator may open any school.
- **The local database has the phase 1 migration applied**
  (`20260820120000_identity_becomes_a_row`). The deployed database does not, and
  applying it is an owner step that goes with the push.
- **The suite is green**: `npm test` 1278 passed, `npx tsc --noEmit` clean,
  `npm run lint` clean, `npm run build` clean, `lint:composition`,
  `lint:doc-numbers`, `openapi:check` and `docs:endpoints:check` all pass.

**Next concrete step:** push `feat/identity-becomes-a-row`, apply its migration
to the deployed database, and then create the Google OAuth client — all three are
owner actions here, and the third falls under the standing approval gate on
authentication configuration. The deployment keeps its password screen until
`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` and `OIDC_REDIRECT_URI`
are set, and switches the moment they are; the redirect URI must be
`https://<deployment>/api/auth/oidc/callback`, listed verbatim on the client.
After that, phase 2 of
[`multi-tenancy-plan-2026-08-20.md`](multi-tenancy-plan-2026-08-20.md) — the
administrator area and invitations — which is what a school user needs before
anybody but the operator can be given a school. Two other things wait on the
owner and have their own entries below: **rotate `GEMINI_API_KEY`**, exposed in a
transcript on 2026-08-20 and billed, before any paid round; and, off a round run
for some other reason, read the usage lines for what a `6.0` round costs at
`LLM_REASONING_EFFORT=low`. `docs/product-behaviour-backlog.md` §12, the research
instrument, is the alternative to phase 2.

## Deployed state

Two environments exist and no others: local (`docs/local-environment.md`) and
deployed. The Vercel alias named `Production` is an operational staging endpoint.
No real respondents, no production data; database contents are disposable.

### Core (Vercel)

`shalomut-map-demo.vercel.app`. Vercel builds **every** push to `main` on its own,
without anyone asking — observed many times, and the reason a "deployed lags
main" claim is usually a stale document rather than a missing deploy.

`GET /api/health/` is public and answers `status`, `commit` and
`producedContractVersion`. Since `ca1c6c8` that makes "is the deployed code what
I pushed?" one anonymous request instead of a dashboard reading, and
`VERCEL_GIT_COMMIT_SHA` is confirmed populated on this project. It is a liveness
and identity reading, not a content one.

Environment variables, read 2026-08-17 in the owner's signed-in Chrome, names
only — every value is marked `Sensitive` and none was opened: `AI_SERVICE_URL`,
`DATABASE_URL`, `AI_SERVICE_TIMEOUT_MS`, `AI_WEBHOOK_SECRET`,
`AI_CALLBACK_SECRET`, `MCP_SHARED_SECRET`, `SESSION_SECRET`,
`MANAGER_ADMIN_PASSWORD`, `MANAGER_ORGANIZATION_ID`,
`AI_ANALYTICS_CONTRACT_VERSION`. **`AI_SERVICE_TIMEOUT_MS` is dead** as of
2026-08-20 — nothing in the repository reads it, and the webhook dispatch it
bounded was replaced by the durable job queue. It can be deleted from the
dashboard whenever someone is there.

### AI service (Render)

`shalomut-ai-analytics.onrender.com`, service `srv-d9i8vhnavr4c73ad298g`, Docker,
Frankfurt, free plan, *Blueprint managed*. `GET /health` is public and answers
`commit`, `env`, `privacyThreshold`, `supportedContractVersions` and
`jobPollingEnabled`.

**Reading its commit correctly, because the obvious reading raises false alarms.**
`render.yaml` carries a `buildFilter` over `ai-analytics-service/**`,
`contracts/**`, `Dockerfile` and `render.yaml`, so a Core-only or docs-only push
does not rebuild the service. And when it does build, Render builds the **tip of
`main` as of the push whose contents touched those paths** — not the commit inside
that push which did the touching. On 2026-08-19 the service served `2ad95e9`
while the last commit under `ai-analytics-service/` was `057ce1b`, four commits
below it in the same push; anyone expecting `057ce1b` would have gone looking for
a broken deploy. So: **a service commit behind Core's is the normal resting
state.** Read the two halves as two independent questions.

Two more readings that look like faults and are not. A commit one behind the tip
within a minute or two of a push means a build in flight — poll rather than
conclude. And Render *can* miss a push: on 2026-08-17 a GitHub outage meant
nothing was queued, and `Manual Deploy → Deploy latest commit` fixed it. When a
push that touches the service's paths does not appear, check the deploy list
before rereading the diff.

Environment: sixteen variables, read on the dashboard 2026-08-19, with no linked
environment groups and no secret files, so there is nowhere else a value can come
from — `AI_CALLBACK_SECRET`, `AI_JOB_POLLING_ENABLED`, `AI_JOB_POOL_SIZE`,
`AI_WEBHOOK_SECRET`, `DATA_LAYER_CALLBACK_URL`, `DATA_LAYER_MCP_URL`, `ENV`,
`GEMINI_API_KEY`, `LLM_MAX_REQUESTS_PER_MINUTE`,
`LLM_MAX_REQUESTS_PER_MINUTE_HEAVY`, `LLM_MODEL_FAST`, `LLM_MODEL_HEAVY`,
`MAX_TOKENS_PER_DIMENSION`, `MCP_SHARED_SECRET`, `ONLY_LLM_FOR_PROBLEMATIC`,
`USE_MOCK_MCP`. `LLM_REASONING_EFFORT=low` was read there on 2026-08-20.

Three things that reading settled and are worth not re-deriving. Neither
`LLM_REQUEST_TIMEOUT_SECONDS` nor `LLM_RETRY_BUDGET_SECONDS` is set, so the
deployment runs the code defaults — 90 s inside 300 s. `render.yaml`'s env block
**does** reach the dashboard on deploy. And two variables `render.yaml` marks
`sync: false` are not on the dashboard at all — `LLM_MAX_CONCURRENT_REQUESTS`
(code default `2`) and `VERCEL_PROTECTION_BYPASS`: `sync: false` records an
intention, not a fact.

### Last read

**Both halves served `e69a5eb`, read anonymously on 2026-08-20** — Core
`status: ok`, `producedContractVersion: 6.0`; the service `env: production`,
`jobPollingEnabled: true`.

Since then `origin/main` moved to `136a752` over seventeen commits. Sixteen touch
only `docs/`, the root documents, `package.json`, `eslint.config.mjs`,
`.gitattributes` and two new scripts; the seventeenth changes one line of
`src/lib/server/request-question-suggestion.ts`, and that line is a comment. No
`ai-analytics-service/`, no `prisma/`. So Core is *expected* to have rebuilt and
to be serving `136a752` with unchanged behaviour, and the service is *expected*
to have stayed on `e69a5eb` — neither has been read since, and both are
inferences from the rules above rather than readings. `GET /api/health/` settles
the Core half in one anonymous request whenever it matters.

**The idle poll backoff was read in Render's logs at the moment it changed**, on
2026-08-20 (times GMT+3). The outgoing instance `6tl48` posted
`/api/ai-analysis-runs/claim/` every three seconds — the flat two-second interval
plus the round trip to Vercel. The incoming `7hprp` posted at gaps of 3, 5, 11,
19, 32, 32, 32 s: the 2/4/8/16/30 ladder holding at its ceiling, every answer
`204`. Its startup line reads `Polling with 1 concurrent slot(s), every 2.0s and
up to 30.0s while the queue is empty`. No environment variable was needed;
`AI_JOB_POLL_MAX_INTERVAL_SECONDS` defaults to the ceiling. **The reset is still
unobserved** — no round has been analysed on the deployed service since, so
nothing has snapped the interval back from 30 s to 2 s there.

### Database

Supabase PostgreSQL, region `aws-1-ap-northeast-2` (**Seoul**).

**Sixteen migrations, `Database schema is up to date!`**, read 2026-08-19. The
most recent, `20260819120000_a_run_may_name_the_dimensions_it_rewrites`, was
applied that day *ahead of* the push carrying its code.

**Migrations are a hand step, every time.** The build command runs
`prisma generate` and never `prisma migrate deploy`. A schema change must reach
the deployed database before or immediately after its push; in between, Prisma
selects the model's columns by name and every read of the changed table fails
rather than falling back. The discriminating symptom, when it happens: the
previous deployment's own URL still answers correctly while the Production alias
returns 500 — same database, so the difference is the schema the new build
expects. This cost a broken deployment on 2026-08-04.

**`npm run db:migrate:deploy` targets the local database**, not the deployed one:
it reads `.env`, which points at local PostgreSQL on purpose. The deployed
database is reached by passing `DIRECT_URL` from `.env.deployed.local` as
`DATABASE_URL`.

The deployed database was last counted **empty** — 0 organizations, 0 rounds, 0
responses, 0 answers, 0 AI runs — on 2026-08-17. One seeded round,
`SHALOM-DEPLOYED` in school `בית ספר הדגמה` with twelve responses, was written
there on 2026-08-19 for the per-dimension re-run walk; its numbers are real and
its Hebrew prose is placeholder shaped to pass the validators, so it is fine for
looking at screens and useless as evidence about wording. `scripts/seed-local.ts`
still refuses any non-loopback host.

### Geography, and the window that closes with the first school

The deployment runs in three places at once: functions in **Washington**
(`X-Vercel-Id` reads `fra1::iad1::…`), the database in **Seoul**, the AI service
in **Frankfurt**. The users are in Israel. Measured 2026-08-15: **one database
query costs ~180 ms**, medians of ten samples. A submit makes several in sequence,
which is where its ~2 s comes from.

**Owner decision 2026-08-15: change nothing for now.** The time-sensitive half is
that the deployed database is empty, so moving its region today is a new project
and a new `DATABASE_URL`; after the first pilot school answers, the same decision
becomes a migration of real answers. The cheap window closes with that school, not
with a date.

## Monitoring

Three UptimeRobot monitors in the owner's own account, free plan, `3 of 50` used.
Nothing in this repository can create or read them; the keyword literals are a
contract with something outside it, and `tests/test_provider_health.py` pins all
six words — a rename would not break anything visibly, it would just stop a
monitor finding its word and leave it reporting Up forever.

| Monitor | Watches | Keyword |
| --- | --- | --- |
| `803671546` — keep-alive | the service's `/health` | `"status":"online"` |
| `803761399` — dead model | `/api/v1/provider-status` | `failing` |
| `803766551` — half-written map | `/api/v1/fallback-status` | `degraded` |

All three are keyword monitors on a five-minute interval, *Start incident when
keyword exists*, e-mail to the account address, no credential of any kind — the
free plan offers no request headers, which is why the status words are published
anonymously (owner decision 2026-08-17, of four options, taken over paying for
the header or adding a second service). The endpoints publish only the word; the
reason, model, counts and timing stay behind `AI_WEBHOOK_SECRET` on
`/api/v1/provider-health`, because *whether the account behind the key has credit*
is exactly the class of fact Core's `/api/health` refuses to publish.

Both watchdogs are proved end to end, not argued: on 2026-08-17 a refused model
reached the owner's inbox in **2m 27s**, and on 2026-08-18 the fallback ratio did
it in **46s**, each incident keeping the response body as its own evidence.

**Three ways to misread these**, all of which have happened:

- **`unknown` is silent by design.** The state lives in process memory, a deploy
  restarts it, and a green monitor after a deploy means nobody has asked the
  model — not that it answered. On 2026-08-18 an incident that had been open for
  **14h 59m** closed itself that way, and the dashboard read as though the outage
  had ended.
- **They watch a provider that fails in use, not one that fails while unused.**
  On a deployment nobody is touching, a dead provider reads `unknown`.
- **The keep-alive's alerts are usually deploys.** A free instance has no
  zero-downtime swap, so any rebuild produces a 502 window. Its one genuine
  incident, 2026-08-07 at 05:01, lasted 5m 5s — exactly one check interval, and
  either a transient timeout or a slept container paying its own cold start. Do
  not upgrade it to a known sleep.

**Still the owner's to create: a monitor on Core's `/api/health`.** The route was
opened anonymously for exactly this and nothing walks through it yet.

The free plan's fifteen-minute sleep timer is reset by an inbound `GET /health`,
which the service's own outbound polling does not do — scale-to-zero alone is not
a reliable worker. GitHub Actions was tried as the pinger on 2026-08-05 and
measured as unreliable: ten cron windows passed with no scheduled run, while
`workflow_dispatch` finished green in 9s. The `schedule` block is gone; the
workflow remains as a manual wake before a demo or a round. An always-awake
instance would cost nearly the whole 750 free instance-hours a month, so a second
free service does not fit beside it.

## Provider account

Gemini, project `Default Gemini Project`, billing tier `Paid 1`, **prepaid with
auto-reload Off**. That last fact is the operational one: the balance empties, the
API answers `429 RESOURCE_EXHAUSTED` — *"Your prepayment credits are depleted"* —
and whoever notices tops it up. It has depleted twice, on 2026-08-17 and again on
2026-08-19. A round ran successfully on 2026-08-20, so the account had credit
then; nothing in this repository can read the balance.

Rate limits are not what causes this and have been ruled out by reading: the
28-day peak for `gemini-3.5-flash` is `27/1K` requests per minute and `160/10K`
per day, two orders of magnitude below the ceiling.

**A depleted account does not stop a run** — it fills the report with this
service's own fallback copy and reports `success`. Check the balance *before*
starting a corpus run, not after.

**A free tier is not a way out**, read from AI Studio's own comparison on
2026-08-19: `gemini-3.5-flash` gets 5 RPM / 250K TPM / **20 RPD** free, and a
round is about 28 calls — so the free tier cannot finish one round a day on the
model whose Hebrew this project verified. The only free-tier model that could is
the one measured on 2026-08-09 as splicing Arabic letters into Hebrew words.
Enabling billing also moves a project to the paid tier permanently, so a
free-tier key means a different project rather than a different key.

Both model tiers are `gemini-3.5-flash` since 2026-08-09. **A probe that wants to
reproduce deployed behaviour must read `LLM_MODEL_FAST` first** — `config.py`'s
defaults (`gemini-flash-latest`, `gemini-pro-latest`) are not what the deployment
calls.

Worth deciding at some point: the local `.env`, the eval corpus and
`scripts/local-unlocked-pipeline.ts` all bill the same key as the deployment.

### What a round costs

₪50 was topped up on 2026-08-05 and consumed by 2026-08-17 — ₪50.82 of usage over
28 days, across three days rather than as a slope: ~₪9 on 08-05, ~₪17 on 08-09,
~₪21 on 08-11. That implies roughly ₪0.13 a call and ₪3–4 a round, which is an
inference from two dashboard figures.

The measurement that checked it: same fixture, both settings, at a 40 s request
timeout inside a 90 s budget — unset costs $1.12 a round (₪4.1),
`LLM_REASONING_EFFORT=low` costs $0.37 (₪1.35), **67% less**, with all eight
stones written by the model either way. Read 67% as a floor: the deployment now
waits 90 inside 300, which can only widen the gap.

**Two caveats on that number.** The single-round cost figures came from
`local-unlocked-pipeline.ts` while it still pinned contract `5.0`, so they
describe a round whose adaptation was failing on every dimension rather than the
round the deployment produces; the quality half is unaffected, because the eval
corpus runs `6.0`. **A `6.0` cost run is still unmade**, and it should be taken
off a round run for some other reason, after the key is rotated.

## Contract and AI runtime

Runtime contract details and the rollout rule are canonical in
`docs/ai-contract-version-matrix.md`; do not reconstruct them from old rollout
plans. What belongs here is the operational reading.

- Contract `6.0` completed its consumer-first rollout. Deployed Core explicitly
  produces `6.0`; unset configuration remains `5.0`, the rollback value. Core can
  produce `3.0`–`6.0`; callback and parser support spans `1.0`–`6.0`.
- **A silent provider does not fail a dimension on `6.0`.** The structured summary
  and metric narratives fall back to aggregate-derived copy and the round reports
  `success`. Read
  `ai_deterministic_summary_ratio_sample` **before** reading any round as evidence
  about the prompts: on a rate-limited key it is close to 1 while
  `ai_jobs_succeeded` looks healthy. Read
  `ai_deterministic_metric_narrative_ratio_sample` *beside* it, not instead — a key
  that answers the short prompt and times out on the longer one shows a healthy
  summary ratio with derived narratives underneath.
- **`ai_jobs_rearmed` no longer exists.** It counted re-arms of the automatic
  analysis path, removed on 2026-08-17 when analysis moved to round closure. Point
  anything that watched it at
  `ai_jobs_failed{failureCode="round_validation_failed"}`, which measures the
  residual race from the other end. A dashboard built on the old counter reads as
  a metric that stopped rather than one that was retired.
- **`failureReason` is a prefix, not a value.** Since 2026-08-09 a provider
  failure appends its reason — `provider_unavailable_missing_api_key`,
  `_http_429`, `_retry_budget_exhausted`. A query matching the old single value
  must group by prefix.
- **A per-dimension re-run is not a contract change.** Since 2026-08-19 a run may
  name the dimensions it rewrites; the service asks the provider for those only
  and starts the rest from the stored map, and the callback is an ordinary
  eight-stone `6.0` payload with every number recomputed. There is no
  partial-payload shape and no merge step, and `verifyAiResultAgainstRound` is
  untouched. An empty list still means the whole round. `PROJECT_CONTEXT.md`
  ADR-024 owns it. Exercised on the deployed stack 2026-08-19: a re-run of
  `balance` came back `succeeded` with eight stones, `balance` at `attempts: 3`
  and the other seven carrying the previous paragraphs verbatim at `attempts: 1`.
- **The immutable input snapshot no longer has this justification.** A durable run
  refetches the round's aggregates rather than owning a snapshot, so a response
  landing mid-analysis fails the callback with `round_validation_failed`. Since
  analysis starts at closure and a closed round refuses submissions, the ordinary
  way responses moved under a run is gone. Anyone reviving that plan needs a
  different reason.

**Deployed but never exercised through a deployed round:** the 90 s request
timeout, the 300 s budget, `scope=` on the provider log lines, the error-level
`token_budget_exhausted`, the map's deterministic-summary notice and the
dimension screen's re-run button. The last two are behind the manager login and
need the owner signed in to the connected Chrome. The numbers behind the first
four come from local rounds, where the slowest call differed by roughly 2x
across two otherwise identical rounds — so 90 s is 1.8x a maximum that is itself
unstable. If a round ever exceeds it, `LLM_REQUEST_TIMEOUT_SECONDS` can raise it
without a code change; that, more than the number, is what changed.

## Operational invariants

- Confirm the database and environment before any write, so work does not land on
  the wrong target. Clearing, reseeding, resetting and migrating need no
  data-preservation ritual at the design stage.
- Keep respondent identity and sub-threshold detail out of every manager and AI
  boundary.
- Deployed manager auth requires `SESSION_SECRET`, `MANAGER_ADMIN_PASSWORD` and
  `MANAGER_ORGANIZATION_ID` while it still signs in with a password. Once the
  four `OIDC_*` variables are set the password stops being a way in at all and
  `MANAGER_ADMIN_EMAIL` becomes the seed for the first platform administrator;
  machine boundaries use their own shared secrets either way.
- The deployed producer switch is configuration, not a silent fallback. Unknown
  contract versions fail closed.
- Parallel agents use separate branches, worktrees and active task files.

## External blockers and approval gates

**Open, and the owner's own hands:**

1. **Rotate `GEMINI_API_KEY`, 2026-08-20.** It was printed in full into an agent
   session transcript and a scratch file — a shell presence-check written as
   `${VAR:-fallback}`, which expands to the value when the variable is set. The
   scratch copy was redacted; the transcript cannot be. This is the billed key, so
   the exposure is a spending risk as well as an access one, and it is more
   current than the four credentials below. Do this before any paid round.
2. **Rotate the four credentials previously exposed in a private design-stage
   transcript**, before the first real respondents. An accepted deferred gate, not
   a blocker for local or documentation work.
3. **Generate `MANAGER_ADMIN_PASSWORD` with `openssl rand -hex 32`** during that
   rotation, and do not choose one by hand. This replaced the Upstash gate on
   2026-08-10. **Nothing in the code enforces it, by decision** —
   `ManagerAuthenticationService` requires the variable to be non-empty and would
   accept `123`. That is why it is written here and in `.env.example` rather than
   left to judgement.

   **Re-read this gate once the OAuth client exists (2026-08-20).** On a runtime
   with an identity provider the variable is not a credential and not a way in:
   `/api/auth/login` refuses before it looks at any password. What still matters
   there is `MANAGER_ADMIN_EMAIL`, which decides who becomes the first platform
   administrator, and which is a name rather than a secret — anyone who can set
   it can already grant themselves everything, so it is protected by the
   deployment's own access and not by its entropy.

   **Create the Google OAuth client (2026-08-20), which is what turns that on.**
   A Web application client in Google Cloud Console, with
   `https://<deployment>/api/auth/oidc/callback` listed verbatim as an
   authorized redirect URI, and its id and secret plus `OIDC_ISSUER`
   (`https://accounts.google.com`) and `OIDC_REDIRECT_URI` set on the
   deployment. Authentication configuration, so it is the owner's and sits
   inside the standing approval gate. Phase 1 of the multi-tenancy plan is
   written and verified against a stand-in provider; this is the only thing
   between it and a real sign-in.
4. **Create an uptime monitor on Core's `/api/health`.**
5. **Decide where the structured observability lines land** — a log sink or an
   error tracker, and with which alert. Every counter the product emits still
   lands in a `console.info` line that expires with the platform's log window.
   Countable is not noticed.
6. **The copyright line in `NOTICE`.** It reads `Copyright (c) 2026 Maxim
   Berenshtein`, taken from the Git author of 692 of 806 commits; 88 commits
   between 2026-06-16 and 2026-07-25 were authored from a `zoominfo.com` address —
   the same person under an email inherited from another machine, which `.mailmap`
   now reports as one contributor without rewriting anything. Whether personal
   ownership is the correct claim depends on an employment agreement no agent can
   read. It is a one-line change to a public file.
7. **The methodologist's item-to-dimension mapping**, which blocks phases 3, 5 and
   6 of `docs/default-research-instrument-plan-2026-08-14.md`. The questions are
   written and ready to send in both languages —
   `docs/methodologist-questions-2026-08-15-{ru,he}.md`, six of them since
   2026-08-17. Its machinery exists and its content does not.
8. **Naming a pilot school with a date**, which is what still gates the 2026-08-10
   strategy sweep, and the wording of its axis 1 (Chief Scientist directive) and
   axis 7 (fair-use commitment, and how small a staff room is too small to measure
   safely). Both are legal and editorial judgement, not engineering.
9. **How many rounds the deployed service should analyse at once, 2026-08-18.**
   `AI_JOB_POOL_SIZE` is `1` in `render.yaml`, which is the behaviour the service
   had before the setting existed. A round is about 28 calls over three minutes,
   near 11 a minute against the configured 60, so **4–5 is the useful range at
   today's pace** — but the real provider tier is the actual ceiling and nothing
   here can read it. And a second Render instance is **not** the next step after
   raising it: `provider_rate_limiter` is per-process, so two containers would
   keep two private counters and together exceed the quota, which is the `429`
   that killed every early live round.

**Standing rule:** explicit bounded approval is required before changing secrets,
credentials, authentication configuration or deployment aliases.

## Decisions that are closed, recorded so they are not reopened

- **A goal gains no owner, due date or plan of steps, and no number beside it** —
  owner, 2026-08-09, both as "no". Fields would make this task management rather
  than measurement, and a number beside a goal would assert through layout the
  causal link the AI copy is forbidden to assert. Reasoning in backlog §5 and
  ADR-015.
- **Excluding respondents from a published basis is closed** on the number of
  published bases — `PROJECT_CONTEXT.md` ADR-022 — and no methodologist answer
  reopens it. Question 6 of the methodologist files says so up front, so that a
  positive answer about attention checks cannot be read as permission.
- **Upstash is prepared, stays off, and is not a pre-pilot gate** — owner,
  2026-08-10, revised the same day. Its code path was exercised against a stub
  speaking the REST pipeline API and fails open in both shapes. Switching it on is
  two environment variables and no code change; doing so makes Upstash a fourth
  processor and a subprocessor-list entry. The reasoning for the swap: a shared
  counter rescues a weak password and does not make one safe, so the password is
  the gate that actually protects a school's answers.
- **Password-strength enforcement was built and withdrawn**, owner 2026-08-10, and
  waits on a second manager. It refused a deployed runtime a password under
  sixteen characters, with fewer than eight distinct ones, or a well-known value,
  and was verified in both directions over HTTP against a production build. The
  code sits unpushed on the local branch `fix/manager-password-must-be-strong` —
  **this worktree only**, on no remote. If that branch is lost, backlog §8 is the
  record and the work is a couple of hours.
- **`fix/refuse-asserted-causes` is a decided no**, owner 2026-08-05, not a
  deferral. The rule refused asserted causes at runtime, worked, and cost 8–14% of
  the map's model-written prose — eight of its eleven refusals were the model's own
  caveats about the sample. The branch stays as the measurement. If ever
  revisited, its own note says fix the subject rather than the mechanism: refuse a
  cause attributed to the school or to people, allow one attributed to the data.
- **A published contract may gain an optional additive field and nothing else** —
  owner 2026-08-05, settled as an explicit clause in ADR-002 rather than by opening
  `7.0`. The load-bearing conditions are that absence keeps the version's previous
  meaning and that the consumer accepts before the producer emits. The rule rests
  on validation that checks known fields without enumerating keys, so a validator
  that ever starts rejecting unknown keys revokes it.
- **The respondent consent wording is approved**, owner 2026-08-17. What stays
  open is not the wording but what it commits to: the "no per-question timing"
  half describes what is *collected*, so any later feature that measures per step
  re-opens the sentence rather than merely extending a schema.
- **Two CI gates were considered and declined on 2026-08-07**: a mutation-score
  threshold (the score moves for reasons unrelated to test strength) and a
  line-coverage threshold (it would have been green throughout the period when
  ~90 validator rules could be deleted silently). A nightly full mutation run was
  declined as a number nobody would read.

## Lessons that have each cost a session

- **Ask the remote for `main`, never a tracking ref.** Work reaches `main` in this
  repository without an agent running `git push` — seven separate observations,
  and once a written claim about what was unpushed became false between being
  written and being committed. Ask as late as possible, and ask again before
  calling anything unpushed.
- **Ask before trusting a branch's numbers, not only before pushing them.** Two
  sessions fixed the same request timeout from different evidence and neither
  knew; the same happened to a dropped log line and to the usage line. A branch
  published and left for a day is the shape that produces this.
- **A push refused with `fetch first` means `main` moved.** Rebase and push again;
  it is the ordinary case here, not a fault.
- **A `cancelled` browser smoke on `main` means a later push arrived.** The
  workflow declares `concurrency: browser-smoke-${{ github.ref }}` with
  `cancel-in-progress`. Look for the workflow's own concurrency group before
  reading it as a break.
- **Probe gated paths with `-I`, not `-L`.** Every gated path answers `307` to
  `/login?next=…`, so `curl -sL … | grep` reads the login page and reports a
  build that has not landed. This produced a false negative for a dozen polls.
- **The CSS-hash trick for identifying a deployed build is dead.** Use the
  `commit` field on either half's health endpoint, or a route that exists only in
  the new build.
- **Outbound reachability to `*.vercel.app` varies by container.** Treat a failed
  request as a fact about the container, not about the deployment.
- **`git status` can hide untracked files here** — the untracked cache has gone
  stale once. Confirm with `git ls-files -o --exclude-standard`.
- **`.env.local` overrides `.env`**, in `scripts/local-stack.mjs` and in Next.js
  both. It once pinned `AI_ANALYTICS_CONTRACT_VERSION=5.0` silently, so a local
  run was exercising a lighter contract than the deployment produces. The stack
  banner prints the version it resolved; read that line after changing any env
  file.
- **A stale dev server can fake a layout bug.** Verify signed-in screens against a
  production build on its own port rather than against `next dev`.
- **Every worktree needs its own `ai-analytics-service/.venv`**, created with
  `pip install -e ".[dev]"` — plain `-e .` installs no pytest. `npm test` drives
  the real Python pipeline through it, and `npm run lint:interpreter` fails on a
  `python3` spawned by name anywhere.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and the Python service, then record only fresh read-only evidence in the new
branch task file. Both halves are one anonymous request each; the rules for
reading the service's commit without raising a false alarm are under
**Deployed state** above.

The last such comparison was made on 2026-08-20 and both halves matched the tip
at `e69a5eb`. What has changed since is documentation only — see **Last read**.

## Published documents

The three HTML documents under `docs/` also exist as artifacts on claude.ai. They
were republished from their repository sources on **2026-08-20**, which is the
last date the two sides are known to have been level; that stops being true the
moment a document changes without a republish. `docs/README.md` owns the rule.

**Publishing is an undocumented hand transformation**, and that is the defect
rather than an inconvenience. A repository document is a whole HTML page; the
platform wraps content in its own skeleton and injects its own mermaid, so
publishing means stripping `<!doctype>`/`<html>`/`<head>`/`<body>`, dropping the
`vendor/` script tags and keeping `<title>` inside the first 8 KB. Nothing in the
repository performs it, so the next person derives it again. The 2026-08-20 pass
left the `claude-mermaid-runtime` marker block in the published body of two
pages, which now carry that small `<style>` twice — identical rules, nothing
renders differently, and it is the symptom rather than the defect. One script
beside the other checks in `scripts/` would end both.
