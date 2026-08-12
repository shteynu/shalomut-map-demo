# Shalomut Tracker — operational handoff

Updated: 2026-08-11, end of session. The tip of `main` is the documentation
commit carrying these paragraphs — deliberately not written as a hash, because
twice in a row a commit set that number and then became the tip itself, naming
the commit before it. The load-bearing pointer is the other one: **the last
commit that changed product code is `187f14e`**, the end-date wording, and
`git log --oneline main -- src/ next.config.ts scripts/ playwright.config.ts`
is how to re-read it.

**Session closed 2026-08-11. Nothing is waiting on a push**, and
`docs/agent-tasks/active/` holds only `research--scientific-evidence-layer.md`,
which waits on owner decisions rather than on an agent.

**2026-08-11 landed six commits of product code, all of the same kind: screens
that stopped claiming what the system does not do.** In order —
`18c74b3` the setup screen warns while the staff count is being typed that a
staff smaller than its own privacy threshold can never unlock (the API had
refused this since `staff-floor.ts`, but only after save); `7368148` the home
screen's status stones show `—` and the round's own threshold instead of `0`
while analytics are locked, so an empty round stops reading as a perfect
school; `257bb2f` a recommendation names the ISO 45003 clause or OECD TALIS
guideline it came from, a field the contract has carried since `1.0` and no
screen showed; `9d61916` the time a questionnaire asks for is computed from the
questions it asks, on both the builder and the consent screen; `187f14e` the
round's end date is labelled `סיום מתוכנן` and says when it has passed on a
round still collecting, because it closes nothing. Verification on this tree:
`npm test` 878 pass 0 fail, `npm run typecheck`, `npm run lint` and
`npm run build` clean, each change walked in a local production build. Every
task file is in `docs/agent-tasks/archive/`.

**The cheap-wins list of `docs/product-strategy-axes-2026-08-10.md` is closed
as engineering work.** Items 3–8 and 12 were already done when that list was
drafted or landed the same day; 2, 9, 10 and 11 landed on 2026-08-11. What
remains is item 1 — whether `GEMINI_API_KEY` is on a paid billing account,
which only the owner can read — and item 13, rewriting the questions and
anchors in the inclusive convention, which is methodology and belongs with the
answer-scale decision. Do not read the numbered list in that dated document as
a to-do; it is a snapshot of 2026-08-10. The one branch that
exists and is deliberately not on `main` is
`fix/manager-password-must-be-strong` — withdrawn work, described below, local
to one worktree. Verification on the tree that is on `main`: `npm test` 856
pass 0 fail, `npm run typecheck` and `npm run lint` clean. The browser suite's
last run was 18 passed, on the same product tree with the withdrawn commit on
top; nothing in that commit is reachable from a browser, but the number is
recorded as what it is rather than as a run of `main`.

**All four Tier 0 code items are closed, on `main` and deployed.** The four
branches landed as one linear stack — `test/respondent-path-e2e` (`0506169`,
item 4), `fix/questionnaire-speaks-to-everyone` (`5cf826e`, item 3),
`feat/security-headers` (`230ee44`, item 1) and `feat/rate-limiting`
(`568fbcb`, item 2) — and all four task files are now in
`docs/agent-tasks/archive/`. `docs/agent-tasks/active/` holds only
`research--scientific-evidence-layer.md`, which waits on owner decisions.
Nothing is waiting on a push.

**What "deployed" means for each of them, because it is not the same claim
four times.** The Vercel deployments list was read on 2026-08-10 in the owner's
signed-in Chrome: `568fbcb` on `main` is `Ready`, built in 40s, carrying the
Production badge, with every earlier push of the stack `Ready` below it and no
failed or queued build anywhere in the list.

- **Item 1 is confirmed in the product**, anonymously with `curl -I` on the
  alias: `/`, `/login/`, `/api-docs/` and `/answer/NOT-A-REAL-CODE/` each carry
  exactly one `Content-Security-Policy` plus the five companion headers, `/`
  carries `frame-ancestors 'none'`, and only `/api-docs/` carries
  `https://unpkg.com`. Vercel adds nothing that conflicts. Not checked there:
  a signed-in walk under the enforced policy, and whether `/api-docs/` actually
  draws.
- **Items 2, 3 and 4 are deployed as code and nothing more.** Item 2's limiter
  has never refused a deployed request — proving it means eleven failed sign-ins
  and a five-minute lockout of the originating address, so it waits on the
  owner asking and on an address nobody needs. Item 3's slash wording cannot be
  read there while the deployed database holds no round, so there is no share
  link to open. Item 4 is a test, a seed and a Playwright project; none of them
  runs on Vercel at all.

**One probe to distrust.** `curl -sL .../openapi.json | grep RATE_LIMITED`
returned nothing for a dozen polls and read as a build that had not landed. It
had: `/openapi.json` is behind the manager gate, answers `307` to
`/login?next=%2Fopenapi.json`, and `-L` made the grep read the login page.
Every gated path anonymously probed has this shape — read the status with `-I`
rather than the body with `-L`.

Seven branches
landed that day, in this order: the product-strategy sweep (`b42b509`), the four
Tier 0 respondent-path fixes (`3df1a13`), the respondent funnel (`bf02dd1`), a
documentation close (`743c362`), the consent screen's truth (`93e3baa`),
observability (`e1ef1e1`), delta honesty (`c30a5fc`) and the staff-size refusal
(`e14e3ac`).

**Strategy axis 6 closed the same day**, in two more pushes:
`fix/comparison-reads-the-questionnaire` (`37960c4`) — a comparison between two
different questionnaires says so — and `feat/a-split-staff-room-is-visible`
(`301c329`, `8b08aaf`) — the map marks the dimensions whose answers split
between the two ends of the scale. Both were walked signed-in against a
production build on port 3210, because the dev server on port 3000 was serving
stale CSS for part of that session; a layout that looks broken there is worth
re-checking on a fresh build before it is called a defect.

**The stack landed on 2026-08-10.** Because it was linear, pushing the tip
carried the branches below it at once and the earlier ones were then rejected as
non-fast-forwards — which read like a failure and was not: `main` is `568fbcb`
and contains every commit of all four.

What each of them was:

`test/respondent-path-e2e` closes Tier 0 item 4;
`fix/questionnaire-speaks-to-everyone` closes item 3 — the
questionnaire's sixteen feminine-only sentences now address both genders in the
slash form the file already used for `המנהל/ת מעריכ/ה`. The published `2.0`
contract deliberately keeps the wording it shipped, so the default template and
`contracts/ai-analytics-v2.json` now differ on purpose; a canary test fails if
anyone "fixes" the manifest. Item 3 is the one that could not have been
repaired after a school started answering.

The first of the two also fixes the reason item 4 was invisible — the
seed wrote its round `closed`, so the one share link the project hands out led
to the dead-link screen, and the smoke test that claimed to open the
questionnaire had been passing against it. Verified by falsification: with the
round closed again, the new spec and the tightened smoke assertion fail and the
rest of the suite passes.

Axis 6 has nothing left in it; axis 7's second half still waits on the owner's
wording, not on engineering.

`feat/security-headers` closes item 1: the application sent none, and now every
response carries a CSP with `frame-ancestors 'none'`, plus `nosniff`,
`Referrer-Policy`, `X-Frame-Options`, a `Permissions-Policy` and HSTS without
`preload`. `/api-docs` has its own header for unpkg and a test that keeps that
exception off the manager screens. Enforced rather than report-only, after
every screen was walked in a browser with a violation listener attached and
came back clean. One limit is written into the config and
`docs/data-flow-and-subprocessors.md`: `script-src` keeps `'unsafe-inline'`
because Next serves inline RSC scripts and the nonce alternative would make
`/login` dynamic. The endpoint reading is at the top of this file.

`feat/rate-limiting` closes item 2, the last of the four. Sign-in is limited to
ten attempts per address per
five minutes — counted before the password is read, so the refusal cannot be
used as an oracle — and the respondent submission to sixty, deliberately loose
because a staffroom answers from one school address and refusing them would be
worse than the abuse it prevents. Addresses are never stored: the key is a
salted hash that expires with the window.

**Upstash is prepared, stays off, and is no longer a pre-pilot gate — owner
decision, 2026-08-10, revised the same day.** The first decision was to switch
it on before the pilot. It was reconsidered and the gate was replaced by a
generated manager password, for a reason worth keeping:

The in-memory counters are per-instance, so on serverless the effective ceiling
is the limit times however many instances are warm — and the number of warm
instances is set by the attacker's own parallelism, not by how few real users
the product has. Twenty concurrent instances is roughly 200 attempts per five
minutes, about 57 000 a day. **But that number only decides anything against a
guessable password.** Against `admin123` it is fatal with or without Upstash;
against `openssl rand -hex 32` it is nothing, and no shared counter is needed.
Rate limiting rescues a weak password; it does not make one safe, and it is not
what a strong one needs.

So the gate that actually protects a school's answers is the password, and it
now sits under the pre-pilot list in place of Upstash. **Nothing in the code
enforces this, by decision**: `ManagerAuthenticationService` requires the
variable to be non-empty and would accept `123`
(`src/lib/auth/manager-auth-service.ts`). That is why it is written down here
and in `.env.example` rather than left to judgement.

**The enforcement was built and then withdrawn the same day, 2026-08-10 — owner
decision, and it waits on a second manager.** The rule refused a deployed
runtime a password under sixteen characters, with fewer than eight distinct
ones, or a well-known value, answering `UNCONFIGURED` and naming the rule in the
server log only. It was verified in both directions over HTTP against a
production build and never pushed. The reason it waits: with one operator who
sets the variable once, the requirement is that person's habit, and a rule that
can lock them out of their own deployment costs more than it protects. When
passwords start being chosen by people who have not read `.env.example`,
enforcement earns its keep — so it is recorded as part of
`docs/product-behaviour-backlog.md` §8 rather than as a loose idea. The code
sits unpushed on the local branch `fix/manager-password-must-be-strong`, which
means **this worktree only**: it is not on any remote and another checkout
cannot see it. If that branch is ever lost, the backlog entry is the record and
the work is a couple of hours.

What the in-memory limiter still buys, and why it stays: it stops a script
hammering either endpoint from one address, it makes the refusal visible in the
logs, and it costs nothing. What is given up by not enabling Upstash: a counter
that holds across instances, which matters against a distributed attempt on a
password worth attempting. If the password is generated, there is no such
password.

Upstash remains two environment variables away, its code path is verified (see
below), and nothing needs rewriting to turn it on later.

Switching it on is two environment variables — `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` — and nothing else: the REST API is called directly,
so there is no dependency to install and no code change to make. One thing
follows when it happens: Upstash becomes a fourth processor and belongs in any
subprocessor list.

**The Upstash code path is no longer unexecuted, 2026-08-10.** It was run
locally against a stub speaking the same REST pipeline API — no account, no
credentials, no network. What it establishes: the store POSTs to `/pipeline`
with `[["INCR", key], ["EXPIRE", key, "300", "NX"]]` and a bearer token; all
twelve sign-ins reach the store rather than any local cache, so the counter is
genuinely shared; the tenth is allowed and the eleventh refused with
`retryAfter: 300`; `EXPIRE` carries `NX`, so the stub's second call leaves the
window where it was and a burst cannot push the reset away; the key is
`shalomut:rl:manager-login:<32 hex>` with the address nowhere in it, and the two
policies key separately. Fail-open was exercised in both of its shapes — a
rejected token (`Upstash answered 401`) and an unreachable host (`fetch
failed`) — and each logged `Rate limit store unavailable; request allowed` and
let the request through. So a wrong credential costs the limiter, never the
manager's access.

What that does **not** establish is Upstash itself: the stub is this
repository's reading of the REST contract, not the vendor's server. The first
real execution is still the first deployed request after the variables are set,
and the check at that moment is the logs — `Rate limit store unavailable` there
means the URL or the token is wrong, and nothing on any screen will look
broken, because it fails open by design.

What is left of the readiness
list is outside the repository and the owner's: rotating the four exposed
credentials, the legal artifacts (privacy notice, subprocessor list, retention,
deletion route), the availability monitor on Core, and the `שימוש הוגן`
wording from axis 7.

`20260810101610_add_survey_attempts` is applied to the deployed database; twelve
migrations, all applied. The deployed AI service still reports `9c46355`, which
remains correct: nothing since has touched `ai-analytics-service/`, and its
`buildFilter` is why.

**Due before the first pilot school, not before merge:**

