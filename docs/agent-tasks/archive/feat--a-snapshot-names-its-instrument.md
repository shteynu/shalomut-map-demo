# A snapshot names the instrument it came from

## Metadata

- Branch: feat/a-snapshot-names-its-instrument
- Base branch: main
- Base commit: `c9f00d7`
- Current HEAD: `319eccb` — the change; this file lands in the commit after it.
- Status: implemented, verified and committed locally. Not pushed — `git push`
  is the owner's action here.
- Last updated: 2026-08-16
- Last agent/tool: Claude Code (Opus 5)

## Objective

Record, in the round's own persisted questionnaire, which instrument it was
built from — so that "which questionnaire did this round start from" becomes a
question the database can answer.

## User-visible outcome

None. No screen reads the value yet. It is a fact being written down before
anyone needs it, which is the only order in which it can be written down at all:
provenance cannot be recovered later for rounds that ran without it.

## Context

Second half of recommendation 2 in
`docs/questionnaire-modularity-audit-2026-08-16.md` §6. The audit found a
repository-wide grep for `templateId|instrumentId|questionnaireId` returning
zero matches, and the one declared identity that does exist —
`surveyInstrument.id = "shalomut-organizational-diagnosis-v1"` at
[shalomut-source.ts:325](../../../src/lib/shalomut-source.ts#L325) — with no
reader anywhere in the repository. It also found that the parser rebuilds from a
strict whitelist, so provenance could not simply be written and read later; the
whitelist had to be widened for the field to survive a single database read.

The first half — collapsing the three constructions of the default into one —
is on `main` at `15ce7c4`.

## Scope

- `SurveyDefinition.instrumentId?: string`.
- `createCanonicalSurveyDefinition` stamps it; `createEmptyDraftSurveyDefinition`
  explicitly does not.
- `parseSurveyDefinition` carries it, and refuses a present-but-unusable value.
- The manager's save path carries the stored value forward rather than trusting
  the request body.
- `docs/openapi.yaml` and its generated mirror.

## Non-goals

- **No reader.** Nothing branches on the value, and no screen shows it. Giving
  it a consumer is a separate change with its own product question.
- **No backfill.** See the decision below.
- **No template catalogue and no second instrument.** The audit's option A is
  still not recommended, and this change does not smuggle in half of it.
- Nothing else from the audit: `bucketForAnswer`'s shape problem, the dimension
  coupling, the hash/`scaleId` disagreement, the frozen-24 suggestion prompt.

## Acceptance criteria

- A round born from the canonical factory carries the instrument id, and still
  carries it after a database round trip and after a manager edits and saves.
- A round whose stored questionnaire has no provenance is never given one.
- No round's `surveyDefinitionHash` changes.

## Relevant repository instructions

- `.agents/skills/shalomut-map/SKILL.md` — the persisted round snapshot is the
  source of a round's questions.
- `.agents/skills/shalomut-verification/SKILL.md` — evidence matrix; falsify a
  new test before trusting it.

## Relevant architecture and contracts

- [types/backend.ts](../../../src/lib/types/backend.ts) — `SurveyDefinition`.
- [survey-definition.ts](../../../src/lib/survey-definition.ts) —
  `parseSurveyDefinition`, `carryInstrumentProvenance`,
  `createCanonicalSurveyDefinition`, `createEmptyDraftSurveyDefinition`.
- [rounds/[roundId]/survey-definition/route.ts](../../../src/app/api/rounds/[roundId]/survey-definition/route.ts)
  — the manager's save path.
- `prisma/schema.prisma:34` — `survey_definition Json?`. No migration: the
  column has no schema and no check constraint.

## Decisions made

- **`instrumentId`, not `templateId`.** It names `surveyInstrument.id`, a thing
  that exists. `templateId` would imply a template entity, and there is none —
  inventing the word before the concept is how a field ends up meaning two
  things.
- **A plain `string`, not a union of known ids.** A round may outlive the
  instrument it was built from, and refusing to parse an unrecognised id would
  take that round off every manager screen to punish it for a fact about the
  past. The file already argues this shape for a definition that will not parse
  (`prisma-round.repository.ts:57`).
- **Present-but-unusable is refused, absent is fine.** Only the server writes
  this field, so a number or an empty string is a bug upstream rather than an old
  shape to tolerate. Capped at 200 characters because the column is opaque JSON
  with no width.
- **Server-owned: carried forward, never taken from the request.** The builder
  posts a payload it rebuilds from its own draft state
  ([survey-builder.tsx:485](../../../src/components/survey/survey-builder.tsx#L485))
  — six fields and a question list — so a stamp that depended on the browser
  would die on the manager's first save. `carryInstrumentProvenance` reads it off
  the stored definition instead, which also means a forged value in a request
  body has no effect. What a round was built from is not something the browser
  is a witness to.
- **No backfill.** Every round already persisted has no record of what it was
  built from. Most were in fact built by the canonical factory, but the database
  does not say so, and stamping them retroactively would be manufacturing
  evidence rather than recovering it. Absent means unknown, and that is a true
  answer.
- **One exception to the above, deliberate and narrow.** A round that never
  persisted a definition at all falls back to the canonical factory in the save
  path, exactly as the respondent route, the submit route and the analytics path
  have been falling back all along. Its first save therefore records the
  questionnaire it has in fact been running. That is an observation, not a
  retroactive claim.
- **An empty draft claims nothing.** `createEmptyDraftSurveyDefinition` spreads
  the canonical factory for its wording and its estimate; the stamp is explicitly
  cleared, because no question in it came from the instrument.
- **`isSameSurveyDefinition` and `hasSameQuestionSnapshot` are untouched.** They
  answer "did the manager change the questionnaire", and provenance is not
  something a manager can change. Since it is carried forward it can never
  differ, so comparing it would be dead code.

## Assumptions

- The `survey_definition` column tolerates one more key. It is `Json?` with no
  schema and no check constraint, so this needs no migration.

## Completed

- `SurveyDefinition.instrumentId?: string` added with its reasoning.
- `parseSurveyDefinition` destructures, validates and re-emits it.
- `carryInstrumentProvenance` added and exported.
- `createCanonicalSurveyDefinition` stamps `surveyInstrument.id` — the first
  reader that identifier has ever had.
- `createEmptyDraftSurveyDefinition` clears it.
- The save route computes `nextDefinition` once and uses it for the write, the
  question-snapshot guard, the version record and the activation gate, so those
  four cannot record different questionnaires.
- `docs/openapi.yaml` documents the field; `public/openapi.json` regenerated via
  `npm run openapi:generate`, and `npm run openapi:check` passes.
- Ten tests added across two files.

## In progress

- Nothing.

## Remaining

- The owner's push: `git push origin feat/a-snapshot-names-its-instrument`, or
  straight to `main` with
  `git push origin feat/a-snapshot-names-its-instrument:main`.

## Changed files

Committed on this branch, local only — this branch does not exist on `origin`:

- `319eccb` — `src/lib/types/backend.ts`, `src/lib/survey-definition.ts`,
  `src/app/api/rounds/[roundId]/survey-definition/route.ts`,
  `src/lib/__tests__/survey-definition.test.ts`,
  `src/app/api/__tests__/survey-definition-provenance.test.ts` (new),
  `docs/openapi.yaml`, `public/openapi.json`. It also carries the zero-diff
  rename of `refactor--one-construction-of-the-default.md` into `archive/`,
  which was staged before the code and swept in; left as it landed rather than
  rewritten, since it moves no content.
- the commit holding this file — this task file.

Pre-existing and untouched: `next-env.d.ts`, modified before this session.

## Verification evidence

### Passed

- **Falsification, two independent sabotages, each isolating one half.**
  - Replacing `carryInstrumentProvenance(currentDefinition, parsed.value)` with
    `parsed.value` in the save route: `# pass 2 # fail 3`. The three that fail
    are the manager's edit, the forged client value and the never-saved round;
    the two that pass are the factory-only test and the negative case, which is
    the discrimination the sabotage was chosen to show.
  - Removing `instrumentId` from the parser's returned whitelist: exactly one
    failure, `not ok 21 — the questionnaire records which instrument it was built
    from, and a database round trip keeps it`. `# pass 24 # fail 1`.
- `npm run verify:core` — **exit 0**. That is eight fitness checks
  (`lint:literals`, `lint:interpreter`, `lint:composition`, `lint:fixtures`,
  `lint:skills`, `lint:mutation-config`, `lint:contract-refusals`,
  `lint:fonts`), `npm run typecheck`, `npm test`, `npm run lint` and
  `npm run build`.
- `npm test` — `# tests 1057 # pass 1057 # fail 0`, up from 1047.
- `npm run openapi:check` — mirror check passed.
- **The hash does not move**, pinned by a test rather than asserted:
  `createSurveyDefinitionHash` takes `questions` and projects only
  `questionId`, `dimensionId` and `questionText` of enabled analytic questions
  ([survey-definition-hash.ts:43](../../../src/lib/survey-definition-hash.ts#L43)),
  so no top-level field can reach it. This is what keeps Python's independent
  recomputation valid and is why no new contract version is needed.
- **No leak to any wire payload**, established by reading both boundaries: the
  public respondent route answers from an explicit whitelist
  (`instrument: { title, introText, anonymityText, dimensions, questions }`,
  `api/survey/[shareCode]/route.ts`), and the AI payload carries the hash rather
  than the definition (`round-analytics-payload.ts`).

### Failed

- None.

### Blocked or not run

- Browser walk of the builder's save: not run. The behaviour is exercised
  through the real `PUT` handler with in-memory repositories, including the
  browser's exact payload shape written out by hand rather than spread from a
  definition — spreading would have carried the very field the test exists to
  prove the browser never sends.
- Deployed-database check that no existing round changed: not run, and not
  needed — nothing in this change rewrites a stored definition. A round is
  touched only when its manager saves.
- Python suite: not run. Nothing under `ai-analytics-service/` changed, and the
  hash test is what protects that boundary from Core's side.

### Environment

- Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.

### Method note, recorded because it weakens one input

A five-agent reconnaissance workflow was launched against this worktree and was
still running when implementation began, so its agents read a tree that was
changing underneath them — one of them said so in its own transcript. Its output
is therefore **not** evidence of the baseline and is not cited anywhere above.
Every claim in this file rests on files read directly before the edits and on
the two sabotage runs. The mistake was mine: read-only agents still need a
stationary tree.

### Residual risk

- **A field with no reader can rot.** Nothing consumes `instrumentId`, so
  nothing would notice if it stopped being written except the tests added here.
  That is the trade this change accepts: provenance is only worth having if it
  was recorded before it was needed.
- **The value is a bare string with no registry.** Two instruments could
  disagree about their own ids and nothing would catch it. Cheap to add when a
  second instrument exists; premature now, when there is one.
- **A round that never persisted a definition gets stamped canonical on its
  first save.** True of what it was running, but it is an inference from the
  fallback rather than an observation of its creation. Recorded above as a
  deliberate exception rather than left to be discovered.

## Failed approaches

- None. The first shape considered — letting the builder round-trip the field —
  was rejected before being written, on reading `saveDefinition` in
  `survey-builder.tsx`: the payload is rebuilt field by field from draft state,
  so provenance would have had to be threaded through the whole builder to
  arrive back unchanged, and a client would then be able to forge it.

## Known risks

- None to any existing round. No stored definition is rewritten by this change.

## Approval gates

- None triggered. No migration, no secrets, no credentials, no alias.

## Questions requiring an owner decision

- Whether the manager should ever *see* which instrument a round came from —
  for example on the round card or in the builder header. Worth asking once the
  second instrument exists; there is nothing to distinguish today.

## Next concrete step

Nothing is left to write. The branch is committed and waiting on the owner's
push; until that push exists, this work is visible only in this worktree.
