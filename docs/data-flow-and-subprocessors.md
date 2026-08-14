# Where a teacher's answer goes, and who else touches it

Living document. Written 2026-08-10, from the repository and from the deployed
configuration — not from a vendor questionnaire and not from legal advice.

Every other legal artifact this product will eventually need — a privacy notice,
terms, a processing agreement with a school, a retention schedule, an incident
plan — is a statement about the list below. That is why this file exists before
any of them: none of those documents can be written honestly while the answer to
"who receives this data, and where" lives only in four dashboards.

The five sentences on the consent screen
(`src/components/survey/survey-consent-step.tsx`) are the short form of this
file. If something here changes, that screen is the first thing to correct.

## The parties

| Party | Role | What it receives | Where |
| --- | --- | --- | --- |
| Vercel | hosts Core, terminates every browser request | every request a respondent or a manager makes, including the request bodies carrying answers; client IP addresses in its own infrastructure logs | no `vercel.json` exists, so Core serves from Vercel's default region — not chosen, not verified in the dashboard by any agent |
| Supabase | the PostgreSQL database | organizations, rounds, questionnaires, responses, answers, funnel sessions, AI results | `aws-1-ap-northeast-2` — Seoul, read off the connection host |
| Render | hosts the AI analytics service | the analytics payload described below; no respondent-level row ever | `frankfurt`, pinned in `render.yaml` |
| Google | the language model behind the analysis | whatever the AI service sends it as a prompt | `generativelanguage.googleapis.com`; region not selected by this project |

Israel, where the school and the teachers are, is not in that column. Four
parties, at least three jurisdictions, none of them the respondent's.

## What crosses each boundary

**Browser → Core (Vercel).** A submission carries the answers and one
`anonymousTokenHash`: a hash of a token the browser generated for that filling
session, which exists so a reload cannot count twice. It is not derived from
anything about the person. The funnel beacons
(`POST /api/survey/{shareCode}/attempt`) carry the same hash and a question
index. No name, address, e-mail or device identifier is read anywhere in `src/`,
and no analytics or tag-manager package is installed.

What Core does not control is that the request itself arrives at a hosting edge,
and hosting edges log client addresses. That log is not this product's storage
and never reaches a manager's screen, but it exists, it is Vercel's, and it is
the reason the consent screen describes the address instead of denying it.

**Core → Supabase.** A `SurveyResponse` row holds `roundId`, the token hash and
`submittedAt`; the answers hang off it. A `SurveyAttempt` row holds the same
hash plus timestamps and the furthest question reached. The identifying columns
a survey product usually has are not absent by policy — they are absent from the
schema.

**Core → the AI service (Render) → Google.** Only aggregates cross:
`encodeAnalyticsInput` in `src/lib/analytics-encoder.ts` sends dimension scores,
per-question averages and counts, the questionnaire's own question texts, and —
on contract versions that carry it and only for an unlocked round — the school
background context the manager typed. No response row, no answer row and no
token hash is in that payload. A locked round sends nothing at all, because the
provider is not called for one.

The manager-authored `backgroundContext.notes` is free text about the school
that reaches the model prompt. Respondents are told the model receives
question-level averages; they are not told what a manager may have written about
their school, because the product cannot know what that says.

## What the browser is told

Since 2026-08-10 every response carries security headers, set in
`next.config.ts` — there is no `vercel.json`. `frame-ancestors 'none'` and
`X-Frame-Options: DENY` are the load-bearing pair: the manager screens close
rounds and reset analyses in one click, and without them any page could frame
those buttons under its own. Alongside them: `default-src 'self'` with no
foreign origin, `form-action 'self'` so a stolen session cannot be posted
elsewhere, `base-uri 'self'`, `object-src 'none'`, `nosniff`,
`strict-origin-when-cross-origin` (which keeps a round's share code out of the
`Referer` of anything a respondent clicks through to), a `Permissions-Policy`
that switches camera, microphone, geolocation, payment and USB off, and HSTS
for two years without `preload`.

Two honest limits. The policy allows `'unsafe-inline'` for scripts, because
Next serves its RSC payload as inline script tags and the alternative — a
per-request nonce — makes every page dynamic, including the statically
rendered `/login`; so the policy stops a foreign script, not an injected one,
which is a thin risk in a product that renders no user-authored HTML.
And `/api-docs` has its own header allowing `unpkg.com`, because that screen
loads Swagger UI from the CDN at runtime; the exception covers that route
only, and `e2e/security-headers.spec.ts` fails if it leaks into the policy the
manager screens get.

## Demographics

