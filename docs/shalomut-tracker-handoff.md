# Shalomut Tracker — operational handoff

Updated: 2026-08-05, session close (`origin/main` is `4b0a4bd`; nothing is
pending, nothing is waiting, and what is left is decisions rather than work).
This
document owns only cross-task operational/deployed
state, external blockers and approval gates. Product milestones belong in
`PROGRESS.md`; branch work and exact verification belong in
`docs/agent-tasks/{active,archive}/`; older snapshots remain available in Git.

## Repository snapshot

- `origin/main` is `b0c9848` — `feat/round-context-across-screens`, pushed by
  the owner on 2026-08-06. The round a manager is reading now follows them
  across home, tracking, the builder and the map, and a round the school has
  moved past is read rather than worked on. Before it, `main` was `ddd6be3`,
  the 2026-08-05 session close.
- Five branches reached `main` on 2026-08-05, each as a fast-forward the owner
  pushed themselves: `feat/survey-definition-history` (backlog §1),
  `feat/archived-rounds-read-only` (§10), `feat/goals-across-rounds` (§5), plus
  `docs/close-causal-refusal-decision` and `docs/roadmap-reconciliation`. All
  are fully contained in `main` and can be deleted; their task files are in
  `docs/agent-tasks/archive/`.
- Nothing is waiting. No branch holds unpushed work the product needs; the one
  unmerged branch, `fix/refuse-asserted-causes`, is a decided **no** and is
  described below.
- **No migration is pending on the deployed database.** The eleventh,
  `20260805170000_add_survey_definition_versions`, was applied on 2026-08-05
  immediately after the push that carried its code — the build command runs
  `prisma generate`, never `prisma migrate deploy`, so this is a hand step every
  schema change still needs. Details and the read-back are in the database
  section below. Nothing after it changed a schema.
- Verification at `b0c9848`, the current head: `npm run verify:core` exit 0
  with 620 TypeScript tests. `verify:db` and `verify:ai` were **not** run for
  it — nothing since 2026-08-05 morning changed a schema, a repository, a
  contract or Python. The last `verify:db` reading is 26 tests, 26 pass at
  `763e38f`, against local PostgreSQL on `127.0.0.1:5433`.
- **The manager screens have now been walked in a browser**, on 2026-08-06,
  with the owner signed in on the local dev server. This closes the gap the
  2026-08-05 entry recorded. It was worth doing: the walk found three defects
  that the test suite did not — stale client state across a round switch, a
  duplicate React key that rendered two rounds' controls at once, and a link
  that dropped the round. All are fixed in `c67471c`. A signed-in walk remains
  the check that a rendering test cannot stand in for.
- Deployment of `b0c9848` was read on 2026-08-06 and is `Ready`; see the
  deployed-state section.
- Superseded snapshot: `origin/main` was `45f38c2` — the round archive.
  Verification there: `verify:core` exit 0 with 576 tests; `verify:db` and
  `verify:ai` not run, and the archive flow not smoke-tested in a browser.
- Older snapshots of this pointer were trimmed on 2026-08-05. They had grown
  into a session log of every push since 2026-08-02, which is what Git and the
  archived task files already hold, and this document is supposed to say what
  is true now. `git log --oneline main` and `docs/agent-tasks/archive/` carry
  the same history with the commits attached. Everything the trimmed entries
  recorded as an approval gate, a deployed fact or an external blocker is
  preserved in the sections below rather than in that chain.

## Deployed state

- Supported product environments remain local and deployed only.
- Core endpoint: `https://shalomut-map-demo.vercel.app/`. Vercel names the
  target Production; for the product it is the design-stage operational staging
  endpoint.
- AI service: Render container from the root `Dockerfile`, with durable polling
  enabled. The service needs an always-available process or explicit wake
  mechanism; scale-to-zero alone is not a reliable worker. An inbound
  `GET /health` resets the free plan's fifteen-minute sleep timer, which the
  service's own outbound polling does not.
