# A changed scale is a changed questionnaire

## Metadata

- Branch: fix/a-changed-scale-is-a-changed-questionnaire
- Base branch: main
- Base commit: `61a02f8`
- Current HEAD: `61a02f8` — nothing committed on this branch yet.
- Status: implemented and verified locally; not committed.
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make the one flag that warns a manager their two rounds are not like for like
fire when the answer scale or the polarity changed, and stop the caption
blaming wording for it.

## User-visible outcome

A manager comparing two rounds whose questions are identical in wording but
answered on different scales — or in opposite directions — now sees the
questionnaire-changed note instead of a bare delta. The delta itself is
unchanged, and the note now says the difference can come from the questionnaire
rather than specifically from its wording.

## Context

`docs/questionnaire-modularity-audit-2026-08-16.md` §3.3, framed there as "two
disagreeing definitions of 'the same questionnaire' — the hash omits `scaleId`,
the comparison function reads it".

**The framing was half wrong, and the code says so.** The two functions are not
two answers to one question. `createSurveyDefinitionHash` is the identity of
the snapshot *the AI is shown*, and the AI is shown no scale — its own docstring
says as much, and widening it would move every round's identity and break a
recomputation the Python service performs from a payload that carries no scale
at all. `hasSameQuestionSnapshot` decides whether a manager may still edit a
round after its first answer, where the scale must count. Both are right.

The defect is at the third site, which used the AI-visible hash to mean
something it never claimed: `round-comparison.ts` set `questionnaireChanged`
from `surveyDefinitionHash` inequality. Two rounds asking word-for-word
identical questions on three colours and on a seven-point scale hash the same,
so the flag stayed false while the delta subtracted one instrument's mean from
another's.

The owner asked for both fields — scale and polarity — after the polarity hole
was raised: two questions identical but for polarity mean opposite things, and
a fix aimed at one field would have left the second open.

## Scope

- `createMeasurementSnapshotHash` — what a round measured: the AI-visible
  projection plus `scaleId` and `polarity`.
- `CanonicalRoundAnalytics.measurementSnapshotHash`, computed beside the
  existing hash.
- `questionnaireChanged` reads it.
- The Hebrew caption stops attributing the difference to wording alone.

## Non-goals

- **The AI-visible hash is not touched.** Deliberate, and the reason is written
  into its docstring so the next reader does not "fix" it.
- **No wire change, no contract version, no migration.** `encodeAnalyticsInput`
  names the keys that cross the boundary and this is not one of them.
- **The comparison is still not cancelled.** See the owner question below —
  whether a scale change makes the delta dishonest rather than merely caveated
  is a product decision, not one to take while fixing a silent flag.
- **No second flag.** A caption that distinguishes "reworded" from "answered
  differently" would need the comparison to carry which of the two happened.
  Worth doing if the owner wants the sharper sentence; not smuggled in here.

## Acceptance criteria

- Two definitions differing only in `scaleId` produce the same
  `surveyDefinitionHash` and different `measurementSnapshotHash`.
- The same for `polarity`.
- Everything the old flag caught, the new one still catches.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — the per-round snapshot is the source
  of a round's questions; privacy and contract invariants.
- `.agents/skills/shalomut-verification/SKILL.md` — falsify before trusting.

## Relevant architecture and contracts

- [survey-definition-hash.ts](../../../src/lib/survey-definition-hash.ts) — both
  projections, side by side, each saying what the other is for.
- [types/backend.ts](../../../src/lib/types/backend.ts) —
  `MeasurementSnapshotHash`.
- [types/canonical-analytics.ts](../../../src/lib/types/canonical-analytics.ts)
  — the Core-side analytics shape.
