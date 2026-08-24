# A deployed runtime refuses to run on a guessable manager password

## Metadata

- Branch: `fix/manager-password-must-be-strong`
- Base branch: `main`
- Base commit: `0ded0bf` (rebased there on 2026-08-24; the original base was
  `3491ba8` of 2026-08-10, and the branch sat unmerged for two weeks waiting on
  the owner's approval of an authentication-configuration change)
- Current HEAD: see `git log -1`
- Status: implementation complete, verified locally with `verify:core` green,
  approved by the owner on 2026-08-24, waiting on a push
- Last updated: 2026-08-24
- Last agent/tool: Claude Code (Opus 5)

## Objective

Make the pre-pilot password requirement a property of the code rather than of a
document. `MANAGER_ADMIN_PASSWORD` was checked for being non-empty and nothing
else, so `123` would have run a deployment.

## User-visible outcome

None while the password is generated. A deployment configured with a guessable
one stops issuing sessions: sign-in answers `503 UNCONFIGURED`, the same
refusal a missing variable already produces.

## Context

One manager account per deployment (ADR-020) means an attacker's whole search
space is this one password, against a public URL. Rate limiting bounds the
guess rate, but on serverless the counters are per-instance and the number of
warm instances follows the attacker's own parallelism — roughly 200 attempts
per five minutes at twenty instances, ~57 000 a day. That figure is fatal to a
chosen password and irrelevant to a generated one, which is why the owner
replaced the pre-pilot Upstash gate with a password requirement on 2026-08-10
(`docs/shalomut-tracker-handoff.md`). This task is the half of that decision
which does not depend on anyone reading the tracker.

## Scope

- `src/lib/auth/manager-auth-service.ts`: the rule, and folding it into
  `isUnconfigured()`.
- `src/lib/auth/__tests__/manager-auth-service.test.ts`: four tests.
- `.env.example` and `docs/local-environment.md`: what the operator must know.

## Non-goals

- **Replacing SHA-256 with Argon2.** The hash is derived per login and never
  stored, so it is not the exposure here; the swap belongs to the persistent
  identity work ADR-013 gates.
- **A real password dictionary.** A list of ten values is not a guess list and
  is not pretended to be one — length is what stops guessing. The list exists
  for the values this repository itself published.
- **Enforcing anything locally.** `admin123` on `next dev` is the point of
  having a local runtime.
- **Reporting password state on `/api/health`.** That endpoint deliberately
  reports no credential state, and this does not change it.

## Acceptance criteria

- A deployed runtime with a guessable password issues no session.
- The refusal names the rule to the operator and nothing to the caller.
- The browser suite, which runs against a production build, still signs in.

## Relevant repository instructions

- `AGENTS.md`: explicit bounded approval before changing authentication
  configuration. Given by the owner on 2026-08-10 ("давай сделаем проверку
  пароля в коде").

## Decisions made

- **Fail closed, not warn.** A warning is a check nobody reads until the
  incident — the same argument that made the CSP enforced rather than
  report-only earlier in this session. A refusal is visible on the first
  sign-in and costs one environment variable to fix.
- **`UNCONFIGURED`, not a new failure reason.** A weak password is a
  misconfiguration of the deployment, and the caller-facing behaviour of the
  missing-variable case is already exactly right.
- **The caller is told nothing specific.** The generic Hebrew message is
  reused, and a test asserts the response contains neither the password nor the
  name of the rule. `/api/health`'s own comment makes the argument: an endpoint
  that reports credential state tells an anonymous caller where to push.
- **The rules are crude on purpose.** Sixteen characters, eight distinct, and a
  short list of values this repository published. Length is the only property
  that survives every guess about how the value was produced; the distinct
  count exists so a long unvaried string does not pass. `openssl rand -hex 32`
  clears all three with room.
- **Sixteen, not twelve or twenty.** Twelve is inside reach of the arithmetic
  above for a non-random string; twenty starts refusing reasonable passphrases.
  Sixteen is a judgement, not a derivation, and is stated as one.

## Assumptions

- The deployed `MANAGER_ADMIN_PASSWORD` today is unknown to this agent. If it
  is shorter than sixteen characters, the first deploy carrying this commit
  stops manager sign-in until it is replaced. Flagged under Known risks, and it
  is the reason the push sequence matters.

## Completed

- `managerPasswordWeakness()` — exported, returns `"well-known"`,
  `"too-short"`, `"too-few-distinct-characters"` or `null`.
- `ManagerAuthenticationService.isUnconfigured()` consults it on a deployed
  runtime only, through a private `hasUnusablePassword()` that logs the reason.
- Four tests: the generated shape passes, each rule names itself, a deployed
  runtime with a weak password is unconfigured and leaks nothing, and local
  development is untouched.
- `.env.example` and `docs/local-environment.md` say the rule and the command.

## In progress

Nothing.

## Remaining

- Push, **after** confirming the deployed variable satisfies the rule.

## Changed files

- `src/lib/auth/manager-auth-service.ts`
- `src/lib/auth/__tests__/manager-auth-service.test.ts`
- `.env.example`
- `docs/local-environment.md`
- `docs/agent-tasks/active/fix--manager-password-must-be-strong.md` (this file)

## Verification evidence

### Passed

- `npm test` — 860 pass, 0 fail (856 before this branch).
- `npm run typecheck`, `npm run lint` — clean.
- `npm run test:e2e` — 18 passed. This is real coverage rather than incidental:
  `next start` sets `NODE_ENV=production`, so the gate is live for the whole
  suite, and the smoke's own `smoke-run-password` (18 characters, 13 distinct)
  passes it. Had the default been weak, every sign-in in the suite would have
  failed.
- **Over HTTP against a production build on port 3211**, both directions:
  - `MANAGER_ADMIN_PASSWORD=admin123` → `POST /api/auth/login/` answers `503`
    with `reason: "UNCONFIGURED"` and the generic Hebrew message, while the
    server log carries `MANAGER_ADMIN_PASSWORD is unusable on a deployed
    runtime (well-known); … Generate one with 'openssl rand -hex 32'.`
  - the same server with a hex-32 password → `200`, a session issued, and zero
    complaints in the log.
- Falsification: with `hasUnusablePassword()` forced to `false`, exactly one
  test fails — the new one — and the other sixteen pass. So the gate is what
  the new test binds to, and no pre-existing behaviour depended on it.

### Failed

- A first falsification attempt inverted the condition rather than removing the
  gate, which failed three tests and answered the wrong question. Redone as a
  clean removal; the number above is from the second run.

### Blocked or not run

- **The deployed endpoint, and this one matters.** Whether the deployed
  `MANAGER_ADMIN_PASSWORD` satisfies the rule is unknown here — no agent reads
  it. Until the owner confirms or replaces it, the effect of this commit on the
  deployment is unknown, and the failure mode is a manager who cannot sign in.
- `npm run verify:db`, the Python suite, the mutation run: no schema,
  repository, contract or Python file is in this diff.

### Environment

Local. Production build via `next start` on port 3211 with throwaway
credentials invented for the run, and Playwright's own server on 3100.

### Residual risk

- Sixteen characters and eight distinct symbols is a floor, not a proof of
  strength: `Passw0rd-Passw0rd` clears it. What it removes is the class of
  password that falls to the arithmetic in Context — and the operator is told
  to generate rather than choose, in both places they might look.
- The rule reads one variable at sign-in time. A deployment whose variable is
  changed to a weak value while running keeps working until the next cold
  start, because nothing re-reads it. This matches how the other three
  variables already behave.

## Failed approaches

None beyond the falsification noted above.

## Known risks

`Independent review recommended.` — this changes when a deployment will issue a
session at all.

**Sequencing risk, and it is the one to act on.** If the deployed
`MANAGER_ADMIN_PASSWORD` is shorter than sixteen characters, pushing this to
`main` makes Vercel deploy a build that refuses manager sign-in — a
self-inflicted outage of the same shape the rate limiter deliberately avoids by
failing open. The order that avoids it: set the deployed variable to a
generated value first, redeploy, confirm sign-in, then push this branch. The
credential rotation was already due before the pilot, so this is that rotation
happening now rather than an extra step.

## Approval gates

- Changing authentication configuration: approved by the owner on 2026-08-10.
- The deployed variable itself is the owner's hands. No agent here sees, types
  or stores its value.

## Questions requiring an owner decision

- None outstanding. Sixteen characters is a judgement and can be moved with one
  constant if the owner wants a different floor.

## What the rebase added, 2026-08-24

The branch was rebased onto `0ded0bf` and one gap was closed that the August
version did not have. `isUnconfigured()` guards the door a password walks
through; `findAccountById` is the door a *session* walks through, and it
assembles the same account from the same variables with no password to check.
A deployment that received this rule with a weak password already set would have
refused new sign-ins and kept renewing whoever was already in. `defaultAccounts`
now applies the same rule on a deployed runtime, and a test walks both halves.

The gate `lint:audit-count` also learned that a Russian verb agrees with its
number: the summary now reads "**0** открыты целиком", and the singular-only
patterns would have failed on the day the last open finding closed.

## Verification that actually ran, 2026-08-24

- `npm run verify:core` — exit 0. 1622 unit and API tests, plus every lint and
  fitness gate and the production build. `lint:audit-count` reports 50 findings:
  41 closed, 9 closed in part, 0 open.
- `npm run test:e2e` — 26 passed, 1 failed, and **the failure is not this
  change**. `administrator-console.spec.ts:68` ("a platform larger than a
  screenful arrives one page at a time") fails against a freshly reset local
  database, and it fails the same way on `0ded0bf` with no part of this branch
  applied: checked out detached, rebuilt, re-run. Against a database that
  already holds other specs' schools it passes on both. It runs on the tenant
  server, whose directory is the database because a provider is configured, so
  no password path is involved at all.
- Local database: three pending migrations were applied
  (`20260823120000`, `20260823140000`, `20260823160000`) and
  `scripts/seed-local.ts --reset` re-seeded it. `db:clear` was not run.
- The deployed `MANAGER_ADMIN_PASSWORD` was **not** read or measured. It is not
  in `.env` or `.env.deployed.local`, and the dashboard value is the owner's to
  open.

## Next concrete step

**Read `MANAGER_ADMIN_PASSWORD` in the Vercel dashboard for the Preview scope
before pushing, and rotate it if it is under sixteen characters.** This change
fails closed: a Preview deployment whose password does not clear the floor
answers `503 UNCONFIGURED` on every manager sign-in until the value is replaced
with `openssl rand -hex 32`. Production is unaffected either way — its four
`OIDC_*` variables mean `authenticateCredentials` returns `PROVIDER_REQUIRED`
before it ever reaches the strength check. The value is not on this machine:
neither `.env` nor `.env.deployed.local` carries the variable, so this is the
owner's read, not an agent's.

Then push `fix/manager-password-must-be-strong` to `main` and move this file to
`docs/agent-tasks/archive/`.
