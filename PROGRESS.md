# Shalomut Map — product progress

This file is a concise product-level milestone record, not a session log. Branch
evidence lives in `docs/agent-tasks/archive/`; current deployed state and
approval gates live in `docs/shalomut-tracker-handoff.md`. When this file was
last touched is a question for `git log -1 -- PROGRESS.md`, not for a line
inside it.

## Current state

- **A round publishes its numbers once, when it closes.** Since 2026-08-22 a
  round that is still collecting shows its response count and nothing derived
  from the answers — no map, no dimension scores, no per-question numbers, no
  breakdown. Until then every read of an open round republished the full
  aggregates, so two reads taken either side of one submission could be
  subtracted to recover that respondent's answer sheet; the audit of 2026-08-21
  found it and `PROJECT_CONTEXT.md` ADR-030 records the rule, which extends
  ADR-022 from "one basis per manager choice" to "one basis, on the clock too".
  The cost is the live map during collection, and the screens say so rather than
  promising the map after N more answers. Closed and archived rounds publish
  exactly as before.

- **The one note that leaves the platform says so, at the field.** Since
  2026-08-22 the background note on the round setup screen carries a line under
  it: the text is sent verbatim to the model that writes the map, so it leaves
  the platform, and names of staff do not belong in it. On contract 4.0 and
  above that note has always reached the prompt as written; what was missing was
  any way for the manager to know it while typing. The same day closed five
  neighbouring hygiene findings from the 2026-08-21 audit — the funnel beacon
  got a rate limit, the machine-to-machine secret fails closed on any deployed
  runtime and compares in constant time, the share code's uniformity claim
  became true, `npm run db:clear` clears the whole schema rather than five
  tables of it, and the Swagger UI script from unpkg is hash-checked before it
  runs inside a manager's session.

- **The AI service runs the packages it was tested with.** Since 2026-08-22 its
  Python dependencies are a generated lock — the whole transitive tree at exact
  versions, every distribution hashed — and the container Render builds, both CI
  gates and the documented local setup install from it with `--require-hashes`.
  Before this they were four `>=` lines with no lockfile, so each rebuild
  accepted whatever the index served that day and the three environments drifted
  apart silently; an untested release or a hijacked package reached the paid
  analysis pipeline simply by being current. `npm run lint:python-deps` keeps
  the declaration, the locks and the install commands in agreement.

- **The deployed database is verified, not merely encrypted.** Since 2026-08-22
  every connection to it — the serverless runtime and every administrative
  script — checks the certificate against Supabase's own root, which the
  repository carries because a public trust store does not. Before this the
  connection was encrypted to whoever answered: an attacker between the
  function and the database could have presented any certificate, read and
  rewritten every survey answer, and taken the credentials on the way past.
  `PROJECT_CONTEXT.md` ADR-040 records it, including the one path it does not
  close — the migration step, which uses Prisma's own engine.

- **An anonymous submission carries a filling session, and a round stops
  somewhere.** Since 2026-08-22 the attempt token hash is required rather than
  optional — omitting it used to skip the duplicate guard, so the only defence
  against a round being stuffed was a field the caller could leave out — and a
  round refuses answers past three times its school's staff count, with a floor
  of one hundred. `PROJECT_CONTEXT.md` ADR-039 records both, and is explicit
  that they bound the rows rather than the ratio: binding a submission to
  something this server issued is the open half of the audit's entry and a
  change to the respondent flow rather than a number.

- **The login screen cannot be borrowed to send a manager somewhere else.**
  Since 2026-08-22 the `next` a sign-in carries is resolved by a URL parser
  rather than checked by its first two characters. Browsers drop ASCII tab, line
  feed and carriage return from anywhere in a URL before parsing it, so
  `/login?next=/<LF>/elsewhere` passed the old rule and then landed on
  `elsewhere` — a phishing destination laundered through this product's own
  login screen. What is honoured now comes back in the parser's own words, so
  the value reaching a `Location` header has already lost the characters that
  could split one, and the OIDC callback checks the destination again where it
  builds that header rather than trusting the unsigned handshake cookie.
  `PROJECT_CONTEXT.md` ADR-038 records it; the audit of 2026-08-21 found it.

- **A group's dimension score says how many people are behind it, or it is not
  shown.** Since 2026-08-22 the breakdown table gates each cell as well as each
  column. A group large enough to name is no guarantee about any one of its
  dimensions — analytic questions may be optional, so a group of twenty can
  bring four people to one dimension — and the printed average was those four
  people's, beside a group size that said nothing about it. Cells now go
  through the same suppression as the group sizes, computed across the row so a
  lone blank cannot be recovered by subtraction from the round's own average,
  and every published cell prints the number of respondents it stands on.
  `PROJECT_CONTEXT.md` ADR-037 records it; the audit of 2026-08-21 found it.

- **A manager is a person the database knows, and their password is nobody's.**
  Since 2026-08-20 `managers` and `organization_memberships` are tables: a
  session is built from rows rather than assembled per login from environment
  variables, and which school it may read is the membership rather than the
  configuration. Sign-in goes to an external identity provider — Google
  Workspace, decided the same day — so the product stores no password at all,
  and an address the provider vouches for is still refused unless somebody
  invited it. About four platform administrators may open any school; a school
  user may open theirs. A deployment without an OAuth client keeps the interim
  password screen until it has one, and never both at once. An administrator
  opens a school and invites its person from `/admin`, and every manager action
  — including an administrator reading a school they are not a member of — is a
  row in `audit_events`, which nothing renders yet. The row names the school the
  screen was answered with rather than the one the request asked for: most
  requests ask for none, and a deployment with one school hands that school back
  to all of them.

