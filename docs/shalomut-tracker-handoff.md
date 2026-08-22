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

Verified 2026-08-22, in this worktree and on the deployed endpoint:

- **`GET /api/health/` answers `commit: b4f9b50`**, read 2026-08-22 after the
  redeploy that restarted the pipeline. It carries the day's earlier runtime
  changes — the bounded connection pool, the dropped index, and the build that
  applies its own migrations — but **not** the conditional round status write
  below, which is committed on `fix/a-status-write-that-failed-says-so` and
  reaches the deployment when that branch is pushed and Vercel builds it. Read
  the endpoint again rather than this line whenever the tip matters. The only
  unrelated modified file in this worktree is `next-env.d.ts`, which is
  generated and belongs to the owner.
- **A round status write that failed now says which failure it was.** The write
  is conditional on the status the request read, so a transition validated
  against a stale read is refused by the database rather than applied over
  whatever happened since, and `RoundStatusWrite` names the five outcomes the
  old `null` collapsed. The audit row and the closing analysis are now
  consequences of a confirmed write — before this, a failed `active → closed`
  still queued the analysis and produced a map for a round that was still
  collecting. ADR-032 records it, including what it deliberately leaves
  non-atomic.
- **A collecting round no longer publishes its numbers, on the deployment too.**
  `648465c..66707ae` closed the critical finding of the 2026-08-21 audit: an
  open round republished its full per-question aggregates on every read, so two
  reads taken either side of one submission could be subtracted to recover that
  respondent's answer sheet. The gate sits in
  `calculateDynamicRoundAnalytics`, so all seven consumers inherit it; ADR-030
  records it and amends ADR-022. Walked on the deployed endpoint on 2026-08-22
  with the demo round set to `active` and back to `closed`: locked while
  collecting, full map once closed. Detail in
  `docs/agent-tasks/archive/fix--results-open-when-the-round-closes.md`.
- **Deployed reads can be served by the Next.js client router cache.** The first
  `/dashboard` load after a status change showed the previous render; a fresh
  URL showed the truth. When checking a deployed behaviour change, vary the URL
  rather than trusting a repeat navigation.
- **The old `feat/what-the-administrator-sees` ref on `origin` is gone**, deleted
  2026-08-21. It had stopped at `2576b99` while `main` moved on, so it held no
  work of its own — `main` already contained it — and a future agent reading it
  would have found a tree 27 files behind. Branches on this project land with
  `git push origin <branch>:main`, so a same-named remote branch is a leftover,
  not a target.
- **Two commits of the day changed runtime; the rest did not.** `179600c` is
  the one the tenancy evidence below was taken against, re-checked on `d4b6039`
  anyway. `6bf0757` moved the eight dimensions' Hebrew texts into
  `contracts/wellbeing-dimensions.json` and deleted the drifted second copy of
  the names — one string changes on screen, `management-support` on the
  breakdown table. Everything else since `179600c` is documentation, tests and
  check scripts.
- **No migration was needed for any deploy since.** `54881c5..bbcc41b` touches
  no file under `prisma/`. The deployed schema is the one applied earlier the
  same day — 18 migrations, `Database schema is up to date!` The identity tables
  are no longer empty: `managers` holds **1** row (the bootstrapped platform
  administrator), `organization_memberships` **0**, `organizations` 1 and
  `survey_rounds` 1. `audit_events` is not a fixed number and should not be
  quoted as one — every walk of a manager screen adds an
  `ADMINISTRATOR_SCHOOL_VISIT`, all of them naming the demo school. It stood at
  1 before the fix and at 7 by the end of the day. **The deployed audit log records
  again**; before those migrations every manager write had been failing on the
  missing table and logging `[audit] … was not recorded` while the action itself
  proceeded.
