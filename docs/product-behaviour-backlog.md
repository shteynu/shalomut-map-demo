# Product Behaviour Backlog

Updated: 2026-08-03
Status: remaining product behavior after persisted rounds, AI suggestions and
the lifecycle-aware privacy flow landed, reconciled against the owner's
development requirements document ("פיתוח פלטפורמת מפת שלומות — MVP + הכנה
לשלב הבא", Google Docs)

## Completed In This Pass

- Centralized navigation and route/action metadata in `src/lib/navigation.ts`.
- Removed duplicated workflow navigation from setup and round next-step bands.
- Kept global navigation as the persistent route switcher and kept local CTAs only where they represent the next workflow action.

## Alignment With The Development Requirements Document

Reviewed on 2026-08-03 against the requirements document section by section.
This section records where the shipped product deliberately differs from that
document, so the difference stays visible instead of looking like an oversight.
Sections of the document with no entry here are either already delivered or
tracked as numbered items below.

### Already delivered

- §5.1 respondent experience: mobile-first Hebrew RTL flow, progress bar,
  autosaved draft that survives a reload of the same tab, and an explicit
  consent screen before the first question.
- §5.2 rounds: organization and round records, start and end dates, share code
  distribution, numeric-only response counts and a manual round-close action.
- §5.3 organizational background: staff count on the organization plus the
  round background context (sickness days, new staff, student count,
  socio-economic index, classes per grade and a free-text note).
- §5.5 dashboard: the stone map with per-dimension colour, an organizational
  summary, verbal interpretation and highlighted metrics behind each stone, and
  recommendations per dimension.
- §6.1 privacy: no personal identifiers are stored, no screen can show who
  answered, and detailed results stay locked below the response threshold.
- §8.2 intervention recommendations, partially and earlier than the document
  expected: contract `6.0` already returns five recommendations per stone.
  Whether they become tracked goals is item 5 below.

### Deliberate differences

- **Answer model (§5.1).** The document lists Likert scales, choice questions,
  open text fields and 100% distribution items. The product uses one
  three-colour scale (`green`/`yellow`/`red`, scored `100`/`60`/`0`). Owner
  decision 2026-08-03: this is the intended product simplification, not a gap.
  The scale carries the whole analytics pipeline — dimension scores, colour
  categories, per-question distributions and published contracts `1.0`–`6.0` —
  so the document is out of date on this point and no backlog item follows from
  it. Open text also carries a privacy cost the colour scale does not: free
  writing can identify its author inside a small staff room.
- **Roles (§3.1, §3.4, §5.6, §7.7).** The document places Owner/Admin and
  read-only Viewer access inside MVP scope. Owner decision 2026-08-03: one
  manager per deployment is the requested shape, so viewer and admin roles are
  deferred. Item 8 below owns the trigger and the work required when a second
  user is actually requested.
- **Privacy threshold (§6.1).** The document suggests a configurable minimum of
  roughly 5–10 respondents. The product enforces ten as both the default and
  the floor; a manager can only raise it. Owner decision 2026-08-03: keep the
  floor at ten. This is a deliberate tightening of the document, not a
  configuration gap.
- **Environments (§6.3).** Staging/production separation is infrastructure, not
  product behavior. It stays out of this backlog; `AGENTS.md` and
  `docs/shalomut-tracker-handoff.md` own the current environment shape.

## Remaining Product Behaviour Work

### 1. Draft Persistence And Recovery

Current state: setup and survey-builder edits persist through the Data Layer into the current organization/round. The 24 canonical questions are protected from disabling or reassignment.

Remaining proposal:
- Add a visible "last saved" timestamp after save actions.
- Add explicit draft/version history if editors need recovery beyond the latest persisted definition.

Why it matters:
- Principals will expect setup and survey edits to survive accidental refreshes.
- Demo reviewers need clarity about whether "save" is a product promise or a prototype signal.

### 2. Save, Copy, And Clipboard Failure States

Current state: copy actions show success even if clipboard writing fails.

Proposal:
- Track copy success and failure separately.
- Show fallback instructions when clipboard access is blocked.
- Keep Hebrew, privacy-first copy and avoid exposing respondent identity.

Why it matters:
- Mobile browsers and embedded browsers often block clipboard access.
- A false success state can make the distribution flow feel unreliable.

### 3. Survey Builder Efficiency

Current state: the builder supports filtering by dimension, toggling
required/enabled state, duplicating questions, full eight-dimension template
suggestions and AI suggestions. Suggested text is source-labelled, opens in the
editor and cannot join the questionnaire until the manager changes it.

Proposal:
- Add search across question text and dimension labels.
- Add bulk controls for enabling/disabling questions by dimension.
- Add explicit reorder support or avoid implying that reorder already works.
- Add keyboard-friendly edit actions for common builder operations.

Why it matters:
- A real 24-question instrument is small but still benefits from fast review and batch editing.
- Visible drag handles imply a behaviour that is not fully implemented yet.

### 4. Dashboard Map Accessibility

Current state: desktop stones can be dragged, mobile stones are tap-first, and
the conditional reset control is a native keyboard-focusable button. Several
map transitions already honor `prefers-reduced-motion`.

Proposal:
- Add keyboard nudge controls for selected stones on desktop.
- Verify focus/announcement behavior after pointer movement and reset.
- Audit drag and hover transitions so every relevant motion path honors
  `prefers-reduced-motion`.
- Consider saving customized map positions per session if rearrangement becomes a product feature.

Why it matters:
- The map is a core interaction, so keyboard and reduced-motion support should match its importance.
- If rearranging stones is meaningful, users will expect their arrangement to persist.

### 5. Dashboard Action Follow-Through

Current state: detail pages lead from summary to highlighted metrics to recommendations, with a back-to-map action.

Proposal:
- Define whether recommendations are only read-only guidance or can become tracked goals.
- If tracked goals are desired, add a goal selection state and a lightweight action plan surface.
- Keep results aggregated and never expose per-person data.

Why it matters:
- The product principle is "from picture to action"; tracked goals are the likely next step beyond visual diagnosis.

### 6. Privacy Threshold States Across Routes (completed 2026-08-02)

Current state: manager context exposes one persisted threshold/count model;
home, round, dashboard and dimension routes use it, and detailed analytics stay
locked below threshold. The round screen now explains the next step before the
threshold and distinguishes the persisted analysis lifecycle after it:
checking, queued/running, ready, question-level privacy lock, missing result and
failure. Ready and running states lead to the map; missing and failed states
lead to the existing analysis refresh action without exposing raw service
errors.

Why it matters:
- Privacy is a primary product promise.
- A consistent threshold model makes the system easier to trust.

### 7. Demo Data Boundaries

Current state: methodology source and visual metadata are separated from
runtime records. Manager routes use persisted organization/current-round data,
explicit empty onboarding states, real share codes and real round IDs. Demo
records are not a production fallback.

Remaining proposal:
- Keep only stone geometry and other non-record visual metadata in the mock
  layer.
- Keep scoring thresholds configurable and avoid hard-coding status assumptions in view components.

Why it matters:
- A zeroed mock screen can look correct while still not reflecting PostgreSQL.
- Runtime data provenance must be unambiguous for school leaders to trust the
  product.

### 8. More Than One Manager Per School (not requested yet)

Current state: one manager signs in per deployment. The account is not a
database record — it is built in `src/lib/auth/manager-auth-service.ts` from
`MANAGER_ADMIN_PASSWORD`, and `MANAGER_ORGANIZATION_ID` binds the session to a
single organization. Roles, memberships, permissions and an audit-log interface
already exist as types and in-memory services; nothing persists them.

Owner decision 2026-08-03: a second manager is not a requirement today, so this
stays a future feature rather than an open architecture task. Recorded here so
the trigger is explicit rather than assumed.

Proposal, when a second manager is actually requested:
- Persist `Manager`, `OrganizationMembership` and audit events, or delegate
  authentication to an identity provider and keep membership in Core either way.
- Store a real credential with a memory-hard KDF, or store none at all under an
  identity provider.
- Add invitation, revocation and password recovery, each with Hebrew RTL
  screens, or accept the provider's hosted screens only after checking their RTL
  behaviour by hand.

Why it matters:
- Every part of this is a data model and a set of flows, not a configuration
  change; treating it as one would surface late.
- Building invitation and recovery flows before a second manager exists means
  maintaining Hebrew screens nobody opens.
- The single-account shape has real limits worth naming while it lasts: the
  deployment secret is the credential, rotation means a redeploy, and per-user
  revocation and a meaningful "who signed in" audit trail do not exist.

### 9. Configurable Scoring Thresholds (completed 2026-08-03)

Requirements document §5.4: the scoring mechanism must be tunable after the
pilot through configuration rather than code, so thresholds and mappings can
move without taking the system apart.

Current state: `contracts/scoring-bands.json` is the single source of the
green/yellow/red bands. Core reads it through `src/lib/scoring-bands.ts` and the
AI analytics service through `src/schemas/scoring_bands.py`; dimension scoring,
the methodology table, Core's payload validation, the service's input parsing
and its outgoing-payload validation all resolve to that one definition. The
loader refuses a manifest whose bands are out of order, non-integer, inverted,
overlapping, gapped or short of either end of the 0-100 scale, so a bad edit
fails at import rather than colouring a stone wrongly. Tuning after the pilot is
an edit to that file plus a deploy of both services.

The five code copies this replaced were spread across both runtimes, and the
cross-runtime corpus was the only thing that would have noticed one drifting.

Owner decision 2026-08-03: the bands are deployment-wide, not per round. The
service validates that a payload's status matches its score, so per-round bands
would have to travel inside the payload — new semantics for contracts
`1.0`–`6.0`, requiring a version of its own and a consumer-first rollout. The
requirements document asks for configuration rather than hard-coding, which
deployment-wide bands satisfy.

Not part of this: the per-question distribution counts what respondents picked,
which is their own answer colour rather than an aggregate, so it deliberately
does not consult these bands. That path now says so in
`src/lib/services/analytics.service.ts` instead of repeating the numbers.

### 10. Dashboard Per Round And Round History (reading, creation and map comparison done 2026-08-04)

Requirements document §5.5 and §8.1: the dashboard should be viewable per
measurement round, and a new round for the same organization must keep history.

Current state: the dashboard reads whichever round the URL names. The manager
context resolves a requested round inside the manager's own organization,
offers the school's rounds in reading order, and every dashboard link carries
the selected round so a detail screen stays on it. Each round is read through
its own questionnaire snapshot, its own privacy threshold and its own stored
analysis, so an older round below its threshold stays locked on its own terms.
A round id that does not belong to the school reads as unknown and says so
rather than showing another round's numbers under the requested one.

A school can now open a second round. `/setup?round=new` prefills the school's
own details and empties the round fields, so the manager describes the new
measurement period without re-entering the school. The round is created as a
draft with no questionnaire, and the builder link that follows names it, so the
manager edits the new questionnaire rather than the running one. It goes live
only once its questionnaire covers all eight dimensions — and going live closes
whichever round the school was running, because a school runs one round at a
time (owner decision 2026-08-03, recorded as ADR-014). The builder names the
round that stopped running rather than leaving the school to notice it on the
dashboard.

The home screen deliberately stays on the active round: it answers "what is
this school doing now", which is not the same question as "what did we measure
last spring". Owner decision 2026-08-03.

The map carries the comparison rather than a second screen. Each stone shows
the change against the round the school measured before this one, and the
sidebar states the overall change and names the round it compared with. The
comparison is per dimension because the eight dimensions are what stays stable
across rounds while each round keeps its own questionnaire snapshot. A round
below its privacy threshold is skipped rather than compared: it has no numbers,
and a delta against it would hand back the very scores the gate is withholding.

Remaining:
- Question-level and narrative comparison. Today the delta is per dimension and
  deterministic; the AI analysis still reads one round at a time. This is what
  `PROGRESS.md` calls comparative multi-round analytics.
- Decide whether archived rounds belong in the switcher; today they are listed
  last rather than hidden.
- Make the single-active-round rule durable in the schema — a partial unique
  index on `(organization_id) where status = 'active'`. Today it is upheld by
  `RoundService` alone.

Why it matters:
- Repeat measurement is the product's stated second act; without history the
  second round replaces the first instead of extending it.
- A principal comparing semesters is the first real test of whether the map
  drives action.

### 11. Repeat-Measurement Reminders (future)

Requirements document §8.1: automatic reminders for the next measurement in
6–12 months, explicitly named as architectural preparation rather than MVP
work.

Current state: nothing schedules or notifies. There is no respondent or manager
contact channel at all, which is consistent with storing no personal
identifiers.

Proposal, when this is actually requested:
- Decide who is reminded. Reminding respondents would require contact data the
  privacy model deliberately does not hold; reminding the manager does not.
- Keep the trigger derivable from round records — the closing date of the last
  round plus an interval — rather than a new scheduling entity.

Why it matters:
- Naming the manager as the only reachable party keeps a future reminder
  feature from quietly introducing respondent contact details.
