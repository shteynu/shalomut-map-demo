# The eight dimensions are named once, in a manifest

## Metadata

- Branch: `feat/what-the-administrator-sees`
- Base branch: `main`
- Base commit: `64ed991` (also `origin/main`; the previous task on this branch
  is fully landed)
- Current HEAD: the commit carrying this file. `6bf0757` is pushed and
  deployed; `159994a`, `16c0aed`, `d0bb7e4` and this one sit unpushed on the
  branch and change no runtime. The tip is deliberately not written as a sha —
  a file cannot name the commit that contains it without being stale the moment
  it is amended
- Status: done and verified; four commits await the owner's push
- Last updated: 2026-08-21
- Last agent/tool: Claude Code (Opus 5)

## Objective

Move the eight wellbeing dimensions' Hebrew texts out of TypeScript and into a
manifest, and delete the second copy of those texts that had drifted.

## User-visible outcome

One string changes. The breakdown table's `management-support` row read `עוגן`
and now reads `עורף מקצועי`, which is what every other screen already called it.
Nothing else on any screen changes.

## Context

The owner asked (2026-08-21) whether the analysis configuration — eight
dimensions, three colours — could be data rather than code, so that renaming
something is not a code change. The dimension texts were the part that could
move now. Reading them showed a second problem: the texts existed twice, once in
`src/lib/shalomut-source.ts` and once in
`src/lib/dashboard/dimension-presentation.ts`, and seven of the eight pairs were
byte-identical while `management-support` was not. The
`docs/questionnaire-modularity-audit-2026-08-16.md` §3.2 had predicted exactly
this: "duplication without a parity test". The owner ruled the difference a
drift rather than a decision and chose `עורף מקצועי` everywhere.

## Scope

- `contracts/wellbeing-dimensions.json`: the manifest — id, label, conceptLabel,
  subtitle, sourceLabel for each of the eight, in methodology order.
- `src/lib/wellbeing-dimensions.ts`: the id union, the declared order and a
  loader that validates the manifest and throws rather than yielding
  `undefined`.
- `src/lib/shalomut-source.ts`: composes manifest texts with the 24 questions,
  which stay in TypeScript.
- `src/lib/dashboard/dimension-presentation.ts`: `label` deleted from the type
  and from all eight placements.
- Call sites moved to `conceptLabel`: `breakdown-board.tsx`, `school-goals.ts`,
  `dashboard-map-lock.test.tsx`.
- Documentation: `PROJECT_CONTEXT.md` ADR-011, `docs/source-of-truth.md`,
  `PROGRESS.md`, `.agents/skills/shalomut-map/SKILL.md`.

## Non-goals

- The 24 canonical question texts stay in TypeScript. The owner's own
  observation is why: the 126-item research instrument (backlog §12) replaces
  them as soon as the methodologist's mapping arrives, so moving them to JSON
  now is work built to be thrown away, and the new instrument's answer scales
  are not the three colours these questions assume.
- Scoring bands, answer scales and status labels are not touched.
- No ninth dimension becomes possible. The map has eight hand-tuned organic
  shapes placed by eye; a ninth manifest entry would be a stone nobody drew, so
  the loader refuses it.

## Acceptance criteria

- One name per dimension in the whole tree, and a test that fails if a second
  copy reappears and disagrees.
- A malformed manifest fails at load with a message naming the dimension and the
  field, not at render with `undefined`.
- `management-support` reads `עורף מקצועי` on every screen.
- `verify:core` green with its real exit code.

## Relevant repository instructions

- `AGENTS.md`: living documents lose to code, and are updated in the same task.
- Dated plans and audits are preserved as historical evidence.
  `docs/questionnaire-modularity-audit-2026-08-16.md` was therefore left
  untouched even though this task closes one of its findings.

## Relevant architecture and contracts

`contracts/scoring-bands.json` is the pattern this follows: a manifest under
`contracts/`, validated at load, fail-closed. The difference is that
scoring-bands is read by both Core and Python, and this one is Core-only —
Python names dimensions by id, never by Hebrew text.

## Decisions made

- The id list stays a TypeScript union rather than being derived from the
  manifest, so a dimension stays a compile-time thing and the eight
  `Record<WellbeingDimensionId, …>` maps keep failing to compile when the set
  changes.
- The manifest fixes the order too: the loader compares entry `i`'s id against
  position `i`, so a reordered manifest is refused rather than silently
  reordering the screens.
- `sourceLabel` — the heading each dimension had in the Google Form — is kept
  even though nothing renders it. It is provenance, and the alternative is that
  tracing the methodology means opening the form.
- Both `label` and `conceptLabel` survive in the manifest. Five of eight are the
  same word, but they are two roles (formal name, name in use), and collapsing
  them is a methodology question, not a refactor.

## Assumptions

- The owner's ruling covers only the `עוגן`/`עורף מקצועי` pair. The other seven
  pairs already agreed, so nothing else needed a decision.

## Completed

Everything in Scope, plus `src/lib/__tests__/wellbeing-dimensions.test.ts`.

## In progress

Nothing.

## Remaining

Nothing in the work itself. Four commits are unpushed: `159994a` (handoff tip),
`16c0aed` (the render test), `d0bb7e4` (this file plus the handoff) and the tip,
which carries the handoff's unpushed/runtime corrections. The owner pushes.

## Changed files

Modified: `src/lib/shalomut-source.ts`,
`src/lib/dashboard/dimension-presentation.ts`,
`src/components/breakdown/breakdown-board.tsx`, `src/lib/goals/school-goals.ts`,
`src/components/dashboard/__tests__/dashboard-map-lock.test.tsx`,
`PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/source-of-truth.md`,
`.agents/skills/shalomut-map/SKILL.md`.