- **Sign-in on Production is Google, not a password (2026-08-21).** All five
  identity variables are set and the whole flow was walked on the deployed
  endpoint. The approval-gate entry below carries the evidence and the client's
  configuration. The walk also produced a finding — an administrator's reading
  of a school went unrecorded whenever exactly one school existed — which is
  fixed, deployed and proved on the deployment; the two rows below are that
  proof.
- **An administrator's plain reading of a school is now a row, on the
  deployment.** The original observation was reproduced against `179600c`:
  signed in with Google, landed on `/setup/` with no `?school=`, saw the demo
  school's name, city, type and round — and `audit_events` went from 1 to 2, the
  new row naming the demo school with no round, at 11:38:06Z. Then the case that
  tells the two versions apart: `/setup/?school=00000000-0000-0000-0000-`
  `000000000000`, a school that does not exist. The screen fell back to the demo
  school, and the row written names **the demo school**, not the id that was
  asked for. The version before the fix would have filed that reading under a
  school nobody has ever had. A third row appeared 72 seconds after the second
  for the same administrator and school, which is the fifteen-minute window
  being process-local across two instances — documented behaviour, and the log
  holding a visit twice rather than missing it.
- **The deployed database has all 19 migrations**, `Database schema is up to
  date!`, read 2026-08-22 after applying
  `20260822120000_one_index_per_lookup_on_question_answers` by hand through
  `DIRECT_URL` from `.env.deployed.local`. `question_answers` there now carries
  `question_answers_pkey` and `question_answers_response_id_question_id_key` and
  nothing else, with its 288 answer rows across 12 responses untouched. The
  table is far too small for the planner to choose an index on its own — a
  `response_id` lookup seq-scans 288 rows — so the check that means anything
  there is that the composite *can* serve it: with `enable_seqscan = off` the
  plan is an index scan on
  `question_answers_response_id_question_id_key`, 3 buffers. The cost comparison
  was made locally, where the table has 4576 rows.
- **The AI service correctly did not rebuild** and still serves `e69a5eb`.
  Nothing in this push touches its `buildFilter` paths, so a service commit
  behind Core's is the expected resting state here, not a missed deploy.
- **Phase 5 is deployed and the signed-in path was walked there.** That walk
  used the password door, which Production no longer has; it stands as evidence
  for renewal, not as a way in. Signed in as `admin@shalomut.edu.il`
  (`mgr-admin-001`, a school admin, `isPlatformAdministrator: false`), the
  session read
  `09:45:05 → 10:00:05` — fifteen minutes, ADR-028 alive on the real endpoint.
  `SessionRenewal` fired its own `POST /api/auth/session/renew` on page arrival
  and got **`200`** with `renewAfterSeconds: 300`; the window moved to
  `09:45:13 → 10:00:13`, the length unchanged, and `/api/auth/me` still answered
  `authenticated: true` afterwards. No console errors. This is exactly the path
  phase 5's first version broke — renewal signed the password-door manager
  straight back out — so it is the check that had to happen here rather than
  only locally.
- **Refusals hold on the deployed endpoint, signed in and anonymous.** Anonymous:
  `POST /api/auth/session/renew/` → `401 NO_SESSION` with a `Max-Age=0` cookie
  clear, `/admin/` → `307` to `/login`, `/api/admin/people/` → `401`. Signed in
  as a school admin: `/admin` redirects away and `/api/admin/people/` answers
  **`404 Not found.`** rather than `403` — the deliberate non-disclosure, since a
  `403` would confirm the screen exists.
- **Phase 4 has not been exercised on the deployed endpoint**, and cannot be
  usefully: the deployed `managers` table is empty, so the only account there is
  the environment-built school admin, and `/admin` is unreachable through it by
  design. The administrator screen was walked locally against a stand-in identity
  provider — see
  [`archive/feat--what-the-administrator-sees.md`](agent-tasks/archive/feat--what-the-administrator-sees.md).
  Setting the four `OIDC_*` values is what makes it reachable there.
- **The local database has all 18 migrations** and carries the walks' leftovers:
  extra schools, an invited-then-revoked person, and `audit_events` rows.
  Disposable.