- **Generate `MANAGER_ADMIN_PASSWORD` during the credential rotation —
  `openssl rand -hex 32` — and do not choose one by hand.** This replaced the
  Upstash gate on 2026-08-10; see below for why the swap is honest rather than
  a downgrade. The rotation was already due before the first real respondent,
  so this adds no step, only a shape. The owner's own hands: no agent sees or
  types this value.
- Rotate the four exposed credentials. The strategy document already states
  this as due before the first real respondent rather than after.

**Three things this repository cannot do, all now the owner's:**

1. Create an uptime monitor against `/api/health` on the deployed Core endpoint.
   The route was opened anonymously for exactly this and nothing walks through
   it yet.
2. Decide where the structured observability lines land — a log sink or an error
   tracker — and with which alert. The first alert worth having is on the
   deterministic-fallback ratio.
3. Answer the open questions of `docs/product-strategy-axes-2026-08-10.md`
   axis 1 (the Chief Scientist directive, Amendment 13) and axis 7 (the fair-use
   commitment, and how small a staff room is too small to measure safely). Both
   are wording and legal judgement, not engineering.

Nothing from this session was observed on the deployed endpoint: its database
holds no round, so there is no link to open, no funnel to read and no comparison
to render. The first deployed round is what will exercise all three.

The paragraphs below were written on 2026-08-09 and describe that session.
**The AI analysis had stopped being written by the model,
and the two settings behind it are now declared rather than defaulted.**
`MAX_TOKENS_PER_DIMENSION` was unset everywhere, so both halves ran on the
service default of 2048 and every dimension came back `finish_reason=length`;
it is `8192` now, in `render.yaml` and `.env.example` (`aefec31`). With the
ceiling raised, the deployed fast model `gemini-3.5-flash-lite` turned out to
splice Arabic letters into Hebrew words — `מתורجם`, `בمשימות`, `לبחון` — which
the Hebrew-only gate refused, fourteen answers of twenty-one; the fast tier is
`gemini-3.5-flash` now, which produced zero refusals on the same round, and the
V6 summary and metric nodes finally tell a refused answer which gate it hit
instead of re-sending the same prompt (`9c46355`, 480 Python tests).

**Proven end to end on the local stack after those changes**: the analysis was
started from the round screen, `succeeded` on attempt 1 in about three minutes,
contract `6.0`, **eight stones of eight with `llm` provenance and no validator
refusal**. All 305 Hebrew strings of the stored result were scanned: no Arabic
and no Cyrillic. The only Latin left is in `recommendedInterventions[].source`,
which cites standards like `ISO 45003` and comes from the catalog, not the
model. Nothing equivalent has run on the deployed endpoint — its database is
empty, so there is no round there to analyse.

**A local-environment trap worth knowing**: `.env.local` overrides `.env`, in
`scripts/local-stack.mjs` and in Next.js both, and it pinned
`AI_ANALYTICS_CONTRACT_VERSION=5.0`. A local run was therefore exercising a
lighter contract than the deployment produces, silently. It is `6.0` there now.
The stack banner prints the version it resolved, which is the only reason this
was caught — read that line after changing any env file.

Before that, three fixes landed after the
decision below, all pushed by the owner: the builder's round switcher now
crosses the server/client boundary as data rather than as markup (`0f13481`,
which removes a React key warning on every load of that screen), `render.yaml`
gained a `buildFilter` so only the AI service's own paths rebuild it
(`7949d8a`), and the builder's keyboard legend can wrap (`8986bd3`, which is
what had been dragging that panel's whole contents out of view). Both screen
fixes were walked on the local server only — measured at 1728px and 1180px,
console clean — and not on the endpoint: with the deployed database empty there
is no round to open the builder on. Vercel has the code; nobody has looked at
it there.

**Both databases were emptied on request and only the local one was reseeded.**
The deployed Supabase database holds no organization, round, response or answer
— 2 organizations, 3 rounds, 20 responses, 510 answers and 2 AI runs were
deleted on 2026-08-09; the schema and its migrations are untouched. The local
container was emptied the same way and then reseeded with
`npm run db:seed:local`, so it holds one school and one closed round of twelve
responses. Deployed screens now serve the onboarding state, which was confirmed
in the browser; anything below that describes deployed *data* is a record of
what was there, not of what is there.

Before that, the last thing to land was a
decision rather than a change: backlog §5's two open goal questions are both
answered "no" — a goal gains no owner, due date or plan of steps, and no number
is shown beside it. Recorded in the backlog item, in ADR-015 and in the open
list below; no runtime file changed.

Before it, the last product change was the scope dead end a manager could reach
with no action on the screen at all: a
request naming no school the system has now offers the schools it could not
choose between. It was walked in the owner's signed-in Chrome twice — on the
local server before the push and on the deployed endpoint after it — and both
walks are recorded in
`docs/agent-tasks/archive/fix--scope-required-has-a-way-out.md`.

Every finding of the
2026-08-09 deployed end-to-end smoke is fixed, pushed and confirmed on the
endpoint — the seven items and their evidence are in the deployed-state section,
and each task file is now in `docs/agent-tasks/archive/`. Two of the seven
changed data on the deployed database and the owner approved that first; what
changed is recorded below.

The throwaway data those walks left behind has since been removed: the E2E
school and its three rounds are off the deployed database, deleted by name
rather than by emptying it. `docs/agent-tasks/active/` again holds only
`research--scientific-evidence-layer.md`, which is waiting on owner decisions
and not on an agent. Nothing is waiting on a push.

The paragraphs that follow describe the 2026-08-08 session and are kept as they
were written (`origin/main` was `7434ed5` then). The session's
product changes are the sign-in transition fix `8d4af8d`, confirmed on the
deployed endpoint by the owner; the frontend UI/UX audit — seven branches
pushed as one stack, of which the only thing a manager sees is the new skip
link, everything else proved inert by a computed-style fingerprint or
documentation; and the privacy tooltip fix `5ffdd91`.

The tooltip bug was found by walking the deployed product in the owner's
signed-in browser: the bullet lead-ins rendered at 46.4px on the home screen. It
shipped with the component and the audit's own refactor of that component walked
past it. It is now fixed, pushed and confirmed on the endpoint — details in the
deployed-state section — and `docs/agent-tasks/active/` is empty again.

The check that caught the tooltip now stands as the seventh end-to-end test
(`4fc3a26`): it enumerates every text node in the open tooltip and fails if any
exceeds 17px. `npx playwright test e2e/` is 7/7 locally, CI is green at that
commit with its browser smoke step included, and the test was proved to fail on
exactly the three 46.4px lead-ins with the fix removed.

