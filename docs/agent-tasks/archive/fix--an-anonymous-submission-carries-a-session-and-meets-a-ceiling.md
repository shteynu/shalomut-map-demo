# An anonymous submission carries a session and meets a ceiling

## Metadata

- Branch: `fix/an-anonymous-submission-carries-a-session-and-meets-a-ceiling`
- Base branch: `main`
- Base commit: `f906406`
- Current HEAD: `bfbfdf9` plus the documentation commit that follows it
- Status: code complete, verified, awaiting the owner's push
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close what is closeable in the abuse medium of the 2026-08-21 audit: the
anonymous submit endpoint had no server-side defence against stuffing and no
ceiling on the responses one round would store.

## User-visible outcome

Nothing changes for a respondent answering normally. A submission that carries
no attempt token hash is refused with a sentence telling the respondent to
reload, and a round that has reached its ceiling tells them to contact the
school rather than failing silently.

## Context

`AGENTS.md`: never expose respondent identity or detailed results below the
privacy threshold. A round whose results can be stuffed crosses that threshold
on fabricated answers, which is the same invariant from the other side.

## Scope

- `src/lib/services/survey.service.ts` — the attempt token hash is required.
- `src/lib/survey/response-ceiling.ts` (new) — the ceiling and its reasoning.
- `src/app/api/survey/[shareCode]/submit/route.ts` — the ceiling gate.
- `src/lib/types/backend.ts`, `src/lib/survey-submission-outcome.ts` — two new
  codes and their Hebrew sentences.
- `src/lib/server/rate-limit.ts` — a comment that claimed a defence it did not
  have.
- `docs/openapi.yaml` and its generated mirror.
- Tests, ADR-039, `PROGRESS.md`, the audit file, the handoff, this file.

## Non-goals

- A server-issued signed attempt token. See "Questions requiring an owner
  decision".
- The attempt beacon's own missing rate limit — a separate audit entry.

## Acceptance criteria

- A submission with no attempt token hash, or one that is not
  `^[0-9a-f]{64}$`, is refused and stores nothing.
- A round refuses responses past its ceiling with a code a client can read.
- The ceiling follows the school's current staff count.
- The shape the client produces is the shape both write endpoints require, and
  a test says so.

## Relevant repository instructions

`.agents/skills/shalomut-map`, `.agents/skills/shalomut-verification`,
`.agents/skills/shalomut-tracker`.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-004/ADR-005 (the privacy threshold), ADR-022 (no
per-question timing), and the new ADR-039. `docs/openapi.yaml` documents the
endpoint; the request body's `anonymousTokenHash` moved from optional to
required, which is a contract change on a published endpoint.

## Decisions made

- Required *and* shape-checked. The shape adds no security by itself; it makes
  the submit and attempt endpoints agree on what a token hash is, so a value
  one stores is one the other can find.
- Ceiling = `max(100, 3 × totalStaffCount)`. The multiplier is generous because
  the product publishes response rates over 100% legitimately; the floor exists
  because the multiplier trusts a number a manager typed once.
- Read the organization on every submission rather than stamping a ceiling onto
  the round. Two extra reads on the hot path, and the reason is in the route.
- `ROUND_FULL` is 409, not 429: waiting does not change it.
- The rate-limit comment that presented the token hash as the anti-stuffing
  defence is corrected rather than left standing. The audit called it out by
  name.

## Assumptions

- `organizations.total_staff_count` is a required positive integer, so the
  ceiling has something to be a multiple of. `responseCeiling` still falls back
  to the floor for a nonsensical value, because it reads a database row rather
  than a validated input.

## Completed

Everything in scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `src/lib/survey/response-ceiling.ts` (new)
- `src/app/api/__tests__/a-round-stops-accepting-answers-somewhere.test.ts` (new)
- `src/app/api/survey/[shareCode]/submit/route.ts`
- `src/lib/services/survey.service.ts`
- `src/lib/types/backend.ts`
- `src/lib/survey-submission-outcome.ts`
- `src/lib/server/rate-limit.ts`
- `docs/openapi.yaml`, `public/openapi.json`
- Six test files updated: `api.test.ts`,
  `submit-dispatches-no-analysis.test.ts`, `repositories.test.ts`,
  `duplicate-response-mapping.test.ts`, `postgres-concurrency.test.ts`,
  `survey-attempt-token.test.ts`
- `PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/critical-audit-2026-08-21.md`,
  `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

- `npm run verify:core`, unpiped, `REAL_EXIT=0`. 1430 tests, no failures.
- `npm run verify:db`, `REAL_EXIT=0`. 48 tests against the local PostgreSQL.
- Six mutations, each caught:
  1. any non-empty string is a token hash → 2 failures
  2. a missing token is accepted again → 3 failures
  3. no ceiling gate → 2 failures
  4. the ceiling ignores the school → 1 failure
  5. no floor → 3 failures
  6. `>=` becomes `>` at the ceiling → 2 failures
  The tree was restored from a scratchpad copy after each; the focused suite is
  green again (36/36).
- End-to-end against a production build on `next start -p 3210`, over real
  HTTP, against the local database and the seeded active round `SHALOM-LOCAL`
  (a school of 20, so the ceiling is the floor of 100, and the round already
  held 30 responses):
  - no `anonymousTokenHash` → `400 ATTEMPT_TOKEN_REQUIRED`
  - `"not-a-digest"` → `400 ATTEMPT_TOKEN_REQUIRED`
  - a hash produced by the same algorithm the client uses → `200`
  - the same hash again → `409 ALREADY_SUBMITTED`
  - filling the round → `409 ROUND_FULL` on the 101st response, naming the
    number
  The 70 rows that walk added were removed afterwards; the round holds the 30
  it held before.

### Failed

None.

### Blocked or not run

- A click-through of the questionnaire in a browser. The change is server-side
  apart from two Hebrew sentences in `survey-submission-outcome.ts`, and the
  end-to-end probe above exercises the same endpoint the client calls, with the
  same hash algorithm.

### Environment

Local. `next start -p 3210` with the interim password door.

### Residual risk

The contract change is the one to watch: `anonymousTokenHash` was optional in
`docs/openapi.yaml` and is now required. Any client other than this repository's
own — there is none — would start receiving 400s.

## Failed approaches

- Requiring the 64-hex shape broke eleven existing tests that submitted short
  strings or `randomUUID()`. They were fixtures rather than assertions about
  the shape, and all eleven were updated. One DB test did assert the old
  behaviour — "submissions without a token are not deduplicated against each
  other" — and it was rewritten to write through the repository, because the
  database rule it pins (PostgreSQL treats NULLs as distinct) is still true and
  still worth pinning; a companion test now states that the service refuses
  what the index would have permitted.

## Known risks

The ceiling's numbers are a judgement, not a measurement. Three times the staff
count and a floor of one hundred are stated in one file with the reasoning
beside them, so changing them is a one-line decision rather than an
archaeology exercise.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

- **The open half of this audit entry.** Binding a submission to a token this
  server issued when it served the questionnaire is the audit's first
  prescription. It changes the respondent flow — a token has a lifetime, and a
  respondent whose tab outlived it must not lose their answers — and it still
  does not bound the ratio of fabricated answers to real ones, because tokens
  are minted one GET at a time. Worth doing, worth deciding deliberately.
- Standing: rotate `GEMINI_API_KEY` before any paid round; decide whether
  pagination and server-side search in the administration console are worth a
  slice.