- **The suite was green at `2576b99`**, the last commit that carried code: `npm test` 1342 passed, `npm run
  typecheck`, `npm run lint` and `npm run build` clean, and `lint:composition`,
  `lint:doc-numbers`, `lint:literals`, `lint:skills`, `openapi:check` and
  `docs:endpoints:check` all pass. `verify:core` was not run whole; `verify:ai`,
  `lint:interpreter`, `lint:mutation-config`, `lint:contract-refusals` and
  `lint:fixtures` were not run, because nothing in this work touched the AI
  contract or the Python service.

**Next concrete step:** ask the owner for the methodologist's item-to-dimension
mapping, because without it there is no substantial *product* work an agent can
start. This branch is finished — the multi-tenancy plan is closed, the
deployment signs in with Google, and the one defect the sign-in walk found is
fixed, deployed and proved there. The standing alternative,
[`product-behaviour-backlog.md`](product-behaviour-backlog.md) §12, is not
startable: its machinery landed on 2026-08-15 and both halves that remain — the
126 items and contract `7.0` — wait on that mapping.

Engineering work, unlike product work, is no longer blocked, and that changed on
2026-08-22: the 2026-08-21 audit is in the repository as
[`critical-audit-2026-08-21.md`](critical-audit-2026-08-21.md). It had existed
only in a session and a private artifact, and what the repository held of it was
one sentence naming a count. Forty-nine of its fifty findings are open, seven of
them high and re-read on `0a56f8c` — analytics recomputed on every manager
screen, the administrator overview at ~3 sequential queries per school, a
heartbeat blip that terminally fails a paid run, three write paths that report
success on a failed write, a re-analysis that hides an already-saved map, and no
deploy path that applies migrations. None has an owner decision behind it, so
picking one is a conversation before it is a branch.

The owner picked the two cheap ones on 2026-08-22 and both are closed —
`f7da423` and `4392c34`, four of the audit's fifty entries, since the pool
appeared in it three times. The Prisma client now caches on `globalThis` rather
than per module graph, its pool is bounded at two connections with a finite wait,
the three scripts build their pools from the same function, and the duplicate
index on `question_answers` is gone.

Then the migrations one, which is why the hand step above existed at all: a
deployed build now applies its pending migrations before it builds anything and
fails rather than shipping when it cannot (ADR-031).

Then the fail-open cluster on the round status write, `12980ca` — two entries
and five findings, because four of them met on one path. The write is now
conditional on the status the request read, its outcome is named instead of
collapsed into `null`, and audit rows, analysis dispatches and `success: true`
are consequences of a confirmed write (ADR-032).

Then the one where a re-analysis hid the round's map, `85ad5dd`: the map a
manager reads is the newest result the round has, and a run that is queued,
running or failed now qualifies it on screen instead of replacing it with an
empty state (ADR-033).

Then the worker's resilience entry: a heartbeat that could not be sent is
retried, the lease Core granted — not the beat — decides when to stop analysing,
and a run the worker has to let go is released for its remaining attempts rather
than failed terminally. The same rule covers a finished map whose delivery ran
out of attempts against an unreachable Core (ADR-034).

That one changes the AI service, not Core. Pushing it rebuilds Core on Vercel and
changes nothing about the running worker: `ai-analytics-service` deploys on
Render on its own, so until that service is redeployed the deployed run loop
still fails a paid run on the first blip.

Then the per-screen analytics recompute, the audit's oldest high finding. A round
that is still collecting now reads no answer rows at all, and a round that has
stopped collecting keeps the numbers it published in a new
`survey_rounds.published_analytics` column and is read back from it while its
basis of calculation is unchanged (ADR-035). **This one carries a migration** —
`20260822180000_a_closed_round_keeps_the_numbers_it_published` — which a deployed
build applies on its own since ADR-031; nothing to do by hand, but the first
build after this push is the one that adds the column.