- **An administrator can see what every school is doing, one school at a time.**
  Since 2026-08-21 each school on `/admin` says how many rounds it has run, which
  round it is currently about, and how many people have answered against the
  threshold that would unlock it — with a link into that school's own map. What
  no screen and no export does is put two schools into one figure: small groups
  that are each suppressed become readable when added together, so the summary
  carries counts and never a score. That limit is enforced by the type the screen
  reads and by tests over its fields, not by review.

- **A session lasts fifteen minutes, and taking access away means it.** Since
  2026-08-21 the token is short rather than good for a day, and the renewal that
  replaces it is the moment memberships, role and the administrator flag are
  re-read from the database. Revoking somebody who is signed in stops them
  within the quarter hour instead of at their next sign-in. A manager's own
  activity is what renews it, so an idle screen signs itself out and a working
  one never does; twelve hours after signing in, everybody signs in again.

- **The product explains itself, on a screen and in the repository.** `/help` is
  a Hebrew manager guide answering the seven questions the screens raise — why a
  result is locked, how a stone gets its colour, what the model does and does not
  decide, what closing a round starts, why a questionnaire freezes, what happens
  to a goal, and what is stored about respondents. Every number in it is read
  from the module that enforces it rather than written out, and a test fails if
  the guide drifts from the threshold or the scoring bands. The locked map links
  to it directly, because the dashboard renders without the global header and a
  manager meeting a locked map is the likeliest person to want the explanation.
  Alongside it, `docs/platform-handbook.md` explains the whole platform to a
  non-developer, with Russian and Hebrew as dated snapshots under
  `docs/snapshots/`, and `docs/ai-analysis-run-lifecycle.md` draws the durable
  analysis run for a developer.
- **`origin/main` carries the response-quality stack, landed 2026-08-17.** Five
  branches: analysis moved from every answer to the moment a round closes; the
  round says how long it took to fill and how many questionnaires came back too
  fast; that duration became the time the questionnaire was actually on the
  respondent's screen rather than the lifetime of their session; and the
  attention-check question went to the methodologist instead of into code. Both
  of its migrations were applied to the deployed database before the push.
- `origin/main` also carries the eight-branch research-instrument stack, which landed
  on 2026-08-15 as one fast-forward of twenty-six commits, and the smaller
  commits that closed that session after it. Before the stack, `main` was
  `45e1340` plus its archive commits, after six branches landed on 2026-08-11
  and ten on 2026-08-10. What is deployed, as opposed to merged, is in
  `docs/shalomut-tracker-handoff.md`.
- **The browser smoke runs on every branch** as of 2026-08-15, in its own
  `browser-smoke.yml` rather than as the last step of the deploy workflow. It
  moved because a branch could not reach it: landings are fast-forwards, so a
  stack met Playwright only after it was on `main`, and one did — green on every
  branch gate and red on the first run there.
- **Opening a school or a round is a decision the screen states, not a form to
  survive.** Both were the same forty-field setup screen, told apart by the
  wording of one button below the fold; each is now a dialog that says what the
  save will do — for a round, that it opens as a draft, that a round has exactly
  one questionnaire, and that the running round keeps collecting until the new
  questionnaire is saved — and asks only for the fields that differ. Each field
  it refuses says why, under that field. Editing a round stays a screen, with
  the save button and the save state pinned to the bottom of the viewport
  instead of forty fields down. Every irreversible action left `window.confirm`
  for a Hebrew dialog that describes what it will do. The builder also gained
  the one thing it could not do: a question written by the manager, rather than
  taken from the template, the model, or a duplicate of another question.
- **Two defects behind that confusion, both silent.** Opening a round left the
  URL reading `round=new`, so a manager who fixed a typo and saved again opened
  a second draft of the same quarter. And a round's name is edited on two
  screens: both wrote the round, only the builder wrote the copy inside the
  questionnaire snapshot, so renaming on the setup screen was posted back over
  by the next questionnaire save — no refusal, no message, the name simply came
  undone. The name is now mirrored in both directions, as the privacy threshold
  already was, and both screens say it is one string.
- **The screens stopped saying things the system does not do.** A locked round
  shows `—` and the threshold it is waiting for rather than `0` problem areas,
  so an empty round no longer reads as a perfect school. A recommendation names
  the ISO 45003 clause or OECD TALIS guideline behind it. The minutes a
  questionnaire asks for are computed from the questions it asks, on the
  builder and on the consent screen alike. The round's end date is labelled a
  plan and says when it has passed while answers are still arriving, because it
  closes nothing. And the setup screen warns while the staff count is being
  typed that a staff smaller than its own privacy threshold can never unlock —
  the rule the API already enforced, said early enough to act on.
- **The dashboard says how much of its own number to believe.** A delta smaller
  than one respondent's width is no longer stated as a change, a score near a
  band edge says so, a comparison between two different questionnaires admits
  it, and a dimension whose answers split between the two ends of the scale is
  marked on the map instead of hiding behind its mean. That closes axis 6 of
  `docs/product-strategy-axes-2026-08-10.md`. Scores, colours and statuses were
  deliberately left untouched: these are facts beside the number, not
  corrections of it.