- **GitHub Actions is not the keep-alive, and the reason is measured.**
  `.github/workflows/render-keepalive.yml` carried `schedule: */10 * * * *` from
  14:21Z on 2026-08-05. The run list was read every two minutes until 16:05Z:
  ten cron windows passed and not one scheduled run ever appeared, while the
  manual `workflow_dispatch` finished green in 9s with `status: online` and
  `commit: 80930a4`. The workflow was `active` throughout, so this was not
  GitHub's sixty-day idle rule. GitHub's scheduler is best-effort, skips runs
  under load rather than queueing them, and throttles short periods hardest.
  Owner decision 2026-08-05: move the keep-alive to an external pinger. The
  `schedule` block is gone; what the workflow still offers is a manual wake
  before a demo or a round.
- **The keep-alive is an external uptime monitor, and it exists.** UptimeRobot,
  free plan, in the owner's own account: monitor `Shalomut AI analytics —
  keep-alive /health`, keyword type, `GET
  https://shalomut-ai-analytics.onrender.com/health` every five minutes — three
  times the rate the fifteen-minute sleep timer needs, so a skipped check costs
  nothing. Created 2026-08-05 in the owner's signed-in browser, with the owner
  confirming the settings before it was saved. It reported `Up` with 100%
  uptime at its first checks.
- Keyword rather than plain HTTP: it fails unless the body contains
  `"status":"online"`, so a `200` from an edge in front of an unhealthy
  container does not read as alive. Alerts go to the account e-mail, with no
  delay and no repeat. Nothing secret is involved — `/health` is public and
  returns no respondent data.
- If the service starts sleeping again, that monitor is the first thing to
  check, before anything in this repository.
- An always-awake instance costs nearly the account's whole free allowance of
  750 instance-hours a month, so a second free service does not fit beside it.
  The paid instance type is the version that needs neither a workflow nor a
  monitor.
- Database: the confirmed deployed Supabase PostgreSQL target contained all
  seven repository migrations after `prisma migrate deploy` and a successful
  follow-up `prisma migrate status` on 2026-08-02. The eighth,
  `20260804120000_one_active_round_per_organization`, was applied there on
  2026-08-04: `prisma migrate status` reports the schema up to date, and a
  read-back confirms `survey_rounds_one_active_per_organization` exists as a
  partial unique index on `(organization_id) WHERE status = 'active'`. No school
  held two active rounds when it was created, so the migration's cleanup step
  changed no row. The deployed database holds one round, and it is active.
- The ninth migration, `20260804170000_add_round_goals`, was applied there on
  2026-08-04: `prisma migrate status` reports nine migrations and a schema that
  is up to date, and a read-back confirms `round_goals` with its unique key on
  `(round_id, dimension_id, title)`, its `(round_id, created_at)` index and a
  cascading foreign key to `survey_rounds`. The table holds no rows.
- The tenth migration, `20260804190000_add_round_updated_at`, was applied to the
  deployed database on 2026-08-04: `prisma migrate status` reports ten
  migrations and a schema that is up to date. It adds the nullable
  `survey_rounds.updated_at` that carries the manager screens' save time across
  a reload. The deployed round has `updated_at NULL`, so its setup screen shows
  no save time until someone saves once — the documented behaviour for a round
  written before the column existed.
- The eleventh migration, `20260805170000_add_survey_definition_versions`, was
  applied to the deployed database on 2026-08-05, right after the push that
  carried the code: `prisma migrate status` reports eleven migrations and a
  schema that is up to date. A read-back confirms `survey_definition_versions`
  with `id`, `round_id`, `definition jsonb` and `saved_at`, its
  `(round_id, saved_at)` index, and a foreign key to `survey_rounds` with
  `ON DELETE CASCADE`. The table holds no rows: the deployed round has not been
  saved since. No migration is pending.
- **`npm run db:migrate:deploy` targets the local database, not the deployed
  one.** It reads `.env`, which points at local PostgreSQL on purpose. The
  deployed database is reached by passing `DIRECT_URL` from
  `.env.deployed.local` as `DATABASE_URL`. This cost a broken deployment on
  2026-08-04: the push went out, the migration was run against local, reported
  success, and every round read on the deployed app returned 500 until the
  migration reached Supabase.
- Sequencing rule this leaves behind: the build command runs `prisma generate`,
  not `prisma migrate deploy`, so a schema change must reach the deployed
  database **before or immediately after** the push. Prisma selects the model's
  columns by name, so in between, every read of the changed table fails rather
  than falling back. The discriminating check when it happens: the previous
  deployment's own URL still answers correctly while the Production alias
  returns 500 — same database, so the difference is the schema the new build
  expects.