Owner decision 2026-08-14 replaces the 24-question default with a 126-item
research questionnaire that asks 16 background questions — age band, gender,
marital status, children, education, role, managerial role, two tenure bands,
FTE, hours, commute, salary band, school type, work mode. In a staffroom of
30–60 those combine into a re-identification set well before any one of them
does alone, and the response threshold described above protects a *total*, not
a *cell*. "Teachers aged 51–60 in the special-needs track" can be one person
inside a round of eighty.

The owner chose full cross-tabulation with cell suppression. Since 2026-08-14
that mechanism exists, in `src/lib/privacy/cell-suppression.ts`:

- No cell below the round's threshold is published.
- No suppressed cell can be recovered from what is published. Every line the
  table publishes — each row against its total, each column against its total,
  and both margins against the grand total — holds either no suppressed entry
  or at least two, so a blank is never "the total minus everything else". This
  is the part that is invisible in a rendered table and easy to get wrong, and
  it is tested by enumerating the tables a reader could still be looking at.
- A round below its threshold publishes no cell and no margin at all.
- The grand total stays published, because it is the round's response count and
  every manager screen already shows it. Hiding it here would be a fiction.

**Background answers do not reach the AI service or Google.** They are
aggregated, suppressed and displayed inside Core and nowhere else. Nothing in
an insight needs a salary band, and sending one would make a subprocessor hold
a demographic profile of a named school for no gain.
`AnalyticsService` builds no aggregate for a background question, so there is
nothing for `encodeAnalyticsInput` to encode;
`src/lib/privacy/__tests__/background-answers-stay-in-core.test.ts` pins it by
searching the serialised MCP payload for the demographic ids and their Hebrew
text.

The three columns a demographic answer occupies are the same ones an analytic
answer does — `question_answers` with a null `dimension_id` and a null `score`.
Nothing new about a person is stored; what is new is that two stored answers
can be crossed, which is what the rule above governs.

## The one place an address is counted

Since 2026-08-10 sign-in attempts and survey submissions are rate limited per
client address, and that is the only feature in the product that treats an
address as anything at all. It is worth being exact, because the consent screen
makes a promise about this.

The address is never stored. What is stored is a salted SHA-256 of
`policy:address:secret`, truncated, with a counter behind it and a five-minute
expiry — so the record is "something was counted here recently", not "who".
An unsalted hash would be no protection at all, since the whole IPv4 space can
be hashed in minutes; the salt (`RATE_LIMIT_KEY_SALT`, or `SESSION_SECRET`)
makes the key meaningless outside this deployment. The counter is never joined
to a response, and nothing reads it back except the limiter.

Where it lives depends on configuration. With no Upstash credentials it is a
map in the running instance's memory, gone when that instance is recycled.
With `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set it is a key in
Upstash Redis — **a fourth processor**, holding those hashes and nothing else,
and it belongs in any subprocessor list from the moment it is switched on. It
is not switched on today.

## What is not covered here

- **Where the demographic items will be displayed.** The rule that governs
  them is decided and built — see *Demographics* below — but no screen shows a
  cross-tab yet, and no round collects one. When one does, this file gains the
  reader-facing half: which tables a manager can open and what a suppressed
  cell looks like on screen.
- **Retention.** There is none. No schema column expresses it, and deletion
  exists only as `onDelete: Cascade` from an organization or a round. Nothing
  expires on its own.
- **A deletion route for a respondent.** There cannot be one that means
  anything: the product deliberately holds nothing that identifies a person, so
  it cannot find "their" answer to remove. That is a consequence of the design,
  not an oversight, and any privacy notice has to say it plainly rather than
  offer a right it cannot exercise.
- **Regional choice.** Nobody chose Seoul. It is where the database happened to
  be created, and it is recorded as axis 11 of
  `docs/product-strategy-axes-2026-08-10.md`, unresolved.
- **The legal questions.** Whether the Chief Scientist directive permits a
  single school to survey its own staff, and what Amendment 13 requires of this
  data, are for a human to confirm. This file only says what the system does.

## What to check when this file is edited

1. `src/components/survey/survey-consent-step.tsx` — five promises, one of which
   describes the IP address and one the third-party model.
2. `src/components/survey/__tests__/consent-promises.test.tsx` — refuses a
   promise that outruns the deployment.
3. `src/lib/analytics-encoder.ts` — the only place that decides what leaves for
   the model.
4. `next.config.ts` and `e2e/security-headers.spec.ts` — the headers above and
   the test that keeps them from quietly disappearing.
5. `src/lib/server/rate-limit.ts` — the only code that touches a client
   address, and the only thing that would add a fourth processor.
