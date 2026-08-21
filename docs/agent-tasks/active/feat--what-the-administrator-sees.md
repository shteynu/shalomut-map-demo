# The eight dimensions are named once, in a manifest

## Metadata

- Branch: `feat/what-the-administrator-sees`
- Base branch: `main`
- Base commit: `64ed991` (also `origin/main`; the previous task on this branch
  is fully landed)
- Current HEAD: `6bf0757`, pushed to `main` by the owner and deployed
- Status: done, committed, pushed and verified on the deployed endpoint
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

Commit. The owner pushes.

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

Untracked and not this task's: `next-env.d.ts` is modified by the owner's
tooling and left alone.

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
- **The deployed breakdown table was not seen, because it does not render.**
  The owner signed in and `/breakdown/` was reached on the deployed endpoint,
  but the demo round's questionnaire has no background question with options,
  so the screen shows its empty state — "בשאלון של הסבב הזה אין שאלת רקע עם
  אפשרויות בחירה" — and the table is unreachable there. This is round content,
  not a deploy problem, and the only way to see it on the deployed endpoint is
  to add a background question to that round, which changes a round that
  already holds 12 responses. Not done; the owner's call.
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

Commit the working tree as one commit, then hand the push to the owner.