- No real respondents or production data exist. Database contents are
  disposable at this stage.

## Contract and AI runtime

- Contract `6.0` completed its consumer-first rollout. Deployed Python and Core
  support it, and deployed Core explicitly produces `6.0`.
- Unset Core configuration remains `5.0`, which is the rollback value. Core can
  produce `3.0`–`6.0`; callback/parser support spans `1.0`–`6.0`.
- The recorded deployed V6 round completed through durable claim, provider,
  callback, persistence and authenticated Dashboard rendering with eight
  stones, three summary paragraphs and five recommendations per stone.
- Runtime contract details and the rollout rule are canonical in
  `docs/ai-contract-version-matrix.md`; do not reconstruct them from old rollout
  plans.
- A durable run still refetches the round's aggregates instead of owning an
  immutable snapshot, so a response landing mid-analysis fails the callback with
  `round_validation_failed`. Since 2026-08-04 the automatic path retries that
  one failure up to three runs per round (`PROJECT_CONTEXT.md` ADR-016); before
  that a single late response left the round with no analysis and no signal.
  The new `ai_jobs_rearmed` operational metric counts the retries. **Its rate is
  the evidence for whether to build the immutable input snapshot**, which is
  Phase 1 of the AI harness improvement plan the owner is holding outside the
  repository.

- On contract `6.0` a silent provider does not fail a dimension: the structured
  summary and the metric narratives fall back to aggregate-derived copy and the
  round is reported `success`. Since 2026-08-04 that is disclosed rather than
  implicit — ADR-007 now describes it, the dimension screen tells the manager
  no model wrote those paragraphs, and every accepted map emits
  `ai_deterministic_summary_ratio_sample`. **Read that share before reading any
  round as evidence about the prompts**; on a rate-limited key it is close to 1
  while `ai_jobs_succeeded` looks healthy.
- Since 2026-08-04 `6.0` also declares `supportsPartialMaps`, and what produces
  a gap is repair exhaustion rather than a silent provider: when the budget is
  spent and every refusal left is one dimension's own copy, that dimension is
  reported as a stated gap instead of the round failing whole. Gated on the
  capability, so `5.0` behaves the same way.
- Since 2026-08-04 the map sidebar carries a notice naming the dimensions a
  round has no interpretation for, so a partial map is visible without opening
  the dimension that is missing. It also says which cause left each dimension
  without words: the gap carries `generationProvenance.unavailableReason`, and
  the notice and the dimension screen give different advice for the two — retry
  in a few minutes for a silent provider, retry for a different wording when
  this service refused its own copy. Rounds analysed before 2026-08-04 carry no
  reason and get a sentence that claims neither.
- Since 2026-08-05 the metric narratives are covered too:
  `generationProvenance.metricInsightsOutcome` says whether the model or this
  service wrote them, separately from the overview, and the metrics screen says
  so in Hebrew when they are derived. One value per dimension, because one call
  writes all of its narratives. The operational half is
  `ai_deterministic_metric_narrative_ratio_sample`, and a round that recorded
  nothing emits no sample rather than counting as model-written — **read it
  beside the summary ratio, not instead of it**: a key that answers the short
  prompt and times out on the longer one shows a healthy summary ratio and
  derived narratives underneath.
- The same slice documented `unavailableReason` and the `unavailable` outcome in
  `docs/openapi.yaml`, which the partial-map work put on the wire and never
  wrote down. `public/openapi.json` was regenerated.

## Operational invariants

- Confirm the database/environment before any write so work does not land on
  the wrong target. Clear, reseed, reset and migrations need no data-preservation
  ritual during the design stage.
- Keep respondent identity and sub-threshold details out of every manager and
  AI boundary.
- Deployed manager auth requires `SESSION_SECRET`,
  `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`; machine boundaries use
  their own shared secrets.
- The deployed producer switch is configuration, not a silent fallback.
  Unknown contract versions fail closed.
- Parallel agents use separate branches, worktrees and active task files.

## External blockers and approval gates

- Before the first real respondents, rotate the four credentials previously
  exposed in a private design-stage transcript. This is an accepted deferred
  gate, not a blocker for local/docs work.
- Explicit bounded approval is required before changing secrets, credentials,
  authentication configuration or deployment aliases.