- Previously recorded: `origin/main` was `4b0a4bd`. The product-behaviour backlog is closed except for
  its two requirement-gated items; `ROADMAP.md` has no open product outcome, and
  `docs/shalomut-tracker-handoff.md` lists under "What is open, and what it
  waits on" the four things that remain — two owner decisions, two requests, and
  a signed-in walk of the newest screens that only the owner can perform.
- The last three slices, all on 2026-08-05: the questionnaire keeps a version
  history a manager can restore from, an archived round became genuinely
  read-only rather than merely hidden, and a school reads its goals in one place
  across every round it has run.
- Contract `6.0` is deployed end to end and the deployed Core explicitly
  produces it. The unset configuration default remains rollback-safe `5.0`. A
  published version may gain an optional additive field under ADR-002's stated
  rule; a changed meaning still needs a new version.
- **The administrator's screen costs the same whatever the platform holds** as
  of 2026-08-22. It asks five queries for the whole list instead of three per
  school inside a loop; at a hundred schools that was around 300 sequential
  round trips against a database some 180 ms away, which is a function timeout
  on the only administration screen there is. Rounds arrive as summaries, so a
  list of schools no longer reads 126-question questionnaires it does not
  display. ADR-036 records it, supersedes half of ADR-029, and names what is
  left: the console still renders every school without pagination or search,
  which is a product decision rather than a refactor.
- **A round's numbers are derived once, not once per screen** as of
  2026-08-22. A round that is still collecting reads no answer rows at all —
  its result is locked whatever they say, and the locked payload needs only a
  count — and a round that has stopped collecting keeps what it published and
  is read back from it. Before this, every manager screen, every dashboard
  comparison and every AI request aggregated every response of the round with
  all its answers in Node: some 38 000 rows for 300 staff on the 126-question
  instrument, per page view. ADR-035 records it, including what still reads
  responses in full and why.
- **A blip between the worker and Core no longer burns a paid run** as of
  2026-08-22. A heartbeat that could not be sent is retried, and the worker
  keeps analysing until the lease Core granted has actually run out; a run it
  then has to let go is released for its remaining attempts rather than failed
  terminally. The same rule covers a finished map whose delivery ran out of
  attempts against an unreachable Core. Before this, one timeout or one `502`
  mid-run cancelled a three-minute analysis, spent up to 28 paid provider calls
  for nothing, and left the run in a state nothing ever retried, with nobody
  notified. ADR-034 records it, including what a released run costs.
- **A re-analysis no longer takes the round's map away** as of 2026-08-22. The
  map a manager reads is the newest result the round has, and a run that is
  queued, running or failed qualifies it on screen instead of replacing it with
  an empty state. Before this, any re-analysis hid the map while it ran and a
  failed one hid it indefinitely, and a failure payload overwrote the round's
  rollback copy of the map it was meant to replace. ADR-033 records it, including
  the earlier rule it reverses.
- **A round status write that failed says so** as of 2026-08-22. The write is
  conditional on the status the request read, and its outcome is named rather
  than collapsed into `null`, so audit rows, analysis dispatches and
  `success: true` are consequences of a confirmed write. Before this, a refused
  activation was recorded as a transition that never happened, a failed close
  still queued the closing analysis for a round that was still collecting, and a
  builder that could not start a round reported a successful save after closing
  the round the school had been running. ADR-032 records the decision and what
  it deliberately does not make atomic.
- **A deployed build applies its own migrations** as of 2026-08-22, and fails
  rather than shipping when it cannot. It was a hand step before that, which
  cost a broken deployment on 2026-08-04 and one manual command after every
  schema change since; ADR-031 records the decision, its `DIRECT_URL`
  requirement and the ordering rule it introduces — additive first, because the
  schema now moves ahead of the alias. `docs/shalomut-tracker-handoff.md` owns
  the current deployed reading and the evidence for it.
- Verification is a checkpoint fact, not an evergreen expectation. At `8be73a6`:
  844 TypeScript tests. At `e14e3ac`: 826 TypeScript tests, 32 PostgreSQL tests and 11 Playwright tests. Earlier, at
  `763e38f`: 606 TypeScript tests and 26 PostgreSQL tests. The Python suite last ran at
  465 tests, before the TypeScript-only work of 2026-08-05.
- The manager screens were walked in a signed-in browser on 2026-08-06, and
  since 2026-08-07 one path through them runs automatically in CI — sign in,
  round tracking, the share link, the dashboard. Anything beyond that path is
  still the owner's own session to walk. That path earned itself on the first
  day: it found a session bug no test could reach — the middleware verifies a
  JWT in a sandbox with its own realm, and on Node 20 the signature it was
  handed failed an `instanceof` check inside SubtleCrypto, so every manager
  session was issued correctly and then refused, which reads as a wrong
  password. Whether the deployed endpoint was affected is untested; Vercel runs
  middleware in a different isolate.
- There are no real respondents or production data. The deployed Vercel alias
  remains an operational staging endpoint for the design stage.

## Completed product capabilities

### Survey and manager workflow

- Persisted organization onboarding, round setup and share-code distribution.
- Dynamic round-scoped questionnaire snapshots with the original 24 questions
  as the default/legacy template.
- The default template addresses both genders (`מרגיש/ה`, `יכול/ה`). The source
  material is feminine throughout, which made non-response by the men on a
  staff a likely and undetectable bias; rounds already collecting keep the
  wording their staff started with, and `contracts/ai-analytics-v2.json` keeps
  the sentences it published.
- Builder editing, enable/required controls, duplication, dimension coverage,
  template suggestions and AI-generated suggestions. An AI suggestion names
  its source and must be edited by a manager before it can be added.
