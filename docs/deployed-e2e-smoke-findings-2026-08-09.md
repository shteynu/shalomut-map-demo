# Deployed end-to-end smoke, 2026-08-09 — findings

What this is: the defects found while walking the deployed endpoint end to end
in the owner's signed-in Chrome — creating a school, opening rounds inside it,
generating questionnaires, answering them and reading the analysis. The full
plan, the evidence for what works, and the exact data created are in
`docs/agent-tasks/active/test--deployed-e2e-smoke-2026-08-09.md`.

Nothing here is fixed. Each item names the code that produces it.

## 1. A new draft round is announced as a previous round, and loses its controls

**Severity: high — it tells the manager the opposite of what happened.**

Open a new round in a school that already has one. The round is created as a
draft, correctly, and the previous round keeps running until the new
questionnaire covers eight dimensions. But the moment the manager selects that
new round on `/round`, the screen says:

> זהו סבב קודם. בית הספר עבר לסבב חדש יותר, ולכן הסבב הזה פתוח לקריאה בלבד…

The round is not previous. It is the one the manager just opened, and the school
has not moved past it. The same flag hides `רענון ניתוח` and `איפוס נתונים`,
so the round the manager is supposed to be preparing is the one they cannot act
on.

Reproduced twice: `סבב בדיקה E2E 2` in school `טסט`, and `סבב שני E2E` in the
newly created school.

Cause: `isSelectedRoundCurrent` treats "not the first round in the manager's
order" as superseded, and that order puts `active` before `draft`:

- `src/lib/services/manager-context.service.ts:41` — `roundStatusPriority`
  (`active: 0, draft: 1, closed: 2, archived: 3`)
- `src/lib/services/manager-context.service.ts:81` — `isSelectedRoundCurrent`
- `src/app/round/page.tsx:90` — `isSuperseded={!isSelectedRoundCurrent(context)}`
- `src/components/round/round-controls.tsx:55` — `readOnly = archived || isSuperseded`

Suggested fix: a round is superseded when the school has moved *past* it, which
a draft never is. Compute it from the round's own status — `closed` or
`archived` and not the current round — rather than from its position in a list
that sorts drafts behind the active round. A draft should read as "not
distributed yet", with its own copy.

## 2. `?round=new` leaks into the global navigation and claims the round was deleted

**Severity: high — reachable by clicking the ordinary menu, and the message is
frightening and false.**

`/setup?round=new` is the new-round form. While it is open, the header renders
every link with the parameter carried over: `/?round=new`,
`/survey/?round=new`, `/round/?round=new`, `/dashboard/?round=new`. Clicking any
of them shows:

> הסבב המבוקש לא נמצא — הקישור מפנה לסבב אבחון שאינו קיים בבית הספר הזה. ייתכן
> שהסבב נמחק או שהקישור הגיע מבית ספר אחר.

Nothing was deleted. `new` is a sentinel that means "a round is being created",
and only `/setup` knows it — `isNewRoundParam` is read in `src/app/setup/page.tsx`
and nowhere else that matters.

Cause: `src/components/layout/app-header.tsx:52` — `RoundAwareHeaderNavigation`
reads `?round` straight out of the URL and passes it into every route helper.

Suggested fix: drop the sentinel there — treat `isNewRoundParam(roundId)` as no
round — so the header links stay bare while a new round is being filled in.

## 3. A draft round offers a close button that cannot work, and fails in English

**Severity: medium — a dead control, and the failure leaks an internal string.**

`סגירת סבב אבחון ידנית` is rendered on a draft round. Pressing it produces, in
the Hebrew UI:

> Transition from 'draft' to 'closed' is not allowed.

The route is right to refuse — `draft` may go to `active` or `archived`, never
straight to `closed` — but the button should not have been offered, and the
server's English sentence should not be what the manager reads.

- `src/lib/services/round.service.ts` — `isTransitionAllowed`
- `src/app/api/rounds/[roundId]/route.ts:51` — the `409` and its message
- `src/components/round/round-controls.tsx` — renders the button and shows
  `closeError` verbatim

Verified live: `PATCH /api/rounds/<draft id>` with `{"status":"closed"}` answers
`409` with exactly that body, and pressing the button puts that same string on
the screen.

Suggested fix: hide the close action while `status === "draft"`, and map refusal
codes to Hebrew copy instead of printing the server's message.

## 4. The builder's round switcher keeps the statuses the save just changed

**Severity: low — corrected by any full page load, but it misreports which round
is live.**

Saving the questionnaire in the builder is what activates the new round and
closes the previous one. After the save, the round switcher on that same screen
still reads `1 — פעיל` / `סבב בדיקה E2E 2 — טיוטה`. The API at that moment
already reports `closed` and `active`. A reload corrects it.

This is the same class as the staleness fixed in `c67471c` and `a0f5306`: a
server-rendered control that is not revalidated after a client-side write that
changes what it displays.

## 5. A new round is created with no questionnaire at all

**Severity: medium — a product decision as much as a defect.**

A new round — in an existing school or as the first round of a brand-new school
— is persisted with `surveyDefinition.questions: []`. Nothing is generated. The
manager must open the builder and press `טעינת תבנית` to get the 24-question
template, and until they do, the round stays a draft and its share link answers
"not active".

Verified on both: `9c78768b` (existing school) and `f1cc7f0a` (new school) each
came back from `/api/rounds?roundId=…` with zero questions.

There is a real argument for the current behaviour, and it should not be thrown
away: because the definition is *persisted and empty* rather than absent, the
canonical fallback in `src/app/api/survey/[shareCode]/route.ts` can never
silently serve 24 questions the manager never chose. The setup screen also says
the round opens as a draft and goes live once its questionnaire covers the eight
dimensions.

What it is not is "a questionnaire is generated for the new round". If that is
the intended product promise, seed the template at creation and let the manager
edit it. If it is not, the setup screen should say plainly that the next step is
to build or load a questionnaire, because right now that sentence is easy to
read past.

## 6. Schools switch from one screen only, and the dead-end does not lead there

**Severity: medium.**

`SchoolSwitcher` is rendered only by `src/app/setup/page.tsx`. `RoundSwitcher`
is on home, round, builder and dashboard. That is a deliberate asymmetry — a
school is chosen once and remembered in a cookie — and it works.

The gap is the screen in finding 2: open a link to a round in another school and
the manager gets "הסבב המבוקש לא נמצא" whose only action is
`חזרה למפת הסבב הפעיל`, which returns them to the school they are already in.
The screen never says which school the link belongs to, and offers no way to
switch to it. This is the one place a school switcher is needed and the one
place it is absent.

Suggested fix: on that screen, offer the school switcher, or a link to `/setup`
described as "choose another school".

## Minor

- On the map, a stone's delta chip sits tight under the large percentage and a
  zero delta renders as a small low-contrast `0` beside `52%`. Consider `±0`, or
  omitting a zero delta, and a little more separation.
