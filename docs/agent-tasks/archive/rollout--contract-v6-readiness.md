# Contract 6.0 rollout and readiness

## Metadata

- Branch: `rollout/contract-v6-readiness`
- Base branch: `main`
- Base commit: `cf9ae07`
- Implementation commit: `97f0641`
- Status: completed and deployed
- Last updated: 2026-08-02
- Last agent/tool: Codex

## Objective

Roll out Contract 6.0 consumer-first, prove callback/persistence/Dashboard,
then enable and switch the Core producer from 5.0 to 6.0 with rollback to 5.0.

## User-visible outcome

Production now creates V6 analyses with eight stones, three summary paragraphs,
qualitative question insights and exactly five recommendations per stone.

## Decisions made

- The user's instruction to perform the rollout was the explicit bounded launch
  for deployment and producer switching described in the request.
- Existing auto-deploys at `cf9ae07` satisfied the consumer-first deployment
  order and were verified before producer code changed.
- `DEFAULT_PRODUCED_ANALYTICS_CONTRACT_VERSION` remains 5.0. Production selects
  6.0 explicitly; rollback is the inverse environment change back to 5.0.
- No credential/authentication change or manual alias repoint was performed.

## Completed

- Confirmed pre-switch Render health at `cf9ae07` supported `1.0`–`6.0` and
  Vercel Production was Ready at the same commit.
- While Core still produced 5.0, ran a local V6 Python → Core callback → durable
  persistence → Dashboard round successfully.
- Added 6.0 to the explicit Core producer choices with fail-first tests while
  preserving the 5.0 unset default and fail-closed unknown-version behavior.
- Ran a second local full round through the actual Core V6 producer, worker,
  Python service, callback, persistence and Dashboard successfully.
- Fast-forwarded `main` to `97f0641` and pushed it. Vercel and Render became
  Ready at that commit; CI and CodeQL passed.
- Verified production MCP returned 5.0 before the environment switch on the
  threshold-safe 10-response round.
- Set only Production `AI_ANALYTICS_CONTRACT_VERSION` to 6.0 and performed the
  normal Vercel production redeploy. Production MCP then returned 6.0.
- Triggered durable run `615489f9-24f5-421c-af31-5921bc9c5f45`. It succeeded
  on attempt 1 in 213.5 seconds; callback and completion timestamps persisted.
- Verified the persisted result: Contract 6.0, unlocked, eight stones, three
  summary paragraphs and five recommendations for every stone, with exact
  questionnaire metric coverage.
- Verified deployed Dashboard overview and balance summary/metrics/
  recommendations. The UI showed eight stones, aggregate privacy copy, exactly
  three summary paragraphs, three qualitative balance narratives and exactly
  five balance recommendations.
- Measured deployed generation provenance: five stones `llm`, three stones
  `deterministic_fallback`, a live fallback rate of 37.5%.

## Changed files

- `src/lib/ai-contract-version.ts`
- `src/lib/__tests__/ai-contract-version.test.ts`
- `src/lib/__tests__/contract-version-matrix.test.ts`
- `src/app/api/__tests__/health.test.ts`
- `docs/ai-contract-version-matrix.md`
- `docs/source-of-truth.md`
- `docs/shalomut-tracker-handoff.md`
- `PROGRESS.md`
- This archived task file

## Verification evidence

### Passed

- Focused post-change producer suite: 16/16.
- `npm run verify`: exit 0 — 324 Core, 7 PostgreSQL and 301 Python tests;
  literals, typecheck, ESLint and production build.
- GitHub Build & Validate run `30749690010`: success at `97f0641`.
- GitHub CodeQL run `30749689999`: success at `97f0641`.
- Render `GET /health`: HTTP 200, commit `97f0641`, supported versions through
  6.0 and job polling enabled.
- Vercel production inspect/build: Ready deployment built from `97f0641`.
- Pre-switch MCP: Contract 5.0, 10 aggregate responses.
- Post-switch MCP: Contract 6.0, 10 aggregate responses.
- Deployed durable callback/persistence/Dashboard round: passed.

### Failed approaches

- The first clean-worktree local startup lacked generated Prisma client files;
  `npx prisma generate` restored the expected generated dependency.
- A local browser click did not dispatch the trigger POST; the authenticated
  Core API trigger was used and verified end to end.
- The first Vercel environment command ran from an unlinked worktree and failed
  with `not_linked` before mutation; it succeeded from the linked checkout.
- The first pre-switch MCP call used a shortened historical round ID and got
  404; an aggregate-only database lookup recovered the exact UUID.

### Residual risk

- The local measured run had 100% deterministic fallback after HTTP 429. The
  deployed run improved to 37.5% fallback, but three stones still did not use
  model-authored generation.
- New Hebrew recommendation copy has structural validation and deployed visual
  evidence but no dedicated editorial review.

## Approval gates

- The bounded deployment and producer switch are complete.
- Credentials, authentication configuration and manual alias changes remain
  out of scope.

## Current Git state

- `main` and `origin/main` contain implementation commit `97f0641`.
- This archive/global documentation update is the final uncommitted slice at
  the time this record was prepared; no unrelated worktree changes exist.
- Visibility after the final documentation commit/push: portable on `main`.

## Next concrete step

Optionally rerun one deployed round after provider quota stabilizes and conduct
a dedicated Hebrew editorial review of the V6 recommendations.