- No open migration decision remains in the repository record.
- **Closed 2026-08-05, no longer a blocker.** The eval corpus has scored real
  provider output. The owner installed a paid Gemini key, and a full run on
  `gemini-3.5-flash-lite` produced `outcome: "llm"` on 55 of 56 stones with no
  `429` in the log. The quota argument for the free tier no longer applies —
  which is why `render.yaml` now paces the fast model at `60` and the heavy one
  at `30`, the rates those runs actually sustained, instead of the `14` and `4`
  the free tier dictated. Applied on 2026-08-05: the service is blueprint
  managed, and its dashboard now reads `60` and `30`. It assumes the dashboard's
  `GEMINI_API_KEY` is the billed key, which no agent can read — the one thing
  about this pace still taken on trust.
  What the first report says lives in
  `docs/agent-tasks/archive/test--eval-corpus-baseline.md`. The open question it
  raised — whether `summary_grounding` counts what it claims to count — was
  answered no and fixed the same day; the baseline is the corrected scoring of
  the same payloads. `no_overreach`, the one weak grader, was then worked on in
  `fix/prompt-no-overreach` and stands at 0.94 with a second baseline beside
  the first. Four asserted causes survive it. **Owner decision 2026-08-05: they
  stay.** The runtime refusal that removes them was built and measured, and the
  measurement decided it — see the entry below. This is settled, not open.
  Still run the provenance check before reading any report, per
  `evals/README.md`.
- That chain has landed. `test/eval-corpus-baseline`, `fix/prompt-no-overreach`,
  `feat/retry-carries-a-critique` and `feat/adaptation-retry-critique` are all
  contained in `main`; the retry that carries a critique is `f8c08a5`. Nothing
  from that work is waiting to be pushed.
- `fix/refuse-asserted-causes` is deliberately **not** in that chain, and owner
  decision 2026-08-05 closed the question rather than deferring it: the rule is
  not merged. It refused asserted causes at runtime, which worked and cost 8 to
  14 percent of the map's model-written prose, and eight of its eleven refusals
  were the model's own caveats about the sample. The code stays on the branch as
  the measurement. Do not re-open it as an unfinished task; the one thing that
  branch carried and `main` needed — the retry that rebuilds its request with a
  critique — landed separately as `f8c08a5`, so nothing there is waiting. If the
  rule is ever revisited, the branch's own note says fix the subject rather than
  the mechanism: refuse a cause attributed to the school or to people, allow one
  attributed to the data and the sample.
- **Settled 2026-08-05, no longer a gate.** The two amendments published
  contract `6.0` took on 2026-08-04 — `supportsPartialMaps` and
  `generationProvenance.unavailableReason` — stood against ADR-002's rule that
  released semantics do not change. Owner decision: ADR-002 gains the explicit
  clause rather than `7.0` being opened. A published contract may gain an
  optional additive field and nothing else, on five conditions ADR-002 now
  states, of which the load-bearing two are that absence keeps the version's
  previous meaning and that the consumer accepts before the producer emits.
  Both amendments meet them. The rule rests on validation that checks known
  fields without enumerating keys, so a validator that ever starts rejecting
  unknown keys revokes it. `docs/ai-contract-version-matrix.md` carries the
  operational form under "Amending a published version".

## What is open, and what it waits on

Recorded at the 2026-08-05 session close. Nothing here is unfinished work; each
item waits on a decision, a request or the owner's own hands.

**Waits on an owner decision**

- Whether a tracked goal ever gains an owner, a due date or a plan of steps.
  `docs/product-behaviour-backlog.md` §5 has held this open deliberately since
  2026-08-04: the three-state goal was built as the smallest thing that makes
  "tracked" true, and anything more is a product choice rather than a gap.
- Whether a goal should be read beside the delta of the dimension it belongs to.
  The goals screen names the dimension and the round; it shows no numbers, and
  putting a score next to a goal is a different question from where goals live.

**Waits on being requested**

- A second manager per school (§8). One manager per deployment is the requested
  shape; the work behind a second one is a data model and a set of flows, and
  `PROJECT_CONTEXT.md` ADR-013 says why swapping the password hash closes
  nothing.
- Repeat-measurement reminders (§11). Reminding respondents would need contact
  data the privacy model deliberately does not hold; reminding the manager would
  not.

**Waits on the owner's hands**

