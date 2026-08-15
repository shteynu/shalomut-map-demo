# Fix: the first submit after an idle period returns nothing at all

## Metadata

- Branch: `fix/the-first-submit-after-idle`
- Base branch: `test/deployed-walk-of-the-research-stack` (`c6d3efa`), which is
  itself two commits ahead of `main`. Stacked rather than branched from `main`,
  because the evidence this task starts from is in that branch's task file.
- Base commit: `c6d3efa`
- Current HEAD: `c6d3efa` (no commit on this branch yet)
- Status: complete for what this branch set out to do. The cause is located
  outside this repository; the mitigation is written, tested and walked in a
  browser in all three of its outcomes.
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

- **Walked in a browser against a local production build on port 3210**, with
  `window.fetch` made to reject the submit the way the deployed edge does. Three
  runs, and the third is the one that matters most:
  1. First send lost, second lands. The respondent never sees an error — the
     completion screen arrives on its own. Two sends were recorded, 1.2s apart,
     and the database holds **one** response with 20 answers.
  2. First two lost. The button reads `מנסה שוב...` under its spinner while it
     waits — read on screen, not in the diff — and the third send completes.
     Gaps of 1.1s and 4.0s, which is the 1s and 3s policy plus the failed
     attempts' own time.
  3. All three lost. The old message comes back —
     `לא ניתן להתחבר לשרת. בדקו את החיבור ונסו שוב.` — the button returns to
     `שליחת שאלון` rather than staying on `מנסה שוב...`, **the draft survives**,
     and no response is written. Two responses exist for the three runs, which
     is the arithmetic the whole change rests on.
- The local walk school was deleted afterwards; the local database is back to
  the 2 organizations and 4 rounds it held before.

## In progress

- Nothing.

## Remaining

- Nothing on this branch. The region question was the last open item and is now
  a recorded decision; the standing note that follows from it — that the
  mitigation makes the next occurrence silent — lives in
  `docs/shalomut-tracker-handoff.md`, which owns cross-task operational state.

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

- The three browser runs above, against a local production build. 2026-08-15.

### Blocked or not run

- `verify:db`, `verify:ai`, the Python suite and the mutation run. No schema,
  repository, contract or mutated module is in this diff.
- A deployed check of the fix. It is not deployed.
- `npm run test:e2e`. The smoke walks a submit that succeeds first time, which
  this change leaves untouched; the failing path cannot be produced without
  intercepting the request, which is what the browser runs did by hand.

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
- The browser runs forced the failure at `window.fetch`, which is the shape of
  the deployed failure and not the deployed failure itself. Nothing has yet
  retried against the real edge.

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
2. **Closed 2026-08-15 — nothing changes for now.** Owner decision, taken with
   the measurement below in hand. The alternatives offered were moving
   everything to Frankfurt, pinning the functions to Seoul, and measuring the
   submit's query count first.

   What the decision is accepting, so nobody has to re-derive it:

   - The deployment runs in **three places at once**. `X-Vercel-Id` reads
     `fra1::iad1::…`, so the function executes in **Washington**; the database
     is `aws-1-ap-northeast-2`, **Seoul**; and `render.yaml:19` puts the AI
     service in **Frankfurt**. The people using it are in Israel, which is none
     of those.
   - **One database query costs ~180ms**, which is the Washington–Seoul round
     trip. Medians of ten samples each: `/api/health/`, which touches no
     repository, 0.307s; `/answer/<code>/`, which makes one lookup, 0.486s. My
     own leg to the edge is identical in both, so the difference is the
     function-to-database leg alone.
   - A submit makes several of those in sequence, which is where the ~2s warm
     submit comes from. That figure is an inference from the measurement above
     and not a count of the queries in the code — the option to count them was
     offered and declined.
   - **The window for a cheap move closes with the first pilot school.** The
     deployed database is empty today, so changing its region is a new project
     and a new `DATABASE_URL`. Once a school has answered, the same decision is
     a migration of real respondents' answers.

   None of this is a cause of the defect this branch fixed; the request is lost
   before the function, wherever the function is.

## Next concrete step

None on this branch; it is complete and archived. The one thing it leaves for
whoever comes next is in the handoff: watch the deployed endpoint for the lost
submit, because the retry now hides it.
