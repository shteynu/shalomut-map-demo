# The deployed database's certificate is verified

## Metadata

- Branch: `fix/the-deployed-database-certificate-is-verified`
- Base branch: `main`
- Base commit: `25858a9`
- Current HEAD: `5309de9` plus the documentation commit that follows it
- Status: code complete, verified against the live deployed database, awaiting
  the owner's push
- Last updated: 2026-08-22
- Last agent/tool: Claude Code (Opus 5)

## Objective

Close the transport medium of the 2026-08-21 audit: every connection to the
deployed database was encrypted without checking who was on the other end.

## User-visible outcome

None. The deployed database answers exactly as before; the difference is that a
machine in the middle can no longer answer for it.

## Context

`resolvePoolConfig` is the one place this project builds a Postgres connection —
the serverless runtime and every administrative script — so the branch was in
force everywhere at once. The audit's own note said the finding came from a
completeness critic and had not been adversarially checked; it was checked here
before anything was changed.

## Scope

- `src/lib/repositories/prisma/supabase-root-ca.ts` (new) — the root, inline,
  with its provenance.
- `src/lib/repositories/prisma/pool-options.ts` — verification, the servername,
  and the `DATABASE_CA_CERT` override.
- Its tests.
- ADR-040, `PROGRESS.md`, the audit file, the handoff, this file.

## Non-goals

- `prisma migrate deploy` on `DIRECT_URL`. See "Blocked or not run".
- Any change to a connection string, a secret, or a deployment variable. None
  was needed; `DATABASE_CA_CERT` is an override that stays unset.

## Acceptance criteria

- No connection string produces an encrypted-but-unverified pool.
- The deployed database still answers.
- A different, real certificate authority cannot stand in for Supabase's.
- The shipped root is the one the deployed chain actually ends at.

## Relevant repository instructions

`AGENTS.md`: bounded approval is required before changing credentials, secrets
or authentication configuration. Nothing here changes any of those — no
connection string, no environment variable, no credential. The certificate is
public information the server hands to every client that connects.

## Relevant architecture and contracts

`PROJECT_CONTEXT.md` ADR-031 (the deployed build applies its own migrations,
which is the path left open here) and the new ADR-040.

## Decisions made

- The root is inline in a TypeScript module rather than a `.crt` file, because
  the runtime is serverless and a file has to survive the build's tracing.
- It replaces the trust store rather than joining it: this connection has one
  known counterparty, and pointing the project at another database should be a
  deliberate act.
- `DATABASE_CA_CERT` overrides the root and cannot switch verification off. A
  value that is not a PEM is ignored, so a typo cannot become an empty trust
  store.
- `servername` is set from the connection string rather than left to `pg` to
  infer, so the hostname check is stated where it can be read and tested.
- An unparseable connection string falls back to verified, not to `false`.

## Assumptions

- Supabase's root does not rotate before 2031. If it does, `DATABASE_CA_CERT`
  is the same-day answer and the file is the permanent one.

## Completed

Everything in scope.

## In progress

Nothing.

## Remaining

Nothing on this branch. The push is the owner's.

## Changed files

- `src/lib/repositories/prisma/supabase-root-ca.ts` (new)
- `src/lib/repositories/prisma/pool-options.ts`
- `src/lib/repositories/prisma/__tests__/pool-options.test.ts`
- `PROJECT_CONTEXT.md`, `PROGRESS.md`, `docs/critical-audit-2026-08-21.md`,
  `docs/shalomut-tracker-handoff.md`, this file

## Verification evidence

### Passed

- **The finding was reproduced first.** A PostgreSQL `SSLRequest` handshake to
  the deployed pooler, from this machine: with the default trust store and
  verification on it fails `SELF_SIGNED_CERT_IN_CHAIN`; with verification off it
  succeeds and reports `authorized=false`, `subject.CN=*.pooler.supabase.com`,
  `issuer.CN=Supabase Intermediate 2021 CA`. So the reason the branch existed
  was true, and it was still not a reason.
- **The root's provenance, from two directions.** Downloaded over verified
  HTTPS; SHA-256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:
  F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`. The chain the pooler itself presents is
  `*.pooler.supabase.com <- Supabase Intermediate 2021 CA <- Supabase Root 2021
  CA`, and that root has the same fingerprint.
- **The live deployed database, through the real `resolvePoolConfig`.** A `pg`
  pool built from it answers `select 1` with `rejectUnauthorized: true` and
  `servername=aws-1-ap-northeast-2.pooler.supabase.com`. The same pool with a
  different real authority substituted is refused with
  `SELF_SIGNED_CERT_IN_CHAIN` — so the verification verifies rather than merely
  being switched on.
- Hostname checking was confirmed separately: the same handshake with
  `servername: 'wrong.example.com'` fails `ERR_TLS_CERT_ALTNAME_INVALID`.
- `npm run verify:core`, unpiped, `REAL_EXIT=0`. 1435 tests.
- `npm run verify:db`, `REAL_EXIT=0`. 48 tests against the local PostgreSQL,
  which is the loopback branch and must keep speaking no TLS at all.
- Six mutations, each caught:
  1. verification off again → 3 failures
  2. no servername pinned → 1 failure
  3. a lookalike host counts as loopback → 1 failure
  4. any `DATABASE_CA_CERT` value is accepted → 1 failure
  5. an unparseable string turns TLS off → 1 failure
  6. a different real CA is shipped → 1 failure
  The tree was restored from a scratchpad copy after each; the suite is green
  again (10/10).

### Failed

None.

### Blocked or not run

- **`prisma migrate deploy` on `DIRECT_URL`.** It connects through Prisma's own
  engine rather than through this pool and still does not verify, with the same
  credentials. `prisma migrate status` against that URL returns `P1001` from
  this machine both as configured and with `sslmode=verify-full` added, so the
  session-mode port is simply not reachable from here and the change could not
  be exercised even once. An unverified change there fails the whole Vercel
  build rather than one request, so it is named in ADR-040 and in the audit
  rather than shipped blind.

### Environment

Local, plus read-only network access to the deployed database. Two probe
scripts were written at the repository root, run, and deleted. Nothing was
written to the deployed database — the only statement issued was `select 1`.

### Residual risk

If the shipped root were wrong, the deployed application would fail to reach its
database on the first request after the deploy. It is not wrong: it was checked
against the live chain and used to make a real query, and a test pins its
fingerprint and asserts it has not expired.

## Failed approaches

- `https://supabase.com/downloads/prod-ca-2021.crt`, the URL that used to serve
  the root, now answers `404` with an HTML page. The file came from
  `supabase-downloads.s3-ap-southeast-1.amazonaws.com` instead, which is why
  the cross-check against the live chain is part of the provenance rather than
  a nicety.

## Known risks

Replacing the trust store means a future move to a database with a
publicly-trusted certificate needs `DATABASE_CA_CERT` set, or this file
changed. That is deliberate, and ADR-040 says so.

## Approval gates

The push. `git push` is an owner action here.

## Questions requiring an owner decision

- **The migration path.** Closing it means `sslmode=verify-full` plus a
  `sslrootcert` file written during the Vercel build. It has to be tried on a
  real deploy, because it cannot be tried anywhere else.
- Standing: rotate `GEMINI_API_KEY` before any paid round; the server-issued
  attempt token from the previous slice; pagination and server-side search in
  the administration console.