Nothing is waiting on a push except the documentation commit that carries this
sentence, and `docs/agent-tasks/active/` is empty: every task this session
opened is closed and archived.

This document owns only cross-task operational/deployed state, external
blockers and approval gates. Product milestones belong in `PROGRESS.md`; branch
work and exact verification belong in `docs/agent-tasks/{active,archive}/`;
older snapshots remain available in Git.

## Repository snapshot

- **A workaround inside the browser smoke was hiding a real defect, and it is
  fixed.** `8d4af8d`: the first sign-in of a browser session never left
  `/login`. The login screen's brand `<Link href="/">` prefetches the home page
  while the manager is still signed out, the middleware answers that prefetch
  with a redirect back to `/login`, and the client router caches it — so once
  the cookie was set, `router.push("/")` was served from that cache, reached no
  server and landed where it already was. The form does not clear its loading
  state on the success path, by design, so it spun on "מתחבר..." with no way
  out. Reloading `/login` was the owner's own workaround and explains the rest
  of the report: with a cookie present the prefetch returns the real home
  screen. Fixed by a document navigation on sign-in and, mirrored, on sign-out.
  `?next=` is filtered to a same-origin path in the same commit — it was an
  open redirect through `router.push` already, and a real navigation raised the
  cost of leaving it. The regression is `e2e/login-transition.spec.ts`.
- **Correction, same day.** The entry above first claimed that the workaround
  in `e2e/smoke.spec.ts` — `signIn` navigating to the destination itself rather
  than waiting for the form — had hidden this bug. Checked afterwards by
  removing the workaround and running it against the pre-fix code: it still
  passed. The defect needed a destination the login screen had already
  prefetched while signed out, which is `/`; the smoke signs in towards
  `/round` and `/dashboard` and was never affected. What the workaround did
  hide was a wrong diagnosis — its comment blamed the router for a flake — and
  that is the part worth carrying. The workaround is gone as of `1c2da29`,
  which buys coverage of the `?next=` deep-link path rather than of this bug.
- **The browser smoke found a session bug the whole suite was blind to.** The
  middleware verified JWTs by passing `signatureBytes.buffer` to
  `crypto.subtle.verify`; it runs in a sandbox with its own realm, so that
  ArrayBuffer failed an `instanceof` check inside SubtleCrypto and the call
  threw before reading a signature — on Node 20, which CI pins, and not on the
  Node 22/24 used locally. Route handlers, outside that sandbox, kept issuing
  valid sessions, so a manager could sign in and every protected page still
  bounced to `/login`. Fixed by passing the typed array. **The deployed endpoint was never
  affected**, and this was checked rather than assumed: on 2026-08-07 the owner
  signed in on deployment `515kx96zg`, which serves `46fcde7` — the commit
  immediately before the fix — and there `/api/auth/me` answered
  `authenticated: true`, `/round/` answered 200 without a redirect, and the
  manager screen rendered. Vercel runs middleware in its own Edge isolate
  rather than Next's Node sandbox, so the cross-realm check never tripped
  there. The bug reached only runtimes where the middleware executes under
  Node 20: CI, and `next start` on Node 20 if this is ever self-hosted.
- **`main` is green.** Run 31207956670 at `0524542` is the first full pass,
  smoke step included, 4/4. It took three red runs to get there and each named
  a different real defect: `31191748609` — `npm run db:seed:local` called
  `getRepositories`, an export the composition root had replaced, so the seed
  had been dying at its first line, invisible until something re-seeded;
  `31195236422` and `31205427782` — the middleware could not verify a session
  on Node 20, described above.
- `origin/main` is `6e06ff7`. The last commit that changed **product** code is
  `8d4af8d`, the sign-in transition fix above. Before it the
  product-visible tip was `26209f3`, the session-verification fix. Before it,
  the product-visible tip was `36fe4ce` — `feat/multi-school-scope`, pushed by
  the owner on 2026-08-07: the system holds more than one school, `/setup` is
  where one is chosen and added, and every other screen reads inside the chosen
  school. Before it, `main` was `bc00512`, itself the tail of
  `feat/round-context-across-screens` (`9983184`).
- **Three test-only branches landed on 2026-08-07**, pushed by the owner in two
  goes: `test/legacy-contract-refusals`, `test/v5-contract-refusals` and
  `test/v6-contract-refusals`. Together they gave contracts `1.0`–`3.0`, `5.0`
  and `6.0` the refusing half of their tests; the mutation pilot moved 71.81%
  to 95.22%. No runtime file changed. Their task files are in
  `docs/agent-tasks/archive/`.
- **`chore/contract-refusal-suite-check` landed the same day.** `npm run
  lint:contract-refusals` runs inside `verify:core`, so CI fails when a
  contract version reaches a stone validator that no `*-refusals.test.ts`
  exercises. It groups versions by the capability flags
  `validateStoneMapResult` branches on — `4.0` shares `3.0`'s path and needs no
  suite — and reads that flag list out of `ai-contract.ts` so it cannot go
  stale. It proves a suite exists, not that it is complete.
- **A browser smoke landed on 2026-08-07.** `npm run test:e2e` starts its own
  production server with credentials it invents, signs a manager in, reads the
  round's share link, opens it as a respondent and looks at the dashboard. CI
  runs it after `npm run verify`, seeding the disposable service database
  first. The job declares one throwaway `SESSION_SECRET` so the build and the
  server share it; none of the repository's real secrets are read. It replaces the
  manual browser walk as a regression check — not as a substitute for walking
  new screens.
- **`npm test` now needs `ai-analytics-service/.venv`, and every worktree needs
  its own.** Landed 2026-08-12 with `chore/python-from-the-service-venv`. The
  cross-service test used to spawn a bare `python3`; on macOS that is the 3.9
  from the Command Line Tools, below the service's `requires-python`, so three
  tests failed with an ImportError from inside the service and `verify:core`
  could not finish. Every Node-side caller now resolves the interpreter through
  `scripts/ai-service-python.mjs`, which names the missing virtualenv and
  `docs/local-environment.md` instead of falling through to PATH, and
  `npm run lint:interpreter` — in `verify:core` — fails on a `python3` spawned
  by name anywhere in `scripts/`, `src/`, `e2e/`, `package.json` or
  `.github/workflows/`. Two consequences for anyone starting fresh: `.venv/` is
  gitignored, so a new worktree has none until it makes one, and the setup
  command needs the `[dev]` extra — `pip install -e ".[dev]"` — because plain
  `-e .` installs no pytest and the documentation said otherwise until this
  branch.