- [round-comparison.ts:211](../../../src/lib/dashboard/round-comparison.ts#L211)
  — the flag.
- [dashboard-round-comparison.tsx](../../../src/components/dashboard/dashboard-round-comparison.tsx)
  — the caption.

## Decisions made

- **A second projection, not a widened one.** Widening the AI hash was priced
  and rejected on evidence: it is specified in `contracts/ai-analytics-v3..v6`
  and recomputed independently by Python from a payload that carries neither
  `scaleId` nor `polarity`, so a scale-aware hash cannot be recomputed on that
  side without a payload change and a new contract version.
- **A distinct type name, `MeasurementSnapshotHash`, knowing it is structural.**
  Template literal types are not nominal, so TypeScript will not stop the two
  being swapped. The names are the whole of the warning, and the type comment
  says so rather than implying a guarantee it cannot give.
- **Required on `CanonicalRoundAnalytics`, not optional.** Two rounds that both
  left it undefined would compare equal and be reported as the same
  questionnaire — the exact silence being removed.
- **Only `scaleId` and `polarity` are added.** `required` was considered and
  left out: it changes how many answers arrive, not what one is worth, and both
  response counts are already on screen beside the delta. `sectionId` groups a
  screen and changes no score. Background questions produce no score at all.
- **The caption widened rather than split.** "מהשאלון עצמו — מניסוח אחר של
  השאלות או מדרך אחרת לענות עליהן" covers both causes without claiming to know
  which one happened, which the comparison currently cannot tell it.

## Assumptions

- The pair is reachable in the product: a new round is born from the canonical
  template, so its question ids and texts match the previous round's, and the
  builder's per-question scale picker can change the scale before the first
  answer arrives. `hasSameQuestionSnapshot` only refuses such an edit *after* a
  round's first response, and never across rounds.

## Completed

- Everything in scope.
- Four tests added, one rewritten.

## In progress

- Nothing.

## Remaining

- Commit, then the owner's push.

## Changed files

Unstaged, uncommitted, this worktree only:

- `src/lib/survey-definition-hash.ts`
- `src/lib/types/backend.ts`
- `src/lib/types/canonical-analytics.ts`
- `src/lib/services/analytics.service.ts`
- `src/lib/dashboard/round-comparison.ts`
- `src/components/dashboard/dashboard-round-comparison.tsx`
- `src/lib/dashboard/__tests__/round-comparison.test.ts`
- `src/lib/__tests__/analytics-encoder.test.ts`
- `docs/agent-tasks/active/fix--a-changed-scale-is-a-changed-questionnaire.md`
  (this file)
- `docs/agent-tasks/archive/fix--an-unread-stamp-cannot-take-a-round-down.md`
  (moved from `active/`; that branch is on `main` at `61a02f8`)

Pre-existing and untouched: `next-env.d.ts`.

## Verification evidence

### Passed

- **Falsification, three sabotages, each isolating one guarantee.**
  - Flag reads `surveyDefinitionHash` again: `# pass 16 # fail 3` — the scale
    test, the polarity test, and the rewritten-questionnaire test whose override
    now travels on the new field.
  - Measurement projection hardcodes the scale: exactly one failure, the scale
    test.
  - Measurement projection hardcodes the polarity: exactly one failure, the
    polarity test.
- `npm run verify:core` — **exit 0**, `# tests 1063 # pass 1063 # fail 0`.
- The new tests run the **real projections over real definitions** rather than
  invented digest strings, which is what makes them able to fail: a test that
  made up its own hashes would pass against either projection.
- **Nothing crosses the wire.** `encodeAnalyticsInput` returns a literal of
  eleven named keys and `measurementSnapshotHash` is not among them; a grep for
  the field outside tests reaches only the type, the service that computes it
  and the comparison that reads it.

### Failed

- None.

### Blocked or not run

- Browser walk of the dashboard with two such rounds: not run. It would need two
  seeded rounds differing only in scale, and the caption change is a string in a
  component whose branch is already covered by
  `dashboard-round-comparison.test.tsx`.
- Python suite: not run. Nothing under `ai-analytics-service/` changed, and the
  reason the AI hash was left alone is precisely that boundary.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Method note

The reconnaissance workflow launched for this task was **stopped before it
returned**, once the owner settled the open question it existed to answer
(both fields). Nothing in this file cites it; the evidence is the files read
directly — `survey-definition-hash.ts`, `round-comparison.ts`,
`manager-context.ts`, `analytics-encoder.ts`, `canonical-analytics.ts` and the
dashboard component — and the three sabotage runs. Stopping it was also what
kept the previous session's mistake from repeating: agents were not left reading
a worktree being edited underneath them.

### Residual risk

- **The two hashes are structurally identical strings.** Nothing but the names
  and the docstrings stops a future edit from passing one where the other
  belongs. A branded type would fix it and would cost a cast at every
  construction site.
- **The caption cannot say which change happened.** A manager who reworded one
  question and a manager who switched the whole instrument to a seven-point
  scale read the same sentence, and the second case is much the more serious.

## Failed approaches

- **Widening `createSurveyDefinitionHash`** — the obvious reading of the audit's
  finding. Rejected on the contract evidence above rather than attempted.

## Known risks

- None to stored data. Nothing persisted is recomputed or invalidated: the new
  hash is derived at read time from the round's own snapshot.

## Approval gates

- None triggered.

## Questions requiring an owner decision

- **Should a changed answer scale cancel the cross-round comparison rather than
  caveat it?** ADR-004's reasoning — dimensions are the stable taxonomy, so
  rounds asking different questions remain comparable at dimension level —
  assumes the answers are scored on the same instrument. A scale change breaks
  that assumption in a way a reworded question does not. The delta is currently
  still shown, with a note.
- **Should the note distinguish "reworded" from "answered differently"?** It
  would need the comparison to carry which of the two happened, which is a small
  addition once the answer to the first question is known.

## Next concrete step

Commit the eight files plus this one, then hand the push over.
