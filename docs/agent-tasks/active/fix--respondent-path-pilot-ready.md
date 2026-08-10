# The respondent path, made fit for a pilot with real teachers

## Metadata

- Branch: `fix/respondent-path-pilot-ready`
- Base branch: `main`
- Base commit: `50fac0f`
- Current HEAD: `50fac0f` plus one commit on this branch.
- Status: complete and verified locally. Waits on a push.
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the four Tier 0 defects that `docs/product-strategy-axes-2026-08-10.md`
names as unconditional — true regardless of which school the pilot lands in and
regardless of any open owner decision.

## User-visible outcome

A teacher answering on a phone can read what green, yellow and red mean, and is
told how long the questionnaire actually takes. A stranger holding a share code
learns nothing about the school.

## Context

The owner's goal is a first pilot in a real school within roughly three months.
The strategy sweep found the respondent path to be the least tested and least
defended surface in the product while being the only one that produces data at
all. These four were picked because none of them is gated on a decision.

## Scope

1. The scale anchors are visible on a phone.
2. The public survey endpoint returns a whitelist rather than the round.
3. The share code is guessing-resistant.
4. The completion estimate follows the question count.

## Non-goals

- The gendered wording of the 24 default questions. Real, recorded in the
  strategy document, and a change to the instrument's text rather than to its
  plumbing — it belongs with the owner's decision about the answer scale.
- Rate limiting, security headers, funnel instrumentation and error tracking.
  All Tier 0, none of them one-line, each its own slice.
- The manager-editable `estimatedMinutes` field in the builder. The default is
  now derived; a manager who types their own number still owns it.

## Acceptance criteria

- The anchors render and are in the accessibility tree at 375px, and the desktop
  layout is untouched.
- A test fails if `backgroundContext` ever returns to the public payload.
- Share codes come from a cryptographic source and cannot collide silently.
- No new round claims fifteen minutes.

## Relevant repository instructions

`AGENTS.md`; `.agents/skills/shalomut-map/SKILL.md` for implementation;
`.agents/skills/shalomut-verification/SKILL.md` for the check selection below.

## Relevant architecture and contracts

`GET /api/survey/{shareCode}` is documented in `docs/openapi.yaml`, so its
response schema changed there too and `public/openapi.json` was regenerated with
`npm run openapi:generate`. No AI contract version is involved: nothing on the
Core↔Python boundary changed.

## Decisions made

- **The public round payload is a whitelist, not a redaction.** The leak arrived
  by returning a domain object rather than by adding a field, so the test asserts
  the exact key set of `body.round`. A redaction list would pass the next time
  the domain object grows.
- **`privacyThreshold` stays in the public payload.** It is part of the anonymity
  promise the respondent is being asked to rely on, and it reveals nothing about
  the school.
- **Ten characters, not eight.** The alphabet omits `0/O` and `1/I/L` because the
  code is read off a slide and typed by hand; ten characters buys back the
  entropy the missing five cost, and 31 characters is close enough to a divisor
  of 256 that the remaining modulo bias is negligible at this length.
- **The share code is replaced in `createAndSaveRound`, not inside
  `createRound`.** Only the persisting path can ask the repository whether a
  candidate is taken, and `createRound` stays synchronous for its callers.
- **Ten seconds per item** for the estimate: the three anchors are the same three
  sentences on every question, so they are read once and recognised after that.
  24 questions → 4 minutes.

## Assumptions

- A manager who has typed their own completion estimate meant it. Only the
  default changed.

## Completed

All four, with tests.

## In progress

None.

## Remaining

Nothing on this branch. It waits on a push.

## Changed files

- `src/app/globals.css` — the mobile rule now wraps the anchor onto its own line
  instead of hiding it.
- `src/app/api/survey/[shareCode]/route.ts` — whitelisted payload; the 400 no
  longer names the round.
