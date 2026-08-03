# Shalomut Tracker — operational handoff

Updated: 2026-08-03. This document owns only cross-task operational/deployed
state, external blockers and approval gates. Product milestones belong in
`PROGRESS.md`; branch work and exact verification belong in
`docs/agent-tasks/{active,archive}/`; older snapshots remain available in Git.

## Repository snapshot

- `main` and `origin/main` are both `baf229b`: the merge `16510d7` and its
  documentation commit have since been pushed, so the merged `main` is visible
  outside this machine.
- The 2026-08-02 refactoring stack is merged and published: AI-insights
  repository, thin callback route, canonical Core input, canonical Python
  output, analytics-runner ports and `TextGenerator`.
- Checkpoint evidence on merged `main` (2026-08-03): `npm run verify:core`
  passed with 359 TypeScript tests, both fitness checks, typecheck, ESLint and
  production build; `npm run verify:db` passed 7 PostgreSQL integration tests.
  Python was not re-run: neither merged slice touches it.
- The repository record does not claim that this final refactoring stack has
  been deployed. Verify deployment source/health before relying on it at the
  deployed endpoint.

## Deployed state

- Supported product environments remain local and deployed only.
- Core endpoint: `https://shalomut-map-demo.vercel.app/`. Vercel names the
  target Production; for the product it is the design-stage operational staging
  endpoint.
- AI service: Render container from the root `Dockerfile`, with durable polling
  enabled. The service needs an always-available process or explicit wake
  mechanism; scale-to-zero alone is not a reliable worker.
- Database: the confirmed deployed Supabase PostgreSQL target contained all
  seven repository migrations after `prisma migrate deploy` and a successful
  follow-up `prisma migrate status` on 2026-08-02.
- No real respondents or production data exist. Database contents are
  disposable at this stage.

## Contract and AI runtime

- Contract `6.0` completed its consumer-first rollout. Deployed Python and Core
  support it, and deployed Core explicitly produces `6.0`.
- Unset Core configuration remains `5.0`, which is the rollback value. Core can
  produce `3.0`–`6.0`; callback/parser support spans `1.0`–`6.0`.
- The recorded deployed V6 round completed through durable claim, provider,
  callback, persistence and authenticated Dashboard rendering with eight
  stones, three summary paragraphs and five recommendations per stone.
- Runtime contract details and the rollout rule are canonical in
  `docs/ai-contract-version-matrix.md`; do not reconstruct them from old rollout
  plans.

## Operational invariants

- Confirm the database/environment before any write so work does not land on
  the wrong target. Clear, reseed, reset and migrations need no data-preservation
  ritual during the design stage.
- Keep respondent identity and sub-threshold details out of every manager and
  AI boundary.
- Deployed manager auth requires `SESSION_SECRET`,
  `MANAGER_ADMIN_PASSWORD` and `MANAGER_ORGANIZATION_ID`; machine boundaries use
  their own shared secrets.
- The deployed producer switch is configuration, not a silent fallback.
  Unknown contract versions fail closed.
- Parallel agents use separate branches, worktrees and active task files.

## External blockers and approval gates

- Before the first real respondents, rotate the four credentials previously
  exposed in a private design-stage transcript. This is an accepted deferred
  gate, not a blocker for local/docs work.
- Explicit bounded approval is required before changing secrets, credentials,
  authentication configuration or deployment aliases.
- No open migration decision remains in the repository record.

## Next operational check

Before the next deployment-sensitive task, compare `origin/main` with deployed
Core and Python source/health, then record only fresh read-only evidence in the
new branch task file.

`main` moved on 2026-08-03: the Core composition root and the Dashboard
presentation DTO are both merged, which closes stage 4 of the refactoring plan
and the presentation half of stage 5. Deployed Core has not been updated for
either, so deployed and `main` differ by these two slices until the next
deployment. Neither changes an API, a contract version, a schema or a migration.

The long-term identity model is no longer the next architecture slice. Owner
decision 2026-08-03: one manager per deployment is the requested product shape,
so identity is requirement-gated future work — `PROJECT_CONTEXT.md` ADR-013 and
`docs/product-behaviour-backlog.md` §8. The SHA-256 password hash stays as it
is; it is derived from `MANAGER_ADMIN_PASSWORD` per login and never stored, so
replacing the algorithm alone would close nothing.

What this leaves standing as an operational item: the deployment secret is the
credential, so rotating it means a redeploy, and the open rotation of the
exposed design-stage credentials before the first real respondents is
unaffected by this decision.
