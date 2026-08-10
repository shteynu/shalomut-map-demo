# The respondent path runs in CI, on a phone as well as a desk

## Metadata

- Branch: `test/respondent-path-e2e`
- Base branch: `main`
- Base commit: `8f24cf3`
- Current HEAD: see `git log -1` (commits listed under Completed)
- Landed on `main` as `0506169`; contained in `origin/main` `568fbcb`
- Status: **closed** — landed, deployed, archived
- Last updated: 2026-08-10
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close Tier 0 item 4 of the readiness list: the respondent path had never been
run to its end by anything but a person, and the phone had never rendered the
questionnaire in CI at all.

## User-visible outcome

None for a respondent — no product behaviour changed. For anyone running the
project: `npm run db:seed:local` now leaves a share link that actually opens
the questionnaire, so walking the respondent flow no longer starts with a
hand-written status flip in the database.

## Context

Four Tier 0 items were verified open against the code on 2026-08-10:
missing security headers, no incoming rate limiting, feminine-only
questionnaire wording (16 places in `src/lib/shalomut-source.ts`, plus the
same text in `contracts/` and the Python service), and this one. The owner
chose this one first because it is the net under the other three.

The finding that made it urgent came out of reading the seed rather than the
test: `scripts/seed-local.ts` seeded its round `closed`,
`src/app/answer/[shareCode]/page.tsx` calls `notFound()` for any round that is
not `active`, and `not-found.tsx` is a Hebrew RTL page with an `h1`. The
smoke's third test asserted `dir=rtl` and "a level-1 heading is visible", so it
had been passing against the dead-link screen — the sentence in its own header
about a respondent seeing the questionnaire was never once verified. Archived
task files (`feat--respondent-draft-and-consent.md`,
`fix--builder-switcher-reads-the-save.md`) show earlier sessions flipping
`SHALOM-LOCAL` to `active` by hand for a manual walk and flipping it back,
which is how the gap survived.

## Scope

- Seed an `active` round so the respondent route has a live target.
- A spec that walks consent → every question → review → submit → thank-you.
- A second Playwright project running that spec on a phone viewport.
- Tighten the smoke assertion that let the dead-link screen pass.
- Extract the shared sign-in helper instead of writing a fourth copy.

## Non-goals

- WebKit. The phone project is Pixel 5 (chromium) because CI installs chromium
  only; an iPhone would be the more honest device for an Israeli staffroom and
  costs another browser download per run.
- Running the manager specs at phone width — they are a desk product.
- Asserting the response count on the manager screen after submitting. It
  would need a second sign-in and would read differently under CI retries,
  where a retried run has already written one response.

## Acceptance criteria

- The respondent spec fails when the round is not answerable. Verified by
  falsification, not by reasoning — see Verification evidence.
- The full suite passes on both projects.
- The seed still leaves the dashboard unlocked (twelve responses, threshold 10).

## Relevant repository instructions

- `AGENTS.md`: database contents are disposable; two environments only.
- `.agents/skills/shalomut-verification/SKILL.md`: browser scenarios, and the
  rule that only checks which actually ran may be recorded.

## Relevant architecture and contracts

- `answer/[shareCode]/page.tsx` gates on `round.status === 'active'`.
- One active round per school is enforced in `RoundService`; the seed writes a
  single round through the repository, so nothing conflicts with it.

## Decisions made

- **The seeded round becomes `active` rather than adding a second round.** A
  second, newer round would become `rounds[0]` and take over the default
  selection on `/round` and `/dashboard`, and a second, older one would leave
  the manager screens pointing at a round with no responses. Flipping the
  single round keeps every existing screen exactly where it was and makes the
  link live; the twelve responses still unlock the dashboard.
- **The respondent test clears cookies instead of opening a second browser
  context.** `browser.newContext()` starts from the browser's defaults, not the
  project's, so under the phone project it would hand back a desktop window and
  the file's whole reason for existing would evaporate. Clearing the cookie
  keeps the device emulation and still proves there is no session.
- **The test writes.** One anonymous response per project, two per full run.
  That is ordinary under the disposable-data rule and is stated in the spec's
  header so nobody points it at an environment where it is not.
- **`login-transition.spec.ts` keeps its inline sign-in.** Its subject is the
  transition after the click; a helper that waits for the destination would do
  the thing the test exists to watch the product do.

## Assumptions

- CI has no AI provider configured for the smoke step, so the analysis job the
  submission queues stays fail-closed there. Locally it queued
  (`ai_jobs_queued`) and the submit still answered `200`.

