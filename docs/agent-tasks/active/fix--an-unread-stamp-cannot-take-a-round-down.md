# An unread stamp cannot take a round down

## Metadata

- Branch: fix/an-unread-stamp-cannot-take-a-round-down
- Base branch: main
- Base commit: `b2d2522`
- Current HEAD: `b2d2522` — nothing committed on this branch yet.
- Status: implemented and verified locally; not committed.
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Stop a provenance stamp nothing reads from being able to refuse a
questionnaire, and make a questionnaire with no stamp one shape rather than two.

## User-visible outcome

A round whose stored `instrumentId` is unusable keeps answering respondents
instead of returning `409 Survey definition is invalid`. Nothing else changes.

## Context

A correction to `319eccb`, which is on `main`. The refusal it added —
present-but-unusable `instrumentId` is refused rather than dropped — was
reasoned from where the value comes from ("only the server writes it") and never
from what refusing costs. `parseSurveyDefinition` is the read gate for the
public answer page, the public submit route and the analytics path, and the
`allowIncomplete` escape hatch does not help because the check ran before it.

Found by an adversarial pass that was asked to refute "a stamp does not leak
into any strictly-validated wire payload in a way that would be refused". It
confirmed the leak half and refuted the refusal half: the value does not have to
reach a payload to break one. Two further defects came from the same review's
synthesis and are fixed here rather than left as follow-ups, because both are
one-line traps in code three days old.

## Scope

1. An unusable stamp is read as no stamp.
2. `carryInstrumentProvenance` reads its input rather than copying it — its
   `current` does not always come from the parser.
3. No-stamp is one shape: the key is absent, never present holding `undefined`.
4. The type comment stops reading as an absolute.

## Non-goals

- **No warning on drop.** It was considered and rejected: `parseSurveyDefinition`
  runs on every database read and in the browser bundle, so a per-read warning
  would be noise proportional to traffic rather than to the defect. Nothing
  reads the value, so a dropped stamp costs "unknown provenance", which is a
  state the field already holds. Recorded under residual risk instead.
- No change to what is stamped, or to the carry-forward design.

## Acceptance criteria

- A stored definition with valid questions and an unusable stamp serves the
  public answer page with `200`.
- A stamp that could not have come from the parser is not written back.
- The three producers of a no-provenance definition agree on its shape.

## Relevant repository instructions

- `.agents/skills/shalomut-verification/SKILL.md` — falsify before trusting;
  record only checks that ran.

## Relevant architecture and contracts

- [survey-definition.ts](../../../src/lib/survey-definition.ts) —
  `readInstrumentId` (new, private), `parseSurveyDefinition`,
  `carryInstrumentProvenance`, `createEmptyDraftSurveyDefinition`.
- [types/backend.ts](../../../src/lib/types/backend.ts) — `SurveyDefinition`.
- `prisma-round.repository.ts` — `readSurveyDefinition`, which returns raw JSON
  cast to `SurveyDefinition` when a parse fails, and is why (2) is needed.

## Decisions made

- **One private `readInstrumentId`, used by both the parser and the carry.**
  Two call sites reading the same field by two rules is how the field ends up
  meaning two things, which is the defect this whole line of work exists to
  remove.
- **Lenient here, strict everywhere else in the same function, and the comment
  says why.** The rule is not "be lenient with stored JSON" — it is that a value
  with no consumer must not be able to refuse a round. A malformed *question*
  still refuses, and should.
- **`delete` rather than `instrumentId: undefined`.** The two compare equal
  through `JSON.stringify` and through Prisma and unequal through
  `deepStrictEqual`, and `InMemoryRoundRepository` does not JSON round-trip — so
  the asymmetry is exactly the kind that makes an in-memory test and a database
  test disagree about the same object.
- **The type comment gains the one case it was wrong about.** A round that never
  stored a questionnaire does acquire a stamp on its first save, from two paths,
  and that is truthful rather than retroactive. The comment read as an absolute
  and the route's comment already said otherwise.

## Assumptions

- None beyond those already recorded for `319eccb`.

## Completed

- All four items in scope.
- Three tests added, one existing test inverted.

## In progress

- Nothing.

## Remaining

- Commit, then the owner's push.

## Changed files

Unstaged, uncommitted, this worktree only:

- `src/lib/survey-definition.ts`
- `src/lib/types/backend.ts`
- `src/lib/__tests__/survey-definition.test.ts`
- `src/app/api/__tests__/survey-definition-provenance.test.ts`
- `docs/agent-tasks/active/fix--an-unread-stamp-cannot-take-a-round-down.md`
  (this file)
- `docs/agent-tasks/archive/feat--a-snapshot-names-its-instrument.md` (moved
  from `active/`; that branch is on `main` at `b2d2522`)

Pre-existing and untouched: `next-env.d.ts`.

## Verification evidence

### Passed

- **Falsification, three sabotages, each isolating one guarantee.**
  - Restoring the refusal: `# pass 24 # fail 2` — and the one that matters is
    `not ok — a questionnaire whose stamp is unreadable is still answerable`,
    which runs the real public `GET /api/survey/[shareCode]` handler and gets
    the 409 the fix exists to remove.
  - Carrying `current.instrumentId` raw instead of reading it: exactly one
    failure, `a stamp that could not have come from the parser is not carried
    forward`.
  - Putting the key back holding `undefined`: two failures, the shape agreement
    and the poisoned carry.
- `npm run verify:core` — **exit 0**, `# tests 1060 # pass 1060 # fail 0`
  (1058 before this branch's two additions plus the inverted one).
- `npx tsc --noEmit` — clean.

### Failed

- None.

### Blocked or not run

- Postgres check that a real row with a poisoned stamp now serves: not run
  locally. The equivalent is covered through the real route handler with
  in-memory repositories, and the parser it exercises is the same one
  `prisma-round.repository.ts` calls on every read.
- Python suite: not run. Nothing under `ai-analytics-service/` changed.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Residual risk

- **A dropped stamp is silent.** A seed script or a migration that writes a
  malformed value gets no signal; the round simply reports unknown provenance.
  This is the accepted cost of not warning on a hot path, and it is only
  tolerable because nothing reads the value — it stops being tolerable the day
  something does.
- **`319eccb` was on `main` for the length of one push with the refusal in it.**
  No round can have been affected: the only way to store a bad stamp through the
  app is a client `PUT`, which the same refusal rejected with a 400 before
  anything was written.

## Failed approaches

- **Warning on drop**, from the review's synthesis. Rejected on the hot-path
  argument above rather than attempted.

## Known risks

- None. The change only widens what parses.

## Approval gates

- None triggered.

## Questions requiring an owner decision

- None.

## Next concrete step

Commit the five files, then hand the push over.