- **Actions are on current majors, and Dependabot keeps them there.** Landed
  2026-08-12. Every `uses:` moved off the Node 20 action runtime —
  `checkout`/`setup-node`/`setup-python`/`upload-artifact` to `v7`,
  `codeql-action` to `v4` — and all three edited workflows are green with the
  deprecation annotation gone. `.github/dependabot.yml` now opens one grouped
  `ci:`-prefixed pull request a month for the `github-actions` ecosystem only,
  so a bump arriving as a PR is expected, not a stray. Both CI gates run on it
  before merge: `deploy-vercel.yml` on `pull_request`, `verify-core.yml` on the
  pushed branch. `npm` and `pip` are deliberately not covered. The one line no
  green run could reach — `upload-artifact@v7` behind `if: failure()` — was
  exercised on purpose on 2026-08-12 and works: run `31588584933` uploaded a
  1 MB `playwright-report` that opens with the screenshot and traces intact.
  Dependabot itself is still unproven until the first monthly pull request
  arrives.
- **`.github/workflows/verify-core.yml` runs `npm run verify:core` on every
  push, on every branch.** Until 2026-08-12 the only verification job was the
  one inside `deploy-vercel.yml`, which triggers on `main` and on pull requests
  to it, so a branch or an agent worktree was unverified until it landed. The
  new job carries no Postgres service, no browsers and no seed — `verify:core`
  needs none of them — and it installs `ai-analytics-service/.venv` with the
  exact command `docs/local-environment.md` gives, so a green run also proves
  the documented setup. On `main` it overlaps `deploy-vercel.yml` deliberately:
  the two run in parallel and this one reports first. `verify:db`, `verify:ai`
  and the browser smoke stay in the deploy workflow, which remains the gate a
  deployment waits on.
- **The build no longer downloads its own typeface.** 2026-08-12. Noto Sans
  Hebrew is committed at `src/app/fonts/noto-sans-hebrew-variable.woff2` and
  loaded through `next/font/local`; `npm run lint:fonts` in `verify:core` fails
  on `next/font/google`, on a Google font host in code or CSS, and on a
  `next/font/local` source that is not on disk. The reason is operational rather
  than aesthetic: `Core verification` `31582875968` went red on `main` at
  `e9020f8` because Google served a stale stylesheet and all five `.woff2` files
  404ed, while the same commit built cleanly in `deploy-vercel.yml` at the same
  minute. A re-run went green in one try. Treat any future
  `@vercel/turbopack-next/internal/font/google/font` failure as a signal that
  this was reverted, because nothing else can produce it now. On `main` as
  `61900c6`…`790f4c9`; the deployment serves the committed file byte for byte
  under an immutable cache, and preloads it, so a font request leaving for
  Google would now be a regression visible in the document head.
- **Two gates were considered and declined on 2026-08-07**, so they are not
  reopened by habit: a mutation-score threshold (the score moves for reasons
  unrelated to test strength) and a line-coverage threshold (it would have been
  green throughout the period when ~90 validator rules could be deleted
  silently — those lines executed, they were simply never asserted against).
  A nightly full mutation run was also declined as a number nobody would read.
- **The deployed commit was read back on 2026-08-07**, in the Vercel dashboard:
  Production is `807eccc`, `Ready`, and the deployments list shows every push to
  `main` that day building on its own. Sign-in and the round screen were walked
  there in the owner's signed-in browser and both work.
- Five branches reached `main` on 2026-08-05, each as a fast-forward the owner
  pushed themselves: `feat/survey-definition-history` (backlog §1),
  `feat/archived-rounds-read-only` (§10), `feat/goals-across-rounds` (§5), plus
  `docs/close-causal-refusal-decision` and `docs/roadmap-reconciliation`. All
  are fully contained in `main` and can be deleted; their task files are in
  `docs/agent-tasks/archive/`.
- **Nothing is waiting on a push.** The documentation commit recording the
  deployed check above is `a968dcd`, and it is `origin/main`.
  `docs/agent-tasks/active/` is empty; the task file is in
  `docs/agent-tasks/archive/`. The last product branch, `feat/multi-school-scope`,
  landed on 2026-08-07, is fully contained in `main` and was walked in the
  owner's signed-in browser before the push; its task file is archived.
- The one unmerged branch, `fix/refuse-asserted-causes`, is a decided **no**
  and is described below.
- **No migration is pending on the deployed database.** The eleventh,
  `20260805170000_add_survey_definition_versions`, was applied on 2026-08-05
  immediately after the push that carried its code — the build command runs
  `prisma generate`, never `prisma migrate deploy`, so this is a hand step every
  schema change still needs. Details and the read-back are in the database
  section below. Nothing after it changed a schema.
- Verification at `8d4af8d`: `npm run verify:core` exit 0 with 739 TypeScript
  tests, all five fitness checks, typecheck, ESLint and the production build,
  plus `npx playwright test e2e/` 6/6 against the local development database.
  `verify:db`, `verify:ai`, the Python suite and the mutation run were **not**
  run: no schema, repository, contract, Python or mutated module is in that
  diff. CI at `8d4af8d` was not read back. The deployed confirmation is the
  owner's own first sign-in, which entered immediately.
- Verification at the earlier `test/browser-smoke` tip: `npm run verify:core` exit 0
  with 736 TypeScript tests, all five fitness checks, typecheck, ESLint and the
  production build, plus `npm run test:e2e` 4/4 against the local development
  database and a Node 20 container reproduction that answers 200 on a protected
  page where it answered 307 before the fix. CI ran the same suite green at
  `0524542`, smoke step included. The last full mutation run was at `ae73259` — nothing after
  it touched a mutated module or the runner's test list — and was exit 0 (1155
  killed, 52 survived, 6 uncovered, 42 runtime errors, 95.22%). `verify:db` and
  `verify:ai` were **not** run — nothing since 2026-08-05 morning changed a
  schema, a repository, a contract or Python. The last `verify:db` reading is 26 tests, 26 pass at
  `763e38f`, against local PostgreSQL on `127.0.0.1:5433`.
