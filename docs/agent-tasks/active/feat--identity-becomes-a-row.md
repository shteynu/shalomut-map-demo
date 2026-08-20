# Phase 1 — identity becomes a row

## Metadata

- Branch: `feat/identity-becomes-a-row`
- Base branch: `main`
- Base commit: `6a19916`
- Current HEAD: `9d229f6` plus the documentation commit on top
- Status: complete and verified, unpushed
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Phase 1 of [`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
managers stop being three constants assembled from environment variables and
become rows; a platform administrator becomes a flag on one of those rows; and
sign-in moves to the identity provider the owner chose on 2026-08-20.

## User-visible outcome

A runtime with an OAuth client signs in with the organizational account and has
no password field at all. A school user lands in their own school; a platform
administrator lands in none and may open any. A deployment without an OAuth
client keeps today's password screen unchanged.

## Context

Phase 0 made the tenant boundary a membership, but every membership was still
manufactured per login from `MANAGER_ORGANIZATION_ID`. Nobody could be invited,
nobody could be revoked, and the deployment secret was the credential.

## Scope

Delivered:

- `managers` and `organization_memberships` tables, migration
  `20260820120000_identity_becomes_a_row`, and `PrismaManagerRepository` behind
  the `IManagerRepository` that already existed.
- `Manager.isPlatformAdministrator`, carried into the session and into the token
  as `adm`.
- The middleware's second branch: an administrator may open any school.
- An OpenID Connect authorization-code flow with PKCE
  (`/api/auth/oidc/start`, `/api/auth/oidc/callback`), and a login screen that
  offers whichever door this runtime has.
- `ManagerDirectoryService`: an authenticated address is refused unless it has a
  row, plus the first-administrator bootstrap.

## Non-goals

- The `/admin` area, school creation and invitations (phase 2). Until they
  exist, a school user's membership row is written by hand.
- The durable audit log (phase 3), short sessions (phase 5), school-user
  restrictions (phase 6).

## Acceptance criteria

All met; see the evidence.

## Decisions made

- **Two ways in never exist at once.** Where a provider is configured it is the
  only door and `authenticateCredentials` refuses with `PROVIDER_REQUIRED`;
  where none is, the password form is untouched. This is what lets the deployed
  endpoint keep working until its OAuth client exists and flip the moment the
  four `OIDC_*` variables are set, without leaving a quieter second way in.
- **`authenticateCredentials` was not made repository-backed**, which the plan
  had listed. It is a path being deleted, and reading managers from the database
  there would break the local accounts it exists to serve, which have no rows.
  The refusal above is the stricter version of the same intent. Recorded in the
  plan as not done and why.
- **The bootstrap runs on first sign-in, not first start.** There is no start: a
  cold start that writes to the database is a write nobody asked for on every
  scale-up. The occasion is an address the provider has just verified. It
  creates nobody but `MANAGER_ADMIN_EMAIL`, grants no school, and stops existing
  once an administrator does — including when the variable later names somebody
  else, which must not mint a second administrator behind the first one's back.
- **The identity token's signature is not verified**, and the comment above the
  function says why at length: it was fetched by this server from the token
  endpoint over TLS with the client secret, which is the case OIDC Core §3.1.3.7
  exempts. Issuer, audience, expiry, nonce and `email_verified` are all checked,
  because the transport cannot say any of them. A JWKS verifier is what a
  different flow would need, and the comment names the day it starts applying.
- **The provider is named by its issuer and discovered**, not hardcoded to
  Google's two URLs, which would have made `OIDC_ISSUER` decorative until the
  first non-Google school found out at sign-in time.
- **A session may name no school** (`activeOrganizationId: string | null`). An
  administrator belongs to none; `createSession` refuses a school user with no
  school, so the null is an administrator's and nobody else's.
- **An administrator's scope header says `*`, not a list of schools.** Enumerating
  every school into the token would make the number of schools change what a
  session carries, which is the one thing the model was chosen to avoid.
- **The rate limit moved rather than went.** It guards the code exchange, which
  reaches the provider and the database once per call.
- **`crypto.randomUUID()` for the bootstrap row's id**, matching the `@default(uuid())`
  the schema uses everywhere else.

## Assumptions

- The provider returns a verified address for the person at the browser. Google
  Workspace does; `email_verified: false` is refused explicitly.
- A manager's name is not resynchronised from the provider on later sign-ins.
  It is written once, at bootstrap, and phase 2 owns the invitation that sets it
  for everybody else. A write per sign-in for a display name is not worth it.

## Completed

- `d4dfe2c` — the schema, the migration, the repository, the composition-root
  wiring, the administrator flag through the session and the token.
- `9d229f6` — the identity provider, the two routes, the directory service, the
  login screen's two doors, the middleware's administrator branch.
- The documentation commit on top: ADR-025 and the supersession of ADR-013,
  ADR-020's amended rule, the identity provider as a subprocessor, `.env.example`,
  `docs/local-environment.md`, `PROGRESS.md`, backlog §8, the plan and the
  operational handoff.

## Remaining

Nothing on this branch. Three owner actions follow, in order: push; apply the
migration to the deployed database; create the Google OAuth client and set the
four `OIDC_*` variables.

## Changed files

Schema and data: `prisma/schema.prisma`, `prisma/migrations/20260820120000_identity_becomes_a_row/`,
`src/lib/repositories/prisma/prisma-manager.repository.ts`, `src/lib/repositories/index.ts`,
`src/lib/repositories/prisma/prisma-client.ts`, `src/lib/composition-root.ts`.

Identity: `src/lib/auth/types.ts`, `src/lib/auth/domain-contract.ts`,
`src/lib/auth/jwt-session-provider.ts`, `src/lib/auth/manager-auth-service.ts`,
`src/lib/auth/manager-audit-service.ts`, `src/lib/auth/membership-service.ts`,
`src/lib/auth/identity-provider.ts`, `src/lib/auth/manager-directory-service.ts`,
`src/lib/server/oidc-handshake.ts`, `src/lib/server/manager-audit.ts`.

Boundary and routes: `src/middleware.ts`, `src/lib/server/manager-scope.ts`,
`src/app/api/auth/oidc/start/route.ts`, `src/app/api/auth/oidc/callback/route.ts`,
`src/app/api/auth/login/route.ts`, `src/app/api/auth/me/route.ts`,
`src/app/login/page.tsx`, `src/app/login/login-form.tsx`.

Tests: `src/lib/repositories/__tests__/prisma-manager.repository.test.ts`,
`src/lib/auth/__tests__/identity-provider.test.ts`,
`src/lib/auth/__tests__/manager-directory-service.test.ts`,
`src/app/api/auth/oidc/__tests__/oidc-sign-in.test.ts`, and additions to
`jwt-session-provider.test.ts` and `middleware-school-scope.test.ts`.

## Verification evidence

### Passed

Local:

- `npm test` — 1278 passed, 0 failed (1231 before this branch). The new suites:
  6 repository tests, 15 identity-provider tests, 9 directory tests, 11 sign-in
  route tests, 4 middleware administrator tests, 2 token-claim tests.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run lint:composition`,
  `npm run lint:doc-numbers`, `npm run openapi:check`,
  `npm run docs:endpoints:check` — all clean. The auth routes are outside the
  machine-authenticated endpoint surface, which is why the last two are unchanged.
- `npm run db:migrate:deploy` applied the migration to the local database.
- **Real-runtime walk**, `next start` on port 3212 against the local database,
  with a stand-in OpenID Connect provider on port 4455 implementing discovery,
  authorize and token. The stand-in exists because the Google client does not
  yet; every line of product code on the path is the real one.
  - An address the provider verified and nobody invited:
    `/login?error=not_invited`, no session cookie. Screenshot taken.
  - `MANAGER_ADMIN_EMAIL` signing in: the bootstrap created one `managers` row
    with `is_platform_administrator = true`, `/api/auth/me` reported
    `activeOrganizationId: null`, `role: admin`,
    `isPlatformAdministrator: true`. After three sign-ins as that address the
    database held `{managers: 2, administrators: 1, memberships: 1}` — created
    once, not once per sign-in.
  - That administrator opened **both** schools by `?school=`, neither of which
    they are a member of: `34d05e66-…` answered `סבב פילוח נעול` and
    `local-dev-organization` answered `סבב בדיקה מקומי`. The setup switcher
    listed both.
  - A school user seeded into the database with one active membership signed in,
    landed in `local-dev-organization`, was refused `?school=34d05e66-…` (it
    answered with their own school's round), and saw no switcher at all.
  - The login screen with no provider configured (port 3211) still renders the
    e-mail and password form, unchanged.

### Failed

None.

### Blocked or not run

- **A real Google sign-in.** No OAuth client exists; creating one is the owner's
  and is authentication configuration. What a real provider would change against
  the stand-in is the discovery document's contents and the token's signature —
  and the signature is not verified, by the documented decision above, so the
  remaining risk is configuration rather than code.
- **The deployed runtime.** Nothing was deployed and the migration was not
  applied there. The deployed endpoint is unaffected until it is: with no
  `OIDC_*` set it keeps the password door.
- **Submitting the interim password through the browser.** Not done. The
  password path is covered by `auth-routes.test.ts`, which passes, and the walk
  confirmed only that its screen still renders.
- `npm run verify:core` end to end; the checks in it that this diff can affect
  were each run and are listed above.

### Environment

Local. `next start` on ports 3211 and 3212 with throwaway secrets from
`.claude/launch.json`, against the local Docker database. The stand-in provider
is a scratchpad script and is not in the repository.

### Residual risk

- **The `PROVIDER_REQUIRED` rule is the whole of the "one door" guarantee.** It
  lives in one branch at the top of `authenticateCredentials`. A future route
  that authenticates some other way would not inherit it.
- **The handshake cookie is not signed.** It carries the state, nonce and PKCE
  verifier for one sign-in, and it is compared against what comes back rather
  than trusted, so forging it buys an attacker a sign-in as themselves. `next`
  is sanitised through `resolveLoginRedirect`.
- **Discovery is cached per process and never invalidated.** A provider that
  moves its token endpoint would be followed only after a redeploy.
- **A school user with several active memberships lands in whichever came back
  first.** The product gives them one; the code does not enforce that, and the
  order is `createdAt` ascending.

## Known risks

An administrator can read any school's results and nothing durable records that
they did. This is the decision the owner took on 2026-08-20 with its consequence
named, and phase 3 — the durable audit log — is the answer to it. It is now the
most urgent phase for that reason.

## Approval gates

- **Creating the Google OAuth client and setting the four `OIDC_*` variables** is
  authentication configuration and therefore the owner's. Recorded in the
  operational handoff.
- The `MANAGER_ADMIN_PASSWORD` rotation gate changes meaning once the provider is
  on; the handoff entry now says how.

## Questions requiring an owner decision

Which e-mail provider, which phase 2 needs for invitations. Nothing on this
branch waits on it.

## Next concrete step

Push `feat/identity-becomes-a-row`, apply
`20260820120000_identity_becomes_a_row` to the deployed database, and create the
Google OAuth client. Then phase 2: the administrator area, school creation and
invitations — without it, only the operator's own address can ever be given a
school.
