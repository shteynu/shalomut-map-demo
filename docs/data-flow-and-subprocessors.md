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

## What is not covered here

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