- **The manager screens have now been walked in a browser**, on 2026-08-06,
  with the owner signed in on the local dev server. This closes the gap the
  2026-08-05 entry recorded. It was worth doing: the walk found three defects
  that the test suite did not — stale client state across a round switch, a
  duplicate React key that rendered two rounds' controls at once, and a link
  that dropped the round. All are fixed in `c67471c`. A signed-in walk remains
  the check that a rendering test cannot stand in for — the 2026-08-07 walk of
  the school switcher found another one the suite had missed, the setup form
  keeping its save state across a switch (`a0f5306`).
- The local development database now holds the same one school it held before
  2026-08-07: a second school was created through the UI during that walk and
  deleted afterwards at the owner's request. The deployed database was not
  touched.
- Deployment of `9983184` was read on 2026-08-06 and is `Ready`; see the
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

- **The 2026-08-09 smoke's seven findings are deployed and confirmed on the
  endpoint, 2026-08-09**, in the owner's signed-in Chrome. `origin/main` is
  `90a507c`; the served stylesheet carries the new `.round-delta` pill and
  `.manager-onboarding-schools`, so the deployment is that stack rather than a
  near miss. What was checked, in the product rather than in the build:
  - a draft round (`סבב שני E2E`) shows no `זהו סבב קודם` banner, keeps
    `איפוס נתונים` and `רענון ניתוח`, and its close button is disabled with the
    title `סגירה ידנית אפשרית רק לסבב שאוסף תשובות`;
  - `/setup/?round=new` renders six navigation links and a brand link, none
    carrying `round=new`;
  - a link to another school's round shows the dead end *with* a school
    switcher, and choosing that school lands on
    `/round/?school=…&round=…` — the round the link was for, in its own school;
  - on `טסט`'s map every delta chip sits on `--surface` at 5.17–6.87:1,
    including two real `±0` chips at 5.41:1 — the `0`-beside-`52%` case the
    finding named;
  - a round opened from the setup screen arrives with 24 questions as a draft,
    while `סבב שני E2E`, created before the change, still has 0 — the two sit in
    the same school as a before and after;
  - the round that was collecting (`סבב ראשון E2E`) was still `פעיל` after that
    round was opened;
  - saving the questionnaire flipped the builder's switcher from
    `סבב ראשון E2E — פעיל` / `סבב שלישי E2E — טיוטה` to
    `סבב שלישי E2E — פעיל` / `סבב ראשון E2E — סגור` with no reload.
- **What that verification changed on the deployed database**, with the owner's
  approval, all inside `בית ספר בדיקת E2E` (`ff5625a8`): a round
  `סבב שלישי E2E` (`b19be646`) was created and is now the school's active round,
  and `סבב ראשון E2E` (`f1cc7f0a`) was closed by that activation, as one active
  round per school requires. No other school was written to; switching schools
  during the walk only moved the browser's own cookie, which was returned to
  `ff5625a8`.
- **That school is now off the deployed database**, on the owner's instruction,
  2026-08-09. `בית ספר בדיקת E2E` (`ff5625a8`) and its three rounds were deleted
  with `scripts/clear-test-data.ts`, which removes named ids rather than
  emptying tables the way `db:clear` does. What remains is the two manager
  schools, their three rounds, 20 responses and 510 answers — the state that
  predates the walks. `סבב בדיקה E2E 2` (`9c78768b`) was left in place on
  purpose: it is named like a test round but holds the unlocked analytics and
  the round-over-round deltas inside `טסט`.
- Known dead end, found while verifying that deletion: a session whose
  `shalomut_school` cookie names a deleted school lands on
  `נדרש שיוך לבית ספר` with no school switcher — the same shape finding #6
  fixed for `round-not-found`. **Fixed and on `main`** as
  `fix/scope-required-has-a-way-out`, pushed by the owner on 2026-08-09
  (`origin/main` is `1b49e86`): the state now offers the schools it could not
  choose between, and choosing one reopens the screen the manager was on and
  replaces the stale cookie. Walked in the owner's signed-in Chrome on the local
  server and then **on the deployed endpoint after the push**, 2026-08-09 — the
  chain from this state through `round-not-found` and back to a school's own home
  screen was exercised end to end in both places; the evidence is in the archived
  task file. A deleted school turns out not to be needed to reach it: the
  middleware writes `?school=` to the cookie without checking the school exists,
  so any unknown id produces the same state. The deployed walk wrote nothing to
  the database — the only state it changes is the browser's own cookie, which was
  returned to `טסט` at the end.
- Supported product environments remain local and deployed only.
- Core endpoint: `https://shalomut-map-demo.vercel.app/`. Vercel names the
  target Production; for the product it is the design-stage operational staging
  endpoint.
- **The frontend audit is deployed and checked on the endpoint, 2026-08-08.**
  The served stylesheet chunk is `2go2uobe7cagm.css` — the same content-hashed
  name and the same 103 855 bytes a local build produces from `213e59b`, so the
  deployment is that commit rather than a near miss. It carries `.skip-link`,
  the six `.privacy-tooltip-*` rules and `--z-skip-link`. `/login/` serves the
  rewritten `login-shell` markup and `/answer/NOT-A-REAL-CODE/` serves
  «הקישור אינו פעיל».
- **The manager screens were then walked in the owner's signed-in Chrome,
  2026-08-08**, which is what the public probes could not reach. Confirmed on
  the endpoint: the skip link is the first Tab stop, draws the navy ring at
  `z-index` 100 over the sticky header and lands focus on `#main-content`
  ringless; `.site-header` still lays out flex/centre/space-between/16px with
  its four Tailwind utilities gone; the builder's search draws
  `rgb(45,48,126) solid 3px` at 3px offset on `/`; and all eight map stones
  carry the same `--plus-top`/`--plus-left` they had before the geometry moved
  into `DimensionPresentation`. The walk also found the tooltip bug named at
  the top of this file.
- **The tooltip fix is deployed and confirmed, 2026-08-08.** The chunk rolled
  over to `1jqn_40hp-si6.css`, 103 928 bytes, byte-identical to a local build of
  `57dda52` (`cmp` clean), carrying
  `privacy-tooltip-reasons strong{font-size:.88rem}`. With the tooltip open on
  `/` in the owner's signed-in Chrome: the three bullet lead-ins measure 14.08px
  where they measured 46.4px, no text node in the panel exceeds 17px, the panel
  is 371x386 fully inside the viewport and not scrolling, and `.stat-stone >
  strong` is still 46.4px — the stone's own number was not quieted along with
  the tooltip.
