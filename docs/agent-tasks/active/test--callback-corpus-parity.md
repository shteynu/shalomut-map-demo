# Shared callback corpus parity

## Metadata

- Branch: `test/callback-corpus-parity`
- Base branch: `origin/main`
- Base commit: `956daf5` (`origin/main`)
- Current HEAD: tip of `test/callback-corpus-parity`, one commit past `956daf5`
- Status: complete, verified, committed, unpushed
- Last updated: 2026-08-02
- Last agent/tool: Claude Code (Opus 5); earlier sections drafted by Codex in
  the same worktree, which is the concurrency incident recorded under Known
  risks

## Objective

Add one shared callback-direction corpus so Core and the Python analytics
service must accept and refuse the same Stone Map payloads for contracts
`1.0`–`6.0`.

## User-visible outcome

No direct UI change. Contract drift should be caught locally before a paid AI
run reaches Core and is refused at the callback boundary.

## Context

`contracts/fixtures/golden_corpus.json` covers Core to AI input. The recently
merged `fix/hebrew-only-parity` exposed that the callback direction had no
shared cross-runtime corpus. This branch starts that broader follow-up.

The branch was cut from `fix/hebrew-only-parity` on purpose: two corpus cases —
a Cyrillic summary and a Cyrillic interpretation — were accepted by Core before
that fix, so basing anywhere else would have meant either committing red tests
or dropping the two cases that demonstrate the very drift the corpus exists to
catch. That fix has since been merged, so the branch was fast-forwarded to
`956daf5` and is now independent.

## Scope

- Shared accepted payloads and refused mutations for contracts `1.0`–`6.0`.
- A TypeScript suite judged by Core's existing `validateStoneMapResult`.
- A Python suite judged by a Python-side semantic validator.
- Named refusal rules so matching only the final verdict cannot hide drift.

## Non-goals

- Wiring the new Python validator into the callback runtime in this slice.
- Changing immutable contract schemas or producer selection.
- Changing privacy thresholds, persistence, authentication or deployment.

## Acceptance criteria