- `src/lib/services/round.service.ts` — crypto share code, unambiguous alphabet,
  bounded uniqueness retry.
- `src/lib/survey-definition.ts` — `estimateMinutesForQuestions`, used for the
  canonical definition's default.
- `docs/openapi.yaml` + `public/openapi.json` — new `PublicSurveyRound` schema.
- `src/lib/services/__tests__/share-code.test.ts` (new),
  `src/app/api/__tests__/api.test.ts`, `src/lib/__tests__/survey-definition.test.ts`.

## Verification evidence

### Passed

Local, at the branch tip:

- `npm run typecheck` — exit 0.
- `npm test` — 787 tests, 787 pass, 0 fail (733 before this branch).
- `npm run lint` — clean.
- `npm run build` — production build succeeded.
- `npx playwright test e2e/` — **9 passed**, including the respondent path
  (`the share link a manager reads opens the questionnaire for a respondent`).
- `npm run openapi:generate` then `src/app/api/__tests__/openapi.test.ts` — 8/8,
  which includes the whole-document `openapi:check`.
- Browser walk on the local dev server at **375x812**, `/answer/SHALOM-X1XC/`:
  all three anchors compute `display: block`, `visibility: visible`, render
  194x38 at 13.12px, and each button's accessible name now contains its anchor
  sentence (`ירוק ההיגד משקף באופן מלא את מצבי הנוכחי.`). Document
  `scrollWidth` 360 against `clientWidth` 360 — no horizontal overflow. Choosing
  an answer still auto-advances: question 2 of 24 with the progress bar moved.
- The same page at **1280x900**: `.answer-stone` still computes
  `flex-direction: column` and `flex-wrap: nowrap`, so the desktop layout is
  untouched and the new wrap is confined to the mobile query.

### Failed

None.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run — **not run**.
  No schema, repository, migration, AI contract, Python file or mutated module
  (`src/lib/ai-contract.ts`, `src/lib/scoring-bands.ts`) is in this diff.
- Nothing was checked on the deployed endpoint. Its database is empty, so there
  is no round there to open a respondent screen on.
- A real phone was not used. The check is Chromium at a 375px viewport, which is
  what proves the CSS rule and not what proves a touch target.

### Environment

Local only. The local Postgres container was started and `npm run db:seed:local`
was run, which added one school and one closed round; the round the walk used
(`SHALOM-X1XC`) already existed and was read, not written. The deployed database
was not touched.

### Residual risk

- **Rounds created before this change keep their stored values.** The local
  round still tells a respondent «כ־15 דקות», because the estimate lives in the
  persisted survey definition and only the default changed. The same is true of
  share codes: existing rounds keep their four-character code, and re-coding them
  would break links already handed out. If the pilot school's round is created
  before the push, it inherits both.
- The whitelist is a response-shape change to a documented public endpoint. No
  in-repository consumer reads it, but an external one written against the old
  shape would break.
- The mobile anchors were proved at one viewport width. 320px was not measured.

## Failed approaches

- Verifying through the in-app Browser pane: clicks timed out with the pane
  hidden, and `read_page` returned a stale document while the screenshot showed
  the live one. Playwright drove its own browser and was used instead.
- The `dev-inmemory` launch config serves no round — the project deliberately
  keeps demo fixtures out of the runtime — so the walk needed the real local
  database.

## Known risks

- `estimateMinutesForQuestions` is an assumption about reading speed, not a
  measurement. Ten seconds an item is defensible and still four times better than
  the fifteen minutes it replaces; the honest fix is to read it off the funnel
  instrumentation once that exists.

## Approval gates

None consumed. Nothing in this diff touches secrets, credentials, authentication
configuration or a deployment alias.

## Questions requiring an owner decision

None. All four were chosen because they are unconditional.

## Next concrete step

Push this branch, then walk `/answer/<code>` once on a real phone on the deployed
endpoint after creating a round there — that is the one claim this branch cannot
make for itself.
