# Product Behaviour Backlog

Updated: 2026-08-14
Status: every numbered item below is closed except §12, which is open and
decided, and the two that wait on being requested — §8, a second manager per
school, and §11, repeat-measurement reminders. §12, the research instrument
replacing the default questionnaire, was decided on 2026-08-14 and supersedes
the answer-model entry under "Deliberate differences". §5's two open questions
were closed by owner decision on 2026-08-09,
both as "no"; see the item itself. Reconciled against the owner's
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

- **Answer model (§5.1). Superseded on 2026-08-14 — this is now a gap with a
  plan, and §12 below owns it.** The 2026-08-03 decision is preserved here
  because the reasoning still holds for everything it covered, and because the
  reversal is a product decision rather than a discovery that the old one was
  wrong.

  The document lists Likert scales, choice questions, open text fields and 100%
  distribution items. The product uses one three-colour scale
  (`green`/`yellow`/`red`, scored `100`/`60`/`0`). Owner decision 2026-08-03:
  this is the intended product simplification, not a gap. The scale carries the
  whole analytics pipeline — dimension scores, colour categories, per-question
  distributions and published contracts `1.0`–`6.0` — so the document is out of
  date on this point and no backlog item follows from it. Open text also carries
  a privacy cost the colour scale does not: free writing can identify its author
  inside a small staff room.

  What changed on 2026-08-14: the owner designated a specific research
  instrument as the default questionnaire, and it uses three of the four shapes
  §5.1 named — 1–5 and 1–7 Likert scales, single-choice demographic items, and
  two sum-to-100 distribution grids. Open text remains out, and the privacy
  argument above is why. The alignment with §5.1 is a consequence of that
  instrument, not the motivation for it.
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

### 1. Draft Persistence And Recovery (completed 2026-08-05)

Current state: setup and survey-builder edits persist through the Data Layer into the current organization/round. The 24 canonical questions are protected from disabling or reassignment.

Since 2026-08-04 both save surfaces say when the work last reached the database.
The setup screen and the builder show one shared `SaveStatus` line under their
save button: "נשמר בשעה HH:MM" after a completed write, and "יש שינויים שטרם
נשמרו" the moment the manager edits again — with the last save's time kept
beside it, because it is still a fact, just no longer the state of the screen.
The time comes from a `savedAt` the save endpoints report, not from the browser
clock, so it is evidence that a write completed rather than that a button was
pressed; a response without a usable time shows no time at all rather than
inventing one. The stale success note is gone with it: it used to sit there
claiming a save while the manager typed.

Since later the same day the answer outlives the tab. `survey_rounds.updated_at`
holds it, both save endpoints report that stored value, and both screens open
with it — so a reload no longer erases what the manager just saw. Because a
stored time can be days old, the line dates itself when it is not from today,
and it is formatted in the school's own time zone so the server and the browser
render the same words. A round last written before the column existed has no
honest value and shows none: `created_at` is when the row appeared, not when its
questionnaire was last edited.

Done 2026-08-05, and this closes the item: recovery now reaches past the latest
persisted definition. Every save that actually changes the questionnaire keeps
a copy of it in `survey_definition_versions`, and the builder lists those copies
newest first with the time each was saved and how many of its questions were
active. A version can be loaded back into the editor, which is where the manager
reviews it and presses save.

Four decisions shaped it, recorded as `PROJECT_CONTEXT.md` ADR-019:
- Restoring is an ordinary save, not a second write path. Loading a version only
  fills the editor; the existing `PUT` still validates it, still refuses to
  replace the questionnaire of a round that has answers, and still applies the
  activation rule. A restore is therefore itself a version, so going back is
  reversible and the edit that was undone stays in the history rather than being
  erased.
- A save that changes nothing records nothing. Pressing save twice on the same
  questionnaire would otherwise fill the list with entries that differ only by
  their timestamp; the comparison covers the questions and the copy the
  respondent reads, not just the question set.
- The history is capped at twenty versions per round. Old enough to be recovery,
  short enough that the table cannot grow without limit from a single busy
  afternoon.
- Resetting a round's data leaves the history alone. Reset clears answers and
  analysis; the questionnaire is what the manager wrote, not what respondents
  produced. The versions die with the round instead, through the cascade.

A version holds a questionnaire and nothing else. No answer, no count and no
respondent trace reaches the table.

Why it matters:
- Principals will expect setup and survey edits to survive accidental refreshes.
- A bulk edit — hiding twelve questions in one click — is exactly the mistake
  that a last-saved timestamp cannot undo.
- Demo reviewers need clarity about whether "save" is a product promise or a prototype signal.

### 2. Save, Copy, And Clipboard Failure States (completed 2026-08-04)