- A signed-in walk of the three newest screens on the deployed endpoint: the
  builder's version history, an archived round's read-only round screen, and
  `מעקב יעדים`. Every manager route redirects to `/login`, and the agent never
  sees or types the manager password. The last signed-in check was 2026-08-04
  and predates all three.
- Rotating the four design-stage credentials before the first real respondents.
  Listed above as an accepted deferred gate; it is still open.

**Worth a look, cheap**

- The UptimeRobot keep-alive was created on 2026-08-05 and reported `Up` at its
  first checks. Two minutes of `Up` is not evidence that the Render instance
  stays awake across a quiet night. Whoever opens the next session should read
  the monitor's uptime before anything in this repository.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

**Core was re-read on 2026-08-06 and is on `b0c9848`, the current
`origin/main`.** Read-only, nothing changed:

- **Core (Vercel):** the newest deployment is `b0c9848` on `main`, environment
  `Production`, status `Ready`, built in 40s about a minute after the push.
  Read from the project's deployments list in the owner's own signed-in
  Chrome; nothing was clicked and no secret was displayed. Anonymously, `/`
  still answers `307` to `/login`, as it should. Signed in, the deployed home
  and tracking screens serve the new code: the round-scoped links carry
  `?round=`, `setup` and `goals` stay bare, and the console is clean. The
  switcher does not render there, which is correct — the deployed school has
  one round, and the switcher appears from two.
- **Python (Render):** last read at 18:16Z on 2026-08-05, on `763e38f`.
  `/health` answered `status: online`, `commit: 763e38f`, `env: production`,
  `privacyThreshold: 10`, `supportedContractVersions` `1.0`–`6.0`,
  `jobPollingEnabled: true`. Not re-read on 2026-08-06 and not expected to
  move: nothing since has changed Python.
- The schema matches: the only migration these three slices needed was applied
  by hand on 2026-08-05, and nothing after it changed a schema.

Earlier readings the same day — `143d460` at 17:10Z, `3590aae` at 14:31Z,
`65b2885` and `67048b5` before them — were trimmed on 2026-08-05 along with the
snapshot chain above. Each said the same thing about a commit that is no longer
deployed, and Git holds the commits themselves.

So the contract amendment of 2026-08-05 is live on both sides. What that is
**not** evidence of: no round has produced `metricInsightsOutcome` against a
real provider yet. Deployed code, not deployed behaviour.

`GET /api/health` on Core is behind the login redirect, so the deployed
producer/supported versions cannot be read anonymously. Reading them means
signing in, which is the owner's action — see the functional check below.

**The functional half of this check is done, 2026-08-04.** It had stood open
because every manager route redirects to `/login`. The owner signed in
themselves in their own Chrome and handed the session over; the agent never saw
or typed the credentials, and that remains the rule.

What was exercised on `shalomut-map-demo.vercel.app`, signed in:

- Setup, builder, round tracking and the dashboard all render real persisted
  data. The stone map is unlocked at ten responses against a threshold of ten,
  with all eight dimensions, statuses carried by words as well as colour, and no
  respondent-level detail anywhere.
- The persisted save time end to end: saving on the setup screen showed
  "נשמר בשעה 14:43", a full reload kept it — server-rendered from the column,
  not tab state — and the builder showed the same time, because both screens
  read one `updated_at`.
- The round's `updated_at` was then set back to `NULL` so the deployed data is
  as it was, and both screens correctly went back to showing no save time. The
  round itself was rewritten only with the values it already held.

This is behaviour, not deployment metadata. What still needs the owner is the
sign-in itself, so plan a deployed functional check as something done together.

That check is a day old and already behind: it predates the questionnaire
version history, the read-only archive and the school-wide goals screen, none of
which any human has opened in a browser. They are covered by rendering and route
tests, which is not the same claim.

The long-term identity model is no longer the next architecture slice. Owner
decision 2026-08-03: one manager per deployment is the requested product shape,
so identity is requirement-gated future work — `PROJECT_CONTEXT.md` ADR-013 and
`docs/product-behaviour-backlog.md` §8. The SHA-256 password hash stays as it
is; it is derived from `MANAGER_ADMIN_PASSWORD` per login and never stored, so
replacing the algorithm alone would close nothing.

What this leaves standing as an operational item: the deployment secret is the
credential, so rotating it means a redeploy, and the open rotation of the
exposed design-stage credentials before the first real respondents is
unaffected by this decision.
