# Deployed end-to-end smoke: schools, rounds, questionnaires, AI analysis

## Metadata

- Branch: `test/deployed-e2e-smoke-2026-08-09`
- Base branch: `main`
- Base commit: `16df031`
- Current HEAD: `16df031`
- Status: in progress
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5), connected Chrome

## Objective

Walk the deployed endpoint end to end in the owner's signed-in Chrome and prove,
with evidence rather than assumption, that a manager can create a school, open
rounds inside it, that each round gets its own questionnaire, that responses
reach the round they were answered for, and that the AI analysis a manager reads
belongs to the school and round on the screen — including after switching
between them.

## User-visible outcome

No product change. The deliverable is a plan, executed with evidence, and a
findings summary naming what works and what is broken.

## Context

Deployed state at session start, read anonymously and in the signed-in browser:

- Core: `https://shalomut-map-demo.vercel.app/`, anonymous `/` answers `307` to
  `/login`.
- Python: `/health` answers `status: online`, `commit: 16df031` — the current
  `origin/main`. This closes the handoff's open note that the seven AI-service
  findings of 2026-08-09 were fixed on `main` but not deployed: they are
  deployed now.
- Session: the owner is signed in, `activeOrganizationId`
  `34d05e66-fa4d-4a07-a2af-c9d5c41b6088`, session expires 2026-08-09T19:01:14Z.
- Data: one school `טסט`, staff count 20, one round `1`, active, opened
  29.07.2026, 10 responses, privacy threshold 10, analysis reported ready.

The round switcher has therefore never rendered on the deployed endpoint — the
handoff lists that as "worth a look, cheap". This session is where it happens.

## The plan

Naming used below: school A = `טסט` (existing), R1 = its round `1` (existing),
R2 = a new round in school A, school B = a new school, S1 = school B's first
round, S2 = a second round in school B.

### Phase 0 — preflight (read-only)

- [ ] 0.1 Anonymous `/` returns `307` to `/login`.
- [ ] 0.2 Python `/health` commit vs `origin/main`.
- [ ] 0.3 Signed-in `/api/auth/me` returns a valid session.
- [ ] 0.4 Signed-in `/api/health` — deployed producer contract version.
- [ ] 0.5 Baseline of school A: `/setup`, `/round`, `/dashboard` for R1, and the
      share code of R1. Record R1's analysis identity so a later switch can be
      checked against it rather than against a memory of it.

### Phase 1 — new round in an existing school (R2)

- [ ] 1.1 `/setup?round=new` opens an empty round form while school A's details
      stay.
- [ ] 1.2 Save R2. Expect: R2 created and active.
- [ ] 1.3 One-active-round-per-school: R1 moved to `closed`, R2 is the only
      active round.
- [ ] 1.4 `/round` now renders the round switcher — two rounds, first time on
      the deployed endpoint.
- [ ] 1.5 R2 has its own generated questionnaire: `/survey` builder shows it,
      and `GET /api/survey/<R2 code>` returns questions bound to the eight
      dimensions.
- [ ] 1.6 R2's share link `/answer/<R2 code>` opens and renders the consent and
      first question.

### Phase 2 — switching rounds inside one school

- [ ] 2.1 Switch R2 → R1 on `/round`: dates, response count, threshold, share
      code and status all belong to R1; the archived round is read-only.
- [ ] 2.2 Switch R1 → R2: the screen carries no state from R1 (the class of bug
      `c67471c` and `a0f5306` fixed).
- [ ] 2.3 `/dashboard?round=<R1>` still shows R1's finished analysis after R1 is
      closed.
- [ ] 2.4 `/dashboard?round=<R2>` shows locked/empty, not R1's analysis — the
      isolation check that matters most.

### Phase 3 — responses reach R2, and the AI analyses it

- [ ] 3.1 Answer R2's questionnaire fully through the browser at least once.
- [ ] 3.2 Top up to the privacy threshold of 10 through the same public endpoint
      the respondent client calls. Recorded as API, not as UI.
- [ ] 3.3 `/round` for R2 shows 10 responses; R1 still shows its own 10.
- [ ] 3.4 Analysis is enqueued automatically at the threshold and the Render
      worker picks it up; the dashboard reaches a ready state.
- [ ] 3.5 R2's dashboard renders eight stones with R2's own numbers, and reading
      the provenance says whether a model or the service wrote the prose.

### Phase 4 — a new school (B) and its first round (S1)