- Both runtimes consume the same fixture.
- Both accept every accepted case and refuse every refused mutation.
- Python returns the refusal rule named by each corpus case.
- All supported contract versions remain represented.
- Full Core and Python suites pass after the branch is updated from `main`.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-map/SKILL.md`,
`.agents/skills/shalomut-verification/SKILL.md`.

## Relevant architecture and contracts

Core remains the authoritative callback judge. The Python validator mirrors
that behavior for parity testing and reuses the contract registry and existing
Hebrew predicates; it is not a new wire contract.

## Decisions made

- Refused cases are mutations of accepted payloads, avoiding repeated large
  fixtures and making the rule under test explicit.
- Python returns stable rule identifiers rather than operator prose.
- Runtime wiring is deferred because it would change behavior and retry
  placement, while this slice is a parity test foundation.

## Assumptions

- Contract capability metadata is the correct shared source for versioned
  semantic behavior.
- The score/status band duplication should eventually move to shared metadata;
  keeping it explicit here lets the corpus detect drift meanwhile.

## Completed

- `contracts/fixtures/callback_corpus.json`: 6 accepted payloads (`1.0`–`6.0`)
  and 15 refused mutations covering 10 named rules.
- `src/lib/__tests__/callback-corpus-parity.test.ts`: 4 tests judged by Core's
  `validateStoneMapResult`.
- `ai-analytics-service/src/schemas/stone_map_validation.py`:
  `stone_map_refusal()`, returning a rule slug or `None`.
- `ai-analytics-service/tests/test_callback_corpus.py`: 37 tests.
- Fast-forwarded the branch to `956daf5` and reran everything there.

## In progress

None.

## Remaining

Nothing on this branch. Two follow-ups it deliberately does not do are listed
under Questions and Known risks.

## Changed files

Committed as the single commit on this branch past `956daf5`. The branch is not
pushed, so another worktree in this clone can consume it and another checkout or
machine cannot.

- New: `contracts/fixtures/callback_corpus.json`,
  `src/lib/__tests__/callback-corpus-parity.test.ts`,
  `ai-analytics-service/src/schemas/stone_map_validation.py`,
  `ai-analytics-service/tests/test_callback_corpus.py`,
  `docs/agent-tasks/active/test--callback-corpus-parity.md`
- Unstaged, unrelated, preserved untouched: `.idea/shalomut-map-demo.iml`,
  `next-env.d.ts`

## Verification evidence

### Passed

All of the following ran on the branch after it was fast-forwarded to `956daf5`,
so they are evidence for the state being handed over rather than for an earlier
base.

- `npm run typecheck` — exit 0.
- `npm test` — 341 passed.
- `npm run lint` — clean.
- `npm run lint:literals` — architecture fitness check passed.
- `npm run build` — succeeded.
- `.venv/bin/python -m pytest` — 349 passed.
- `ai-analytics-service/scripts/check_version_literals.py` — exit 0.
- Red before green, Python: reverting `is_hebrew_only_copy` to the
  pre-2026-07-30 "Latin only" rule turned 3 corpus cases red; restored, all
  pass.
- Red before green, Core: reverting `isHebrewOnlyUserText` to the loose rule
  turned the refused-case test red; restored, it passes.
- The corpus generator refused to write two earlier drafts — one where three
  accepted payloads were malformed for their version, one where the two
  Cyrillic cases were still accepted by Core.

### Failed

None.

### Blocked or not run

- No live provider call and no HTTP callback was exercised. Both corpus suites
  call the two validators directly.
- `npm run verify:db` was not run; the diff touches no schema, migration or
  repository.

### Environment

Local worktree `/Users/maxim.berenshtein/WebstormProjects/shalomut-map-demo`.
`ai-analytics-service/.venv`, Python 3.14. No database, no deployment and no
environment variable was touched.

### Residual risk

- The Python validator implements the rules that matter for semantic drift, not
  every rule Core has. A payload it accepts can still be refused by Core, for
  instance on intervention shape or metric identity.

## Failed approaches

The first fixture stored every refused case as a complete payload. It worked and
was unreviewable at 474 KB — a v6 payload is intrinsically ~38 KB because the
contract itself requires five interventions per dimension and a 300-500
character narrative each. Compact JSON would have halved the bytes without
making it any more readable; expressing a refused case as a mutation of a named
accepted payload fixed both, and brought the file to 147 KB.

## Known risks

- No runtime behaviour has changed: the Python validator is not wired into the
  pipeline. Wiring it is a separate behaviour-reviewed slice, and the module
  docstring says so rather than implying the gate already exists.
- `_status_for_score` in the new Python module is a fourth copy of the 75/50
  bands (`src/lib/ai-contract.ts`, `src/lib/services/analytics.service.ts` and
  `ai-analytics-service/src/schemas/mcp_types.py` hold the other three). Its
  docstring says so and the corpus catches a drift between them, but the bands
  belong in `contracts/capabilities.json`.
- **Concurrency incident.** A Codex session wrote this task file in this same
  worktree at 19:03 while a Claude Code session was implementing the branch in
  it, which `AGENTS.md` forbids. No implementation file was touched by both —
  the four were last written at 18:42-18:45 and unchanged after — and this file
  was extended rather than overwritten, so its Objective, Scope, Non-goals,
  Acceptance criteria and Decisions are Codex's wording. Anyone reading the
  history should know two agents shared one working tree here.

## Approval gates

None. No secrets, credentials, authentication configuration, deployment alias
or database write is involved.

## Questions requiring an owner decision

Whether the Python validator should gate the outgoing callback. Doing so turns a
`contract_validation_failed` dead end — where a whole round of model calls is
already spent and the safety loop has finished — into one more replay.

## Next concrete step

Owner action: push and merge this branch, then merge
`docs/refactoring-plan-status` last, rewriting section 6 of
`docs/wellbeing-refactoring-plan-v4-review.md` in the same pass. That section
still describes five branches as unpushed and names the stage 0 corpus gap this
branch closes; both statements are now wrong.