- Builder search across text, dimension and question id; bulk enable/hide of
  whatever the filter and search leave on screen; and real reordering through
  move-up/move-down buttons rather than a drag handle that did nothing.
- Keyboard accelerators for the per-question actions, read from the physical key
  so they work on a Hebrew layout, listed on screen, and deliberately absent
  from deletion.
- Every manager screen reads any round the school owns — home, tracking, the
  builder and the map — chosen from one select that stays on the screen it is
  used from and holds its size as the history grows, with each round read
  through its own snapshot, threshold and analysis. The header carries the round between those screens, so opening a new
  round no longer puts the previous one out of reach. Setup is deliberately
  outside it: it configures the round the school is working on. A round the
  school has moved past is read — no reset and no re-analysis — while a closed
  round that is still the newest one keeps both.
- The system holds more than one school, and `/setup` is where one is chosen:
  a select that appears only when there is a second school, and a school opened
  from the same screen together with its first round. Every other screen — the
  map, the goals, the builder, round tracking — is read inside the chosen
  school, which is remembered between screens; `MANAGER_ORGANIZATION_ID` is now
  the school a session lands on rather than the only one it can reach.
  Authentication is untouched: one manager, no memberships (ADR-020).
- A school can open a second round from `/setup?round=new`, keeping its own
  details and starting an empty measurement period. A school runs one round at
  a time: a round going live closes the previous one and the builder names it,
  and a partial unique index makes the rule the database's rather than the
  service's alone.
- A recommendation can become a tracked goal: chosen from the dimension's
  recommendations screen, moved through selected, in progress and done, and
  dropped when the school changes its mind. The goal keeps the recommendation's
  words as they read when it was chosen, so it survives the next analysis and
  says so when that analysis no longer recommends it.
- Setup and builder say when their work last reached the database, and say so
  again as "not saved yet" the moment the manager edits. The time is the one the
  save endpoint reports, so it is evidence of a completed write.
- The school reads its goals in one place: `מעקב יעדים` lists every goal of every
  round, open ones first, each naming its dimension and the round it came from.
  A goal from an archived round says so and can still be moved, which is the
  point — the archive freezes the measurement, not the work that followed it.
- A round can be filed away. Archiving takes it out of the everyday switcher and
  leaves it behind a disclosure, keeping its URL, its dashboard, its analysis and
  its place in the comparison history — and an archived round is read-only:
  reset, a new analysis run and a questionnaire save are all refused. Its goals
  are not frozen with it, because finishing what a measurement started is the
  school's work rather than part of the measurement.
- The questionnaire has a history: every save that changes it keeps a copy, the
  builder lists the last twenty newest first, and an earlier one can be loaded
  back into the editor. Restoring is the ordinary save, so it is validated like
  any other, is itself reversible, and leaves the undone edit in the list.
- The map shows the change against the previous measured round — per stone and
  overall — naming the round it compared with and skipping any round that never
  reached its privacy threshold.
- Map stones move with the arrow keys as well as the pointer, reset returns
  focus to the map and announces itself, and stone motion is instant under
  `prefers-reduced-motion`.
- **A round that could never be shown is refused.** A school whose staff is
  smaller than its own privacy threshold can never unlock a result, so every
  teacher who answered would have handed something to their principal in
  exchange for nothing. Setup now answers 422 and names the two numbers that
  disagree, and writes no school. This is the provable half of the question; how
  small a staff room is too small to measure *safely* stays open.
- **A three-point rise is no longer stated as a fact.** Deltas between rounds
  were printed as changes with no sample size beside them, while a school of ten
  respondents cannot resolve them: one teacher answering differently moves any
  score by ten points. The comparison now carries its own resolution — one
  respondent's width — and anything under it reads as `≈` and "too small to read
  at this sample size" instead of a number, with both rounds' respondent counts
  always shown. The same width says when a stone's colour is a coin toss: the
  band edges are a hard switch that decides which recommendations a principal
  gets.
- **The consent screen says what the deployment can keep.** It used to promise
  that no IP address is collected. That was true of the code — nothing in `src/`
  reads one, no analytics package is installed, no column could hold one — and
  false of the product, because every request lands on a hosting edge that logs
  addresses. The address is now described instead: where it goes, that it is not
  stored beside the answers, and that nobody at the school sees it. A new
  promise discloses the third-party language model and what reaches it, which is
  question-level averages and never one person's answer.
  `docs/data-flow-and-subprocessors.md` is the long form.
- **The product is reachable by a monitor, and a failure leaves a trace.** There
  was no error tracking of any kind: a manager's 500 left a digest on their own
  screen and nothing anywhere else, and `/api/health` sat behind the manager gate,
  so nothing could watch the product at all. Health is now readable anonymously —
  by GET and HEAD only — and every uncaught server error writes one structured
  line carrying that same digest, in the shape the operational metrics already
  use.
- **"Is the model alive?" is one authenticated request.** The AI service now
  remembers the last outcome of a provider conversation — answered or not, with
  the transport's own reason and the model that was called — and reports it at
  `GET /api/v1/provider-health` behind the same inbound secret as its POSTs. It
  never calls the provider, and a process that has observed nothing answers
  `unknown` rather than `ok`, because a quiet service and a healthy one look
  identical from the inside. Owner decision, 2026-08-17: behind the secret rather
  than anonymous, because whether the account behind the key has credit is
  exactly the class of fact Core's own `/api/health` refuses to publish.