Current state: a copy attempt has three outcomes and the screen distinguishes
them. Success says so and fades; a refusal — no clipboard API, a denied
permission, an embedded webview that blocks it — says the browser blocked the
copy, names Ctrl+C/Cmd+C, and stays until the next attempt, because it asks the
manager to do something. The link is selected in its field at that moment, so
the manual copy is one keystroke.

Both copy surfaces, the round-tracking screen and the survey builder, share one
`CopyLinkStatus` component, so the two cannot drift apart. The link is the
anonymous share URL; nothing about a respondent is involved.

Remaining:
- A "last saved" timestamp is still §1's, not this item's.

Why it matters:
- Mobile browsers and embedded browsers often block clipboard access.
- A false success state can make the distribution flow feel unreliable.

### 3. Survey Builder Efficiency (completed 2026-08-04)

Current state: the builder supports filtering by dimension, toggling
required/enabled state, duplicating questions, full eight-dimension template
suggestions and AI suggestions. Suggested text is source-labelled, opens in the
editor and cannot join the questionnaire until the manager changes it.

Since 2026-08-04 the list also has search, bulk enable/hide and real reordering.
Search reads the question text, the dimension label and the stable question id,
so "איזון" finds the dimension's questions as well as the word. The bulk buttons
act on whatever the dimension tab and the search leave on screen — not on a
dimension — so what they change is what the manager can see, and the button says
how many that is.

The order badge used to carry a drag-handle icon that did nothing. It is now two
buttons that move the question one place up or down, which reorders for real and
works from the keyboard. A move is measured in the current view: with a filter
on, a question swaps with the one above it on screen and nothing outside the
view moves.

Since 2026-08-04 the per-question actions also have accelerators, which is speed
rather than access: every one of them was already a native button reachable by
Tab. Inside the question the caret is in — no "selected question" concept, the
card being read is the card that answers — `Alt+↑`/`Alt+↓` move it, `Alt+E`
opens the editor, `Alt+D` duplicates, `Alt+H` hides or restores, `Alt+R`
switches required. Screen-wide, `/` reaches the search field and `Ctrl`/`Cmd+S`
saves.

Three rules decided the set. Deleting a question has no chord and stays a
deliberate button press with its confirmation. The chords are read from the
physical key (`event.code`), because on a Hebrew layout the character for the D
key is `ג` and a character-matched shortcut would work only for managers typing
English; a keyboard that reports no physical key falls back to the character and
simply has no accelerator for Hebrew letters, rather than a wrong one. And the
move is on the arrow keys because up and down mean the same thing in RTL as in
LTR, while a left/right chord would have to reverse with direction.

The chords are listed above the question list and repeated in each button's
tooltip and `aria-keyshortcuts`: a shortcut nobody can see is folklore.

Remaining:
- Nothing here. Bulk actions and the dimension tabs have no chords, which looks
  deliberate rather than missing: both are one click from the top of the list.

Why it matters:
- A real 24-question instrument is small but still benefits from fast review and batch editing.
- Visible drag handles imply a behaviour that is not fully implemented yet.

### 4. Dashboard Map Accessibility (completed 2026-08-04)

Current state: desktop stones can be dragged and moved with the arrow keys —
one step per press, a large step with Shift, and never past the edge of the
stage. Mobile stays tap-first; the arrows are ignored below the drag breakpoint,
where there is nothing to rearrange. The map hint says so in Hebrew.

Pressing reset removes the control that has focus, so focus moves to the map
itself and a `role="status"` line announces that the stones went back. The stage
takes focus only when it is given, never on the way through.

The stone's own motion — pointer or keyboard — is instant under
`prefers-reduced-motion`, as is the reset button's hover lift. Colour and shadow
transitions stay: they are not motion. A rearranged map already persists in
`localStorage`.

Remaining:
- No announcement per nudge. A stone that moves sixteen pixels does not warrant
  interrupting a screen reader on every keypress; if rearranging becomes
  meaningful rather than cosmetic, a position summary on blur would be the way.
- Screen-reader output has not been heard, only the markup verified.

Why it matters:
- The map is a core interaction, so keyboard and reduced-motion support should match its importance.
- If rearranging stones is meaningful, users will expect their arrangement to persist.

### 5. Dashboard Action Follow-Through (minimal version done 2026-08-04)

Current state: detail pages lead from summary to highlighted metrics to
recommendations, and the recommendations screen now carries the decision as well
as the advice.

Owner decision 2026-08-04: recommendations can become tracked goals, in the
smallest form that makes the word "tracked" true. A panel under the stage lists
every current recommendation of the dimension with one action — track it — and a
tracked row gains three states, `נבחר → בתהליך → הושלם`, and a way to stop
tracking. There is no owner, no due date and no plan of steps: a school that has
never tracked a goal should not have to fill a form to try one.

