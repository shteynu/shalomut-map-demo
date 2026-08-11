# A signed-in walk on the deployed endpoint of three never-walked screens

## Metadata

- Branch: `test/deployed-signed-in-walk-2026-08-11`
- Base branch: `main`
- Base commit: `2e1c753`
- Current HEAD: `2e1c753`
- Status: complete. Four screens walked; the defect it appeared to find did not
  survive a reproduction attempt and is recorded as transient
- Last updated: 2026-08-11
- Last agent/tool: Claude Code (Opus 5), connected Chrome

## Objective

Look, on `shalomut-map-demo.vercel.app` and signed in, at the three manager
screens the repository record said had only ever been walked locally — the
builder's questionnaire version history, an archived round's read-only round
screen, and `מעקב יעדים` — plus the round switcher, which nobody had ever seen
deployed because it renders from two rounds up.

## User-visible outcome

None. This is evidence, not a change. No product code changed.

## Context

The blocker was never the screens; it was that every manager route redirects to
`/login` and the agent never sees or types the manager password. The owner
signed in themselves in the connected Chrome; the agent drove afterwards.

The deployed database was read read-only through `.env.deployed.local` at the
start and was **completely empty** — zero organizations, rounds, responses,
questionnaire versions and goals. So the walk had to build its own data through
the product's own screens.

## Decisions made

- **Owner decision 2026-08-11: the walk includes a real AI run.** Paid provider
  calls through Render were accepted so `מעקב יעדים` could be seen holding a
  real goal rather than an empty state.

## Assumptions

- Deployed data is disposable design-stage data, so creating a school and two
  rounds needed no approval ritual.

## Completed

All four items are walked, signed in, on the deployed endpoint.

1. **`היסטוריית שאלון` renders and works.** Two rows — `12:26` marked
   `הגרסה הנוכחית` at 24/24, and `12:24` at "23 שאלות פעילות מתוך 24" with a
   `טעינת גרסה` button. Loading the older version put 23 questions in the editor
   and the header said `יש שינויים שטרם נשמרו… נטענה גרסה קודמת של השאלון. היא
   תיכנס לתוקף רק לאחר שמירה`, so a loaded version does not become the saved
   questionnaire. The section appears only from two versions up: the setup save
   writes no version, the first builder save writes one, the second makes the
   history visible.
2. **The round switcher renders deployed, for the first time.** With two rounds
   it lists `סבב א׳ — אוגוסט 2026 — פעיל` and `סבב ב׳ — ספטמבר 2026 — טיוטה`.
   Choosing the draft rebuilt the whole round screen for it — its own title,
   dates, share code, zero responses, and `סגירת סבב ידנית`/`רענון ניתוח`
   correctly disabled for a draft.
3. **`מעקב יעדים` holds a real goal.** Selected `בחירה כיעד` on the first
   recommendation of `איזון`; the screen then showed `בעבודה (1)` with the
   goal's title, dimension and round, and the three-state control
   `נבחר / בתהליך / הושלם`. Moving it to `בתהליך` survived a full reload. No
   number is shown beside the goal, matching the 2026-08-09 owner decision.
4. **The read-only states of a superseded and an archived round.** Closing round
   1 produced `סבב האבחון מסומן כסגור. הדשבורד זמין לצפייה` and revealed
   `העברה לארכיון`. Archived, the screen says the round left the round list, is
   readable through the archive with its data and analysis intact, and that its
   goals keep updating; `סגירת סבב אבחון ידנית` is disabled and `איפוס נתונים`
   and `רענון ניתוח` are gone.

Seen in passing, also for the first time deployed:

- The consent screen's honest IP sentence (`93e3baa`) and `24 שאלות, כ־4 דקות`.
- The split-staffroom notice: `אקלים ארגוני` marked `דעות חלוקות`, with
  `50% אדום מול 50% ירוק` and the sentence that the average hides the split.
- The near-band-edge honesty note, and the map unlocked at 12 responses against
  a threshold of 10 with all eight dimensions.

## The dashboard spinner: what was seen, and what it turned out to be

**Read the correction at the end of this section before quoting anything in
it.** The observation was real and is recorded as it was made; the conclusion
first drawn from it was too strong and does not survive a second attempt.

What was seen, between roughly 09:29Z and 10:00Z on 2026-08-11:

- On a fresh load of `/dashboard/`, `performance.getEntriesByType('resource')`
  contains **no** request to `/api/rounds/{id}/ai-insights`, and the panel keeps
  showing `טוענים את ניתוח השלומות` indefinitely. Reproduced in two independent
  tabs, before and after insights existed.
- The endpoint itself is fine. Called by hand from the same page it answered
  `404` in 931 ms with `run.state: "failed"` while the run had failed, and `200`
  with stones once the analysis had succeeded.
- The same panel on `/dashboard/{dimension}/recommendations/` **does** fetch,
  in about four seconds, and renders the model-written recommendations. So this
  is not the whole dashboard route group.
- Other manager screens hydrate and are interactive deployed: the builder took
  a question toggle and `Cmd+S`, the round screen's `רענון ניתוח` fired.
