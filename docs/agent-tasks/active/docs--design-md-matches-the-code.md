# `design.md` says what the stylesheet does

## Metadata

- Branch: `docs/design-md-matches-the-code`
- Base branch: `fix/builder-search-focus-ring` (a stack on top of `main` at
  `0cff722`; none of the four branches is pushed)
- Base commit: `6a9b947`
- Current HEAD: `6a9b947` (working tree ahead, see Git state)
- Status: implementation complete, verified locally, not committed
- Last updated: 2026-08-08
- Last agent/tool: Claude Code (Opus 5)

## Objective

Item 5 of the frontend UI/UX audit run on 2026-08-08: four places where
`design.md` no longer described the code. Per `AGENTS.md`, current code
outranks prose, so the document moves — not the stylesheet.

## User-visible outcome

None directly. The outcome is that the next agent reading `design.md` builds
what the product already looks like instead of what it looked like once.

## Context

The audit found:

1. Two vocabularies for one palette. The frontmatter named the status colours
   `success`/`warning`/`danger`/`danger-surface`/`on-danger`; the stylesheet
   names them `--green`/`--yellow`/`--red`/`--red-strong`/`--on-red`. This had
   already cost the product a border: `.survey-submit-error` read
   `var(--danger-surface)`, which has never existed.
2. `muted` was `#6f674f` in the frontmatter and `#383838` in the table.
3. Buttons documented as 8px/14px controls; every shipped button is a `999px`
   accent pill.
4. A five-tier type scale documented against a stylesheet holding 67 distinct
   `font-size` values, with the documented hero size the one no ordinary screen
   renders.
5. Seven breakpoints in use, none documented.

## Scope

- `design.md`.
- One comment in `src/app/globals.css` that referred to the old token name.

## Non-goals

- Changing any style. Nothing in this branch alters a rendered pixel.
- Fixing the debt the document now names. Both the type-scale sprawl and the
  builder's oversized title belong to the `.stone-page` untangling.

## Acceptance criteria

Every factual claim added is measured or read from the code, not inferred.

## Relevant repository instructions

- `AGENTS.md` — «Current code, tests, schemas and configuration outrank prose.
  When a living document disagrees with them, update the document in the same
  task.» And: do not rewrite archived task files as if they were current.
- `docs/README.md` — living documentation vs historical evidence.

## Relevant architecture and contracts

None touched.

## Decisions made

- **One vocabulary, not a mapping table.** The frontmatter keys were renamed to
  the CSS custom property names rather than documenting a translation. A
  mapping is a thing to consult; a single name is a thing you cannot get wrong.
  A new "Do" makes the rule explicit and says why an undefined `var()` fails
  silently.
- **The type-scale section keeps the five tiers and admits they are not
  enforced.** Documenting all 67 values would describe the mess rather than the
  intent, and deleting the tiers would leave nothing to aim at. It now states
  the count, says where it came from, and says new work still picks a tier.
- **The builder's hero is written up as a bug, with numbers.** It is the one
  screen whose root is `page survey-builder-stone-page` without `stone-page`,
  so the compact override never matches it.
- **Archived task files were left alone.**
  `docs/agent-tasks/archive/feat--copy-failure-states.md` recorded the
  `--danger-surface` bug and chose not to fix it. That record stays as it is;
  the stylesheet comment now points at it.

## Assumptions

None. Every number below was measured.

## Completed

All five divergences, plus two additions the audit's earlier items produced
(the sign-in screen and the failure screens as documented components, and the
global placeholder and focus rules under Accessibility Guidance).

## In progress

Nothing.

## Remaining

Nothing in scope.

## Changed files

- `design.md` — frontmatter token names and `muted`; `surface-success-panel`
  added; a note on single-vocabulary naming; three colour rows added to the
  table; two Accessibility Guidance bullets (placeholder, focus); the type
  scale rewritten with a debt subsection; the button radius rule corrected; a
  new Breakpoints table; components 9 and 10; two Do/Don't entries.
- `src/app/globals.css` — one comment, so it stays true after the rename.

Pre-existing and unrelated, left alone: `.idea/shalomut-map-demo.iml`,
`next-env.d.ts`.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0, 739 tests pass.
- `npx playwright test` — all 6 e2e pass.
- `git diff --check` clean.
- Every number in the new prose was measured, not estimated:
  - 67 distinct `font-size` values across 130 declarations — counted from
    `globals.css`.
  - Hero sizes measured in a browser at a 1440px viewport: `/`, `/setup` and
    `/round` render `h1` at 40px / line-height 44.8px / max-width 934.4px;
    `/survey` renders it at 83.2px / 89.856px / 534.5px. Throwaway spec,
    deleted after the run.
  - Breakpoint table derived by walking every `@media (max-width: …)` block in
    the stylesheet and reading its first selector.
  - Button pill: `.stone-page`/`.survey-builder-stone-page` set `999px`,
    `min-height: 3rem`, accent background, ink text — both roots, so buttons
    are pills on every screen including the builder.
  - `:root` custom-property names diffed against the frontmatter keys.

### Failed

None.

### Blocked or not run

- `verify:db` and `verify:ai` not run: documentation and one comment.
- Hero sizes were measured at one viewport width. The clamp heads are quoted
  from the stylesheet, so the narrow end is read rather than measured.

### Environment

Local; measurement e2e against `npx next start` on port 3100.

### Residual risk

None to runtime. The risk is ordinary documentation drift, which is what this
branch is about.

## Failed approaches

- An initial draft claimed every screen carries `.stone-page`. Checking rather
  than assuming turned up the builder, and turned a tidy sentence into the most
  useful finding in the diff.

## Known risks

None.

## Approval gates

None.

## Questions requiring an owner decision

None. The two that were open here were answered on 2026-08-08: the
200-instead-of-404 status became `fix/not-found-answers-404` and closed as
ADR-021, and the restored error-note border is kept.

## Next concrete step

Owner runs `git push origin docs/design-md-matches-the-code:main`. This is the
tip of a four-branch stack, so that single push delivers audit items 1, 2, 3
and 5; none of the earlier branches needs a push of its own.