A goal stores the recommendation's title and body as they read at the moment of
the decision rather than pointing at the analysis, because the next run rewrites
its recommendations wholesale. A goal the current analysis no longer recommends
therefore stays on the screen and says where it came from. One recommendation is
one goal, enforced by a unique key on `(round_id, dimension_id, title)` — the
title is the only identity the AI payload gives a recommendation. Dropping a
goal deletes it rather than adding a fourth state, and the recommendation
becomes choosable again. `PROJECT_CONTEXT.md` ADR-015 records the reasoning.

Goals name a dimension and repeat copy that already cleared the privacy gate;
nothing about a respondent reaches them.

Done 2026-08-05: a school reads its goals in one place. `מעקב יעדים` (`/goals`)
lists every goal of every round the school has run — open ones first, finished
ones after — each naming its dimension, the round it was chosen in, and whether
that round is archived. The dimension links back to the recommendations of that
round rather than of whichever round the manager last looked at.

This became a gap rather than a convenience when the archive turned read-only.
An archived round's goals are deliberately still editable — finishing what a
measurement started is the school's work, not part of the measurement — and that
exception needed somewhere to happen: the round it belongs to now sits behind a
disclosure.

The status is written through the same per-round endpoint the dimension screen
uses, so a goal has one write path and the screens cannot tell two stories about
what a status change means. The repository read takes round ids rather than an
organization id, keeping the rule that a goal is never reachable without naming
its round.

Remaining: nothing. Both questions this item held open were answered on
2026-08-09, and both answers are "no".

Owner decision 2026-08-09 — **a goal gains no owner, no due date and no plan of
steps.** The three-state goal stays the whole of it. Adding the fields would
turn this into task management, which is a different product from measurement;
a school that already tracks tasks elsewhere would get a second, worse tracker,
and the form would land on exactly the manager who is trying one goal for the
first time. Fields can be added later if real use asks for them; a form managers
have grown used to cannot be taken away. Revisit only on evidence from real
schools, not on principle.

Owner decision 2026-08-09 — **no number is shown beside a goal.** The delta of a
dimension is not the result of the goal: many things move a dimension and the
goal is one of them, so placing "+7%" next to a goal would assert a causal link
the data cannot support. The product already refuses that claim in AI copy
(2026-08-05, `no_overreach`); making it through layout instead would be the same
overreach by another route. If a number is ever wanted here, it has to read as
context for the dimension and say so — never as the goal's outcome.

Do not reopen either question as unfinished work. They are closed decisions.

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

Done 2026-08-05, and this closes the item. Both halves of the proposal held
already — stone geometry and labels live in
`src/lib/dashboard/dimension-presentation.ts`, and no view component carries a
score threshold; the bands come from `contracts/scoring-bands.json` through one
shared module. What did not hold was where the fixtures sat.

`DEMO_ORGANIZATION` and `DEMO_ROUND` — a school with an active round and the
share code `SHALOM-DEMO` — were exported from `src/lib/repositories/index.ts`,
the barrel every route handler imports its adapters from. Only tests used them,
but nothing held that line: a ready-made school was one import away from any
runtime module, which is the exact shape this item warns about. They moved to
`src/lib/repositories/__fixtures__/demo-records.ts`.

The rule is now enforced rather than promised. `npm run lint:fixtures`
(`scripts/check-runtime-fixtures.mjs`, part of `verify:core` and therefore of
CI) fails in both directions: when a non-test module imports anything under
`__fixtures__`, including through a dynamic import, and when the repository
barrel starts defining a `DEMO_` constant again. Both failures were provoked
deliberately before the check was trusted.

The last word "mock" left the product code with it: the CSS class
`dashboard-mock-page`, carried by four screens that render PostgreSQL, is now
`dashboard-page`.

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

Owner decision 2026-08-10: **enforcing password strength in code also waits for
this trigger.** It was written and then withdrawn before it was pushed — a
deployed runtime would have answered `503 UNCONFIGURED` on a password under
sixteen characters, with fewer than eight distinct ones, or on a well-known
value, logging the rule to the server and nothing to the caller. It was
verified locally, both directions, over HTTP against a production build. The
reason for withdrawing it is that it solves a problem the current shape does not
have: with one operator who sets the variable once, the requirement is one
person's habit, and a rule that can lock that person out of their own
deployment costs more than it protects. With more than one manager, passwords
start being chosen by people who never read `.env.example`, and enforcement
starts earning its keep. Until then the requirement stays advisory, stated in
`.env.example` beside the variable and as a pre-pilot gate in
`docs/shalomut-tracker-handoff.md`.

Proposal, when a second manager is actually requested:
- Persist `Manager`, `OrganizationMembership` and audit events, or delegate
  authentication to an identity provider and keep membership in Core either way.
