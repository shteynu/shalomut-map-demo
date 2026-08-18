# A manager guide inside the product

## Metadata

- Branch: `claude/manager-help-screen`
- Base branch: `claude/free-ai-service-deploy-yk4tjj` (documentation), which is
  itself based on `main` at `d47a59c`
- Base commit: `8cb42cb`
- Current HEAD: `acd854d`, contained in `origin/main` at `acd854d`
- Status: landed. Archived on 2026-08-18
- Last updated: 2026-08-18
- Last agent/tool: Claude Code

## Objective

Answer, on a screen, the questions the product's own screens raise — and only
those. The platform handbook on the base branch explains the whole system to a
team member; this is the small subset a principal actually hits, in Hebrew, in
product voice.

## User-visible outcome

A signed-in manager who does not know why a result is locked, where a colour
comes from, what the model decides, what closing a round starts, why a
questionnaire freezes, what happens to a goal, or what is stored about
respondents, opens `/help` and reads the answer. It is reachable from the header
on every screen that has one, and from the locked map, which has none.

## Context

Split off `claude/free-ai-service-deploy-yk4tjj` on 2026-08-18 at the owner's
request. Merging to `main` triggers `deploy-vercel.yml`, so a merge is a deploy:
the documentation half can land without changing anything a person sees, while
this half puts Hebrew copy in front of a manager the moment it lands. Separating
them is what buys the proofreading step.

Owner decisions carried by this branch:

1. The product should carry documentation as a manager-facing Hebrew help
   section, not as the platform handbook.
2. The goals screen's open group is called `פתוחים` rather than `בעבודה`.

## Scope

- `src/lib/help/manager-help.ts` — seven topics; every number derived from the
  module that enforces it.
- `src/components/help/manager-help-board.tsx`, `index.ts` — presentational,
  server-rendered, no client JavaScript.
- `src/app/help/page.tsx` — the screen, scoped to no school and no round.
- `src/components/help/manager-help-badge.tsx` — the floating badge, a
  `<details>` disclosure listing the seven topics; `HelpBadgeGate` mounts it in
  the root layout and `shouldShowHelpBadge` owns which screens it reaches.
- `src/lib/navigation.ts` — `routes.help`, its metadata, `helpRoute`.
- `src/components/layout/app-header.tsx` — the guide link beside the user bar.
- `src/components/dashboard/dashboard-map-locked.tsx` — a link to the privacy
  topic from the one screen that renders without the header.
- `src/lib/goals/labels.ts` — the goal labels the guide has to name, moved out of
  the components that had them written twice.
- `src/lib/shalomut-source.ts`, `src/components/ui/status-badge.tsx` — the colour
  words moved beside the status words, now that the guide reads them.
- `src/app/globals.css` — the guide's styles, the header link, anchor offsets.
- `PROGRESS.md` — one product milestone.

## Non-goals

- No product logic: no route writes, no schema, no contract, no analysis
  behaviour. The guide reads two constants and renders text.
- The platform handbook is deliberately **not** this screen. A test fails if
  `Render`, `Vercel`, `Supabase`, `Gemini`, `FastAPI`, `leaseToken` or
  `heartbeat` reaches the guide.
- No respondent-facing help. The consent screen carries what a respondent is
  owed, and that is a different audience with different questions.

## Acceptance criteria

- Every number the guide shows comes from the source that enforces it, proved by
  a test rather than by review.
- Each topic is addressable, so a screen can link to one answer.
- It renders without client JavaScript and is reachable from a locked map.
- It is gated like every other manager screen.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — `Product и UI`: RTL first, WCAG AA,
  status never carried by colour alone, prefer existing components and tokens,
  no threshold literals in code.
- `.agents/skills/shalomut-verification/SKILL.md` — verification proportional to
  the diff; report only checks that actually ran.
- `AGENTS.md` — branch-scoped task state; parallel-agent Git safety.

## Relevant architecture and contracts