- [ ] 4.1 `/setup?school=new` opens an empty school form with the switcher still
      offering school A.
- [ ] 4.2 Save school B with S1. Expect: school B created, S1 active, school A's
      rounds untouched.
- [ ] 4.3 The school switcher lists A and B; switching scopes every screen.
- [ ] 4.4 S1 has its own questionnaire and its own share code, different from
      R1's and R2's.
- [ ] 4.5 Answer S1 once through the browser, top up to 10, and let the analysis
      run.

### Phase 5 — a second round in the new school (S2)

- [ ] 5.1 Open S2 inside school B; S1 closes.
- [ ] 5.2 The round switcher renders inside school B and switches S1 ↔ S2.
- [ ] 5.3 S2 gets its own questionnaire and share code.

### Phase 6 — cross-cutting isolation and hygiene

- [ ] 6.1 Analysis identity: for each of R1, R2, S1 the dashboard shows that
      round's own analysis, and no screen shows another school's. Checked by
      comparing recorded values, not by impression.
- [ ] 6.2 Switching school A ↔ B carries no state across: setup form, round
      screen, dashboard, goals.
- [ ] 6.3 Deep links `?round=` and `?school=` land where they say.
- [ ] 6.4 Privacy: no respondent-level detail on any manager screen; a
      below-threshold round stays locked.
- [ ] 6.5 Console and network clean on every screen walked.

### Phase 7 — close

- [ ] 7.1 Findings summary: what passed, what is broken, what to fix.
- [ ] 7.2 Ask the owner what to do with the test data created on the deployed
      database.

## Non-goals

- No product code change in this session unless a finding is trivial and the
  owner asks for it.
- No local test suite run: nothing in this branch changes runtime code.
- No credential, secret or alias change.

## Assumptions

- Deployed database contents are disposable at the design stage, so creating a
  school, rounds and responses there is ordinary work. The owner asked for
  exactly this.
- The privacy threshold minimum is 10 and a manager can only raise it, so
  unlocking a round means ten responses.

## Verification evidence

### Passed

Every phase of the plan ran. What the endpoint did, in the owner's signed-in
Chrome unless stated:

- **Preflight.** Anonymous `/` → `307` to `/login`. Python `/health` → `online`,
  `commit: 16df031` — the current `origin/main`, so the seven AI-service fixes
  of 2026-08-09 **are** deployed; the handoff's note that they were not is
  stale. Signed-in `/api/health` → producer `6.0` (`configured`), producible
  `3.0`–`6.0`, supported `1.0`–`6.0`.
- **Baseline.** School `טסט`, round `1` (`f9c18f1c`), closed later in this
  session, share `SHALOM-N74F`, 27 questions, 10 responses, analysis
  `success`, contract `6.0`, processed 2026-08-02T13:28:17Z, stones
  self-expression 34 / certainty 41 / meaning 42 / climate 45 / competence 49 /
  management-support 52 / balance 53 / social-resource 56, overall 47. A second
  school `טסט מקס — כפר סבא` already existed at session start; the handoff's
  "one school" is stale.
- **New round in an existing school.** `/setup?round=new` keeps the school's
  own fields and empties only the round's. Saving created `סבב בדיקה E2E 2`
  (`9c78768b`) as a **draft**; `1` stayed active. Saving its questionnaire in
  the builder activated it and closed `1` — one active round per school, read
  back from the API as `closed`/`active`.
