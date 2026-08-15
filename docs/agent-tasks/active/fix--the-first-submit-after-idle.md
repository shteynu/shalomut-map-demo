# Fix: the first submit after an idle period returns nothing at all

## Metadata

- Branch: `fix/the-first-submit-after-idle`
- Base branch: `test/deployed-walk-of-the-research-stack` (`c6d3efa`), which is
  itself two commits ahead of `main`. Stacked rather than branched from `main`,
  because the evidence this task starts from is in that branch's task file.
- Base commit: `c6d3efa`
- Current HEAD: `c6d3efa` (no commit on this branch yet)
- Status: investigating. Cause narrowed but not settled; no fix written.
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

- Nothing yet.

## Assumptions

- None load-bearing yet.

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

## In progress

- Waiting on the deployment's function logs for the two failed requests.

## Remaining

- Read the function logs. They separate "the function was killed" from "the
  function never started" from "the function ran and the response was lost",
  and those three have different fixes.
- Decide the fix with the owner once the cause is known.
- Reproduce the failure deliberately — seed one round, leave the endpoint idle
  until the function is cold, submit once — so the fix has something to be
  measured against. This re-creates throwaway deployed data and the cleanup that
  goes with it.

## Changed files

- `docs/agent-tasks/active/fix--the-first-submit-after-idle.md` (this file,
  untracked).

Nothing else. No product code has been touched on this branch.

## Verification evidence

### Passed

- The reproductions and the ruled-out hypotheses above, all read on 2026-08-15.

### Failed

- The two submits that started this task.

### Blocked or not run

- The function logs. They need the owner's Vercel dashboard.
- The deliberate cold reproduction. Not run: the walk's throwaway data was
  already deleted, so there is no round to submit to.
- Everything local. No local check applies to an unchanged tree.

### Environment

- Deployed: `shalomut-map-demo.vercel.app` and the Supabase database named in
  `.env.deployed.local`.

### Residual risk

- The cause is narrowed, not found. Three readings still fit: a cold start that
  exceeds the function's budget, a connection that hangs with no timeout to cut
  it, and a platform-side drop. The 11.2s on a database-free route is the
  strongest single clue and it points away from Postgres.

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

1. The function logs for the two failed requests — only the owner can open them.
2. Whether the fix may include a `vercel.json`, if the logs point at the region
   or at the time budget.

## Next concrete step

Ask the owner to open the Vercel deployment's function logs and read what the
two failed `POST /api/survey/SHALOM-BACKGROUND/submit` invocations recorded —
in particular whether an invocation exists for them at all.