- **A question suggestion that never reached the model is countable.** That one
  path had no metric and no log line of any kind, which is how the deployed
  button could answer `503` on a depleted provider prepayment for an unknown
  length of time with no trace in Core at all — established on 2026-08-17 only
  by reading the AI service's own log. It now emits
  `ai_question_suggestions_succeeded` or `ai_question_suggestions_failed`, the
  failure labelled with the transport's own reason and the upstream status when
  a service answered with one. This makes the failure countable; where those lines
  are collected is still open.
- **A dead model is now noticed, not merely countable.** `GET
  /api/v1/provider-status` publishes one word — `answering`, `failing` or
  `unknown` — and a free UptimeRobot keyword monitor reads it every five minutes
  and mails the owner when it finds `failing`. Owner decision, 2026-08-17: publish
  the word anonymously rather than pay for a request header, because the free plan
  cannot send one; the reason, model, counts and timing stay behind the inbound
  secret, since they are what turns "the model is down" into "the account has no
  credit". Proved end to end the same evening: a refused suggestion at 23:00:45
  reached the owner's inbox at 23:03:12. Its honest limit is that the state only
  moves when real work calls the provider, so a provider that dies while nobody is
  using the product reads `unknown` and stays silent.
- **What a round costs is now a measurement rather than an estimate.** The
  provider answered every call with its own token accounting and the transport
  threw it away, so the figure behind "do not optimize LLM cost" — $0.31–$1.91
  per round — had no path to ever being checked. One line now carries it, per
  HTTP 200 rather than per conversation, because a refused answer was paid for
  too and this service retries with a critique by design. A field says
  `unavailable` where the provider sent nothing, never zero: a zero is a number
  a reader would sum. This is deliberately the whole of it — the sweep asked for
  a measurement and refused the optimization work, so there is no aggregation,
  no dashboard and no alert.
- **A half-written map is now noticed too, and it is a different question from a
  dead model.** The provider word follows the last conversation, so a round whose
  final call succeeded reads `answering` while most of its dimensions carry copy
  the service derived from the aggregates — which is exactly what happened on
  2026-08-09, when all eight stones came out of the deterministic fallback and
  the round reported success. `GET /api/v1/fallback-status` publishes one more
  word — `writing`, `degraded` or `unknown` — over a bounded window of the last
  twenty provider conversations, saying `degraded` when more than half of them
  fell back and `unknown` below five observed. It reads the same recording as the
  provider watchdog rather than a second hook, which is what keeps a green
  dimension the service deliberately never asks from counting as a failure. The
  threshold and the window are product judgements written as two named constants.
  Until this existed the detector wrote to `console.info` with nothing on the
  other end, which is the whole distance between countable and noticed.
- **A phone and a desktop ask the same question again.** The mobile rule hid the
  scale anchors — the sentences saying what green, yellow and red mean — so a
  teacher on a phone chose between three coloured pills with their definitions
  removed, and the two devices' answers pooled into one dimension score. The
  anchor wraps onto its own line instead. In the same slice: the completion
  estimate follows the question count rather than a hardcoded fifteen minutes,
  the public survey endpoint returns four whitelisted fields instead of the round
  domain object — which carried the school's background context and the
  manager's own notes to anyone holding a share code — and the share code is ten
  characters from a cryptographic source rather than four from `Math.random()`.
- **A round can say what happened to its link.** Sessions that opened the
  questionnaire, accepted the consent and stopped partway were invisible until
  now — the only row written was the one a submitted response created — so a low
  count could not be told apart from a link nobody received. The round screen
  reports openings, consents and completions, counts sessions rather than people
  and says so, and hides where sessions stopped until at least three of them
  stopped. Nothing new is recorded about a respondent: the same per-attempt token
  hash the response already carries, and no address, device or cookie.
- **A round can also say how long it took to fill.** Beside the funnel, the
  round screen reports the minutes the questionnaire asks for, the middle
  session's length, and how many came back in less than a third of that — the
  manager's original question about suspiciously filled questionnaires, answered
  in the half the product may answer. It does not offer to remove any of them,
  and says why: a round has one basis of calculation, and publishing two that
  differ by one respondent reads that person's answers off the per-question
  distributions. A response with no timing is named rather than counted as a
  fast one, and a count of one or two is stated as "fewer than three" so that it
  never describes an individual.
- **That duration is now the time the questionnaire was actually on screen.** The
  session's lifetime counted a forgotten tab and a lunch break as filling; the
  respondent's browser now accumulates only the visible time and sends one number
  with the answers, and a response carrying none still falls back to the session.
  The panel says which measure a round used, because the middle value mixes the
  two. What is deliberately absent is per-question timing: the browser keeps a
  single total and no per-step value ever leaves it, so nothing stored can say
  which question someone hesitated on — and the consent screen states both the
  measurement and that limit before the first question.
- A blocked clipboard is reported as a blocked clipboard: the share link is
  selected, the note names Ctrl+C/Cmd+C and stays until the next attempt.
- Anonymous respondent flow with stable attempt tokens and database-enforced
  idempotency.
- Explicit informed consent before the first question, stating the guarantees
  the code owns rather than manager-edited copy; declining sends nothing.
- An unfinished attempt survives a reload of the same tab, consent included,
  and a retry after a lost response completes instead of recording twice.
- Application-level manager session, server-owned organization scope and
  fail-closed deployed authentication configuration.