- **The seven incidental AI-service findings of 2026-08-09 are all fixed, on
  `main` (`5188bfa`) and now deployed.** Six of the seven are inside
  `ai-analytics-service` and needed the Render container rebuilt from `main`.
  That has happened: anonymous `GET /health` on 2026-08-09 answered
  `commit: 2e80b6a`, which is `origin/main` itself, `status: online`,
  `env: production`, `supportedContractVersions` `1.0`–`6.0`,
  `jobPollingEnabled: true`. Render rebuilt on every push to `main` by itself,
  so this needed no hand step. Since the `buildFilter` of 2026-08-09 that is
  true only of pushes that touch the service's own paths. Deployed code, not deployed behaviour: no round
  has been analysed there since.

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
- **The instance was awake on 2026-08-08, three days later.** Anonymous
  `GET /health` answered `200` in **0.43s** with `status: online`,
  `env: production`, `privacyThreshold: 10`, `supportedContractVersions`
  `1.0`–`6.0`, `jobPollingEnabled: true`. Sub-second is the load-bearing part:
  a cold free instance spends tens of seconds starting, so this container had
  not been allowed to sleep. That is one reading of the effect, not the
  monitor's own history.
- **The monitor's own history was read on 2026-08-08**, in the owner's
  signed-in Chrome (monitor `803671546`): `Up`, last check 54s before the
  reading, every 5m, **99.869% over both 7 and 30 days — one incident, 5m 5s
  down**. The last 24 hours are 100% with 0 incidents, which is why that figure
  alone would have been misleading; the incident is older than that window.
  Response time over the preceding hour: 174ms average, 167–180ms, all warm.
- **The one incident: 2026-08-07, 05:01:22 GMT+3, root cause `Connection
  Timeout`, duration 5m 5s, resolved.** That is exactly one check interval, so
  a single check failed and the next succeeded. From outside, two causes look
  identical here and the monitor cannot tell them apart: a transient network
  timeout, or the container having slept and the ping itself paying for the
  cold start. The second reading is plausible — 05:01 local is the quiet part
  of the night — and it would mean the keep-alive recovers a sleep within one
  interval rather than always preventing one. Either way the cost is bounded:
  one five-minute window in three days, and no analysis job runs at that hour
  yet. Do not upgrade this to a known sleep; it is one timeout with two
  explanations.
- If the service starts sleeping again, that monitor is the first thing to
  check, before anything in this repository.
- **The monitor's first real alert was a deploy, not a sleep — 2026-08-09,
  20:27:28 GMT+3, `502 Bad Gateway`, four US regions, ongoing for minutes.** A
  docs-only push (`6d03ea7`) at 20:08 had rebuilt this service, and a free
  instance has no zero-downtime swap: the old container stops before the new one
  answers. At 20:35 anonymous `GET /health` answered `200` — 22.6s on the first
  request and 0.21s on the third, the new container's cold start — reporting
  `commit: 6d03ea7`, `status: online`, `env: production`, `privacyThreshold: 10`,
  `supportedContractVersions` `1.0`–`6.0`, `jobPollingEnabled: true`. Read the
  alert as the deploy it was: the keep-alive was working, and the outage was a
  push.
- **`render.yaml` now carries a `buildFilter`, so Core-only and docs-only pushes
  no longer rebuild this service.** Its paths are `ai-analytics-service/**`,
  `contracts/**`, `Dockerfile` and `render.yaml` — `.dockerignore`'s allowlist
  plus the blueprint itself. One consequence to keep in mind when reading a
  deployment: **`/health`'s `commit` is no longer the tip of `main`**, it is the
  last commit that touched those paths. A newer tip is not evidence of a missing
  deploy any more; compare against the last Python-affecting commit instead.
- **The filter was proven the same day, by the first push that fell outside
  it.** `8986bd3` touches only `src/`, and afterwards `/health` still answered
  `commit: 7949d8a` — no rebuild, no 502 window, no alert. That is the check to
  repeat if the filter is ever suspected of being ignored: push something
  outside its paths and read `/health`.
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
  changed no row. The deployed database held one active round when this was
  read; it holds no rows at all since the clearing of 2026-08-09 described at
  the top. The index itself is part of the schema and survived it.
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

- Since 2026-08-09 a round that fails because the provider was unavailable
  reports why. `failureReason` keeps `provider_unavailable` as its prefix and
  appends the reason the run learned — `provider_unavailable_missing_api_key`,
  `provider_unavailable_http_429`, `provider_unavailable_retry_budget_exhausted`
  — and Core stores that string as the run's `failureCode` and as the label on
  its operational metric. **A dashboard or query that matched the old single
  value must group by prefix.** Re-arming is unaffected: only Core's own
  `round_validation_failed` re-arms. No contract bump was involved; the field is
  additive and Core does not declare it.

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
- **Closed 2026-08-10, no longer waiting.** `20260810101610_add_survey_attempts`
  creates `survey_attempts` and was applied to the deployed database on
  2026-08-10, right after `bf02dd1` landed on `main`; `prisma migrate status`
  against that host then reported all twelve migrations applied. Worth keeping
  as the pattern rather than as an open item: the deploy build runs
  `prisma generate` and never `migrate deploy`, so every future migration has to
  be applied by hand or the code ships against a schema that lacks it. Here that
  would have been silent — the beacon endpoint swallows its own errors by design,
  so a respondent would have seen nothing and the funnel panel would have read
  zero for every stage.
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
  The model in that run is no longer the fast tier: on 2026-08-09 a real round
  through the real chain caught `gemini-3.5-flash-lite` splicing Arabic letters
  into Hebrew words, which these eight synthetic rounds had not. Read the
  55-of-56 as true of that corpus on that day, not as a verdict on the model —
  the pace it justified is unaffected, and the header above has the rest.
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

Recorded at the 2026-08-05 session close and refreshed on 2026-08-06. Nothing
here is unfinished work; each item waits on a decision, a request or the
owner's own hands.

**Waits on an owner decision**

- **Both goal questions are closed, 2026-08-09, both as "no".** A tracked goal
  gains no owner, no due date and no plan of steps — the three-state goal stays
  the whole of it, because the fields would make this task management rather
  than measurement, and a form is easy to add later and hard to withdraw. And no
  number is shown beside a goal: a dimension's delta is not the goal's result,
  so putting one there would assert through layout the causal link the AI copy
  is already forbidden to assert. The reasoning is in
  `docs/product-behaviour-backlog.md` §5; neither is unfinished work.
