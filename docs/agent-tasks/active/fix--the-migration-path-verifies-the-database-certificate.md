# The build's migration step verifies the database certificate

## Metadata

- Branch: `fix/the-migration-path-verifies-the-database-certificate`
- Base branch: `main`
- Base commit: `9a1d5f8`
- Current HEAD: see `git log -1`
- Status: implemented, verified against the deployed database in a Linux
  container, waiting on a push
- Last updated: 2026-08-24
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the half of the 2026-08-21 transport finding that ADR-040 left open:
`prisma migrate deploy`, which the Vercel build runs before it builds, connected
to the deployed database with the same credentials as the runtime and verified
nothing.

## User-visible outcome

None. A build that reaches the right database behaves exactly as before; a build
whose database is answered by somebody else now fails instead of migrating.

## Context

ADR-040 closed the runtime pool on 2026-08-22 and named this as the remainder.
It was left open for a good reason, recorded at the time: the session-mode port
`5432` was unreachable from the environment the change was made in (`P1001`), so
the fix could not be run even once, and an unverified change here fails the whole
build rather than one request.

That reason has expired. The port answers from this machine now, which is what
made the work possible today rather than a second exercise in reasoning about it.

## Scope

- `scripts/deploy-migrate.mjs`: the certificate, the two connection-string
  parameters, the trust store handed to the child, and a refusal on a platform
  that cannot enforce any of it.
- `scripts/deploy-migrate.test.mjs`: six new tests.
- `PROJECT_CONTEXT.md` ADR-040, `docs/critical-audit-2026-08-21.md`,
  `PROGRESS.md`, `docs/shalomut-tracker-handoff.md`.

## Non-goals

- The runtime pool. It has verified since `5309de9` and is untouched.
- `npm run db:migrate:deploy`. It stays the unverified path for a developer's
  own database, which is a loopback container speaking no TLS at all.

## Decisions made

**None of Prisma's TLS connection-string parameters do what they look like they
do.** Measured on macOS and on Linux, each with the correct certificate, with a
decoy, and with a path that does not exist:

| What was tried | Outcome |
| --- | --- |
| `sslrootcert=<path>` | no effect — identical with a correct, wrong or absent file |
| `sslcert=<path>` | no effect (absolute); "cert file not found" (relative) |
| `sslmode=verify-full` | **silently ignored**: connects against a decoy authority |
| `sslmode=require&sslaccept=strict` | verification on, against the platform trust store only |
| the same plus `SSL_CERT_FILE` | **verifies against the pinned root** |

`verify-full` is the trap worth naming: the connector accepts only `prefer`,
`disable` and `require`, so an unrecognised value falls back to `prefer` and the
connection is *less* verified than the string claims. It is what Supabase's own
documentation suggests for Prisma, and it would have shipped as a placebo that
read like a fix.

**So the trust store is replaced rather than added to**, for the one spawned
process, the same reasoning ADR-040 already made about the pool: this connection
has exactly one known counterparty. `DATABASE_CA_CERT` replaces the pinned root
and cannot switch verification off.

**On a platform that cannot enforce it, the step refuses to migrate.**
`SSL_CERT_FILE` is an OpenSSL variable; macOS goes through Security.framework
and ignores it. A build runs on Linux and this script runs only in a build, so
the refusal is a statement about what the script can promise rather than a step
anyone has to work around.

**The certificate is read out of the module that owns it** rather than copied.
`scripts/deploy-migrate.mjs` is plain ESM run by `node` during a build with no
TypeScript loader in front of it, so it extracts the PEM from
`supabase-root-ca.ts` by pattern and refuses on anything but exactly one match.
A test asserts the extracted bytes are the exported constant.

## Completed

Everything in Scope.

## Remaining

Nothing on this branch. The first production build after it lands is the first
one to run the new step.

## Verification evidence

### Passed

- `npm run verify:core` — exit 0.
- `npx tsx --test scripts/deploy-migrate.test.mjs` — 12 tests, 12 pass.
- **Against the deployed database, in a Linux container** (`node:22-bookworm-slim`,
  the repository's own `scripts/deploy-migrate.mjs`, `VERCEL_ENV=production`,
  the real `DIRECT_URL`), three directions:
  - pinned root → `No pending migrations to apply.`
  - decoy root in `DATABASE_CA_CERT` → `P1011 … certificate verify failed`
  - certificate removed from its source file → refused before any connection,
    naming the file and the count it found.
- The negative control that proves the finding was real: the same connection
  with today's parameters (`sslmode=require`, no `sslaccept`) connects to the
  deployed database with a decoy authority configured, and reports the schema up
  to date.

### Blocked or not run

- Verification on macOS is impossible by construction, and the script now says
  so instead of failing with `P1011`. Confirmed by running it: with the correct
  root in `SSL_CERT_FILE`, macOS still answers "The certificate was not
  trusted".
- The Vercel build itself has not run this. It cannot, until the branch lands.

### Environment

- Local Postgres on `5433`; three pending migrations were applied
  (`20260823120000`, `20260823140000`, `20260823160000`) and the database was
  re-seeded earlier in the session.
- The deployed database was read, never written: `prisma migrate status`
  throughout, and the one `migrate deploy` had nothing to apply.

## Known risks

**The first production build is the first real run.** Everything above was
proven in a container that matches the build's platform and reaches the same
database, but not in Vercel's own image. If that build fails, the failure is
this step, the symptom is `P1011` before the build starts, and
`npm run db:migrate:deploy` is the manual path while it is diagnosed.

## Approval gates

None. This changes no credential, no secret and no deployment alias; it changes
what a connection is willing to accept.

## Next concrete step

Push `fix/the-migration-path-verifies-the-database-certificate` to `main`, watch
the production build that follows, and move this file to
`docs/agent-tasks/archive/`.