- On `/dashboard/` the stone-map interactions also did nothing (clicks on a
  stone and on a stone's `+`), which points at the map screen's client subtree
  rather than at the insights hook alone. Not proven.

**A local production build did not reproduce it.** Checked on `npm run build` +
`npx next start -p 3210` with `DATABASE_URL` pointed at the deployed database,
so the round, its responses and its stored insights were the very same ones.
The request fired — `308` on `/ai-insights` then `200` on `/ai-insights/` — and
the panel rendered `סיכום ארגוני`.

How both controls were driven, because it matters that no real credential was
involved: a throwaway Playwright script signed in with the same fixture
password and session secret `playwright.config.ts` starts its own smoke server
with. The agent never saw or typed the manager password, on either environment.

### The correction: it does not reproduce on the deployment either

Later the same day, on a rebuilt school and round, the deployed dashboard was
put back into every state it had hung in, and it worked in all four:

| State of the round | Then | On re-check |
| --- | --- | --- |
| Run in flight | spinner forever | `הניתוח בעבודה`, request in 1.0–2.0 s |
| Run failed | spinner forever | the `שירות הניתוח אינו זמין כרגע` card, with its retry button |
| Round carrying a builder-saved questionnaire | spinner forever | same, works |
| Insights stored | spinner forever | `סיכום ארגוני` with the model's Hebrew, request in 1.9 s |

The document was not hanging either: five consecutive `GET /dashboard/` all
answered `200` in about 1.5 s, and `loadEventEnd` landed at 2.8 s.

So **the earlier conclusion was wrong in one specific way**: the failure card is
not unreachable in the deployed build. It was reached, deliberately, on the
second attempt. What stands is the observation itself — a spinner that lasted
more than twenty minutes across several reloads and two tabs, with no
`ai-insights` entry in resource timing.

The reading that fits every measurement: **a request that never completes
leaves no resource-timing entry at all**. The network panel did show a
`pending` entry at the time. So what was seen was not a request that never
fired but a response that never arrived — a transient fault in the deployed
runtime or in the browser's connection to it, not a property of the code. Two
hypotheses were tested and refuted on the way to that: an unclosed document
stream, and a round carrying a builder-saved `surveyDefinition`.

Not established: what actually stalled. Manual `fetch` calls to the same URL
answered normally throughout the hang, which a stuck connection would allow but
does not prove.

## The AI run, and why the first one failed

The automatic run fired on its own after the twelfth response and failed with
`failureCode: round_validation_failed` — the responses kept arriving while it
worked, so Core recalculated a different round at callback time. That is the one
failure `trigger-ai-analytics.ts` calls re-armable, and it re-arms on the next
response; no response followed, so it stayed failed. The manual `רענון ניתוח`
on the round screen then succeeded and stored insights at `09:46:27Z`. Nothing
here contradicts the code; it is what a trickle of real respondents would do
less often than a script does.

## Failed approaches

- `npx dotenv -e ... --` for a deployed read: `dotenv-cli` is not installed.
  Source the env file into the shell instead.
- A bare `new PrismaClient()` fails: this client needs the `PrismaPg` adapter,
  as `src/lib/repositories/prisma/prisma-client.ts` builds it.
- `scripts/seed-local.ts` refuses anything but a loopback database by design, so
  deployed data has to come from the product or the API.
- Clicking `העברה לארכיון` froze two tabs in a row. Not a product defect: the
  handler opens a native `confirm()`, which blocks the renderer against CDP.
  The archive itself was then done with the same `PATCH /api/rounds/{id}`
  `{status:"archived"}` the button sends, so the button's own click path is
  **not** covered by this walk.

## Verification evidence

### Passed

- All four walks above, signed in on `shalomut-map-demo.vercel.app`, with
  screenshots taken at each step.
- The local production build serving the same round's insights correctly.
- The deployed dashboard serving all four of its analysis states correctly on a
  rebuilt round, which is what retires the defect.
- Twelve responses submitted through the deployed public API returned `200`.
- The goal's `בתהליך` state persisted across a full reload.

### Failed

- The first automatic analysis run: `round_validation_failed`, explained above.

### Blocked or not run

- No local test suite ran; nothing in the repository changed except this file
  and the tracker handoff.
- The `העברה לארכיון` button's own click path — blocked by the native
  `confirm()`.
- What stalled the dashboard's insights request during the first hour. The
  four states it hung in were each re-entered and each behaved correctly, so
  there is nothing left to reproduce against.

### Environment

- deployed

### Residual risk

- The reproduction attempt rebuilt a throwaway school and two rounds on the
  deployed endpoint and deleted them again the same way; the database is empty
  and every table counts zero. Three AI runs were spent on it — two automatic
  failures and one manual success — which is the cost of turning the claim
  over.
- **Cleared, 2026-08-11.** The walk's data is gone:
  `npx tsx scripts/clear-test-data.ts --school=<id> --confirm` against the
  deployed URL removed `בית ספר אורנים` and, by cascade, both rounds with their
  responses, answers, attempts, questionnaire versions, AI runs, stored
  insights and the tracked goal. Every one of those tables now counts zero, so
  the deployed database is back to the empty state this walk found it in.
  Nothing is left that could be mistaken for a real school.

## Approval gates

- None triggered. No secret, credential, authentication setting or alias was
  touched.

## Next concrete step

Nothing. The four screens are walked, the spinner is chased as far as evidence
allows, and the deployed database is empty again. If the spinner returns, the
thing to capture before reloading is the network entry itself — whether the
`ai-insights` request is absent or `pending` is the whole question, and a
reload destroys the answer.