Added: `contracts/wellbeing-dimensions.json`, `src/lib/wellbeing-dimensions.ts`,
`src/lib/__tests__/wellbeing-dimensions.test.ts`,
`src/components/breakdown/__tests__/breakdown-board.test.tsx`.

Also modified: `docs/shalomut-tracker-handoff.md`.

Not this task's: `next-env.d.ts` is modified by the owner's tooling and left
alone. `git ls-files -o --exclude-standard` reports nothing untracked, which is
the check that survives a stale untracked cache.

## Verification evidence

### Passed

- `npx tsc --noEmit` — clean.
- `npm test` run unpiped with `echo "EXIT=$?"`: `EXIT=0`, 1358 tests, 1358 pass,
  0 fail (1346 before this task; ten new in the manifest suite, two in the
  breakdown render suite).
- `npm run verify:core > verify.log 2>&1; echo $?` — `REAL_EXIT=0`, re-run
  after the render test was added. The log holds
  `# tests 1358 / # pass 1358 / # fail 0`, `568 passed` from the Python
  suite, a clean `next build`, and every fitness check passing: architecture,
  Python interpreter, composition root, tenant chokepoints (two chokepoints,
  two pages about no single school), runtime fixtures, agent skills, mutation
  configuration, contract refusals, local font, and documented numbers (17
  claims across 3 documents).

- **Deployed.** `GET https://shalomut-map-demo.vercel.app/api/health/` answered
  `commit: 64ed991` and was watched flipping to `commit: 6bf0757`, so the
  running build is this commit rather than an assumed one.
- **The string is in the deployed bundle.** The two client chunks that carry the
  dimension texts were fetched anonymously from
  `/_next/static/chunks/` and are byte-identical to the local `next build`:
  each contains `עורף מקצועי` and neither contains `עוגן`. `עוגן` survives in
  the tree only inside three comments explaining why it is gone.
- **The table was walked, locally, on the production build.**
  `npx tsx scripts/seed-breakdown-round.ts` wrote a local round with two
  background questions and 41 responses; `next start -p 3210` served the same
  `next build` whose chunks the deployed endpoint serves byte for byte, and
  `/breakdown/` rendered all eight rows. The fifth reads **עורף מקצועי**, and
  `עוגן` appears nowhere on the page. The suppression behaviour is on the same
  screenshot — `עד שנה` has four respondents and is withheld, and `לא ענו על
  השאלה` goes with it so the four cannot be recovered by subtraction.
  The sign-in used an invented `MANAGER_ADMIN_PASSWORD` passed to that one
  process, against the disposable local database; no configured secret was read
  or typed, and `OIDC_*` were blanked for the child so the local password door
  stayed open.
- **The table itself is rendered in a test.**
  `src/components/breakdown/__tests__/breakdown-board.test.tsx` renders
  `BreakdownBoard` with a background question and two published groups, and
  asserts the markup carries `עורף מקצועי` and not `עוגן`, plus one
  `<th scope="row">` per dimension named from the manifest. Both tests were
  watched failing before they were trusted: setting `management-support`'s
  `conceptLabel` back to `עוגן` in the manifest fails this test and the parity
  test in `wellbeing-dimensions.test.ts`, and the manifest was restored with no
  diff left behind.

### Failed

None.

### Blocked or not run

- `npm run test:e2e` was not run. Nothing in this task touches the respondent
  path, sign-in or the dashboard's data flow; the one changed string is on the
  breakdown table, which the smoke path does not read.
- **The table cannot be shown on the deployed endpoint, and the product is
  right to refuse.** The owner signed in and `/breakdown/` was reached there,
  but the demo round's questionnaire has no background question with options,
  so the screen shows its empty state. Adding one is refused: the builder is
  frozen — "השאלון הוקפא לעריכה משום שכבר התקבלו תשובות בסבב זה" — and the
  refusal is server-side, not a disabled control.
  `src/app/api/rounds/[roundId]/survey-definition/route.ts:101` answers `409`
  when `responseCount > 0` and the question snapshot would change, and says to
  create a new round instead. That is the 2026-08-17 one-basis-of-calculation
  rule doing its job on a round holding 12 responses. A new round would have
  worked but would have closed `סבב הדגמה` — `RoundService` closes the
  previous active round and a partial unique index refuses a second one — so
  the owner chose the local walk above instead.
- The other seven dimensions' names are unchanged, so no other screen
  distinguishes the old build from the new one. Every screen that shows a
  dimension name reads `dimensionPresentations[…].conceptLabel`, and that value
  was already `עורף מקצועי` before this task. The breakdown table is the only
  place the change is visible.

### Environment

Local only. No deployment, no database, no migration, no secret.

### Residual risk

Low. If the manifest and the union ever disagree the product refuses to start
rather than rendering a nameless stone, which is the intended failure.

## Failed approaches

None.

## Known risks

Backlog §12 will replace the 24 questions and their three-colour scale. The
manifest survives that — it holds dimensions, not questions — but
`shalomut-source.ts`'s `questionsByDimension` will be rewritten wholesale, and
whoever does it should not read the manifest as a precedent for moving question
text into JSON.

## Approval gates

None for this task. Unchanged from before: `GEMINI_API_KEY` still needs the
owner's rotation before any paid round.

## Questions requiring an owner decision

None open. `עוגן` was the only one and it is answered.

## Next concrete step

`git push origin feat/what-the-administrator-sees:main` — the owner's action.
Nothing else on this branch is open, and no deploy check is needed after it: the
four commits carry one test file and documentation, so `/api/health/` will move
to the branch tip with no behaviour to re-verify.