- **The round switcher rendered on the deployed endpoint for the first time**
  (the handoff's "worth a look, cheap" item). Switching R1 ↔ R2 on `/round` and
  on `/dashboard` carries dates, response count, threshold, share code and
  status per round with no state from the other.
- **Round-scoped analysis.** `/dashboard?round=<R2>` was locked at 0/10 and
  showed none of R1's analysis; `/dashboard?round=<R1>` still showed R1's
  finished map after R1 was closed.
- **Respondent flow.** R2's link `/answer/SHALOM-TK5F` opened, consent → 24
  questions → `POST …/submit` `200` → thank-you screen. Nine more responses went
  through the same public endpoint from the shell to reach the threshold of 10.
- **Analysis ran by itself at the threshold** and belongs to the round:
  R2 `success`, contract `6.0`, processed 2026-08-09T12:41:13Z, own stones
  (self-expression 57 … climate 52), overall 54, and the map showed per-stone
  deltas against R1 by name (`+8` overall, `+23`, `+14`, `-1`, `0`).
- **New school.** `/setup?school=new` opened an empty form with the switcher
  still offering the other schools. Saving created `בית ספר בדיקת E2E`
  (`ff5625a8`) with `סבב ראשון E2E` (`f1cc7f0a`, share `SHALOM-5TVJ`). Its
  questionnaire was loaded and saved, the round activated, one UI submission
  plus nine reached the threshold, and analysis completed at
  2026-08-09T12:48:38Z with school B's own stones (57 across, certainty 55),
  overall 57, and no deltas — correct for a first round.
- **Second round in the new school.** `סבב שני E2E` (`2d0b109e`, share
  `SHALOM-TPD2`) opened as a draft; the round switcher rendered inside school B
  and switching S1 ↔ S2 showed each round's own dates, counts and share code.
- **School switching re-scopes everything.** `/setup?school=<id>` — the URL the
  switcher's own `GET` form produces — moves setup, round, builder, dashboard
  and goals to that school and persists in the `shalomut_school` cookie across a
  plain reload. Goals for school B rendered its own empty state.
- **Cross-school isolation holds and fails closed.** A link to school A's round
  read while scoped to school B returns `404 Survey round not found.` from
  `/api/rounds/<id>/ai-insights` and renders "הסבב המבוקש לא נמצא", explicitly
  refusing to substitute another round.
- **Draft and closed rounds refuse respondents.** `/api/survey/SHALOM-5TVJ`
  while draft → "not active (status: draft)"; the closed R1 → "not active
  (status: closed)"; `POST …/submit` to the closed round →
  `ROUND_NOT_ACTIVE`.
- **Provenance is real, not fallback.** Both new rounds report
  `outcome: "llm"` and `metricInsightsOutcome: "llm"`, `attempts: 1`,
  `retryCount: 0`, with a `surveyDefinitionHash`. So the prose was model-written
  and the deterministic-summary path was not taken.
- **Privacy.** Every manager screen showed aggregates only. The dimension and
  metrics screens ground their narratives in the round's own question texts with
  counts and distributions, never a respondent. A below-threshold round stayed
  locked.
- Console clean on every screen walked; no failing request other than the
  intentional cross-scope and not-active probes above.

### Failed

Six defects, all reproduced. Details, code locations and suggested fixes are in
`docs/deployed-e2e-smoke-findings-2026-08-09.md`.

1. A newly opened **draft** round is announced as "זהו סבב קודם… פתוח לקריאה
   בלבד" and loses its own controls. Reproduced on R2 and on S2.
2. `?round=new` leaks from `/setup` into every header link, so the ordinary
   navigation lands on "הסבב המבוקש לא נמצא… ייתכן שהסבב נמחק".
3. A draft round offers "סגירת סבב אבחון ידנית"; the route answers `409` and
   the raw English `Transition from 'draft' to 'closed' is not allowed.` is
   rendered into the Hebrew screen.
4. The builder's round switcher keeps the pre-save statuses after the save that
   activates the round and closes the previous one, until a full page load.
5. A new round is created with an empty questionnaire — nothing is generated,
   in an existing school or in a new one.
6. The school switcher exists only on `/setup`, and the cross-school
   "round not found" screen — the one place a manager needs it — offers no way
   to it.

### Blocked or not run

- No local suite ran: this branch changes no runtime code, only documentation.
- The AI question-suggestion button, the questionnaire version history and the
  archive transition were not exercised; they are outside what was asked.
- The screenshot channel stopped working near the end of the session because the
  Chrome window lost visibility. The last check — pressing the draft round's
  close button — was verified through the DOM instead, which is why its
  user-visible text is quoted rather than pictured.

### Environment

deployed (`https://shalomut-map-demo.vercel.app/`, Python
`shalomut-ai-analytics.onrender.com` at `16df031`)

### Residual risk

- The nine top-up responses per round went through the public submit endpoint
  rather than the browser, so what the browser proved is one full submission per
  round; the other nine per round prove the endpoint, not the UI.
- Test data now lives on the deployed database: rounds `9c78768b`, `f1cc7f0a`,
  `2d0b109e` and school `ff5625a8`, with 30 synthetic responses. It is
  disposable, but it is there.
- `1` is now `closed` in school `טסט`. That is the product's own rule, not a
  side effect to undo.

## Approval gates

- None reached. Nothing here touches secrets, credentials, authentication
  configuration or deployment aliases.

## Next concrete step

Ask the owner which of the six findings to fix first, and whether the test
school and rounds should stay on the deployed database or be removed.