- The sign-in screen is inside the design system. It was the one screen written
  in raw Tailwind utilities — `text-slate-*`, `bg-white`, `amber-700`,
  `rounded-2xl`, and `tracking-tight` on Hebrew — with a 2.6:1 placeholder and
  its own focus ring competing with the product's. It now uses the same
  `label`, `input`, `.form-panel`, pill button and error note as every other
  form, and the brand mark the header already draws.
- A wrong address or a thrown segment now answers in Hebrew, right-to-left and
  inside the design system, where the App Router's own English default used to
  show. The respondent screens are written separately from the manager ones: a
  dead share link says the link is not active and offers no route into the
  manager app, and a failure mid-questionnaire says nothing was sent and offers
  a retry. No boundary prints the error message, which in a development build
  carries whatever the throw site put in it.
- A keyboard reaches the content without walking the navigation first: every
  manager screen opens with a skip link, and the respondent screens, which have
  no navigation to skip, deliberately have none.

### Privacy and analytics

- The browser is told what it may do: a CSP with `frame-ancestors 'none'` so a
  manager's one-click destructive buttons cannot be framed, alongside
  `nosniff`, `Referrer-Policy`, `Permissions-Policy` and HSTS. Sign-in attempts
  and submissions are rate limited per client address, counted under a salted
  hash that expires in five minutes and is never joined to a response; two
  Upstash variables move that counter into shared Redis, which is what makes it
  hold on serverless.
- Ten is the default and minimum privacy threshold; managers can only raise it.
- Total and per-question privacy gates prevent partial unlocked analysis, and a
  round is withheld while it is still collecting whatever its counts say
  (ADR-030). All three conditions live in `calculateDynamicRoundAnalytics`, so
  every consumer — dashboard, home, breakdown, comparison, the analytics route,
  the MCP route and the AI callback verifier — inherits one verdict.
- Core owns deterministic aggregates, statuses and callback evidence checks.
- Dashboard, round and detail routes show honest locked, queued/running, ready,
  failed, missing and refresh states without exposing service internals.
- Green dimensions are strengths to preserve; yellow/red use attention or
  improvement semantics.
- The green/yellow/red score bands live in `contracts/scoring-bands.json` and
  are read by both runtimes, so tuning the methodology after the pilot is one
  edit rather than five code copies. They are deployment-wide by decision: the
  service checks a payload's status against its score, so per-round bands would
  be new contract semantics.

### AI analytics

- Separate FastAPI service with MCP input, durable Core-owned jobs,
  lease/heartbeat recovery and idempotent callback completion.
- Published contracts `1.0`–`6.0` with shared capability metadata, version
  fitness checks, OpenAPI coverage and cross-runtime accepted/refused corpora.
- Exact dynamic questions, school background context and per-question
  green/yellow/red distributions reach generation according to version
  capability.
- V6 returns three-part summaries, qualitative question insights and exactly
  five recommendations per stone while retaining numeric callback evidence.
- Provider failure is visible. Safety repair is selective and Python validates
  its own outgoing payload before callback.
- Closing a round is what asks for its analysis; a submission dispatches
  nothing, and the manual route refuses a round that is still open or below its
  privacy threshold. A callback whose delivery fails transiently is retried,
  while a verdict Core has already refused is not.
- On `6.0` a silent provider produces aggregate-derived copy rather than
  failing the round, and the dimension screen says in Hebrew that no model
  wrote it. Every accepted map reports how much of itself the service wrote.
- A dimension whose copy the repair budget could not save is reported as a
  stated gap rather than costing the round: `5.0` and `6.0` both declare
  partial maps, the map names the gaps, and each gap says whether the provider
  went silent or the copy was refused.
- The metric narratives carry that disclosure too, separately from the overview:
  the two are written by different calls and fall back independently, so the
  metrics screen says when its sentences were derived even if the interpretation
  above them was the model's.
- `ai-analytics-service/evals/` measures whether generated Hebrew is any good —
  eight synthetic rounds and five deterministic graders. It scored real
  provider output for the first time on 2026-08-05, once a paid key existed.
- **The map is written by the model again, and on 2026-08-09 it had stopped
  being.** Two settings nobody had chosen did it: the answer ceiling was the
  service default of 2048, which truncated every dimension, and the fast model
  was `gemini-3.5-flash-lite`, which splices Arabic letters into Hebrew words —
  so the Hebrew-only gate refused what survived the ceiling. Every stone came
  out of the deterministic fallback while the round still reported success. The
  ceiling and the model are now declared in `render.yaml` and `.env.example`,
  the V6 summary and metric nodes tell a refused answer which gate it hit
  instead of re-sending the same prompt, and a real round through the real
  chain returns eight model-written stones on the first attempt.

### Architecture and verification

- Core domain calculation is separated from wire encoding through
  `CanonicalRoundAnalytics` and `encodeAnalyticsInput`.
- Python uses `CanonicalAnalysisInput`, a single output adapter and application
  ports for analytics source, result sink, job store, runner and text generator.
- Core wires every repository in one composition root; only entrypoints resolve
  it, and a fitness check in `npm run verify` keeps that boundary.
- CI runs TypeScript tests/types/lint/build, PostgreSQL integration tests and
  the full Python suite through `npm run verify`; CodeQL covers TypeScript and
  Python.
- Two browser paths are automated. The smoke: `npm run test:e2e` signs a
  manager in, reads the round's share link, opens it as a respondent and looks
  at the dashboard. It runs in CI after `npm run verify`, against a seeded
  disposable database and a server the run starts with credentials it invents,
  so no secret is configured for it. It answers "is the app standing?" and
  replaces the manual browser walk that used to be repeated once per session.