Then the last high finding, the administrator overview's N+1 — closed in the half
it named as the mechanism. The screen asks five queries for the whole list
instead of three per school in a loop, rounds arrive as summaries without their
questionnaires, and response counts come back from one `GROUP BY` (ADR-036). It
carries a migration too: an index on `survey_rounds(organization_id)`, added
because the planner was asked rather than because the finding said "unscannable"
— measured at 5 000 rounds, it does nothing for the overview and takes one
school's rounds from 0.50 ms to 0.034 ms, which is the per-school read every
manager screen makes. **The second half of that entry stays open and is an owner
decision**: the console still renders every school with no pagination and no
server-side search.

Then the breakdown's cell privacy, the first of the mediums. A group past the
size threshold was publishing a dimension average for every dimension it
answered at all, and analytic questions may be optional — so a group of twenty
could bring four people to one dimension and print their average beside a group
size that said nothing about it. Cells now go through the same
`suppressFrequency` as the group sizes, computed across the row because the
round's own map publishes each dimension's average and a lone blank is
recoverable from it by subtraction, and every published cell states how many
people it stands on (ADR-037). No migration; Core only.

Two more entries were closed in the same pass without new code. The dashboard
comparison's four full response loads per render were closed by ADR-035 — the
path never changed, but three closed candidates now cost three row reads. And
the missing `survey_rounds(organization_id)` index was closed in its index half
by ADR-036, with its summary-read half still open for `findByOrganizationId`.
Then the login screen's open redirect. `resolveLoginRedirect` decided whether a
destination was inside the product by reading the first two characters of the
string, and browsers strip ASCII tab, line feed and carriage return from
anywhere in a URL before parsing it — so `/login?next=/<LF>/elsewhere` passed the
check and landed on `elsewhere`. The candidate is now resolved by a URL parser
against a host that cannot exist and honoured only if it still names that
origin, and the OIDC callback re-checks the destination where it builds the
`Location` header instead of trusting its unsigned handshake cookie (ADR-038).
No migration; Core only.

**Thirty-six entries remain open; none of them is a high finding still open in
full.**

**The remaining entries were re-checked against current code on 2026-08-22**,
after the owner suspected some had been fixed in passing. Twelve anchors were
opened and read — the per-screen analytics recompute (closed since, above), the
administrator overview's N+1, the worker's missing retry (closed since, above),
the unpinned Python dependencies,
breakdown cell suppression, the login open redirect, the unverified TLS to the
database, the shared secret's fail-open branch, the unlimited attempt beacon,
the share-code alphabet, `clear-db.ts`, and Swagger's unpinned unpkg script.
None had closed on its own; the code at each anchor is what the audit described.
The entries marked `ЗАКРЫТА` in the file are the closed ones, and they are the
only ones. Two of the twelve have since been closed by the slices above —
breakdown cell suppression and the login open redirect — and the dashboard
comparison and the index half were closed after that re-check by work that had
already landed.

**One owner item, outside the repository.** Rotating `GEMINI_API_KEY` before any
paid round blocks nothing and is still open. The unused Google client secret was
deleted on 2026-08-21 and is no longer an item.

**`DIRECT_URL` has been set on the Vercel project since 2026-08-22**, so the
pipeline that stopped for a few hours that day is running again. It was added
scoped to Production *and* Preview, which is wider than the step needs and
harmless: the step keys on `VERCEL_ENV === 'production'`, so a preview build
skips it and never touches the deployed schema. Two details are worth keeping,
because both are how that afternoon actually went. The value is the `5432`
string, not `DATABASE_URL`, whose `6543` pooled string the build refuses by port
on purpose — that mistake otherwise surfaces as an advisory-lock error about the
database rather than as a wrong variable. And **adding the variable rebuilds
nothing**: two pushes had already failed by the time it existed, and each had to
be redeployed by hand from the dashboard.