- Store a real credential with a memory-hard KDF, or store none at all under an
  identity provider.
- Enforce credential strength at the point a password is set, which is where it
  belongs once there is such a point — a rule at sign-in time is a blunt
  substitute for one at registration time, and it exists only because today the
  password arrives as an environment variable.
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
- Not wanted yet: AI analysis across rounds. Owner decision 2026-08-04 — the
  narrative stays per round, and the comparison stays the deterministic
  dimension delta Core computes. Question-level comparison waits with it. This
  is what `PROGRESS.md` used to call comparative multi-round analytics; it is a
  deliberate hold, not an open task.
Done 2026-08-05: the archive became a real place. Owner decision, recorded as
`PROJECT_CONTEXT.md` ADR-018 — archiving a round means taking it out of the
everyday list and nothing else, so the round keeps its URL, its dashboard, its
analysis and its place in the comparison history.

Three parts, and they only make sense together:
- The round screen offers `העברה לארכיון`, and only for a round that has stopped
  running. A live round leaving the list would take its share link with it, so a
  running round is closed first. It confirms before acting, because `archived`
  has no transition out.
- The switcher lists the rounds without the archived ones.
- The archived ones sit behind `הצגת הארכיון (N)`, a `details` disclosure that
  opens without JavaScript, so an old semester is always two clicks away rather
  than a URL a manager had to keep. An archived round the manager is actually
  looking at stays in the everyday list, marked `בארכיון`, because a switcher
  naming every round except the current one would be lying about where they are.

Done 2026-08-05, and this closes the item: the archive is read-only. Owner
decision, recorded as an amendment to ADR-018.

The separate decision this section used to name turned out to rest on a leak
rather than on a preference. `archived` was terminal in `RoundService`, but
reset wrote `draft` straight through the repository without consulting that
table — so resetting an archived round returned it to the everyday list as a
draft, out of a state that has no way out. Refreshing the analysis had no status
check at all, and would rewrite the narrative of a filed round while a later
round's comparison went on naming it.

Three writes now answer `409` with `code: round_archived`: reset, the manual
analysis run and the questionnaire save. The screen stops offering them, and an
archived round's questionnaire opens frozen the way a round with answers does —
which is why the questionnaire is included even though answers already froze
its questions: a draft can be archived without ever taking an answer.

The goals are deliberately exempt. They are the school's work rather than part
of the measurement, so a recommendation chosen last spring can still be marked
done this autumn. Freezing them would mean a school either never files a round
or gives up finishing what the round started.

Done 2026-08-04: the single-active-round rule is durable in the database. The
partial unique index `survey_rounds_one_active_per_organization` on
`(organization_id) where status = 'active'` refuses a second active round, so
the rule no longer rests on `RoundService` alone. The service now closes the
previous round *before* the next one goes live — the other order would be
refused by the index, and this one fails in the safer direction: a lost write
leaves a school with no running round rather than two. Only `active` is
constrained; drafts, closed and archived rounds are the history a second round
extends, so a school may hold any number of them.

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

### 12. The Default Questionnaire Becomes A Research Instrument (open, decided 2026-08-14)

Owner decision 2026-08-14: the 24-statement default template is replaced by a
126-item research instrument held in the owner's Google Docs — 16 demographic
items, 2 sum-to-100 allocation grids and 108 Likert statements across 13 blocks
on two scale lengths. This reverses the "Deliberate differences" entry above on
the answer model and closes the answer-scale question the 2026-08-10 strategy
sweep left open.

Current state: nothing is implemented. `src/lib/shalomut-source.ts` holds the
24 questions and one three-colour scale, and `SurveyDefinitionQuestion` has no
representation for a scale length, an answer polarity, an option set or an item
that scores nothing.

The plan is `docs/default-research-instrument-plan-2026-08-14.md` and is not
restated here. What belongs in this backlog is the shape of the behaviour
change:

- A respondent answers on 1–5 and 1–7 scales instead of three colour stones, in
  blocks rather than one question per screen.
- A respondent answers demographic questions the product has never asked, and
  the manager can read results broken down by group, with cells below the
  threshold suppressed.
- A manager's builder edits answer types, option sets and sections rather than
  a flat list with a free-text answer label.

Why it matters:
- The three-colour scale is load-bearing in the analytics pipeline and in every
  published contract, so this is a data-model change that happens to look like
  new content. Treating it as content is how it becomes a silent regression in
  how rounds are scored.
- Two settled decisions constrain it: the eight dimensions stay, and cross-tabs
  are allowed with suppression rather than forbidden.

Open, and gating: the methodologist's table mapping each of the 108 Likert items
to one of the eight dimensions, plus which items are reverse-scored. Four more
open questions are in the plan's §7.