- The second is the tenant boundary, added 2026-08-21. Which school a manager is
  reading is decided in middleware from a query parameter and a cookie, so it
  exists only in a browser and every unit test around it is blind to the thing
  that actually goes wrong: one school's screen showing another school. Four
  checks — a member asking for a school they are not in stays where they are and
  the refusal is not remembered, a member is turned away from the administrator
  area, an administrator opens a school they do not belong to and the visit is
  written to the audit log, and the administrator area is theirs. Each was
  watched failing against a deliberately broken middleware, one mutation per
  check. It runs on a second server configured with an identity provider,
  because in a runtime without one the directory is the password accounts and
  none of them is an administrator.
- The Dashboard renders `DashboardInsightsDto` instead of the AI wire payload,
  and `src/lib/demo-data.ts` is gone along with the fixture analysis it held.
- StrykerJS provides an opt-in, non-blocking mutation pilot for
  `src/lib/ai-contract.ts` and `src/lib/scoring-bands.ts`, which holds the
  score-to-status rule the validator used to hold. It is not repository-wide
  coverage or a CI gate. Its survivors were classified on 2026-08-03, which
  turned into one refusal test per contract rule that had only ever been
  tested from the accepting side; the pilot's score moved 60.00% to 69.34%.
  The baseline was refreshed on 2026-08-05 after three months of drift in
  which the runner lost track of two test files and of the moved rule:
  871 killed, 275 survived, 67 uncovered and 42 runtime errors over 1255
  mutants, 71.81% total. On 2026-08-07 the same refusal treatment reached the
  contracts that had only ever been tested from the accepting side — first
  `1.0`–`3.0`, then `5.0` with its echoed distribution, adaptation outcome and
  partial map, then the `6.0` rules its one-metric fixture could not reach:
  1155 killed, 52 survived, 6 uncovered and the same 42 runtime errors, 95.22%
  total. Of what survives, nine are the sentence-segmentation helpers left
  alive by decision and five are error-message prose. Three checks hold the
  result without gating on the number: `npm run lint:mutation-config`
  re-derives the runner's test list from the repository, CI starts the runner
  with a dry run on every pull request, and `npm run lint:contract-refusals`
  fails when a contract version reaches a stone validator that no refusal
  suite exercises — so the next version cannot ship with accepting tests only.
  The first two are about the instrument, the third about the tests; none is a
  score threshold, and `ROADMAP.md` records why there is none.
- The OpenAPI specification has one editable source, `docs/openapi.yaml`;
  `public/openapi.json` is generated from it and checked as a whole document.
- The eight dimensions' Hebrew texts are configuration, not code:
  `contracts/wellbeing-dimensions.json` holds each dimension's name,
  description and Google Form heading, and `src/lib/wellbeing-dimensions.ts`
  validates the manifest at load. Renaming a dimension is a data edit; adding a
  ninth is still a code change, because the map has eight hand-drawn stones.
  The move also deleted the second copy of the names that the 2026-08-16
  modularity audit had flagged as duplication without a parity test — one of
  the eight had already drifted, so the breakdown table called
  `management-support` `עוגן` while every other screen called it
  `עורף מקצועי`.

## Next up

### Product

**One thing is open and an agent can start it: replacing the default
questionnaire with the owner's research instrument** (decision 2026-08-14). 126
items instead of 24, 1–5 and 1–7 scales with mixed polarity instead of one
three-colour scale, demographic items that score nothing, and k-anonymous
cross-tabulation. `docs/default-research-instrument-plan-2026-08-14.md` holds
the six phases. Phases 1 to 4 are built: the answer model carries scales and
polarity, demographics are k-anonymous, the builder authors a background
question, `/breakdown` reads one, and as of 2026-08-15 a respondent can answer
the whole shape of the new instrument — a single-choice list with a way to
decline, a number field, an allocation grid that must total 100, and a block of
Likert statements on one screen with its anchors stated once. The completion
estimate is derived from what the questionnaire asks rather than from how many
questions it has.

"Demographics are k-anonymous" became true of the whole screen on 2026-08-15,
not just of one table on it. Until then a breakdown could publish its large
groups while leaving a single person as the unpublished remainder — two blanks,
which satisfied the rule as written, and one person, which is what the rule was
for. A published table now blanks out either nobody or at least the threshold,
which is also the property that holds when a manager opens the round's next
background question.

What is left is phase 5 and the instrument's own content, both of which wait on
the methodologist's item-to-dimension mapping — the machinery exists and the 126
items do not. The eight-branch stack **landed on `main` on 2026-08-15** as one
fast-forward, so the capabilities above are the ones in the repository — but the
default questionnaire a manager gets is still the canonical 24, because
replacing it is what the missing mapping would do.

That decision also closes the answer-scale question the two items below were
waiting with. The cheap-wins list of
`docs/product-strategy-axes-2026-08-10.md` was closed as engineering work on
2026-08-11: its two survivors are whether the provider key is on a paid billing
account, which only the owner can read, and rewriting the questions and anchors
in the inclusive convention — methodology that now belongs to the instrument
replacement rather than to a standing hold. Of the larger axes, error tracking (axis 5) needs an
account and a DSN the owner creates, and the score's blindness to a split staff
room (axis 6) is a measurement decision rather than a defect to fix.

The last product decision in the backlog — whether recommendations
become tracked goals — was taken on 2026-08-04 and shipped in its minimal form
(§5). What §5 deliberately leaves undecided is whether a goal ever gains an
owner, a due date or a plan of steps.

