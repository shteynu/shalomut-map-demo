# Product strategy — the analysis axes, 2026-08-10

A 360° sweep of Shalomut Map as a product, a system and a business, run to answer
one question: **which axes would make this better in every respect, especially the
ones nobody has opened yet.**

**Not for implementation.** This is material for product decisions. Nothing here
is a queued task, and several axes are deliberately gated on an owner decision
that has not been taken.

## How this was produced, and how to read its evidence

Twelve independent areas were audited in parallel — seven against this
repository, five as external research — then merged and passed to a completeness
critic. 145 raw findings reduced to the axes below.

Every claim in this document carries one of two labels, and the difference
matters:

- **[verified]** — checked directly in this repository during this session, with
  the file and line named. Trust these.
- **[researched]** — from web research on Israeli regulation, procurement, the
  market and the psychometric literature. Sources were cited by the researching
  agents but **were not independently confirmed here**. Treat every one as a lead
  to check, not as a fact to act on. Anything with legal or financial
  consequence needs a human professional before it becomes a decision.

## What the owner decided on 2026-08-10, and what it changes

| Question | Answer | Consequence |
| --- | --- | --- |
| Buyer / payer | Not a business yet — R&D and portfolio | The commercial rail drops out of the critical path. Multi-tenancy, billing and roles stay ungated future work. |
| Next ~3 months | **First pilot in a real school** | This is the binding constraint. Several items the repository records as *deferred gates* become blockers the moment one real teacher answers. |
| Arabic sector | Out of scope, Hebrew only | Recorded as a closed decision, not a gap. Do not reopen it as unfinished work. |
| Session output | A strategy document in the repository | This file. |

The two answers together are in tension, and naming it is the point: *"not a
business"* lowers the cost of being wrong about pricing, while *"a pilot with
real teachers"* raises the cost of being wrong about consent, anonymity, the
public boundary and measurement validity to its maximum. The ordering below
follows the pilot, not the business.

---

## Tier 0 — blocks the pilot itself

### 1. Permission to run a survey in a school, and the truth of the consent screen

**[researched]** Israel's Chief Scientist standing directive on research in
educational institutions is reported to cover surveying `עובדי הוראה`, with a
plausible exemption for `פעולת חקר פנימית` — a single institution evaluating
itself for its own needs. Cross-school pooling, national norms or vendor-side
reuse of the answers would void that exemption. Sanctions were reported to
include surrender of collected data. **This is the single lead most worth
confirming with a human**, because it decides whether the pilot can legally
happen at all.

**[researched]** Amendment 13 to the Privacy Protection Law took effect
2025-08-14 with administrative enforcement and financial sanctions. Its
special-sensitivity category was reported to include assessment of personality
and work functioning — which is close to what this instrument measures.

**[verified]** The consent screen promises that no name, e-mail, IP or other
identifying detail is collected. The application code is genuinely clean — there
is no IP capture and no analytics package anywhere in `src/`. But the sentence
describes the whole system, and the stack terminates every request at an edge
that logs client IPs. An anonymity promise that is true of the code and not of
the stack is the most damaging kind of inaccuracy, because it is the one a
teacher would feel betrayed by.

**[verified]** No privacy policy, terms, DPA, sub-processor list, retention
schedule, deletion route or incident-response plan exists in the repository. The
schema has no retention or soft-delete column; deletion exists only as
`onDelete: Cascade`.

**[verified]** `backgroundContext.notes` is manager-authored free text that
reaches the LLM prompt. Nothing tells respondents that any of their round's
content is processed by a third-party model.

