# Fix: the first submit after an idle period returns nothing at all

## Metadata

- Branch: `fix/the-first-submit-after-idle`
- Base branch: `test/deployed-walk-of-the-research-stack` (`c6d3efa`), which is
  itself two commits ahead of `main`. Stacked rather than branched from `main`,
  because the evidence this task starts from is in that branch's task file.
- Base commit: `c6d3efa`
- Current HEAD: `c6d3efa` (no commit on this branch yet)
- Status: the cause is located outside this repository, and the mitigation is
  written and tested. Not yet walked in a browser.
- Last updated: 2026-08-15
- Last agent/tool: Claude Code (Opus 5)

## Objective

A respondent presses send once and is told the server cannot be reached. The
answers are not lost and pressing again works, but this lands on the one action
the product exists for, and the person who sees it has just spent five minutes
answering. Find out why, and make the respondent stop seeing it.

## User-visible outcome

A respondent who presses send once gets one of two honest outcomes — their
answers are stored, or they are told something they can act on. Not a network
error that a second press silently fixes.

## Context

Found on 2026-08-15 by the deployed walk in
`docs/agent-tasks/active/test--deployed-walk-of-the-research-stack.md`. It was
invisible before because nothing had ever submitted an answer on the deployed
endpoint: the database there had been empty since 2026-08-09.

## Scope

- Diagnose using deployed evidence, including the function logs.
- One change to the respondent submit path, if the diagnosis supports one.

## Non-goals

- No change to what a submission means. Idempotency, the duplicate refusal and
  the funnel row keep their current semantics.
- No deployment-configuration change without the owner's explicit go-ahead.

## Acceptance criteria

- The cause is stated from evidence, not from the most plausible reading.
- The failing case is reproduced, and the fix is shown to change it.
- A retry can never turn one person's answers into two rows, and can never
  report a stored response as an error.

## Relevant repository instructions

- `AGENTS.md` — deployed-environment confirmation, approval gates.
- `.agents/skills/shalomut-verification/SKILL.md` — deployed evidence.
- `.agents/skills/shalomut-map/SKILL.md` — respondent path, persistence.

## Relevant architecture and contracts

- `src/components/survey/survey-flow.tsx:449` — the client's single `fetch`,
  with no retry. It posts to `/submit` while `next.config.ts:106` sets
  `trailingSlash: true`, so the request takes a 308 on the way.
- `src/app/api/survey/[shareCode]/submit/route.ts` — the only unauthenticated
  write in the product.
- `src/lib/repositories/prisma/prisma-client.ts:70-75` — one `pg.Pool` per
  process, created with no `connectionTimeoutMillis`, so a connection that never
  arrives is waited on until something else gives up.
- `prisma/migrations/20260730120000_add_response_idempotency_constraints` and
  the `anonymousTokenHash` the client already sends — the reason a retry is
  thinkable at all.

## Decisions made

- **Mitigate rather than chase.** The cause is upstream of the function and this
  repository cannot reach it, so the change is to what the respondent
  experiences. This is deliberately not sold as a cure.
- **Retry only a thrown send.** Three attempts, 1s and 3s apart. A refusal is
  the server having spoken, and re-sending it would turn one refusal into three.
- **No deployment-configuration change.** The region question stays open and
  separate; the fix does not depend on it.

## Assumptions

- That the two logged failures are representative of the phenomenon. The idle
  probe did not reproduce it, so this rests on two observations rather than on a
  rule anyone has confirmed.

## Completed

- **Two reproductions**, both on 2026-08-15 against the deployed endpoint:
  - Browser: `net::ERR_EMPTY_RESPONSE`, screen read
    `לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.` A second press succeeded,
    and the database held **one** response for the two presses.
  - `curl`: the first request carrying a storable payload hung **12.8s** and
    returned `status:000`. The five that followed answered 200 in 1.8–3.0s.
- **The trailing-slash 308 is ruled out.** Two control POSTs from the same
  browser to uncached URLs followed the redirect correctly (`redirected: true`),
  and `curl -L` carried a body through it to a 400 in 0.96s.
- **The database is ruled out as the specific cause.** `GET /api/health/`
  touches no repository and answered in 0.27–0.39s across eight consecutive
  samples — but **once took 11.2s**. A route that does nothing but return JSON
  is not slow because of Postgres, so whatever costs ten seconds here is not the
  connection to Supabase.
- Latency of a page that does query the database, anonymously:
  `/answer/NOPE-CODE/` at 2.29s, 0.69s, 0.50s.
- **The connection string points at `aws-1-ap-northeast-2` — Seoul.** There is
  no `vercel.json` and no region setting in `next.config.ts`, so the functions
  run in whatever region the project defaults to. If that is not Seoul, every
  query in every request crosses an ocean, which is a candidate for the ~2s warm
  submit even if it is not what kills the cold one.
- **A retry is safe in principle and needs care in practice.** The client
  already sends `anonymousTokenHash` (`survey-flow.tsx:446`), and the
  idempotency constraint refuses a second row for the same token. So a retry
  cannot double-store. But if a request ever dies *after* writing, the retry is
  refused as a duplicate — so a transparent retry has to read that particular
  refusal as success, or it turns a stored response into an error message.