Two coverage gaps were found while reviewing what the multi-tenancy work is
tested by, and **both are closed.** The first: `npm run lint:tenant-chokepoints`
now pins both chokepoints, and it is in `verify:core`. Routing every manager path
through `loadManagerContext` or `authorizeManagerRound` had been convention
alone, and `check-composition-root.mjs` explicitly permits a page to resolve the
wiring, so a new page could have read a school unrecorded with no test failing.
Its three rules were each proved against the real tree by breaking it and
watching the check fail. The second: multi-tenancy had no browser-level coverage
— no Playwright spec opened a second school or signed in as an administrator —
so every proof of it was a unit or route test plus the manual walks recorded
above. `a16406f` closed it on 2026-08-21 with `e2e/tenant-boundary.spec.ts`,
which needs a second Playwright server on 3101 and two minted sessions, because
a runtime with no identity provider reads its directory from the password
accounts and cannot hold an administrator at all. Four checks, each watched
failing against a deliberately broken middleware, one mutation per check:
detail in
[`archive/test--multi-tenancy-in-the-browser.md`](agent-tasks/archive/test--multi-tenancy-in-the-browser.md).

That defect, for the record, was that **a platform administrator who belongs to
no school read that school's screens unrecorded whenever exactly one school
existed.** `loadManagerContext` recorded from the request rather than from the
answer — the school had to arrive in `MANAGER_ORGANIZATION_HEADER`, which the
middleware sets from `?school=`, while `resolveOrganizationId` hands back the
only school there is to a request that named none. Most manager requests name
none: a school is chosen once and the other screens carry a round in the URL.
`recordManagerScreenVisit` now takes the school from the loaded context, which
is what `authorizeManagerRound` already did with the resolved round and the
reason the round routes were never affected. The record is therefore taken after
the context resolves, so a page that is then refused has already paid for its
reads — the price of naming the school that was actually read.

**Every phase of
[`multi-tenancy-plan-2026-08-20.md`](multi-tenancy-plan-2026-08-20.md) that was
not deferred is now written and deployed** — 0, 1, 2, 3, 4 and 5. Phase 6, what a
school user may not do, was deferred on purpose by the owner and its content is
undecided. Phase 2 needed no e-mail provider in the end: an invitation is an
entitlement, so the administrator tells the invitee out of band and they sign in.
Who may read `audit_events`, and whether a school sees the visits made to it, is
the one product question these phases deliberately left open, and it has no
addressee until there are real schools. With the plan closed, the next
substantial work is no longer in it —
[`product-behaviour-backlog.md`](product-behaviour-backlog.md) §12, the research
instrument, is the standing alternative.

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

**Nineteen migrations, `Database schema is up to date!`**, read 2026-08-22. The
most recent, `20260822120000_one_index_per_lookup_on_question_answers`, was
applied that day *after* the push carrying its code, which is safe only because
it drops an index; the 2026-08-19 migration before it was applied *ahead of* its
push, which is the order every column change needs.

**Migrations were a hand step, every time, until 2026-08-22.** `npm run build`
now begins with `scripts/deploy-migrate.mjs`, so every Vercel build applies
pending migrations first and fails instead of shipping when it cannot — ADR-031.
**Both directions are proved on the real deployment**, on the same day and in
that order. Without `DIRECT_URL` the build refused in 7 s and the previous
deployment kept serving. With it, the build logged `19 migrations found in
prisma/migrations` against `…pooler.supabase.com:5432` — the direct port, not the
`6543` one — then `No pending migrations to apply.`, and went on to build and
alias in 53 s. Nothing else needs changing, and no other deploy path needs its
own step, because every path ends in a Vercel build.

