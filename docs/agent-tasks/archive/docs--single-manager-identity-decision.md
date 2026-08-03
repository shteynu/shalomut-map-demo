# One manager per deployment: recording the identity decision

## Metadata

- Branch: `docs/single-manager-identity-decision`
- Base branch: `refactor/openapi-single-source` (itself based on `main` @ `baf229b`)
- Base commit: `ae19d0f`
- Final commits: `3939555` (the decision), `d588b97` (handoff correction) and
  the archive commit on top of them
- Status: complete, merged and archived. Reached `main` on 2026-08-03.
- Last updated: 2026-08-03
- Last agent/tool: Claude Opus 5 (Claude Code)

## Objective

Record the owner's decision that one manager per deployment is the requested
product shape, so the long-term identity model stops being tracked as an open
architecture task and becomes requirement-gated future work.

## User-visible outcome

None. Documentation only; no code, schema or configuration changed.

## Context

- `ROADMAP.md`, `PROGRESS.md`, `docs/shalomut-tracker-handoff.md` and the plan
  review all carried identity as the next architecture slice, phrased as
  "replace SHA-256 with Argon2 or a managed IdP".
- Reading the code first showed the framing was wrong. There is no credential
  store: `src/lib/auth/manager-auth-service.ts:57-76` builds the manager object
  in the module, `:142-162` derives the deployed account from
  `MANAGER_ADMIN_PASSWORD`, and `:101-107` hashes it per login and discards the
  result. Prisma has five models and none is a manager, membership or audit
  table. `MANAGER_ORGANIZATION_ID` (`:48-55`) is the whole of tenant scoping.
- So an Argon2 swap would protect a hash database that does not exist, while
  closing a backlog item — the half-fix C5 of the plan review warned about.
- Presented to the owner as three options: persist identity in Core, delegate
  to an identity provider, or defer and stop calling the current gate identity.

## Scope

Documentation only, as described in `Completed`.

## Non-goals

- No change to `manager-auth-service.ts`, the login route, the session provider
  or any environment variable. The SHA-256 hash stays exactly as it is.
- No new Prisma model and no migration.
- The open rotation of exposed design-stage credentials is untouched by this
  decision and remains its own item.

## Acceptance criteria

All met:

- Every living document that called identity the next architecture slice now
  says it is requirement-gated, and names the trigger.
- The reason an Argon2-only change does not close it is written down once, in
  an ADR, so it is not re-proposed.
- The limits of the current single-account shape are recorded rather than
  implied.

## Relevant repository instructions

- `AGENTS.md` documentation lifecycle: living documents were updated;
  §1 and C5 of the plan review were left as historical analysis. Only §6, the
  living audit, was changed.

## Relevant architecture and contracts

- `PROJECT_CONTEXT.md` ADR-013 is new and owns the decision.
- No contract, capability manifest or API surface is involved.

## Decisions made

- **Owner decision (2026-08-03): one manager, no second-manager requirement.**
  Identity becomes `docs/product-behaviour-backlog.md` §8, a future feature with
  an explicit trigger: a second manager per school, multi-tenant hosting, or
  real respondents — whichever arrives first.
- **The Argon2 swap is recorded as a false target, not deferred work.** Naming
  it only as "later" would let it return as a cheap win that closes the item
  without closing the risk.
- **Identity moved to `ROADMAP.md` "Conditional, not scheduled"** rather than
  being deleted, because that section already holds requirement-gated work.
- **This is a separate branch stacked on `refactor/openapi-single-source`.**
  It is a different deliverable, and both touch `PROGRESS.md` and `ROADMAP.md`
  in adjacent lines; stacking avoids a merge conflict between two branches that
  are both waiting to merge.

## Assumptions

- The owner's "one manager for now" applies to the product requirement, not to
  a temporary deployment constraint. Written into the backlog entry as a
  requirement trigger so a change of mind reopens it explicitly.

## Completed

- `PROJECT_CONTEXT.md`: ADR-013.
- `docs/product-behaviour-backlog.md`: §8 with current state, the decision, the
  proposal for when it is requested, and the limits of today's shape.
- `ROADMAP.md`: identity moved out of "Next architecture outcomes" into
  "Conditional, not scheduled"; mutation testing is now the only numbered item.
- `PROGRESS.md`: identity removed from `Next up → Architecture` with a note
  saying when and why it left.
- `docs/shalomut-tracker-handoff.md`: the "next slice is identity" paragraph
  replaced; the stale repository snapshot line corrected — `main` and
  `origin/main` are both `baf229b`, the merge has been pushed.
- `docs/wellbeing-refactoring-plan-v4-review.md` §6: the stage-5 table row, the
  "Нет" list and the remaining-work paragraph. §1 and C5 left as history.

## In progress

- Nothing.

## Remaining

- Nothing.

## Changed files

Six documentation files in one commit. No code, no tests, no configuration.

## Verification evidence

### Passed

- `git diff --check` — clean, no whitespace errors.
- Internal cross-references resolve: ADR-013 exists in `PROJECT_CONTEXT.md`,
  §8 exists in `docs/product-behaviour-backlog.md`, and every document pointing
  at them uses those exact anchors.
- The code anchors quoted in ADR-013 and §8 were read in this session, not
  carried over from an earlier document.
- `ROADMAP.md` list numbering re-read after editing: one numbered item, no
  duplicate left behind.
- The full gate ran at `d588b97`, the tip of this branch before archiving:
  `npm run verify:core` exit 0 (359 TypeScript tests, both fitness checks,
  typecheck, ESLint, build), `npm run verify:db` exit 0 (7 PostgreSQL tests),
  `npm run verify:ai` exit 0 (368 Python tests). A Markdown diff cannot move
  those numbers; they are recorded because this stack goes to `main`, where
  the same three commands are the CI gate.

### Failed

- None.

### Blocked or not run

- Browser smoke: not run and not applicable; the diff is Markdown only.

### Environment

- local.

### Residual risk

- None to runtime behaviour. The residual risk is documentary: if the owner's
  requirement changes, three documents plus the ADR have to be reopened
  together. The backlog entry is written as the single trigger to reduce that.

## Failed approaches

- None.

## Known risks

- The single-account shape keeps the limits named in ADR-013 for as long as the
  decision holds: the deployment secret is the credential, rotation requires a
  redeploy, and there is no per-user revocation or meaningful sign-in audit.
  Recorded, accepted, not mitigated.

## Approval gates

- None. Nothing in this branch changes secrets, credentials, authentication
  configuration or a deployment alias — it documents the decision not to.

## Questions requiring an owner decision

- None.

## Final state

Archived 2026-08-03. This branch stacked on `refactor/openapi-single-source`,
so its tip `d588b97` carried all four commits and fast-forwarded into `main`
in one push; both branches are published and fully contained in `main`, and
both can be deleted. This archive commit itself sits on top of `d588b97` and
reaches `main` the same way.