- **The function logs hold no invocation for either failed request.** Owner read
  them on 2026-08-15. That settles the direction: the request dies before any
  code in this repository runs, so neither a killed invocation nor a hanging
  `pg.Pool` can be it — both would have produced an invocation.
- **A correction to this file's own earlier reading.** The failing `curl`
  reported `redirects:0`, so the 308 never came back either. The connection died
  on the first request to the edge, before the redirect. The trailing-slash
  hypothesis is not merely unsupported; it is impossible for these two failures.
- **The "after an idle period" description is weaker than it looked.** A
  deliberate probe — 15 minutes of no traffic, then one hit on each route —
  did **not** reproduce anything: `/api/health/` answered its first hit in
  0.68s (warm 0.26–0.33s), and `/answer/NOPE-COLD/`, which does query the
  database, answered its first in 2.76s (warm 0.48–0.59s). So a quiet quarter of
  an hour is not by itself enough. Two caveats keep this from being conclusive:
  the probe ran against a fresh deployment of `9c32ef2`, which a build and the
  Vercel workflow may have warmed, and it never submitted anything. What the
  evidence now supports is **a submit is occasionally lost before it reaches the
  function** — the branch name is narrower than the phenomenon.
- **The mitigation is written**: `src/lib/survey-submission-retry.ts` and its
  use in `survey-flow.tsx`. Three attempts, waits of 1s and 3s, retrying only a
  *thrown* send. An HTTP answer is the server having spoken and every one of
  those is already a state `resolveSubmissionOutcome` names.
- **The worry this file opened with was already answered by the code.**
  `survey-submission-outcome.ts` reads `ALREADY_SUBMITTED` as a completion, with
  a comment describing exactly the recovered-attempt case. So a retry cannot
  turn a stored response into an error, and the client already sends the token
  that makes the second write refusable.
- The button now says `מנסה שוב...` on a retry instead of holding one unchanging
  spinner through a fourteen-second silence.

## In progress

- Nothing.

## Remaining

- Walk the retry in a browser against a local production build, with the first
  send forced to fail, so the `מנסה שוב...` state and the recovery are seen
  rather than inferred.
- Decide with the owner whether the deployment's function region is worth
  pinning. Separate from this fix and not required by it.

## Changed files

Committed in `c4baae9`:

- `docs/agent-tasks/active/fix--the-first-submit-after-idle.md` (this file).

Unstaged as of this update:

- `src/lib/survey-submission-retry.ts` (new).
- `src/lib/__tests__/survey-submission-retry.test.ts` (new).
- `src/components/survey/survey-flow.tsx` — the import, a `retrying` state, the
  `sendWithRetry` call and the button's retry wording.
- this file.

## Verification evidence

### Passed

- The reproductions and the ruled-out hypotheses above, all read on 2026-08-15.
- `npx tsx --test src/lib/__tests__/survey-submission-retry.test.ts` — 7 of 7.
  One of them is the deployed failure's shape: the first send throws, the second
  returns, and the caller sees the second.
- `npm run verify:core` — exit 0, which carries typecheck, ESLint, the fitness
  checks and the production build.
- `npm test` — 1033 pass, 0 fail.
- The idle probe above, which passed as a measurement and failed as a
  reproduction.

### Failed

- The two submits that started this task.

### Blocked or not run

- A browser walk of the retry. Not run yet; it is the one remaining item.
- `verify:db`, `verify:ai`, the Python suite and the mutation run. No schema,
  repository, contract or mutated module is in this diff.
- A deployed check of the fix. It is not deployed.

### Environment

- Deployed: `shalomut-map-demo.vercel.app` and the Supabase database named in
  `.env.deployed.local`.

### Residual risk

- **The cause is located, not identified.** "Before the function" is where, not
  what. Nobody knows what makes the edge drop a request, how often it happens,
  or whether it can drop all three attempts at once — in which case the
  respondent sees the same message they see today, just later.
- The retry adds waiting on the worst path. A lost send failed after ~13s in
  the one measurement there is, so three of them plus the waits could keep a
  person on `מנסה שוב...` for the better part of a minute before the error
  arrives. That is a worse wait than today's and a better outcome; if it turns
  out to be common rather than rare, the policy is the thing to revisit.
- Nothing here has been walked in a browser, so the retry wording has been read
  in a diff and not on a screen.

## Failed approaches

- None. The two hypotheses tested were falsified cheaply and are recorded above
  rather than retried.

## Known risks

- A retry written before the cause is known could hide a real failure instead of
  fixing one. That is why this file has no fix in it yet.

## Approval gates

- Pinning the deployment's function region, or raising `maxDuration`, changes
  deployment configuration. Not done, and not to be done without the owner
  saying so.

## Questions requiring an owner decision

1. **Closed 2026-08-15**: the logs hold no invocation for either failure.
2. Whether to pin the deployment's function region to match the Seoul database.
   Open, and independent of this fix.

## Next concrete step

Walk the retry against a local production build with the first send forced to
fail — block the submit request once in the browser's network layer — and read
the `מנסה שוב...` state and the recovery on screen rather than in a diff.