- **Seven decisions from the 2026-08-10 strategy sweep**, in
  `docs/product-strategy-axes-2026-08-10.md`. The two that gate the most other
  work: whether a pilot school can be named with a date, and whether the
  three-colour *answer scale* may become 5–6 points with the map kept as a
  derived presentation band. The same document restates the credential rotation
  below as due before the first real respondent rather than after it.
- The twelve decisions in
  `docs/scientific-evidence-layer-research-2026-08-09.md` section 5, of which
  1–3 select between three different projects, plus the undocumented bridge
  between the eight dimensions and any published framework — a question for the
  named research adviser rather than for engineering.

**Waits on being requested**

- A second manager per school (§8). One manager per deployment is the requested
  shape; the work behind a second one is a data model and a set of flows, and
  `PROJECT_CONTEXT.md` ADR-013 says why swapping the password hash closes
  nothing.
- Repeat-measurement reminders (§11). Reminding respondents would need contact
  data the privacy model deliberately does not hold; reminding the manager would
  not.

**Waits on the owner's hands**

- Signing in, whenever the UptimeRobot dashboard needs reading. Done on
  2026-08-08; the figures are in the keep-alive section above.
- Signing in, whenever a manager screen needs looking at. The agent never sees
  or types the manager password, so every walk starts with the owner signing
  in — and it has to be in a browser the agent can drive. On 2026-08-06 the
  first attempt was lost because the sign-in happened in a window that was not
  connected; the connected Chrome is the one to use. The preview pane is a
  separate browser with its own cookies.
- **Done 2026-08-11, and it found something.** The three screens only ever
  walked locally — the builder's version history, an archived round's read-only
  round screen and `מעקב יעדים` — plus the round switcher were walked signed in
  on the deployed endpoint, and all four render and behave as documented. The
  deployed database was empty, so the walk built a school, two rounds, twelve
  responses and one real analysis run to have anything to look at; that test
  data was deleted the same day with `scripts/clear-test-data.ts` and the
  database is empty again. The walk also spent an hour on a `/dashboard/` whose
  AI panel never left its loading spinner, and **that did not survive a
  reproduction attempt**: on a rebuilt round the deployed dashboard served all
  four analysis states correctly — run in flight, run failed with its retry
  card, builder-saved questionnaire, insights stored. Recorded as a transient
  fault, not a defect, and the reading that fits it is a request that never
  completed rather than one that never fired. Details and evidence:
  `docs/agent-tasks/archive/test--deployed-signed-in-walk-2026-08-11.md`,
  archived on 2026-08-11 when the branch landed.
- Rotating the four design-stage credentials before the first real respondents.
  Listed above as an accepted deferred gate; it is still open.

**Worth a look, cheap**

- **Seen 2026-08-11.** The round switcher renders on the deployed endpoint with
  two rounds, labels each with its status, and choosing one rebuilds the screen
  for it. Nothing left to look at here.
- The doubt this list carried since 2026-08-05 — that two minutes of `Up` says
  nothing about a quiet night — is **answered, and the answer is 99.869% with
  one 5m 5s timeout at 05:01 on 2026-08-07**. Both readings are in the
  keep-alive section. Nothing here is left to look at; the next thing that would
  add information is whether a second night passes without an incident.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

**Core was last read in the Vercel dashboard on 2026-08-10 and was `568fbcb`,
`Ready`, Production, built in 40s** — `origin/main` at that moment. **That
reading is now behind the repository:** 2026-08-11 pushed six product commits
and their task-file archives, and `origin/main` has moved. Vercel builds every
push to `main`, so the deployed build is expected to be the tip, but the
deployments list was not re-read on 2026-08-11 — that needs the owner's
signed-in Chrome, and nothing this session depended on it. Anonymously on
2026-08-11, `https://shalomut-map-demo.vercel.app/api/health/` answered
`status: ok` with producer `6.0`; none of the day's changes is reachable from a
public page, so that is a liveness reading and not a content one. The header of
this file says what that does and does not prove for each of the four items.
The detail below is the 2026-08-06 reading of `9983184` and is kept for what it
exercised, not as the current deployed commit:

- **Core (Vercel):** the newest deployment is `9983184` on `main`, environment
  `Production`, status `Ready`, built in 39s about a minute after the push, and
  carrying the current production badge.
  Read from the project's deployments list in the owner's own signed-in
  Chrome; nothing was clicked and no secret was displayed. Anonymously, `/`
  still answers `307` to `/login`, as it should. Signed in, the deployed home
  and tracking screens serve the new code: the round-scoped links carry
  `?round=`, `setup` and `goals` stay bare, and the console is clean. The
  switcher does not render there, which is correct — the deployed school has
  one round, and the switcher appears from two.
- **Python (Render): re-read on 2026-08-08 and on `a968dcd`**, the current
  `origin/main`. `/health` answered `status: online`, `commit: a968dcd`,
  `env: production`, `privacyThreshold: 10`, `supportedContractVersions`
  `1.0`–`6.0`, `jobPollingEnabled: true`. The service rebuilt on every push to
  `main` when this was read, so it reported the repository tip even when the
  commit — as here — changed only documentation. That stopped being true on
  2026-08-09, when `render.yaml` gained a `buildFilter`; see the keep-alive
  section above before reading a `commit` against the tip. The previous reading
  was `763e38f` on 2026-08-05; no Python source changed in between.
- The schema matches: the only migration these three slices needed was applied
  by hand on 2026-08-05, and nothing after it changed a schema.

Earlier readings the same day — `143d460` at 17:10Z, `3590aae` at 14:31Z,
`65b2885` and `67048b5` before them — were trimmed on 2026-08-05 along with the
snapshot chain above. Each said the same thing about a commit that is no longer
deployed, and Git holds the commits themselves.

So the contract amendment of 2026-08-05 is live on both sides. What that is
**not** evidence of: no round has produced `metricInsightsOutcome` against a
real provider yet. Deployed code, not deployed behaviour.

`GET /api/health` on Core **is public now** — cheap-win item 7 put it in the
middleware bypass — so the deployed producer and supported versions can be read
without signing in, and were on 2026-08-11. The sentence this paragraph used to
carry, that reading them meant an owner sign-in, stopped being true when that
landed.

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