What the old behaviour cost is worth keeping, because the new rule is shaped by
it. A schema change had to reach the deployed database before or immediately
after its push; in between, Prisma selects the model's columns by name and every
read of the changed table fails rather than falling back. The discriminating
symptom: the previous deployment's own URL still answers correctly while the
Production alias returns 500 — same database, so the difference is the schema
the new build expects. This cost a broken deployment on 2026-08-04. The window
now runs the other way and is shorter — the schema moves ahead of the alias, so
the *previous* code briefly meets the *new* schema — which is why additive-first
is a rule now.

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

   **The Google OAuth client exists as of 2026-08-21.** *Shalomut Map —
   deployed*, a Web application client in the `Default Gemini Project`
   (`gen-lang-client-0236547395`), created by the owner from a form an agent
   filled in. Its consent screen is *Shalomut Map*, **External** and in
   **Testing**, with `shteynumaks@gmail.com` as the single test user — in that
   state no other address can sign in at all, whoever they are. Redirect URIs:
   the deployment's callback plus ports 3000, 3210 and 3212 on `localhost`, each
   listed both with and without a trailing slash. The local half is documented
   in
   [`local-environment.md`](local-environment.md).

   **All five variables are set and the deployment signs in with Google
   (2026-08-21).** Walked end to end: `/login/` offers only the organizational
   account, `POST /api/auth/login/` answers `403 PROVIDER_REQUIRED` before
   reading a password, `GET /api/auth/oidc/start/` redirects to Google carrying
   the registered `redirect_uri` with its trailing slash, and the callback
   returns signed in. The bootstrap fired once: `managers` holds exactly one
   row, `shteynumaks@gmail.com`, `is_platform_administrator: true`, created
   11:17:43 — five seconds before the session it issued — and no membership. The
   fifth value, `OIDC_CLIENT_SECRET`, was added by the owner; Google no longer
   shows a client secret after creation, so it came from `+ Add secret` and the
   original `****CrUr` was left unused and **was disabled and then deleted on
   2026-08-21**, in that order and with a full sign-in between the two steps, so
   the client now holds exactly one secret and the console's
   more-than-one-secret warning is gone. Signing in was walked again after the
   deletion and still works. Google warns that a secret change takes five
   minutes to a few hours to take effect, so neither walk proves by itself which
   secret the runtime holds; what does is that the deployment has been
   authenticating since the owner added `****whGu` and redeployed. The other
   four, on
   Vercel, scoped to **Production only** and **not** marked Sensitive:
   `OIDC_ISSUER=https://accounts.google.com`,
   `OIDC_CLIENT_ID=921662152966-oqth23ooibkr1cs3vvvqbpjbsq40pacg.apps.googleusercontent.com`,
   `OIDC_REDIRECT_URI=https://shalomut-map-demo.vercel.app/api/auth/oidc/callback/`
   and `MANAGER_ADMIN_EMAIL=shteynumaks@gmail.com`. Two deliberate choices
   there. **Production only**, because a preview deployment's URL is generated
   per build and cannot be registered with Google, so previews keep the password
   door — which is also why `MANAGER_ADMIN_PASSWORD` stays. **Not Sensitive**,
   unlike every older variable here, because none of the four is a secret and a
   Sensitive value cannot be read back — and the one failure this setup invites,
   `redirect_uri_mismatch`, is diagnosed by reading exactly this string.

   **The trailing slash in `OIDC_REDIRECT_URI` is not a typo** —
   `next.config.ts` sets `trailingSlash: true`, the unslashed spelling answers
   `308`, and Google matches the string byte for byte in both the authorize
   request and the token exchange.

   **The password door is closed on Production and `MANAGER_ADMIN_PASSWORD` no
   longer opens anything there.** It still opens Preview, which keeps the
   password because a preview URL cannot be registered with Google. The consent
   screen is still **External / Testing** with one test user, so no address but
   `shteynumaks@gmail.com` can sign in to Production at all — that is the
   current access control, ahead of any manager row.

   Phase 1 of the multi-tenancy plan is now verified against the real provider
   rather than a stand-in, and phase 4's administrator screen has run on the
   deployed endpoint for the first time: one school, its round named and its
   status shown, `12 תשובות · התוצאות פתוחות`, and the platform-administrator
   list naming the bootstrapped row.
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