Cross-round work is **closed for now**: per-round reading and second-round
creation landed on 2026-08-03, the deterministic dimension-level delta and the
partial unique index behind the single-active-round rule on 2026-08-04, the
read-only archive and the school-wide goals screen on 2026-08-05, and the owner
decided on 2026-08-04 that AI analysis across rounds is not wanted yet.

`ROADMAP.md` was reconciled on 2026-08-05: all five of its "next product
outcomes" had shipped or been decided, so the section listed work an agent could
have started again. It now records each as shipped and names what is gated
rather than queued.

The backlog was reconciled with the owner's development requirements document
on 2026-08-03. Its opening section records the four points where the shipped
product deliberately differs from that document: the single three-colour answer
scale, deferred viewer/admin roles, the privacy-threshold floor of ten, and
environment separation being infrastructure rather than product behavior.

### AI analytics

Closed 2026-08-05: the eval corpus scored real provider output for the first
time, on a paid key and on the models `render.yaml` deploys. The prompts now
have a baseline. It also found a defect in a grader rather than in the prompts:
`summary_grounding` read "18 green *answers*" as a claim about dimensions, so it
now requires the noun and the same payloads were rescored for free.

Closed 2026-08-05: the corpus was then used for what it is for. `no_overreach`
was the one weak grader — 21 uses of clinical vocabulary and 9 asserted causes,
`שחיקה` among them in the round summary itself. Every prompt already said "do
not invent causes or diagnoses"; the rule now names the words, and a second run
on the same models scored 0.94 against 0.2725, with no clinical term left. The
first attempt at it also showed what a prompt change costs elsewhere: more
rules made the model write longer, metric narratives crossed the 500-character
refusal and 13 more dimensions lost their model-written text, so the prompts
ask for 350–450 within a validator that allows 300–500.

Four asserted causes survive that, and owner decision 2026-08-05 leaves them.
Refusing them at runtime was built and measured on `fix/refuse-asserted-causes`:
it works — no model-written causal claim survives it — and it costs 8 to 14
percent of the map's model-written prose, because eight of its eleven refusals
were the model's own caveats about a small sample, the caution the prompts ask
for. One disputable sentence is not worth half a dimension's text. The branch
stays unmerged as the measurement; the retry critique it needed landed
separately and is on `main`, where a refused answer no longer means the same
question asked again.

Closed 2026-08-05: the two amendments `6.0` took on 2026-08-04 no longer sit
against ADR-002. Owner decision — a published contract may gain an **optional
additive** field and nothing else, under conditions ADR-002 now states, so
`supportsPartialMaps` and `generationProvenance.unavailableReason` are legal
rather than tolerated. A changed meaning, a new required field or a removal
still needs a new version.

Closed 2026-08-05, the first use of that clause: a stone now says who wrote its
metric narratives as well as its overview. The two are written by separate calls
and fall back independently, so a dimension could open with the model's
interpretation and read every question in copy the service derived, with nothing
saying so. One outcome covers all of a dimension's narratives — one call writes
them together — and the metrics screen carries the note, because that is where
the sentences are.

Closed 2026-08-19, and the same clause again: the disclosure now covers the two
surfaces that had none. `overallSummaryOutcome` says who wrote the round's
opening sentence, and the goals screen says when its recommendations are the
catalog's own wording rather than an adaptation written for this round —
`adaptationOutcome` had been on the wire since `6.0` and read by nothing. The
gap was worth closing because on `6.0` a silent provider does not raise: all
three per-dimension generators fall back and label themselves, so the overview
banner, which fires on `unavailable`, stays quiet through the failure that is
actually common. Whether that banner should fire on a fallback too is open and
unrequested; `docs/shalomut-tracker-handoff.md` carries it.

### Architecture

Nothing open. Mutant classification closed on 2026-08-03, and on 2026-08-07 the
contracts `1.0`–`3.0`, `5.0` and finally `6.0` got the refusing half of their
tests — what the classification had called a missing-fixture problem. `4.0`
needed no slice: it validates through the `3.0` path. Widening mutation scope
to a second subject stays conditional, and `ROADMAP.md` records why.

The long-term identity model left this list on 2026-08-03 as requirement-gated
future work, and came back on 2026-08-20 when the owner asked for multi-tenant
hosting. Phases 0 to 3 of `docs/multi-tenancy-plan-2026-08-20.md` are done — the
tenant boundary is a membership, identity is a row, sign-in is an identity
provider, the audit log outlived the container in time for the administrators
who make it matter, and a school is now opened by an administrator who then
invites the person who will run it. `PROJECT_CONTEXT.md` ADR-025 is the
successor to ADR-013, whose argument about the password hash turned out to end
with the hash being deleted rather than replaced; ADR-026 records why an
administrator's read of a school they do not belong to is refused when it cannot
be written down; ADR-027 records why an invitation is an entitlement that needs
no e-mail to deliver it. Phases 4, 5 and 6 remain, and the plan holds them.

## Durable references

- Architecture and invariants: `PROJECT_CONTEXT.md`.
- Product direction: `PRODUCT.md` and `ROADMAP.md`.
- Documentation lifecycle: `docs/README.md`.
- Survey/runtime source roles: `docs/source-of-truth.md`.
- Contract runtime state: `docs/ai-contract-version-matrix.md`.
- Current operational/deployed state: `docs/shalomut-tracker-handoff.md`.
- Final task evidence: `docs/agent-tasks/archive/` and Git history.