`contracts/scoring-bands.json` through `scoringThresholds`;
`MINIMUM_PRIVACY_THRESHOLD` in `src/lib/survey-definition.ts`; ADR-005 (privacy
as a product invariant), ADR-007 (provider failure is visible, and copy the
service wrote is never presented as the model's), ADR-014 (one active round),
ADR-015 (a goal is a copy, and dropping it is deletion), ADR-016 (closing orders
the analysis and nothing retries itself), ADR-022 (one basis of calculation).
The seven topics are those decisions said to a principal.

## Decisions made

- **Not in the main navigation.** That navigation is the workflow; reading an
  explanation is never the next step. The link sits beside the manager identity
  and renders unconditionally, because a manager whose session is still loading
  is as entitled to the explanation.
- **The locked map carries its own link.** The dashboard renders headerless, so
  the screen likeliest to raise the question would otherwise be the one with no
  route to the answer.
- **Labels the guide names are shared constants.** `goalActionLabels`,
  `goalStatusLabels`, `statusColorLabels`. A copy in the guide would drift from
  the control silently, since nothing renders the two together.
- **The open group was renamed `פתוחים`.** It holds `selected` as well as
  `in_progress`, so `בעבודה` claimed work had started on a goal only chosen, and
  disagreed with its own empty state three lines below.
- **Anchor offsets are measured, not guessed** — the sticky header is 214px to
  395px depending on where the navigation wraps, measured at eight widths.
- **The badge is a `<details>`, not a menu built on state.** It opens, closes,
  takes focus and announces itself without a line of script, which is the rule
  the round switcher already set for controls on these screens.
- **It shrinks to its icon on screens with a pinned bottom bar**, and is lifted
  above that bar by a `body:has()` rule. Measured rather than eyeballed: with
  the lift and the shrink it covers no control on the setup screen, where
  without them it sat on the save button.

## Assumptions

- The 126-item research instrument is not implemented, so the guide describes
  the 24-question default and treats background questions as a supported kind.

## Completed

- The screen, its entry points, its styles, its tests and the label work it
  pulled in.
- The floating guide badge, owner request 2026-08-18: bottom corner of every
  manager screen, opening a list of the seven topics upward.

## In progress

- Nothing.

## Remaining

- A Hebrew-speaking reader has to review the copy before this merges. Nothing
  automated can stand in for it: the tests prove the numbers and labels are
  derived, never that the sentences read well.

## Changed files

`src/lib/help/manager-help.ts`, `src/components/help/manager-help-board.tsx`,
`src/components/help/index.ts`,
`src/components/help/__tests__/manager-help-board.test.tsx`,
`src/app/help/page.tsx`, `src/lib/goals/labels.ts`,
`src/lib/__tests__/goal-labels.test.ts`,
`src/lib/__tests__/manager-help.test.ts`, `src/lib/navigation.ts`,
`src/lib/__tests__/navigation.test.ts`,
`src/components/layout/app-header.tsx`,
`src/components/dashboard/dashboard-map-locked.tsx`,
`src/components/dashboard/dashboard-goals-panel.tsx`,
`src/components/goals/school-goals-board.tsx`,
`src/components/goals/__tests__/school-goals-board.test.tsx`,
`src/components/ui/status-badge.tsx`, `src/lib/shalomut-source.ts`,
`src/app/globals.css`, `PROGRESS.md`, and this file.

## Verification evidence

### Passed

- `npm run verify:core` — **exit 0**, and `npm run verify:db` — **exit 0**, both
  run before this branch was split out, on a tree identical in `src/` to this
  one. 1175 TypeScript tests, 496 Python tests, 36 PostgreSQL tests, every
  fitness check, lint and the production build with `/help` static. Re-run on
  this branch's own tip after the split: see below.
- **The screen was run, not only rendered in a test.** `next start` on the
  production build, signed in through `POST /api/auth/login`: `/help` answers
  `200` with all seven topics, seven anchors and seven contents links,
  `lang="he" dir="rtl"`, header guide link present. Anonymous, it answers `307`
  to `/login?next=%2Fhelp`.
- **Screenshots in Chromium at 1280×900**, page top and `#help-colors`: the
  anchored heading clears the sticky header, the points render as a list, the
  scoring line reads `ירוק — 75 עד 100; צהוב — 50 עד 74; אדום — 0 עד 49` from
  the manifest, horizontal overflow `0`.

### Failed

- None outstanding. Two defects were found by running the screen rather than
  testing it, and fixed: `display: grid` on the points list suppressed its
  markers, and a 6rem anchor offset left a heading behind the sticky header.

### Blocked or not run

- `npm run test:e2e` — the pinned Playwright expects a browser build the image
  does not carry. The screenshots above were taken by driving the image's own
  Chromium directly, which is evidence of the screen but not a run of the suite.
  No e2e spec covers `/help` either way.

### Environment

- Local container. `npm ci`, the AI service virtualenv and a disposable
  PostgreSQL 16 cluster were created for verification; none is committed.

### Residual risk

- The Hebrew has no native reviewer in the loop.
- The anchor offsets are measured against today's header. Changing the header's
  height degrades the anchor landing silently; nothing fails.
- A rename of a shared label is caught from the guide's side by a test, but a
  component re-hardcoding one is caught only by review.

## Failed approaches

- None on this branch.

## Known risks

- Merging deploys. `deploy-vercel.yml` runs on push to `main`, so this reaches a
  manager as soon as it lands — which is the whole reason it is a separate
  branch.

## Approval gates

- None consumed. No secret, credential, alias or deployment configuration is
  touched.

## Questions requiring an owner decision

- None open.

## Next concrete step

None on this branch — landed and deployed.

**One thing it landed without, stated plainly rather than closed:** no
Hebrew-speaking reader reviewed the copy. The owner read all seven topics in
Russian translation on 2026-08-18 and corrected one of them, and then decided to
merge; that is a narrower review than a native reading, not the same thing. The
copy is one file, `src/lib/help/manager-help.ts`, so a later reading costs an
edit and not a rewrite.
