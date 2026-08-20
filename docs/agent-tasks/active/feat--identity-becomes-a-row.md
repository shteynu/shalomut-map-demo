# Phase 1 — identity becomes a row

## Metadata

- Branch: `feat/identity-becomes-a-row`
- Base branch: `main`
- Base commit: `6a19916`
- Current HEAD: `6a19916` (no commits yet)
- Status: in progress
- Last updated: 2026-08-20
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Phase 1 of [`docs/multi-tenancy-plan-2026-08-20.md`](../../multi-tenancy-plan-2026-08-20.md):
managers stop being three constants built from environment variables and become
rows, a platform administrator becomes a flag on one of those rows, and sign-in
moves to the identity provider the owner chose on 2026-08-20.

## User-visible outcome

A deployed runtime with an OIDC client configured signs in through Google
instead of with an e-mail and a password. Until that client exists, the login
screen is what it is today.

## Context

Phase 0 made the tenant boundary a membership. Every membership is still
manufactured per login from `MANAGER_ORGANIZATION_ID`, so there is exactly one
of them and nobody can be invited. This phase puts the manager, the membership
and the administrator flag in the database and makes the session read them.

## Scope

- `Manager` and `OrganizationMembership` tables and a migration.
- `PrismaManagerRepository` behind `IManagerRepository`, wired in the
  composition root.
- A platform-administrator flag on `Manager`, carried in the session, and the
  middleware's second branch: an administrator may open any school.
- Sign-in through the identity provider: authorization-code flow, no password.
- Bootstrap of the first administrator from `MANAGER_ADMIN_EMAIL`.
- The three hardcoded accounts become local-only seed data.

## Non-goals

- The `/admin` area and invitations (phase 2).
- The durable audit log (phase 3).
- Short sessions with silent renewal (phase 5).
- School-user restrictions (phase 6).

## Acceptance criteria

- A manager row and its memberships decide what a session carries.
- An address with no manager row cannot sign in, however it authenticated.
- Password sign-in and provider sign-in never both exist in one runtime.
- An administrator may open any school; a school user may not.
- `npm test`, `tsc`, `lint`, `build` pass, and the migration applies.

## Next concrete step

Schema and migration.