**First deliverable:** confirm the `GEMINI_API_KEY` is on a paid billing account
and record the answer with its date (ten minutes, and it decides which terms the
school's data is currently processed under); write the sub-processor list and
data-flow diagram — Vercel, Supabase, Render, Google — as the artifact every
other legal document depends on; then reword the consent promise to what the
product actually guarantees.

### 2. The public respondent boundary

The one hole in an otherwise disciplined privacy design, sitting on the only
route that must be public. All of it is about a day of work.

- **[verified]** `GET /api/survey/[shareCode]` returns the whole `round` domain
  object — and `prisma-round.repository.ts:58` maps `backgroundContext` into it,
  which carries sickness days, new staff members, student count, socio-economic
  index and the principal's free-text `notes`. The respondent screen renders
  none of it. The 400 for a non-active round additionally echoes `round.title`,
  which turns a scan into a school-name harvester.
- **[verified]** `src/lib/services/round.service.ts:20-22` —
  `Math.random().toString(36).substring(2, 6).toUpperCase()`. At most ~1.68M
  values, not a CSPRNG, generated once with no retry against the unique index,
  and `substring(2, 6)` can return fewer than four characters.
  `crypto.randomUUID()` is already in use six lines below.
- **[verified]** No inbound rate limiting exists anywhere in `src/`. The only
  match for rate-limiting vocabulary is outbound provider pacing. That includes
  `/api/auth/login`.
- **[verified]** `next.config.ts` declares no `headers()` and there is no
  `vercel.json`, so no CSP, no `frame-ancestors`, no Referrer-Policy — on an app
  whose manager screens carry one-click destructive controls.
- **[researched, mechanism verified]** The dedupe token is minted in the browser
  and the UI deliberately offers a reset for shared staff-room computers, so N
  submissions from one browser count as N respondents. Reaching ten unlocks the
  map and triggers the AI run — so anyone holding the link can manufacture a
  school's wellbeing picture, and the model will then narrate it confidently in
  Hebrew.

**First deliverable:** a whitelisted respondent DTO on the survey GET with a test
asserting the body contains no `backgroundContext` key; a crypto-random share
code with retry on conflict; a limiter on login and submit; a `headers()` block.

**Also here:** the handoff's open commitment to rotate the four exposed
credentials is due now rather than later — `docs/shalomut-tracker-handoff.md`
itself scopes it to "before the first real respondents".

### 3. Respondent experience integrity on a phone

A measurement-validity failure, not a styling nit. It silently invalidates any
pilot data collected before it is fixed.

- **[verified]** `src/app/globals.css:5384`, inside `@media (max-width: 620px)`:
  `.answer-stone span { display: none }`. That span holds the scale anchors — the
  sentences defining what green, yellow and red mean. On every phone the teacher
  chooses between three coloured pills with their definitions removed, and
  `display: none` strips them from the accessibility tree too. Desktop and phone
  answers then pool into the same dimension score. **Teachers answer on phones.**
- **[verified]** `estimatedMinutes` defaults to `15`
  (`src/lib/survey-definition.ts:267`) and is printed as the last thing a teacher
  reads before deciding — `{questionCount} שאלות, כ־{estimatedMinutes} דקות`. The
  instrument is 24 single-tap items on a three-option scale. The number is
  several times too high, and it is the cheapest conversion lever in the product.
- **[verified]** The three scale anchors and the default questions are written in
  feminine singular — `אני מרגישה`, `כשאני חושבת` — eleven occurrences in
  `src/lib/shalomut-source.ts`. The same file already uses the inclusive
  convention elsewhere (`אני יכולה לפנות למנהל/ת`). The likeliest male response is
  no response, concentrated in one demographic, biasing the scores the AI
  narrates.
- **[verified]** No test in the repository ever clicks an answer stone or
  submits; the e2e respondent block stops at a visible heading. Playwright
  declares Desktop Chrome only, so the mobile flow has never rendered in CI.

**First deliverable:** delete the `display: none` and re-lay the mobile pill;
derive `estimatedMinutes` from question count; rewrite the anchors and questions
in the `/` convention the file already uses; extend the e2e respondent path
through submit and add a phone project.

### 4. Respondent funnel instrumentation

Below ten responses the product shows nothing, so response rate is the only
number that decides whether a school ever sees value — and it is the one number
with no instrument.

- **[verified]** `SurveyResponse` is written solely on successful submit. There
  is no open event, no consent-accepted event, no progress and no duration. A
  teacher who opened the link and left is byte-for-byte identical to one who
  never received it — two failures with opposite fixes.
- **[verified]** `endDate` is collected at setup, stored and displayed as
  `סיום איסוף מתוכנן`, and is never read by any rule: its nine references are
  types, persistence and creation only. Nothing closes, nothing warns, and the
  round keeps accepting answers while the screen says collection ended.
- **[verified]** `src/app/page.tsx:53` — `getStatusCount` returns `0` whenever
  analytics are locked. A principal on day one with zero responses is shown a
  dashboard asserting zero problem areas: the empty state is indistinguishable
  from a perfect school, which removes exactly the urgency needed to chase
  responses.

**First deliverable:** a `survey_attempts` table keyed on the `attemptToken` the
draft already holds — round, consent accepted, last question reached, completed
— with the same privacy shape as `SurveyResponse`, giving open → start → submit
per round.

### 5. The ability to notice

- **[verified]** No error tracking of any kind exists — no Sentry, Datadog,
  OpenTelemetry or equivalent in `src/` or `package.json`. A manager's 500 leaves
  a digest and a `console.error` in that manager's own browser.
- **[verified]** `/api/health` is not in any middleware bypass —
  `isRespondentRoute` covers `/answer` and `/api/survey`,
  `isMachineAuthenticatedRoute` covers `/api/mcp` and two POST paths, plus
  `/login` and `/api/auth`. Everything else falls through to the manager gate, so
  Core's health endpoint is unreachable anonymously. The only uptime monitor in
  existence watches the AI sidecar; **the product itself is monitored by nobody.**
- **[researched]** Vercel auto-deploys every push to `main` independently of CI,
  and red-CI commits have deployed. Consistent with this repository's own record
  that Vercel builds every push on its own.

**First deliverable:** add `/api/health` to the public bypass with an anonymous
e2e assertion and one uptime monitor on Core; wire error tracking to the existing
`error.digest`; point the sixteen operational metrics at a real sink with one
alert on the deterministic-fallback ratio.

---

## Tier 1 — makes the pilot produce a defensible result

### 6. Statistical honesty of the number the principal acts on

Every fix here is arithmetic on data already in the database and needs no
contract version.

- **[researched, arithmetic checkable]** Deltas render as stated fact
  (`עלייה של 3 נקודות`) with no n, no interval and no suppression floor. With
  three items per dimension, values in {0, 60, 100} and n at the threshold of ten,
  the minimum detectable change is roughly ±25–28 points — an order of magnitude
  above what is displayed. One respondent flipping one answer moves a dimension
  3.33 points and prints as "+3".
- **[researched]** Band edges are a hard switch: the intervention catalogue is
  filtered by status *before* ranking, so 74 → 75 replaces the entire candidate
  pool and flips the product from improvement mode to `חוזקה לשימור`. There is no
  hysteresis and no band-proximity copy.
- **[researched]** The dimension score cannot see a split staff room: thirty
  yellow answers and eighteen green plus twelve red both score 60 — same number,
  same colour, same headline, while in the second school 40% of staff said the
  aspect requires action.
- **[researched]** `surveyDefinitionHash` exists, is computed on both runtimes and
  is refused on mismatch — and round comparison never reads it, so a school that
  rewrote its questions gets a delta rendered identically to a like-for-like one.

**First deliverable:** a pure `minimumReadableDelta(...)` beside
`toRoundComparison`, sub-threshold deltas rendered as `ללא שינוי מובהק`, both
respondent counts shown beside every delta, and a band-proximity flag.

### 7. Whose side the product is on

**Nothing in the repository defends the respondent against the principal** — who
is simultaneously the person being measured (management support, organizational
climate), the only reader of the result, and the person who controls employment.
In a staff of twelve to twenty, a red management-support stone plus a round timed
just after a specific incident is deanonymizing in practice regardless of the
threshold of ten. The product then converts that finding into an assigned,
tracked goal. There is no code of use, no clause against use in performance
conversations, and no refusal below a staff-size floor.

Teacher-side trust collapses faster than it sells. **First deliverable:** a
one-page `שימוש הוגן` commitment the manager accepts at round creation, and a
hard block — not a warning — below a staff-size floor.

### 8. AI output truth and silent failure

- **[researched]** Validation requires the summary to contain a digit and never
  checks the digit is real. Two documented incidents survive in the test suite,
  including "21 staff members in the red zone" on a twenty-respondent round. Both
  were fixed by adding a sentence to a prompt, and no automated check protects
  that sentence.
- **[verified by the repository's own record]** On 2026-08-09 every one of eight
  stones came from the deterministic fallback while the round reported success.
  The detector exists — `ai_deterministic_summary_ratio_sample` — and its sink is
  `console.info` with no drain, no dashboard and no alert.
- **[researched]** Both committed eval baselines describe a model and token
  ceiling that are no longer deployed. The repository's strongest quality claim is
  about a configuration no reader will ever see. A corpus run against the
  deployed configuration was estimated at about $6.
- **[researched]** Two of the five graders cannot report a defect:
  `summary_grounding` recorded zero claims on all eight cases in both baselines,
  and `recommendation_fit` compares a status the selection code itself wrote.

**First deliverable:** a `numbers_are_grounded` refusal pinned by the two
documented incidents, one alert on the fallback ratio, and a fresh baseline
against the deployed configuration.

### 9. The artifact that leaves the product

The report is the only object that leaves the building — it reaches the staff
meeting and the budget conversation, carrying the product into rooms where nobody
has a login.

- **[verified]** The `הורדת דוח` primary button's entire implementation is
  `onClick={() => window.print()}` — `dashboard-map-page.tsx:199` — and
  `@media print` appears **zero** times in 5,570 lines of `globals.css`.
- **[researched]** At A4 width the mobile branch matches, so what prints is the
  card grid rather than the stone map, with pastel status fills stripped and the
  Download button printed inside the report.
- **[researched]** The forty AI recommendations — the product's actual output —
  live on other routes and are absent from the report entirely.

**First deliverable:** print `/dashboard` once by hand to see what it produces,
then a server-rendered report route in reading order. It needs no new data.

### 10. Closing the loop with teachers

Round two's response rate is set entirely by what teachers experienced after
round one, and repeat measurement is the product's stated second act.

- **[verified]** Everything except `/answer/*` sits behind the manager session,
  so a staff-visible aggregate does not exist as a route. The completion screen
  says thank you and tells the respondent to close the window.
- Two levers cost nothing and need no contact data: a live "N of your colleagues
  have already answered" on the consent screen (`responseCount` is already
  computed and loaded on that page), and a read-only school aggregate unlocking
  under the same privacy threshold.
- **[verified]** Distribution is one read-only URL field and a clipboard button —
  no QR code, no pre-composed Hebrew WhatsApp message, no printable notice. The
  staff meeting is the only room where every respondent is present at once; a QR
  on a slide turns it into a four-minute collection event that clears the
  threshold in one sitting.

---

## Tier 2 — before a second school, a buyer, or a published claim

### 11. Tenancy boundary and hosting region

- **[verified]** `ManagerScopeService` resolves the organization through
  `orgRepo.findAll()` — a full read of the organizations table performed as the
  authorization step, which also means the school switcher enumerates every
  school to any signed-in manager. The session JWT already carries a
  `memberships` array; **[researched]** no route handler consults it, so the
  failure mode is a silent cross-tenant read rather than an error.
- **[verified]** `/api/mcp` bypasses the manager gate unconditionally for every
  method (`basic-auth.ts:39`), behind one deployment-wide shared secret.
  **[researched]** `get_round_analytics` takes a caller-supplied `roundId` with no
  organization scoping.
- **[verified]** The deployed database is in `aws-1-ap-northeast-2` — Seoul —
  while the users are in Israel, Render is pinned to Frankfurt, and there is no
  `vercel.json`, so Core serves from Vercel's default region. **[researched]** the
  manager render issues five sequential round trips, two of them redundant.

### 12. The instrument's scientific foundation

- **[verified]** Each response option bundles three separate judgements. Green is
  "this statement fully reflects my current state" **and** "I feel comfort and
  calm" **and** "I currently see no need to change anything"
  (`shalomut-source.ts:137`). A teacher for whom the statement is true but who
  wants change **has no valid answer**. This is a content-validity defect
  invisible to every reliability statistic, and it cannot be fixed after data
  collection — correcting it makes every prior round uninterpretable.
- **[researched]** Three items per dimension across three response categories caps
  reliability below publishable, and a three-indicator factor is just-identified —
  it cannot be disconfirmed. All 24 items are positively keyed, so acquiescence
  produces a dominant general factor that will be misread as "the eight dimensions
  are not real".
- **[researched]** No crosswalk exists to COPSOQ III, the HSE Management
  Standards, ISO 45003 (adopted in Israel as ת"י 45003, which uses the word
  שלומות) or OECD TALIS. Building one is a one-day artifact that converts the
  vaguest marketing claim into a table a buyer can check.

This axis has its own prior study —
`docs/scientific-evidence-layer-research-2026-08-09.md` — with twelve open owner
decisions. Read it before opening this.

### 13. Fields that get expensive later

**[verified]** `SurveyResponse` carries no role, tenure, grade band or
department, and `Organization`'s `city` and `schoolType` are free-text inputs
typed by a manager. **[researched]** the consent notice never mentions secondary
use, so rows collected in a pilot cannot lawfully join a pooled benchmark later.

The cheap half — a closed enum for school type, a sector and district field, a
pooling-consent flag — is an afternoon today and impossible retroactively.
**Build the fields; do not build the segmentation feature** until the per-cell
suppression rule is written.

### 14. Positioning, and the commercial rail

Deprioritized by the owner's answer, recorded so the research is not lost.

- **[researched]** RAMA and שפ"י already ship `שאלון אח"מ` — an anonymous ~10
  minute online staff climate questionnaire reported to the principal only,
  covering job satisfaction, burnout, teacher-management relations and teamwork,
  benchmarked against comparable schools, **free**, once every three years.
  "RAMA already gives me this for free" is the first objection in every school,
  and there is no written answer anywhere in the repository.
- **[researched]** Shalomut has no norm or percentile of any kind — a school is
  compared only to its own previous round, so "is 62 good?" has no answer. The
  band cut-points arrived in one commit with no recorded provenance.
- **[researched]** The word שלומות is already a Gefen catalogue programme name,
  and everything found in that category is facilitated hours with no measurement
  instrument and no longitudinal data — which is the actual differentiator and is
  currently buried under a generic name.
- **[researched]** The burnout framing is refutable from TALIS 2024, which was
  reported to place Israeli teachers *below* the OECD average on stress. The
  defensible pain is reported to be staffing and retention instead.
- **[verified]** The product already owns the evidence it needs for credibility
  and drops it: all 192 interventions carry a `source` — ISO 45003 clauses, OECD
  TALIS — which dies at a boundary before reaching the manager. Carrying it
  through is the cheapest available answer to "is this AI making things up".

---

## Cheap wins, all verified

Each is under a day, and none is blocked on a decision.

1. Confirm and record whether `GEMINI_API_KEY` is on a paid billing account.
2. Derive `estimatedMinutes` from question count instead of the hardcoded 15.
3. Delete `.answer-stone span { display: none }` at `globals.css:5384`.
4. Whitelist the survey GET response; drop the round title from the 400.
5. Replace `Math.random()` in `generateShareCode` with crypto entropy and retry.
6. Add a `headers()` block to `next.config.ts` and assert it in the smoke.
7. Add `/api/health` to the public bypass and put one monitor on Core.
8. Extend the e2e respondent path through submit; add a phone project.
9. Render `—` rather than `0` for the status stones while analytics are locked.
10. Warn at setup when `totalStaffCount` is below the privacy threshold.
11. Carry the intervention `source` through to the rendered recommendation.
12. Show both rounds' respondent counts beside every delta.
13. Rewrite the questions and anchors in the inclusive `/` convention.

## Do not do

- **Do not optimize LLM cost.** Estimated at roughly $0.31–$1.91 per round and
  a few dollars per school per year — under 1% of revenue at any plausible price.
  Add one line of token logging so the question is answered from data, then close
  it permanently.
- **Do not add more mutation testing or more contract validators.** That layer is
  at 95.22% with five CI checks while the respondent path has no test that ever
  submits a survey. Move verification effort; do not add it.
- **Do not re-platform to an Israeli region or start ISO 27001.** A five-figure,
  multi-month prerequisite that is irrelevant to a school-level pilot.
- **Do not build Arabic localization** — closed by owner decision 2026-08-10.
  Adding a `language` column to `Organization` threaded as a no-op `he` is the
  only thing worth doing, and only if it costs nothing.
- **Do not build the benchmark** — fix the taxonomy fields instead.
- **Do not gate CI on an absolute eval score.** Gate on a *drop* against a
  committed baseline, for the graders that actually measure something. An
  absolute threshold repeats the objection `ROADMAP.md` already raises correctly
  against mutation-score gates.
- **Do not reopen** the decision against cross-round AI narrative, or the
  three-colour survey *experience*. Both were taken deliberately. The open
  question is narrower: the answer *scale's* psychometric ceiling.

## What this sweep could not see

Named honestly, because the ranking above is only as good as its blind spots.

1. **Zero contact with a single human.** All fourteen axes are inferences from
   source code and public documents. No interview note, no named pilot school, no
   teacher quoted anywhere in the repository. Five conversations — three
   principals, two teachers — would re-rank or delete several items above, and
   cost an afternoon.
2. **The calendar.** The school year opens on 1 September. The weeks in which
   principals plan and are reachable are roughly now through mid-September. An
   agenda ordered by severity will silently spend the only reachable weeks of the
   year on internal hardening.
3. **Owner capacity and bus factor.** 587 commits by one person in eight weeks;
   credentials, the deployed database URL and the signed-in browser sessions live
   on one laptop; no second person can operate or recover the deployment. The real
   constraint on all fourteen axes is owner review capacity, not agent hours, and
   nothing budgets for it.
4. **IP and licensing.** The repository has been public since 2026-06-16 with no
   licence file and `licenseInfo: null` — [verified]. What is public includes the
   Hebrew prompt set, the questionnaire, the 192-item intervention catalogue and
   the eval corpus: the entire non-obvious IP. 88 of 587 commits are authored from
   a corporate e-mail address — [verified]. Ownership ambiguity plus no licence is
   the first thing that stops an investment, and it is cheapest to fix now.
5. **Name and trademark.** שלומות is a generic Hebrew noun the Ministry itself
   uses and is already a catalogued programme name — weak as a mark, unsearchable,
   and confusable with an existing listing. The public artifact is called
   `shalomut-map-demo`. The name goes on a printed report in a staff meeting,
   which is where changing it becomes expensive.
6. **The buyer may not be a school.** Four channels were never enumerated: the
   teachers' organisations, occupational-health and insurance channels where
   ISO 45003 psychosocial-risk assessment is a compliance purchase rather than a
   discretionary one, teacher-training colleges (which would generate validation
   data while running it), and the existing facilitators already selling שלומות
   hours — currently modelled only as competitors, and the ones who most need a
   measurement layer.
7. **The agent-driven development model itself.** 414 of 587 commits carry a
   Claude co-author trailer — [verified]. The strongest thing in this repository
   may be the tracker/handoff discipline rather than the product. The unpriced
   risk is a large body of code whose claims the owner has not personally
   verified: this sweep found a primary button whose entire implementation is
   `window.print()` and which arrived inside a refactor commit, never designed by
   anyone.

## Open owner decisions

1. **Which school, and when?** Naming a pilot school converts half this document
   from theory into a schedule.
2. **Is the three-colour *answer* the product**, or may the scale become 5–6
   points with green/yellow/red kept as a derived presentation band? The current
   design puts reliability, a disconfirmable factor structure and any detectable
   round-over-round change permanently out of reach. If the three-colour answer is
   non-negotiable, that ceiling should be stated openly as an accepted constraint.
3. **Is cross-school comparison ever in scope?** Yes requires pooling consent in
   the setup flow *before* the first school, and a controlled taxonomy now. No
   means the buyer's first question — "is 62 good?" — needs a different answer.
4. **Is a printable report a product deliverable?** If yes it is the highest-value
   thing not yet built. If no, `הורדת דוח` should be removed today, because a
   broken one is worse than none.
5. **Should respondents see anything after answering?**
6. **How long do answer rows live after a round closes?** Nothing in the schema
   or the docs answers this, and the consent screen makes no promise about it.
7. **Public repository with no licence — deliberate?**
