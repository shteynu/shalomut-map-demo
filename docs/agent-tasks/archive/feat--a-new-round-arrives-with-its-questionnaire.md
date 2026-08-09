# A new round arrives with its questionnaire, as a draft

## Metadata

- Branch: `feat/a-new-round-arrives-with-its-questionnaire`
- Base branch: `fix/a-wrong-school-link-can-be-opened`
- Base commit: `c650fe3`
- Current HEAD: see `git log -1`
- Status: landed on `origin/main` as `3b19adb`, archived 2026-08-09
- Last updated: 2026-08-09
- Last agent/tool: Claude Code (Opus 5)

## Objective

Finding 5 of the 2026-08-09 deployed end-to-end smoke, in
`docs/deployed-e2e-smoke-findings-2026-08-09.md` on
`test/deployed-e2e-smoke-2026-08-09`.

**Fifth in a stack**, on findings 6, 4, 3 and 1–2. Pushing this one lands all
five.

## The decision, and who made it

The finding named this a product choice rather than a defect and set out both
answers: seed the template at creation, or keep the empty round and say plainly
that building a questionnaire is the next step.

Asked the owner on 2026-08-09. **Chosen: seed the standard questionnaire and
keep the round a draft.** The manager opens the builder with the questions
already there, reads them, and saving is what puts the round live.

A third option — seed and go live immediately — was offered and not taken. It is
what the code would have done on its own, and the reason it is wrong is in the
next section.

## User-visible outcome

Opening a round, in an existing school or as a new school's first, creates it
with the full Shalomut questionnaire. The builder opens on the questions instead
of on nothing, and `טעינת תבנית` is no longer a step the manager has to know
about.

## Context

A new round was persisted with `surveyDefinition.questions: []`. Nothing was
generated, the round stayed a draft, and its share link answered "not active"
until the manager found `טעינת תבנית` in the builder.

The trap is in `RoundService.createRound`: it made a round `active` as soon as
its questionnaire covered the eight dimensions. Seeding the template without
touching that rule would have made every new round go live the moment it was
created — closing the round the school was still collecting answers on, with a
questionnaire nobody had read. The empty questionnaire had been holding that
door shut.

## Decisions made

- **Born active only when the caller brought the questionnaire.** That is the
  real distinction, and it replaces "the questionnaire is complete". The
  builder, the seeding script and `POST /api/rounds` with a definition still
  create live rounds; a seeded questionnaire is a draft, because nobody has read
  it. This is the load-bearing half of the change.
- **`createRound` seeds, and the setup service stops supplying anything.**
  Passing a complete questionnaire from the setup screen would have meant that
  screen had chosen it — and under the rule above, that puts the round live.
  Not passing one says what is true: this round has the standard questionnaire
  because it was given one, not because anyone picked it.
- **The audience comes from `backgroundContext`.** The setup screen owns it and
  the questionnaire shows it to respondents. `createRound` reads it from the
  input it already receives, so the two screens still cannot disagree — this is
  the one thing the setup service used to reach into the definition to set.
- **A caller who brings an unfinished questionnaire keeps it.** Seeding is for
  callers with nothing; a half-built questionnaire is a decision already taken.
- **The setup screen's copy changed, because the change made it wrong.** It said
  the round goes live once its questionnaire covers the eight dimensions, which
  now reads as work still to do when there is none. It says the round opens as a
  draft with the full questionnaire and that saving it in the builder puts it
  live.

## Non-goals

The delta-chip nit is the only finding left.

## Changed files

- `src/lib/services/round.service.ts` — seeding, and the activation rule
- `src/lib/services/manager-setup.service.ts` — stops passing an empty draft
- `src/components/round/setup-form.tsx` — the success copy
- `src/app/setup/page.tsx` — one sentence of the description
- `src/lib/services/__tests__/new-round-questionnaire.test.ts` — new, 7 tests
- Three existing tests that asserted the empty draft, rewritten to the new
  intent rather than deleted

## Verification evidence

### Passed

- `npm run verify:core` exit 0: 771 TypeScript tests (764 before, seven new),
  all five fitness checks, `npm run typecheck`, ESLint and the production build.
- `npx playwright test e2e/` 9/9 — the committed suite is unchanged.
- **Walked in a browser.** Creating a round through `PUT /api/manager/setup` the
  way the setup screen does returned
  `{status: "draft", questions: 24, audience: "צוות הוראה בלבד"}`, the round the
  school was collecting on was still `active` afterwards, and `/survey` opened
  on a populated builder: 24 questions, all eight dimensions at 3/3, the
  switcher naming the round as `טיוטה`.
- The same walk fails against the old behaviour: with the seeding reverted,
  `questions` comes back `0`.
- **The safety property has its own test.** `opening a round does not close the
  one the school is collecting on` fails if the activation rule is loosened
  back, which is the mistake this change was one line away from making.

### Not run, and why

- The browser walk is not committed: it creates a round, and the committed e2e
  suite leaves the database as it found it. The three temporary rounds it made
  were deleted; the local database is back to its four seeded rounds.
- `verify:db`, the Python suite and the mutation run: no schema, repository,
  Python or mutated module is in this diff. No contract or wire type changed —
  this moves what a round is created with, not what any version promises.

### Environment

local

### Local environment repaired, not a product defect

The builder's questionnaire-history panel showed
`לא ניתן היה לטעון את היסטוריית השאלון` during the walk. It was not this change:
the same endpoint answered `500` for the long-seeded round as well, because this
machine's database was missing `20260805170000_add_survey_definition_versions`.
`npx prisma migrate deploy` applied it and the endpoint answers `200` with an
empty list. Nothing in the repository changed; the note is here so the next
person seeing that panel checks their migrations first.

### Residual risk

- Every new round now carries 24 persisted questions from the moment it exists,
  where before it carried none until the manager acted. Nothing reads a draft's
  questionnaire before activation, so this is storage rather than behaviour —
  but a round abandoned at the draft stage is now a heavier row than it was.
- `createEmptyDraftSurveyDefinition` survives as the respondent-facing fallback
  in `src/app/survey/page.tsx` for legacy rounds with no stored definition. It
  has one caller now rather than three, and is worth revisiting once no such
  rounds remain.

## Approval gates

None. The product decision above was taken by the owner in this session.

## Next concrete step

Push, then open a round on the deployed endpoint and confirm the builder shows
24 questions and the previously running round is still `פעיל`.
