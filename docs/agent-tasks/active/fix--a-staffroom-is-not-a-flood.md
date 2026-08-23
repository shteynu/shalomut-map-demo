# A staffroom answering at once is not a flood

## Metadata

- Branch: `fix/a-staffroom-is-not-a-flood`
- Base branch: `main`
- Base commit: `8760e62`
- Current HEAD: `b024d27`
- Status: implemented and verified locally; not on `main`, not deployed
- Last updated: 2026-08-23
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Close the low finding of `docs/critical-audit-2026-08-21.md`: *«Лимит на IP может
отказать большой школе на всплеске после педсовета»*. The submission limit is 60
requests per five minutes keyed on the client address. A staffroom shares one
address, so a school of 150 that answers straight after a staff meeting is
refused at the sixtieth answer — exactly the moment the product is working.

## User-visible outcome

A respondent in a large school who submits during the post-meeting burst gets
their answers stored instead of `יותר מדי בקשות`.

## Context

- `src/lib/server/rate-limit.ts:64` — `RATE_LIMITS.surveySubmission`.
- The number was chosen when the same bucket was believed to be the defence
  against stuffing. It is not, and the file already says so: what bounds a round
  is `responseCeiling` (ADR-039), `max(100, 3 × totalStaffCount)` stored
  responses.
- So the address bucket's remaining job is to keep a script from hammering the
  product's only unauthenticated write, not to decide how many honest answers a
  round may take.

## Scope

- The submission limit's number, derived from the legitimate side and written
  down with the derivation.
- The delivery-report bucket's justification, which currently claims to match
  the submission limit.
- Tests that pin the relation rather than the constant.

## Non-goals

- No shared store. Without Upstash the counter stays per-instance; that is a
  known, documented property of this module and is not what this finding is
  about.
- Not the audit's other suggestion — keying by address plus share code with a
  quota from `totalStaffCount`. See `Decisions made`.
- The attempt beacon and the login bucket keep their numbers.

## Acceptance criteria

- A school of 150 answering inside one window is not refused.
- For a school of up to 200 staff, the round's own response ceiling is what
  refuses first, not the address bucket.
- A script still meets a bound.

## Relevant repository instructions

`AGENTS.md`, `.agents/skills/shalomut-{tracker,map,verification}/SKILL.md`.

## Relevant architecture and contracts

ADR-039 (response ceiling) owns how many responses a round may store. No
contract, schema or migration is touched.

## Decisions made

- **Raise the number; do not key by share code.** The rate limit runs before the
  share code is validated — it has to, since validating it is a database read
  and the guard exists to keep unauthenticated traffic off the database. A bucket
  keyed on an unvalidated URL segment is no bucket at all: a caller who varies
  the code gets a fresh allowance every time, and each request still costs the
  round lookup.
- **Do not size the quota from `totalStaffCount`.** Reading it means a database
  round-trip in front of the guard, for the same reason.
- **The delivery report keeps its 60.** Every accepted report writes an
  `operational_events` row from an unauthenticated caller, and a refused one
  costs a diagnostic rather than an answer.

## Assumptions

- The largest school in this product's audience is a few hundred staff. The
  number is chosen so that a school of 200 is bounded by its round's ceiling
  rather than by the address bucket.

## Completed

- `RATE_LIMITS.surveySubmission.limit` is 600 rather than 60, with the
  derivation written where the number is: 600 is `responseCeiling(200)`, so for
  a school of up to two hundred the round's own ceiling refuses before the
  address bucket does.
- The delivery-report bucket keeps 60 and its justification is corrected: it no
  longer claims to match the submission limit, and it says why the mismatch is
  the right way round — every accepted report is an `operational_events` row
  written for an unauthenticated caller, and a refused one costs a diagnostic.
- The submit route's comment and the OpenAPI `429` description point at the
  relation instead of calling the number loose.
- Tests: the staffroom burst is 150 rather than 40, and a new test holds the
  relation `responseCeiling(staff) <= limit` for schools up to two hundred and
  asserts the boundary is real one staff member past it.

## In progress

- Nothing.

## Remaining

- Land on `main`; the push is the owner's.

## Changed files

`src/lib/server/rate-limit.ts`,
`src/app/api/survey/[shareCode]/submit/route.ts`,
`src/app/api/__tests__/rate-limited-endpoints.test.ts`, `docs/openapi.yaml`,
`public/openapi.json`, `docs/critical-audit-2026-08-21.md`, `PROGRESS.md`.

## Verification evidence

### Passed

Local, 2026-08-23:

- `npm run verify:core` — exit 0, including `npm test` (1617 tests), typecheck,
  lint, build and the OpenAPI integrity check after regenerating the mirror.
- `npx tsx --test src/app/api/__tests__/rate-limited-endpoints.test.ts` — 4
  tests. The one that matters ran red on the old constant by construction: 150
  submissions from one address, which the previous limit refused at the
  sixtieth.

### Failed

- None.

### Blocked or not run

- `npm run verify:db`: not run. No repository, query or schema changed.
- `npm run test:e2e`: not run. No screen, route or redirect changed, and the
  only behavioural difference is a refusal arriving later than it used to.
- Deployed walk: not planned. Reproducing it on the deployment means sending
  hundreds of fabricated submissions to a live round.

### Environment

Local worktree.

### Residual risk

Without Upstash the counter is per-instance, so the effective ceiling is the
limit times however many instances the platform runs. Unchanged by this task and
already documented at the top of `rate-limit.ts`.

## Failed approaches

- None yet.

## Known risks

- A looser bucket lets a script fill a small round's ceiling faster. The ceiling
  is the bound either way, and `response-ceiling.ts` already states that it
  bounds rows and not the ratio of honest answers to fabricated ones.

## Approval gates

None.

## Questions requiring an owner decision

- None. The largest-school assumption is stated above and is cheap to revise.

## Next concrete step

Hand the push over:
`git push origin fix/a-staffroom-is-not-a-flood:main`. Nothing here is waiting
on more code.