## Completed

- `scripts/seed-local.ts` seeds the round `active`; comment and console output
  say why and name the answerable URL.
- `e2e/manager-session.ts`: shared `EMAIL`, `submitLogin`, `signIn`, carrying
  the original comments. `submitLogin` returns the response unjudged so the
  wrong-password test still owns its refusal.
- `e2e/respondent-answers.spec.ts`: the full path, with a 44px touch-target
  floor on the answer stones and a progress-line assertion after every tap.
- `playwright.config.ts`: `mobile-chrome` project (Pixel 5), scoped by
  `testMatch` to the respondent spec.
- `e2e/smoke.spec.ts`: the respondent assertion now names the consent button;
  sign-in helpers imported rather than duplicated.
- `e2e/new-round-navigation.spec.ts`: uses the shared `submitLogin`, keeps its
  own landing rule for `/setup?round=new`.
- `docs/local-environment.md`: the seed line and a note on why the round is
  active.

## In progress

Nothing.

## Remaining

Nothing. Landed on `main` on 2026-08-10 and deployed; Tier 0 items 1–3 were
closed the same day in the three branches stacked on top of this one.

## Changed files

- `scripts/seed-local.ts`
- `playwright.config.ts`
- `e2e/manager-session.ts` (new)
- `e2e/respondent-answers.spec.ts` (new)
- `e2e/smoke.spec.ts`
- `e2e/new-round-navigation.spec.ts`
- `docs/local-environment.md`
- `docs/agent-tasks/archive/test--respondent-path-e2e.md` (this file)

## Verification evidence

### Passed

- `npm run typecheck` — clean.
- `npm run lint` — clean.
- `npm run test:e2e` (build + both projects) — 13 passed, including the new
  respondent spec on `chromium` (9.5s) and `mobile-chrome` (9.8s).
- Falsification of the dead-link guard: with `SHALOM-LOCAL` flipped back to
  `closed`, `npx playwright test e2e/respondent-answers.spec.ts
  e2e/smoke.spec.ts` failed exactly three tests — the respondent spec on both
  projects and the tightened smoke assertion — each with its own message, while
  the other four passed. This is the state that shipped, and it used to be
  green.
- Falsification of the touch-target floor: raising it to 444px failed with
  "the ירוק stone is 115px tall" on Pixel 5, so the measurement is real and
  the stones clear the WCAG AA target with room.
- Full suite re-run after restoring both — 13 passed.

### Failed

None outstanding.

### Blocked or not run

- `npm test` (unit) and `npm run build` on their own: not run separately.
  `npm run test:e2e` builds first, so the production build is covered; no
  `src/` runtime code changed, so the unit suite has nothing new to say.
- WebKit/iOS: not run, see Non-goals.
- **The deployed endpoint, and there is nothing there to check.** This branch
  changes a test, a seed and a Playwright project; none of the three runs on
  Vercel. Its deployed evidence is containment — `0506169` is an ancestor of
  `origin/main` `568fbcb`, which Vercel shows `Ready` under the Production
  alias — and nothing more is claimable.
- CI has not been read back at `568fbcb`. The suite passed locally on both
  projects; the GitHub Actions run for the push was not opened.

### Environment

Local. Database `127.0.0.1:5433`, reseeded with
`npx tsx scripts/seed-local.ts --reset` (816 answers, 34 responses, 3 rounds,
1 organization cleared first).

### Residual risk

- The phone project proves layout at 393px in chromium, not Safari. The
  `display: none` class of defect is caught; a WebKit-only one is not.
- CI writes two responses per run into its disposable database and queues an
  analysis job the environment cannot service. If the smoke step ever gets an
  AI provider configured, that becomes a real provider call per run.

## Failed approaches

- Editing the seeded round's status from a scratch script outside the repo:
  `tsx` cannot resolve the `@/` paths from another directory, and a bare
  `PrismaClient` now requires a driver adapter. Doing it through
  `resolveCoreRepositories()` from a throwaway file at the repository root
  worked; the file was deleted.

## Known risks

None beyond Residual risk.

## Approval gates

None. No secrets, credentials, aliases or deployed state were touched.

## Questions requiring an owner decision

None. Tier 0 items 1–3 were closed after this one, in that stack.

## Next concrete step

None — this task is closed. What is left of the readiness list is outside the
repository and is tracked in `docs/shalomut-tracker-handoff.md`.
